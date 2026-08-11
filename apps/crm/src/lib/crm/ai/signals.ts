/**
 * Deterministic record signals — the only source of truth for briefing
 * recommendations. LLM may rephrase/rank; it must not invent signals.
 */

import { projectLegacyKeys } from '@/lib/crm/legacy-key-projection';
import { bridgeSharingEntityReadPaths } from '@/lib/crm/lead-contact-sharing-fields';
import type {
  BriefingAction,
  BriefingSignal,
  Citation,
  SignalInput,
} from './types';
import { signalPriority, staleTouchDays } from './playbooks';

function isBlank(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (typeof v === 'boolean') return false;
  return false;
}

function truthyFlag(v: unknown): boolean {
  if (v === true || v === 1 || v === '1') return true;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === 'true' || s === 'yes' || s === 'y' || s === 'do not call';
  }
  return false;
}

function preview(v: unknown, max = 48): string {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return (s ?? '').slice(0, max);
}

function daysBetween(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / (24 * 60 * 60 * 1000));
}

function parseIsoDate(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const d = v.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return d;
}

/** Project legacy + health-share keys so signals match what the UI shows. */
export function projectSignalData(
  data: Record<string, unknown>,
  moduleKey: string | null | undefined,
): Record<string, unknown> {
  const base = { ...data };
  bridgeSharingEntityReadPaths(base, moduleKey);
  projectLegacyKeys(base, moduleKey);
  return base;
}

export function computeRecordSignals(input: SignalInput): BriefingSignal[] {
  const now = input.now ?? new Date();
  const moduleKey = input.moduleKey ?? null;
  const data = projectSignalData(input.data ?? {}, moduleKey);
  const signals: BriefingSignal[] = [];
  let citeSeq = 0;
  const cite = (c: Citation): Citation => {
    citeSeq += 1;
    return { ...c, id: `c${citeSeq}` };
  };

  const phone =
    input.phone ||
    (typeof data.phone === 'string' ? data.phone : null) ||
    (typeof data.mobile === 'string' ? data.mobile : null);
  const email =
    input.email || (typeof data.email === 'string' ? data.email : null);

  if (isBlank(phone)) {
    const evidence = [
      cite({ id: '', kind: 'field', key: 'phone', valuePreview: '(empty)' }),
    ];
    signals.push({
      code: 'MISSING_PHONE',
      severity: 'warn',
      label: 'No phone on file',
      evidence,
    });
  }

  if (isBlank(email)) {
    signals.push({
      code: 'MISSING_EMAIL',
      severity: 'warn',
      label: 'No email on file',
      evidence: [
        cite({ id: '', kind: 'field', key: 'email', valuePreview: '(empty)' }),
      ],
    });
  }

  const dnc = truthyFlag(data.do_not_call) || truthyFlag(data.dnc);
  if (dnc) {
    signals.push({
      code: 'DNC',
      severity: 'blocker',
      label: 'Do not call',
      evidence: [
        cite({
          id: '',
          kind: 'field',
          key: 'do_not_call',
          valuePreview: preview(data.do_not_call ?? data.dnc ?? true),
        }),
      ],
    });
  }

  const touchAt = input.lastInteractionAt || input.updatedAt || null;
  const touchDays = daysBetween(touchAt, now);
  const staleLimit = staleTouchDays(moduleKey);
  if (touchDays != null && touchDays >= staleLimit) {
    signals.push({
      code: 'STALE_TOUCH',
      severity: touchDays >= staleLimit * 2 ? 'warn' : 'info',
      label: `No touch in ${touchDays} days`,
      evidence: [
        cite({
          id: '',
          kind: 'insight',
          key: input.lastInteractionAt ? 'lastInteractionAt' : 'updated_at',
          valuePreview: touchAt ?? '',
        }),
      ],
    });
  }

  const overdue = input.overdueTaskCount ?? 0;
  const open = input.openTaskCount ?? 0;
  if (overdue > 0) {
    signals.push({
      code: 'OPEN_OVERDUE_TASK',
      severity: 'warn',
      label: `${overdue} overdue task${overdue === 1 ? '' : 's'}`,
      evidence: [
        cite({
          id: '',
          kind: 'insight',
          key: 'open_activities',
          valuePreview: String(overdue),
        }),
      ],
    });
  } else if (open > 0) {
    signals.push({
      code: 'OPEN_TASKS',
      severity: 'info',
      label: `${open} open task${open === 1 ? '' : 's'}`,
      evidence: [
        cite({
          id: '',
          kind: 'insight',
          key: 'open_activities',
          valuePreview: String(open),
        }),
      ],
    });
  }

  const person = ['leads', 'contacts', 'members'].includes(
    (moduleKey ?? '').toLowerCase(),
  );
  if (person) {
    const entity =
      data.sharing_entity || data.carrier || data.health_insurance_carrier;
    const memberId = data.sharing_member_id || data.member_number || data.e123_member_id;
    const product = data.product || data.plan_name;
    const missingBits: string[] = [];
    if (isBlank(entity)) missingBits.push('carrier/ministry');
    if (
      (moduleKey ?? '').toLowerCase() === 'members' &&
      isBlank(memberId)
    ) {
      missingBits.push('member id');
    }
    if (
      (moduleKey ?? '').toLowerCase() !== 'leads' &&
      isBlank(product) &&
      isBlank(entity)
    ) {
      missingBits.push('plan');
    }
    if (missingBits.length > 0 && (moduleKey ?? '').toLowerCase() !== 'leads') {
      signals.push({
        code: 'MISSING_COVERAGE',
        severity: 'warn',
        label: `Coverage incomplete (${missingBits.join(', ')})`,
        evidence: [
          cite({
            id: '',
            kind: 'field',
            key: 'sharing_entity',
            valuePreview: preview(entity ?? '(empty)'),
          }),
        ],
      });
    } else if (
      (moduleKey ?? '').toLowerCase() === 'leads' &&
      isBlank(entity) &&
      isBlank(product)
    ) {
      // Leads: softer coverage nudge only when both empty
      signals.push({
        code: 'MISSING_COVERAGE',
        severity: 'info',
        label: 'No coverage interest captured',
        evidence: [
          cite({
            id: '',
            kind: 'field',
            key: 'sharing_entity',
            valuePreview: '(empty)',
          }),
        ],
      });
    }
  }

  const statusChanged =
    typeof data.status_changed_at === 'string'
      ? data.status_changed_at
      : typeof data.stage_updated_at === 'string'
        ? data.stage_updated_at
        : input.updatedAt;
  const stageDays = daysBetween(statusChanged, now);
  if (
    stageDays != null &&
    stageDays >= 21 &&
    (input.stage || input.status) &&
    (moduleKey ?? '').toLowerCase() === 'leads'
  ) {
    signals.push({
      code: 'STAGE_STALE',
      severity: 'info',
      label: `Stage unchanged ${stageDays} days`,
      evidence: [
        cite({
          id: '',
          kind: 'field',
          key: 'stage',
          valuePreview: preview(input.stage || input.status || ''),
        }),
      ],
    });
  }

  if ((moduleKey ?? '').toLowerCase() === 'members') {
    const cancel = parseIsoDate(data.cancellation_date || data.sharing_end_date);
    const effective = parseIsoDate(
      data.sharing_effective_date || data.start_date || data.effective_date,
    );
    for (const [key, iso, label] of [
      ['cancellation_date', cancel, 'Cancellation'] as const,
      ['sharing_effective_date', effective, 'Effective date'] as const,
    ]) {
      if (!iso) continue;
      const days = Math.floor(
        (Date.parse(iso) - now.getTime()) / (24 * 60 * 60 * 1000),
      );
      if (days >= -7 && days <= 30) {
        signals.push({
          code: 'MEMBER_DATE_NEAR',
          severity: days < 0 ? 'info' : 'warn',
          label:
            days < 0
              ? `${label} ${Math.abs(days)}d ago`
              : `${label} in ${days}d`,
          evidence: [
            cite({ id: '', kind: 'field', key, valuePreview: iso }),
          ],
        });
        break;
      }
    }
  }

  return signals.sort(
    (a, b) => signalPriority(a.code, moduleKey) - signalPriority(b.code, moduleKey),
  );
}

/** Rules-only recommendations derived from signals (no LLM). */
export function rankRulesRecommendations(
  signals: BriefingSignal[],
  input: Pick<SignalInput, 'moduleKey' | 'email' | 'phone' | 'data'>,
): BriefingAction[] {
  const actions: BriefingAction[] = [];
  const has = (code: string) => signals.find((s) => s.code === code);
  const ids = (s: BriefingSignal) => s.evidence.map((e) => e.id);

  const dnc = has('DNC');
  const missingPhone = has('MISSING_PHONE');
  const missingEmail = has('MISSING_EMAIL');
  const stale = has('STALE_TOUCH');
  const overdue = has('OPEN_OVERDUE_TASK');
  const coverage = has('MISSING_COVERAGE');
  const memberDate = has('MEMBER_DATE_NEAR');
  const stageStale = has('STAGE_STALE');

  if (dnc) {
    actions.push({
      action: 'email',
      title: 'Email instead of calling',
      rationale: 'Do-not-call is set — use email or a task.',
      citationIds: ids(dnc),
      confidence: 'high',
      payload: { emailGoal: 'Respect DNC; follow up by email only.' },
    });
  } else if (stale && !missingPhone) {
    actions.push({
      action: 'call',
      title: 'Call to re-engage',
      rationale: stale.label,
      citationIds: ids(stale),
      confidence: 'high',
    });
  } else if (stale && !missingEmail) {
    actions.push({
      action: 'email',
      title: 'Send a follow-up email',
      rationale: stale.label,
      citationIds: ids(stale),
      confidence: 'high',
      payload: { emailGoal: 'Re-engage after a quiet period.' },
    });
  }

  if (overdue) {
    actions.push({
      action: 'task',
      title: 'Clear overdue work',
      rationale: overdue.label,
      citationIds: ids(overdue),
      confidence: 'high',
    });
  }

  if (memberDate) {
    actions.push({
      action: 'review_coverage',
      title: 'Review upcoming membership date',
      rationale: memberDate.label,
      citationIds: ids(memberDate),
      confidence: 'high',
    });
  }

  if (coverage) {
    actions.push({
      action: 'fill_field',
      title: 'Complete coverage fields',
      rationale: coverage.label,
      citationIds: ids(coverage),
      confidence: 'medium',
      payload: { fieldKey: 'sharing_entity' },
    });
  }

  if (missingPhone && !dnc) {
    actions.push({
      action: 'fill_field',
      title: 'Add a phone number',
      rationale: missingPhone.label,
      citationIds: ids(missingPhone),
      confidence: 'high',
      payload: { fieldKey: 'phone' },
    });
  }

  if (missingEmail) {
    actions.push({
      action: 'fill_field',
      title: 'Add an email',
      rationale: missingEmail.label,
      citationIds: ids(missingEmail),
      confidence: 'high',
      payload: { fieldKey: 'email' },
    });
  }

  if (stageStale && actions.length < 3) {
    actions.push({
      action: 'task',
      title: 'Advance or update stage',
      rationale: stageStale.label,
      citationIds: ids(stageStale),
      confidence: 'medium',
    });
  }

  // Deduplicate by action+title, cap at 3, respect playbook order via signal sort.
  const seen = new Set<string>();
  const out: BriefingAction[] = [];
  for (const a of actions) {
    const key = `${a.action}:${a.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
    if (out.length >= 3) break;
  }
  return out;
}

export function buildRulesSummary(
  signals: BriefingSignal[],
  recommendations: BriefingAction[],
): string {
  if (signals.length === 0) {
    return 'Record looks complete — no urgent follow-up signals.';
  }
  const top = signals.slice(0, 2).map((s) => s.label);
  const next = recommendations[0]?.title;
  if (next) return `${top.join('; ')}. Next: ${next}.`;
  return `${top.join('; ')}.`;
}

/** Lightweight attention score for list chips (0 = clear). */
export function attentionScore(signals: BriefingSignal[]): number {
  let score = 0;
  for (const s of signals) {
    if (s.severity === 'blocker') score += 100;
    else if (s.severity === 'warn') score += 40;
    else score += 10;
  }
  return score;
}

export function topAttentionLabel(signals: BriefingSignal[]): string | null {
  if (signals.length === 0) return null;
  const ranked = [...signals].sort((a, b) => {
    const sev = { blocker: 0, warn: 1, info: 2 } as const;
    return sev[a.severity] - sev[b.severity];
  });
  return ranked[0]?.label ?? null;
}

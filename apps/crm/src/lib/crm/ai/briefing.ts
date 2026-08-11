/**
 * getRecordBriefing — deep module entrypoint.
 * Rules path is always available; LLM only phrases/ranks a closed signal pack.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { loadAiRecordContext, formatAiContextBlock } from '@/lib/crm/ai-context';
import { moduleKeyFromJoinedRelation } from '@/lib/crm/note-aggregate';
import { getRecordInsights } from '@/lib/crm/record-insights';
import {
  buildRulesSummary,
  computeRecordSignals,
  rankRulesRecommendations,
} from './signals';
import { validateRecommendations } from './citations';
import {
  CrmAiBudgetExceededError,
  CrmAiNotConfiguredError,
  invokeCrmAi,
  isAiConfigured,
} from './invoke';
import type {
  BriefingAction,
  BriefingActionKind,
  GetRecordBriefingArgs,
  RecordBriefing,
  SignalInput,
} from './types';

const BRIEFING_SYSTEM = `You rank next actions for a CRM record.
You receive a closed SIGNAL PACK with citation ids. Return JSON only:
{"summary":"≤2 sentences","recommendations":[{"action":"call|email|task|fill_field|review_coverage|none","title":"...","rationale":"...","citationIds":["c1"],"confidence":"high|medium|low","payload":{"fieldKey":"?","emailGoal":"?"}}]}
Rules:
- At most 3 recommendations.
- Every recommendation MUST include citationIds that exist in the pack.
- Never invent phone numbers, emails, dates, premiums, or member IDs.
- Prefer concrete verbs. No markdown.`;

function overdueCount(
  tasks: Array<{ status: string | null; created_at: string }>,
  now: Date,
): { open: number; overdue: number } {
  let open = 0;
  let overdue = 0;
  for (const t of tasks) {
    const status = (t.status ?? '').toLowerCase();
    if (status === 'completed' || status === 'done' || status === 'cancelled') {
      continue;
    }
    open += 1;
    // Heuristic: open tasks older than 7 days count as overdue when no due date.
    const age = Date.parse(t.created_at);
    if (!Number.isNaN(age) && now.getTime() - age > 7 * 24 * 60 * 60 * 1000) {
      overdue += 1;
    }
  }
  return { open, overdue };
}

export async function getRecordBriefing(
  supabase: SupabaseClient,
  args: GetRecordBriefingArgs,
): Promise<RecordBriefing | null> {
  const ctx = await loadAiRecordContext({
    supabase,
    orgId: args.orgId,
    recordId: args.recordId,
  });
  if (!ctx) return null;

  const record = ctx.record;
  const moduleKey =
    moduleKeyFromJoinedRelation(
      (record as { module?: unknown }).module,
    ) ?? null;

  let lastInteractionAt: string | null = null;
  let openFromInsights = 0;
  try {
    const insights = await getRecordInsights(args.recordId);
    lastInteractionAt = insights.lastInteractionAt;
    openFromInsights = insights.counts.open_activities;
  } catch {
    // Insights are optional — signals still work from record fields.
  }

  const now = new Date();
  const { open, overdue } = overdueCount(ctx.recentTasks, now);
  const openTaskCount = Math.max(open, openFromInsights);

  const signalInput: SignalInput = {
    moduleKey,
    title: record.title,
    email: record.email,
    phone: record.phone,
    status: record.status,
    stage: record.stage,
    updatedAt: record.updated_at,
    data: (record.data ?? {}) as Record<string, unknown>,
    openTaskCount,
    overdueTaskCount: overdue,
    lastInteractionAt,
    now,
  };

  const signals = computeRecordSignals(signalInput);
  const rulesRecs = rankRulesRecommendations(signals, signalInput);
  const rulesSummary = buildRulesSummary(signals, rulesRecs);
  const allClear = signals.length === 0;

  const base: RecordBriefing = {
    summary: rulesSummary,
    signals,
    recommendations: rulesRecs,
    mode: 'rules',
    model: null,
    generatedAt: now.toISOString(),
    allClear,
  };

  if (allClear || args.preferLlm === false || !isAiConfigured()) {
    return base;
  }

  try {
    const pack = {
      signals: signals.map((s) => ({
        code: s.code,
        severity: s.severity,
        label: s.label,
        citationIds: s.evidence.map((e) => e.id),
        evidence: s.evidence,
      })),
      rulesRecommendations: rulesRecs,
      context: formatAiContextBlock(ctx).slice(0, 2500),
    };

    const result = await invokeCrmAi({
      purpose: 'record_briefing',
      system: BRIEFING_SYSTEM,
      user: `SIGNAL PACK:\n${JSON.stringify(pack)}\n\nReturn JSON now.`,
      temperature: 0.2,
      maxTokens: 500,
      json: true,
      orgId: args.orgId,
      actorId: args.actorId,
      recordId: args.recordId,
      supabase,
      model: process.env.OPENAI_MODEL_BRIEFING || 'gpt-4o-mini',
    });

    const parsed = parseLlmBriefing(result.text);
    if (!parsed) {
      return { ...base, mode: 'degraded' };
    }

    const validated = validateRecommendations(parsed.recommendations, signals);
    if (!validated) {
      return { ...base, mode: 'degraded', model: result.model };
    }

    return {
      summary: parsed.summary || rulesSummary,
      signals,
      recommendations: validated,
      mode: 'llm',
      model: result.model,
      generatedAt: now.toISOString(),
      allClear: false,
    };
  } catch (err) {
    if (
      err instanceof CrmAiNotConfiguredError ||
      err instanceof CrmAiBudgetExceededError
    ) {
      return {
        ...base,
        mode: err instanceof CrmAiBudgetExceededError ? 'degraded' : 'rules',
      };
    }
    console.error('[getRecordBriefing] llm failed', {
      recordId: args.recordId,
      reason: err instanceof Error ? err.message : 'unknown',
    });
    return { ...base, mode: 'degraded' };
  }
}

const ACTION_KINDS = new Set<BriefingActionKind>([
  'call',
  'email',
  'task',
  'fill_field',
  'review_coverage',
  'none',
]);

function parseLlmBriefing(raw: string): {
  summary: string;
  recommendations: BriefingAction[];
} | null {
  try {
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(cleaned) as {
      summary?: string;
      recommendations?: Array<Record<string, unknown>>;
    };
    const recommendations: BriefingAction[] = [];
    for (const r of parsed.recommendations ?? []) {
      const action = String(r.action ?? '') as BriefingActionKind;
      if (!ACTION_KINDS.has(action)) continue;
      const citationIds = Array.isArray(r.citationIds)
        ? r.citationIds.filter((x): x is string => typeof x === 'string')
        : [];
      recommendations.push({
        action,
        title: String(r.title ?? '').slice(0, 80),
        rationale: String(r.rationale ?? '').slice(0, 200),
        citationIds,
        confidence:
          r.confidence === 'low' || r.confidence === 'medium' ? r.confidence : 'high',
        payload:
          r.payload && typeof r.payload === 'object'
            ? {
                fieldKey:
                  typeof (r.payload as { fieldKey?: string }).fieldKey === 'string'
                    ? (r.payload as { fieldKey?: string }).fieldKey
                    : undefined,
                emailGoal:
                  typeof (r.payload as { emailGoal?: string }).emailGoal === 'string'
                    ? (r.payload as { emailGoal?: string }).emailGoal
                    : undefined,
              }
            : undefined,
      });
    }
    return {
      summary: String(parsed.summary ?? '').slice(0, 280),
      recommendations,
    };
  } catch {
    return null;
  }
}

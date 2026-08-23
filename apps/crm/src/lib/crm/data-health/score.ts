/**
 * Data Health v1 — the rule catalog's identity and THE score formula.
 *
 * This file is the single source of truth for:
 *   - the rule keys, plain-language labels and severity tiers, and
 *   - `computeScore`, the ONE pure function that turns per-rule counts into
 *     the 0–100 Data Health score.
 *
 * Everything else (the sweep engine, the prod audit script
 * `scripts/audit-crm-data-health.mjs`, the Data Health page, the ratchet test)
 * imports from here — nobody re-implements the formula. The committed ratchet
 * baseline (`ratchet.baseline.json`) depends on this formula staying stable:
 * changing weights or adding rules is a FORMULA_VERSION bump plus a deliberate
 * baseline refresh (`npm run data-health:ratchet:update`), never a drive-by.
 *
 * Erasable-syntax TypeScript only (no enums/namespaces): the audit script
 * imports this file directly under Node's native type stripping.
 */

export type RuleSeverity = 'error' | 'warn' | 'info';

export interface RuleDefinition {
  key: string;
  label: string;
  severity: RuleSeverity;
}

export interface RuleResult extends RuleDefinition {
  count: number;
  /** Record ids only (max 20) — never names, phones, emails, or DOBs. */
  sampleIds: string[];
}

/**
 * Bump when the formula or the catalog composition changes meaning.
 *
 * v2 (2026-08-23) — FIELD-CORRECTNESS CORRECTION. The formula, the weights and
 * the 18 keys are unchanged, but SIX rules were reading a column that is not
 * where their concept lives, so their counts did not mean what their labels
 * claimed. A v1 count and a v2 count are NOT comparable and must never be
 * charted as the same series. What changed, and why:
 *
 *   completeness.member-core  995 → 4    `members.effective_date` is vestigial
 *                                        (2 of 997 populated); coverage dates
 *                                        live on `enrollments` (1,098/1,098).
 *   lifecycle.no-owner        425 → 21   ownership is stored per module —
 *                                        leads in data->>'lead_owner',
 *                                        contacts in data->>'contact_owner',
 *                                        plus normalized_advisor_name.
 *   vocabulary.producer       785 → 20   `advisors.full_name` is composite
 *                                        ("Person - Company"); counted in
 *                                        spellings (the fixable unit), not
 *                                        records.
 *   lifecycle.stale-pending     0 → 41   `updated_at` was mass-reset by the
 *                                        August backfill; `stage_updated_at`
 *                                        is the column that survived.
 *   refs.orphan-tasks           3 → 0    `crm_tasks.record_id` is NULLABLE by
 *                                        design — a standalone task is a
 *                                        product feature, not a broken FK.
 *   refs.trash-batch            0 → 2    both sides of the old join are 0%
 *                                        populated; the real gap is a trashed
 *                                        record with no batch receipt at all.
 *
 * plus twins.contact-member (85/128 → 64: compare field FAMILIES, not one
 * slot), dates.impossible (7 → 7, different rows: coverage-before-birth now
 * read from enrollments), completeness.unreachable (66 → 65: `secondary_email`
 * is this book's second-email key, not `email2`), lifecycle.null-status
 * (4 → 5: the sweep now covers every module, as the SQL always did), and
 * label/describe corrections on vocabulary.product and ingest.stuck-imports,
 * whose zeroes were vacuous.
 */
export const FORMULA_VERSION = 2;

/**
 * The deterministic rule catalog, in report order.
 * error = integrity broken · warn = meaning broken · info = workflow smell.
 *
 * A label is a PROMISE about what the count means. If a rule can only see part
 * of its concept (vocabulary.product has no curated list to check against),
 * the label says so rather than letting a 0 read as "all clean".
 */
export const RULE_CATALOG: readonly RuleDefinition[] = [
  { key: 'vocabulary.status', label: 'Records using a retired status word', severity: 'warn' },
  {
    key: 'vocabulary.product',
    label: 'Product names off the dropdown list (no list curated yet)',
    severity: 'warn',
  },
  {
    key: 'vocabulary.producer',
    label: 'Enrolled-by spellings not on the advisor roster',
    severity: 'warn',
  },
  { key: 'refs.orphan-notes', label: 'Notes attached to a missing record', severity: 'error' },
  { key: 'refs.orphan-tasks', label: 'Tasks attached to a missing record', severity: 'error' },
  { key: 'refs.orphan-attachments', label: 'Attachments on a missing record', severity: 'error' },
  {
    key: 'refs.trash-batch',
    label: 'Trashed records with no restorable trash batch',
    severity: 'error',
  },
  { key: 'refs.linked-member', label: 'Contacts linked to a member that does not exist', severity: 'error' },
  { key: 'twins.contact-member', label: 'Member profiles that disagree with their contact', severity: 'warn' },
  { key: 'dates.impossible', label: 'Dates that cannot be right', severity: 'error' },
  { key: 'dates.pending-no-start', label: 'Pending coverage with no start date', severity: 'error' },
  { key: 'dupes.open-pairs', label: 'Possible duplicate pairs awaiting review', severity: 'info' },
  { key: 'lifecycle.no-owner', label: 'Records nobody owns', severity: 'warn' },
  { key: 'lifecycle.stale-pending', label: 'Pending for more than 45 days', severity: 'info' },
  { key: 'lifecycle.null-status', label: 'Records with a blank status', severity: 'warn' },
  {
    key: 'ingest.stuck-imports',
    label: 'Imports stuck mid-run for over two hours',
    severity: 'warn',
  },
  { key: 'completeness.unreachable', label: 'People we could not contact', severity: 'warn' },
  {
    key: 'completeness.member-core',
    label: 'Members with no number and no dated coverage',
    severity: 'warn',
  },
] as const;

/**
 * How the score works, in plain language ("what moves this number"):
 *
 *   - Start at 100.
 *   - Each severity tier owns a fixed budget of points it can ever take away:
 *     errors 60, warns 30, info 10. A perfect book scores 100; a book that is
 *     maximally broken on every rule approaches 0.
 *   - The budget is split evenly across the rules in that tier, so one noisy
 *     rule can never spend another rule's points.
 *   - Within a rule, the penalty saturates: penalty = share × count/(count+25).
 *     The first few bad records move the number the most (25 bad records costs
 *     half the rule's share); thousands of bad records cannot cost more than
 *     the rule's full share. Every single fixed record still nudges the score
 *     up — wins are always visible.
 */
export const TIER_BUDGET: Record<RuleSeverity, number> = {
  error: 60,
  warn: 30,
  info: 10,
};

/** Count at which a rule has spent half its share of the tier budget. */
export const HALF_PENALTY_COUNT = 25;

const TIER_SIZE: Record<RuleSeverity, number> = RULE_CATALOG.reduce(
  (acc, rule) => {
    acc[rule.severity] += 1;
    return acc;
  },
  { error: 0, warn: 0, info: 0 } as Record<RuleSeverity, number>,
);

/**
 * THE score formula. Pure and deterministic: same counts in, same score out.
 * Missing keys count as 0; keys not in the catalog are ignored (forward
 * compatibility while catalog changes ride through a FORMULA_VERSION bump).
 * Returns 0–100, rounded to one decimal.
 */
export function computeScore(counts: Record<string, number>): number {
  let penalty = 0;
  for (const rule of RULE_CATALOG) {
    const raw = counts[rule.key];
    const count = typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 0;
    if (count === 0) continue;
    const share = TIER_BUDGET[rule.severity] / TIER_SIZE[rule.severity];
    penalty += share * (count / (count + HALF_PENALTY_COUNT));
  }
  const score = Math.max(0, Math.min(100, 100 - penalty));
  return Math.round(score * 10) / 10;
}

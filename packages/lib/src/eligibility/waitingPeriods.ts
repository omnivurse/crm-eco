/**
 * Waiting-period computation (BUILD C2)
 * ============================================================================
 *
 * Pure, deterministic helper that turns configured `waiting_period`
 * eligibility rules into concrete "this waiting period elapses on <date>"
 * results, given the requested coverage start.
 *
 * Context / why this exists
 * -------------------------
 * `public.product_eligibility_rules` (FK `plan_id -> plans(id)`) can carry rows
 * with `rule_type = 'waiting_period'`. The sole writer is the admin modal
 * (`apps/admin/src/components/products/ProductEligibilityModal.tsx`,
 * `buildConfig()`), which writes the config shape:
 *
 *     { days: number, type: 'enrollment' | 'effective' }
 *
 *   - `days` = the duration of the waiting period, in whole calendar days.
 *   - `type` = the ANCHOR the clock starts from:
 *       'enrollment' -> count `days` from the enrollment/submission date.
 *       'effective'  -> count `days` from the coverage effective (start) date.
 *
 * These rules are configured but were NEVER computed/enforced anywhere: the
 * inert DB function `public.check_product_eligibility(...)` falls through
 * `waiting_period` to a NULL no-op, and no app code reads the table at enroll
 * time. This helper closes the "computed/enforced nowhere" gap for the
 * duration math; the surrounding evaluator (eligibility.ts) decides advisory
 * vs blocking behaviour behind the `ELIGIBILITY_ENFORCE` flag.
 *
 * Purity contract
 * ---------------
 * This module is 100% pure and deterministic. It NEVER calls `Date.now()` or
 * `new Date()` with no argument. Every anchor date is supplied by the caller
 * (`coverageStart`, and optionally `enrollmentDate`), so the same inputs always
 * yield the same output — making it trivially unit-testable and SSR/edge safe.
 */

import type { Database } from '../types/database';

/**
 * Canonical Row shape for a configured eligibility rule, sourced from the
 * generated DB types so we never drift from the live schema
 * (`packages/lib/src/types/database.ts` -> product_eligibility_rules.Row).
 */
export type ProductEligibilityRule =
  Database['public']['Tables']['product_eligibility_rules']['Row'];

/** The two anchors a waiting period can be measured from. */
export type WaitingPeriodAnchor = 'enrollment' | 'effective';

/**
 * The `config` jsonb shape the admin modal writes for a `waiting_period` rule.
 * `type` is optional/loosely-typed here because `config` is free-form `jsonb`
 * (no DB CHECK constraint); we normalize it defensively at read time.
 */
export interface WaitingPeriodConfig {
  days?: number | string | null;
  type?: WaitingPeriodAnchor | string | null;
}

/**
 * One computed waiting-period result: which rule produced it, a human label,
 * the resolved duration, the anchor it was measured from, and the date on
 * which coverage/sharing becomes eligible (anchor + waitingDays).
 */
export interface WaitingPeriodResult {
  /** `product_eligibility_rules.id` of the source rule. */
  ruleId: string;
  /** `rule_name` of the source rule (display label). */
  label: string;
  /** Resolved, clamped duration in whole days (>= 0). */
  waitingDays: number;
  /** Which date the clock was measured from. */
  anchor: WaitingPeriodAnchor;
  /** The anchor date used, normalized to `YYYY-MM-DD`. */
  anchorDate: string;
  /**
   * Date the waiting period elapses (coverage/sharing eligible), `YYYY-MM-DD`.
   * Equals `anchorDate + waitingDays` days.
   */
  eligibleDate: string;
  /** Whether this rule is configured as blocking (per `is_blocking`). */
  isBlocking: boolean;
  /** Optional admin-authored message (`error_message`), if any. */
  errorMessage: string | null;
}

/** Options for {@link computeWaitingPeriods}. */
export interface ComputeWaitingPeriodsOptions {
  /**
   * Anchor date for `type: 'enrollment'` rules, as a `YYYY-MM-DD` (or any
   * Date-parseable) string. This is the enrollment/submission date and is
   * intentionally a caller-supplied input so the helper stays pure (no
   * `Date.now()`). When omitted, `coverageStart` is used as the enrollment
   * anchor as a safe, deterministic fallback.
   */
  enrollmentDate?: string | null;
}

// ============================================================================
// Internal date utilities (pure)
// ============================================================================

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Parse a date-ish string into a UTC-midnight Date, or null if unparseable.
 * Bare `YYYY-MM-DD` strings are parsed as UTC by the JS engine, so anchoring at
 * UTC midnight keeps day arithmetic free of DST/timezone drift.
 */
function parseUtcDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Format a Date as `YYYY-MM-DD` (UTC). */
function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Add a whole number of days to a UTC-midnight Date (pure). */
function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * MS_PER_DAY);
}

/**
 * Coerce a config value into a non-negative whole number of days. Accepts the
 * number or numeric-string forms the jsonb may hold; invalid/negative -> 0.
 */
function normalizeDays(raw: WaitingPeriodConfig['days']): number {
  const n = typeof raw === 'string' ? parseInt(raw, 10) : raw;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/** Normalize the anchor; anything other than 'effective' defaults to 'enrollment'. */
function normalizeAnchor(raw: WaitingPeriodConfig['type']): WaitingPeriodAnchor {
  return raw === 'effective' ? 'effective' : 'enrollment';
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Compute, for each active `waiting_period` rule, the date its waiting period
 * elapses.
 *
 * Pure & deterministic: all anchor dates come from arguments. Rules that are
 * not `waiting_period`, are inactive, or have an unparseable anchor date are
 * skipped. Results preserve the input rule order (callers typically pass rules
 * already `ORDER BY sort_order`).
 *
 * @param rules        Eligibility rules for the selected plan
 *                     (`product_eligibility_rules` rows; pass the plan's full
 *                     set — non-waiting-period rows are ignored).
 * @param coverageStart Requested coverage effective date (`YYYY-MM-DD`); used
 *                     as the anchor for `type: 'effective'` rules, and as the
 *                     fallback enrollment anchor.
 * @param options      Optional `enrollmentDate` anchor for `type: 'enrollment'`
 *                     rules.
 * @returns One {@link WaitingPeriodResult} per applicable waiting-period rule.
 */
export function computeWaitingPeriods(
  rules: ReadonlyArray<ProductEligibilityRule>,
  coverageStart: string,
  options: ComputeWaitingPeriodsOptions = {}
): WaitingPeriodResult[] {
  const effectiveAnchor = parseUtcDate(coverageStart);
  // Enrollment anchor falls back to coverageStart to stay pure/deterministic.
  const enrollmentAnchor =
    parseUtcDate(options.enrollmentDate) ?? effectiveAnchor;

  const results: WaitingPeriodResult[] = [];

  for (const rule of rules) {
    if (rule.rule_type !== 'waiting_period') continue;
    if (rule.is_active === false) continue;

    const config = (rule.config ?? {}) as WaitingPeriodConfig;
    const anchor = normalizeAnchor(config.type);
    const waitingDays = normalizeDays(config.days);

    const anchorDate = anchor === 'effective' ? effectiveAnchor : enrollmentAnchor;
    // Skip rules whose anchor date can't be resolved (no valid date input).
    if (!anchorDate) continue;

    const eligible = addDays(anchorDate, waitingDays);

    results.push({
      ruleId: rule.id,
      label: rule.rule_name,
      waitingDays,
      anchor,
      anchorDate: toIsoDate(anchorDate),
      eligibleDate: toIsoDate(eligible),
      isBlocking: rule.is_blocking ?? true,
      errorMessage: rule.error_message ?? null,
    });
  }

  return results;
}

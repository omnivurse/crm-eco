/**
 * DB-driven enrollment eligibility evaluator.
 *
 * Activates the previously-INERT `product_eligibility_rules` table (the admin
 * `ProductEligibilityModal` is its only writer; nothing read it at enroll time).
 * This module mirrors the approval-adapter pattern
 * (`apps/portal/src/lib/enroll/approval-adapter.ts`): a thin reader + a pure
 * evaluator that reuses the shared operator vocabulary from `@crm-eco/lib/rules`
 * for operator-based rules (`custom`), and dedicated handlers for the fixed
 * discrete configs (`age`, `state`, `household`, `waiting_period`, `pre_existing`).
 *
 * RESOLVED — PLAN-KEYED: rules are read by `plan_id = selected_plan_id`
 * (`enrollments.selected_plan_id -> plans(id)`). NEVER keyed off product_id.
 *
 * SAFETY: this module only READS and is pure. It NEVER mutates enrollment state
 * and NEVER throws to the caller (read errors degrade to "eligible", like
 * `checkEnrollmentApprovalRequired`). It does NOT decide whether to block — it
 * returns a STRUCTURED result honoring each rule's `is_blocking` flag. The
 * caller (wizard step / submit route) decides warn-vs-block, and any HARD-BLOCK
 * is gated behind ELIGIBILITY_ENFORCE (default OFF).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  evaluateRuleConditionGroup,
  type RuleConditionGroup,
} from '../rules';
// Reuse the dedicated waiting-period date math (BUILD C2) instead of forking a
// second implementation. C2 owns "anchor + days -> eligibleDate"; this module
// only layers the "is it still pending as of `now`" decision on top.
import {
  computeWaitingPeriods as computeWaitingPeriodElapseDates,
  type ProductEligibilityRule,
} from '../eligibility';

// ============================================================================
// Rule vocabulary (mirrors ProductEligibilityModal RULE_TYPES + buildConfig)
// ============================================================================

/** The rule_type values the admin modal writes. `rule_type` is free-form text
 *  in the DB (no CHECK); these are the de-facto vocabulary. */
export type EligibilityRuleType =
  | 'age'
  | 'state'
  | 'household'
  | 'waiting_period'
  | 'pre_existing'
  | 'custom';

/** A row from product_eligibility_rules (subset the evaluator consumes). */
export interface EligibilityRuleRow {
  id: string;
  rule_type: string;
  rule_name: string;
  config: Record<string, unknown> | null;
  is_blocking: boolean | null;
  error_message: string | null;
  sort_order: number | null;
  is_active: boolean | null;
}

// ============================================================================
// Evaluator input + result shapes
// ============================================================================

/**
 * Flat input the evaluator needs, assembled by the caller from the wizard
 * snapshot (ages-from-DOB + state + household + coverage start). Mirrors the
 * fields the rate adapter already derives in buildQuoteInput, so callers reuse
 * the same source of truth.
 */
export interface EligibilityInput {
  /** Whole-year member age as of coverage start. null when DOB missing/invalid. */
  memberAge: number | null;
  /** 2-letter member state (e.g. 'MA'). null/undefined when unknown. */
  state: string | null | undefined;
  /** Total household size = primary + additional members. */
  householdSize: number;
  /** Coverage start / requested effective date (YYYY-MM-DD or ISO). Drives waiting-period anchoring. */
  coverageStart?: string | null;
  /** Flat record map for operator-based (`custom`) rules. Optional. */
  record?: Record<string, unknown>;
}

/** Severity of a finding. 'block' iff the rule's is_blocking is true. */
export type EligibilityFindingSeverity = 'block' | 'warn';

/**
 * One eligibility finding. Shape intentionally parallels the DB function's
 * `failed_rules` object ({ rule_id, rule_name, rule_type, error_message,
 * is_blocking }) plus a derived `severity` + human `message`.
 */
export interface EligibilityFinding {
  rule_id: string;
  rule_name: string;
  rule_type: string;
  error_message: string | null;
  is_blocking: boolean;
  severity: EligibilityFindingSeverity;
  /** Human-readable message: error_message if set, else a generated default. */
  message: string;
  /** Rule-type-specific structured detail (e.g. waiting-period days/eligibleOn). */
  detail?: Record<string, unknown>;
}

/**
 * Structured evaluation result. `isEligible` reflects whether any BLOCKING
 * finding fired (rule-truth, independent of the enforcement flag). The caller
 * decides whether to actually halt based on ELIGIBILITY_ENFORCE.
 */
export interface EligibilityResult {
  /** false iff at least one blocking finding fired. */
  isEligible: boolean;
  /** Findings from rules with is_blocking = true. */
  blocking: EligibilityFinding[];
  /** Findings from rules with is_blocking = false (advisory). */
  advisory: EligibilityFinding[];
  /** All findings (blocking ∪ advisory), in rule sort order. */
  findings: EligibilityFinding[];
}

const EMPTY_RESULT: EligibilityResult = Object.freeze({
  isEligible: true,
  blocking: [],
  advisory: [],
  findings: [],
});

// ============================================================================
// Helpers
// ============================================================================

function asInt(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Days between two dates (b - a), floored. Negative when b is before a. */
function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.floor((b.getTime() - a.getTime()) / MS_PER_DAY);
}

function toYmd(d: Date): string {
  return d.toISOString().split('T')[0];
}

function buildFinding(
  rule: EligibilityRuleRow,
  defaultMessage: string,
  detail?: Record<string, unknown>,
): EligibilityFinding {
  const is_blocking = rule.is_blocking !== false; // default true (matches DB default)
  return {
    rule_id: rule.id,
    rule_name: rule.rule_name,
    rule_type: rule.rule_type,
    error_message: rule.error_message ?? null,
    is_blocking,
    severity: is_blocking ? 'block' : 'warn',
    message: rule.error_message?.trim() || defaultMessage,
    ...(detail ? { detail } : {}),
  };
}

// ============================================================================
// Waiting-period computation (the previously-uncomputed rule type)
// ============================================================================

/**
 * "Pending as of now" view of one waiting-period rule. This is the evaluator's
 * concern (does benefit start in the future?) layered on top of C2's pure
 * "when does it elapse" date math. Internal — NOT re-exported, so the public
 * waiting-period surface stays single-sourced in `../eligibility`
 * (`computeWaitingPeriods` / `WaitingPeriodResult`).
 */
interface WaitingPeriodPending {
  rule_id: string;
  rule_name: string;
  /** Waiting duration in days (config.days). */
  days: number;
  /** Anchor: 'enrollment' (from now) or 'effective' (from coverage start). */
  anchor: 'enrollment' | 'effective';
  /** Date the waiting period elapses (YYYY-MM-DD). */
  eligibleOn: string;
  /** true when eligibleOn is in the future relative to `now`. */
  isPending: boolean;
  /** Days remaining until eligibleOn (0 when already elapsed). */
  daysRemaining: number;
}

/**
 * Resolve the pending state of every `waiting_period` rule, as of `now`. Pure.
 *
 * Delegates the anchor+duration -> elapse-date math to C2's
 * `computeWaitingPeriods` (the single waiting-period implementation), passing
 * `now` as the 'enrollment' anchor so 'enrollment'-typed rules count from the
 * evaluation date and 'effective'-typed rules count from `coverageStart` —
 * matching the evaluator's prior behavior. This module then derives `isPending`
 * / `daysRemaining` relative to `now`.
 */
function resolveWaitingPeriodPending(
  rules: EligibilityRuleRow[],
  input: Pick<EligibilityInput, 'coverageStart'>,
  now: Date,
): WaitingPeriodPending[] {
  const today = new Date(toYmd(now)); // normalize to date-only
  // C2 requires a coverageStart string for its 'effective' anchor + fallback.
  const coverageStart = input.coverageStart || toYmd(today);

  // C2 takes canonical DB Rows; EligibilityRuleRow is the structurally-
  // compatible subset the reader selects, so this widening is safe.
  const elapse = computeWaitingPeriodElapseDates(
    rules as unknown as ProductEligibilityRule[],
    coverageStart,
    { enrollmentDate: toYmd(today) },
  );

  return elapse.map((wp) => {
    const eligibleDate = new Date(wp.eligibleDate);
    const daysRemaining = Math.max(0, daysBetween(today, eligibleDate));
    return {
      rule_id: wp.ruleId,
      rule_name: wp.label,
      days: wp.waitingDays,
      anchor: wp.anchor,
      eligibleOn: wp.eligibleDate,
      isPending: daysRemaining > 0,
      daysRemaining,
    };
  });
}

// ============================================================================
// Pure evaluator
// ============================================================================

/**
 * Evaluate eligibility rules against an input. Pure — no I/O. Returns a
 * structured result; the caller decides warn-vs-block based on the
 * ELIGIBILITY_ENFORCE flag.
 *
 * Handler matrix (config shapes from ProductEligibilityModal.buildConfig):
 *  - age          { min_age, max_age }                     fails if memberAge < min OR > max
 *  - state        { mode: include|exclude, states[] }      include: fail if not in list; exclude: fail if in list
 *  - household    { max_size }                             fails if householdSize > max_size
 *  - waiting_period { days, type }                         fails (pending) if waiting period not yet elapsed
 *  - pre_existing { lookback_months, exclusion_months }    advisory by nature (no member condition data here)
 *  - custom       { key, value } OR a condition group      operator-based via @crm-eco/lib/rules
 *
 * Each fired rule yields a finding whose severity is derived from the rule's
 * is_blocking flag (default true). A rule fires only when its condition fails.
 */
export function evaluateEligibility(
  rules: EligibilityRuleRow[],
  input: EligibilityInput,
  now: Date = new Date(),
): EligibilityResult {
  if (!rules || rules.length === 0) return EMPTY_RESULT;

  // Honor sort_order (rows may arrive unsorted from a permissive caller).
  const ordered = [...rules].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );

  const findings: EligibilityFinding[] = [];

  for (const rule of ordered) {
    if (rule.is_active === false) continue;
    const config = rule.config ?? {};

    switch (rule.rule_type) {
      case 'age': {
        if (input.memberAge == null) break; // can't evaluate without age — skip, don't fail
        const minAge = asInt(config.min_age, 0);
        const maxAge = asInt(config.max_age, 999);
        if (input.memberAge < minAge || input.memberAge > maxAge) {
          findings.push(
            buildFinding(
              rule,
              `Member age ${input.memberAge} is outside the allowed range (${minAge}–${maxAge}).`,
              { memberAge: input.memberAge, minAge, maxAge },
            ),
          );
        }
        break;
      }

      case 'state': {
        const memberState = input.state?.toUpperCase().trim();
        if (!memberState) break; // unknown state — skip
        const mode = config.mode === 'exclude' ? 'exclude' : 'include';
        const states = (Array.isArray(config.states) ? config.states : []).map((s) =>
          String(s).toUpperCase().trim(),
        );
        const inList = states.includes(memberState);
        const fails = mode === 'include' ? !inList : inList;
        if (fails) {
          findings.push(
            buildFinding(
              rule,
              mode === 'include'
                ? `This plan is not available in ${memberState}.`
                : `This plan is not available in ${memberState}.`,
              { state: memberState, mode, states },
            ),
          );
        }
        break;
      }

      case 'household': {
        const maxSize = asInt(config.max_size, 10);
        if (input.householdSize > maxSize) {
          findings.push(
            buildFinding(
              rule,
              `Household size ${input.householdSize} exceeds the maximum of ${maxSize}.`,
              { householdSize: input.householdSize, maxSize },
            ),
          );
        }
        break;
      }

      case 'waiting_period': {
        const [wp] = resolveWaitingPeriodPending([rule], input, now);
        if (wp && wp.isPending) {
          findings.push(
            buildFinding(
              rule,
              `Coverage for this plan is subject to a ${wp.days}-day waiting period; benefits begin ${wp.eligibleOn}.`,
              {
                days: wp.days,
                anchor: wp.anchor,
                eligibleOn: wp.eligibleOn,
                daysRemaining: wp.daysRemaining,
              },
            ),
          );
        }
        break;
      }

      case 'pre_existing': {
        // No structured member-condition data is available at this seam, so a
        // pre-existing rule surfaces as an informational finding (the member
        // must be made aware of the limitation). It never auto-fails on data
        // we don't have; if the rule is marked is_blocking, the caller still
        // only halts when ELIGIBILITY_ENFORCE is on.
        const lookback = asInt(config.lookback_months, 12);
        const exclusion = asInt(config.exclusion_months, 12);
        findings.push(
          buildFinding(
            rule,
            `Pre-existing conditions within the prior ${lookback} months may be subject to a ${exclusion}-month exclusion.`,
            { lookbackMonths: lookback, exclusionMonths: exclusion },
          ),
        );
        break;
      }

      case 'custom':
      default: {
        // Operator-based rules: reuse the SHARED evaluator. Two supported config
        // shapes:
        //  1) a full condition group { logic, conditions[] } -> evaluate directly
        //     (the rule FAILS when the group matches a disqualifying condition).
        //  2) the modal's { key, value } -> equality check against record[key].
        const group = config as unknown as RuleConditionGroup;
        // Require at least one condition: evaluateRuleConditionGroup treats an
        // empty/absent condition list as a vacuous match (returns true), which
        // would otherwise fire a spurious disqualifying finding for a group with
        // no conditions. A rule with no conditions has nothing to disqualify on.
        if (Array.isArray(group.conditions) && group.conditions.length > 0) {
          // Treat a matching group as a failure (disqualifying condition met).
          const matched = evaluateRuleConditionGroup(group, input.record ?? {});
          if (matched) {
            findings.push(
              buildFinding(rule, `This plan has an eligibility restriction that was not met.`),
            );
          }
        } else if (typeof config.key === 'string' && config.key) {
          const actual = input.record?.[config.key];
          // Fail when the configured key/value is present but does not match.
          if (actual !== undefined && actual !== config.value) {
            findings.push(
              buildFinding(
                rule,
                `This plan requires "${config.key}" to be "${String(config.value)}".`,
                { key: config.key, expected: config.value, actual },
              ),
            );
          }
        }
        break;
      }
    }
  }

  const blocking = findings.filter((f) => f.is_blocking);
  const advisory = findings.filter((f) => !f.is_blocking);

  return {
    isEligible: blocking.length === 0,
    blocking,
    advisory,
    findings,
  };
}

// ============================================================================
// Thin reader
// ============================================================================

/**
 * Read active eligibility rules for a plan and evaluate them against the input.
 * Mirrors checkEnrollmentApprovalRequired's contract: never throws — any read
 * error or absent rows degrades to the EMPTY (eligible) result so a gating
 * decision can never harden into a hard failure of the enroll flow.
 *
 * RLS: `product_eligibility_rules` has a "Users can view eligibility rules"
 * SELECT policy (org-scoped via plans.organization_id), so a request-scoped
 * authenticated client can read rules for plans in the member's org. The public
 * submit route passes a service-role client (bypasses RLS), like the approval
 * adapter.
 */
export async function checkEligibility(
  supabase: SupabaseClient,
  selectedPlanId: string | null | undefined,
  input: EligibilityInput,
  now: Date = new Date(),
): Promise<EligibilityResult> {
  if (!selectedPlanId) return EMPTY_RESULT;

  try {
    const { data, error } = await supabase
      .from('product_eligibility_rules')
      .select('id, rule_type, rule_name, config, is_blocking, error_message, sort_order, is_active')
      .eq('plan_id', selectedPlanId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) {
      return EMPTY_RESULT;
    }

    return evaluateEligibility(data as EligibilityRuleRow[], input, now);
  } catch {
    // A read failure must never block enrollment — degrade to eligible.
    return EMPTY_RESULT;
  }
}

/**
 * Enrollment Approval Adapter
 *
 * Bridges the public enrollment wizard to the EXISTING approval rules engine
 * WITHOUT importing CRM server internals. The CRM's `checkApprovalRequired`
 * (apps/crm/src/lib/approvals/rules.ts) is cookie/anon-key scoped and keyed on
 * a CRM `module_id` — neither of which exists in this service-role, module-less
 * public path. So we reuse the part that IS shareable: the single operator
 * vocabulary + pure condition evaluator from the shared rules module, and read
 * the rule rows ourselves.
 *
 * Rules live in `crm_approval_rules` with `trigger_type = 'enrollment_submit'`,
 * scoped by `org_id`. Each rule's `conditions` is the same
 * `{ logic, conditions[] }` group shape the CRM uses, so the SAME evaluator
 * decides a match. We return the first matching rule in priority order, exactly
 * like `checkApprovalRequired`.
 *
 * SAFETY: this module only READS. It never mutates enrollment state. The submit
 * route decides what to do with a match, and only when ENROLLMENT_APPROVAL_ENABLED
 * is on.
 *
 * SHARED: lives in `@crm-eco/lib` so the member portal submit route and the
 * public enrollment software (apps/website) use ONE implementation. Consume via
 * the package's main entry, e.g.:
 *   import { checkEnrollmentApprovalRequired } from '@crm-eco/lib';
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  evaluateRuleConditionGroup,
  type RuleConditionGroup,
} from '../rules';

/** Trigger key for enrollment-submit approval rules in crm_approval_rules. */
export const ENROLLMENT_SUBMIT_TRIGGER = 'enrollment_submit' as const;

/**
 * Flat field map an approval rule condition can reference. Keyed on REAL
 * enrollment fields first (the resolved task: catalog/enrollment gating keys on
 * selected_plan_id, never product_id). Questionnaire answers can be layered in
 * later by extending this shape.
 */
export interface EnrollmentApprovalRecord {
  selected_plan_id: string | null;
  effective_date: string | null;
  state: string | null;
  household_size: number;
  member_age: number | null;
  has_spouse: boolean;
  has_dependents: boolean;
  coverage_tier: string;
  base_monthly_cost: number;
  total_monthly_cost: number | null;
  // Acknowledgment booleans are flattened as ack_<key> so a rule can require a
  // specific acknowledgment to be present/true.
  [ackKey: `ack_${string}`]: boolean;
}

export interface EnrollmentApprovalMatch {
  ruleId: string;
  processId: string;
  ruleName: string;
}

interface EnrollmentApprovalRuleRow {
  id: string;
  process_id: string;
  name: string;
  conditions: RuleConditionGroup;
  priority: number | null;
}

/**
 * Build the recordData map the rule engine evaluates from the inputs the submit
 * route already computed. Pure — no I/O.
 */
export function buildEnrollmentApprovalRecord(input: {
  selectedPlanId: string | null;
  effectiveDate: string | null;
  state: string | null;
  householdSize: number;
  memberAge: number | null;
  hasSpouse: boolean;
  hasDependents: boolean;
  coverageTier: string;
  baseMonthlyCost: number;
  totalMonthlyCost: number | null;
  acknowledgments?: Record<string, boolean>;
}): EnrollmentApprovalRecord {
  const record: EnrollmentApprovalRecord = {
    selected_plan_id: input.selectedPlanId,
    effective_date: input.effectiveDate,
    state: input.state,
    household_size: input.householdSize,
    member_age: input.memberAge,
    has_spouse: input.hasSpouse,
    has_dependents: input.hasDependents,
    coverage_tier: input.coverageTier,
    base_monthly_cost: input.baseMonthlyCost,
    total_monthly_cost: input.totalMonthlyCost,
  };

  for (const [key, value] of Object.entries(input.acknowledgments ?? {})) {
    record[`ack_${key}`] = value === true;
  }

  return record;
}

/**
 * Evaluate enabled enrollment-submit approval rules for an org against a record.
 * Returns the first match in priority order (ascending), or null if none match.
 *
 * Mirrors checkApprovalRequired's contract (first/highest-priority match wins)
 * but reads rows directly via the passed (service-role) client so it works in
 * the public, module-less submit path. Any read error degrades to "no approval
 * required" — this is a gating decision, not the enrollment write itself, and
 * must never harden into a hard failure of a public submit.
 */
export async function checkEnrollmentApprovalRequired(
  supabase: SupabaseClient,
  orgId: string,
  record: EnrollmentApprovalRecord
): Promise<EnrollmentApprovalMatch | null> {
  const { data, error } = await supabase
    .from('crm_approval_rules')
    .select('id, process_id, name, conditions, priority')
    .eq('org_id', orgId)
    .eq('trigger_type', ENROLLMENT_SUBMIT_TRIGGER)
    .eq('is_enabled', true)
    .order('priority', { ascending: true });

  if (error || !data || data.length === 0) {
    return null;
  }

  const rules = data as EnrollmentApprovalRuleRow[];

  for (const rule of rules) {
    if (evaluateRuleConditionGroup(rule.conditions, record as unknown as Record<string, unknown>)) {
      return {
        ruleId: rule.id,
        processId: rule.process_id,
        ruleName: rule.name,
      };
    }
  }

  return null;
}

/**
 * Recalculate membership billing when dependent coverage periods change.
 *
 * Uses currently-covered dependents (via coverage periods) to compute:
 *   subscriber base + sum(per-dependent add-on costs)
 *
 * Persists to memberships.billing_amount, enrollments.base_monthly_cost
 * (which syncs billing_schedules via DB trigger), and active billing_schedules.
 */

import {
  countCurrentlyCoveredDependents,
  isDependentCurrentlyCovered,
} from './dependentCoverage';
import type { DependentCoveragePeriod } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientAny = any;

export interface BillingBreakdownLine {
  label: string;
  amount: number;
}

export interface BillingRecalcResult {
  success: boolean;
  previousAmount: number;
  newAmount: number;
  coveredCount: number;
  breakdown: BillingBreakdownLine[];
  error?: string;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Recompute monthly billing for a member based on who is currently covered.
 */
export async function recalculateMemberBillingFromCoverage(
  supabase: SupabaseClientAny,
  memberId: string,
  organizationId: string,
): Promise<BillingRecalcResult> {
  const empty: BillingRecalcResult = {
    success: false,
    previousAmount: 0,
    newAmount: 0,
    coveredCount: 0,
    breakdown: [],
  };

  const { data: membership, error: membershipError } = await supabase
    .from('memberships')
    .select('id, billing_amount, enrollment_id, plan_id, custom_fields, status')
    .eq('member_id', memberId)
    .eq('organization_id', organizationId)
    .in('status', ['active', 'pending'])
    .order('effective_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return { ...empty, error: membershipError.message };
  }
  if (!membership) {
    return { ...empty, error: 'No active membership found for billing recalculation' };
  }

  const [{ data: dependents }, { data: periods }] = await Promise.all([
    supabase
      .from('dependents')
      .select('id, first_name, last_name, relationship, included_in_enrollment')
      .eq('member_id', memberId)
      .eq('organization_id', organizationId)
      // A removed (soft-deleted) dependent must not be billed — matches the
      // previous hard-delete behavior exactly (billing is driven by this list).
      .is('deleted_at', null),
    supabase
      .from('dependent_coverage_periods')
      .select('dependent_id, effective_from, effective_to')
      .eq('member_id', memberId)
      .eq('organization_id', organizationId),
  ]);

  const dependentList = dependents ?? [];
  const periodList = (periods ?? []) as Pick<
    DependentCoveragePeriod,
    'dependent_id' | 'effective_from' | 'effective_to'
  >[];

  const coveredDependents = dependentList.filter((dep: (typeof dependentList)[number]) =>
    isDependentCurrentlyCovered(dep.id, periodList, dep.included_in_enrollment),
  );
  const coveredCount = countCurrentlyCoveredDependents(dependentList, periodList);

  let enrollmentId: string | null = membership.enrollment_id ?? null;
  let enrollment: { id: string; base_monthly_cost: number | null; selected_plan_id: string | null } | null =
    null;

  if (enrollmentId) {
    const { data } = await supabase
      .from('enrollments')
      .select('id, base_monthly_cost, selected_plan_id')
      .eq('id', enrollmentId)
      .maybeSingle();
    enrollment = data;
  } else {
    const { data } = await supabase
      .from('enrollments')
      .select('id, base_monthly_cost, selected_plan_id')
      .eq('primary_member_id', memberId)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    enrollment = data;
    enrollmentId = data?.id ?? null;
  }

  const planId = membership.plan_id ?? enrollment?.selected_plan_id ?? null;
  const { data: plan } = planId
    ? await supabase.from('plans').select('monthly_share, name').eq('id', planId).maybeSingle()
    : { data: null };

  const custom = asRecord(membership.custom_fields);
  const previousAmount = Number(membership.billing_amount ?? 0);

  let subscriberBase = Number(
    custom.subscriber_base_amount ?? enrollment?.base_monthly_cost ?? plan?.monthly_share ?? previousAmount,
  );
  if (!Number.isFinite(subscriberBase) || subscriberBase < 0) subscriberBase = 0;

  let dependentUnitCost = Number(custom.dependent_unit_cost ?? 0);

  // Live (non-removed) dependent ids — dependentList is already filtered by
  // deleted_at, so this excludes soft-deleted dependents.
  const liveDependentIds = new Set<string>(
    dependentList.map((d: (typeof dependentList)[number]) => d.id),
  );

  const additionalCostByDependent = new Map<string, number>();
  if (enrollmentId) {
    const { data: enrollmentDependents } = await supabase
      .from('enrollment_dependents')
      .select('dependent_id, additional_cost')
      .eq('enrollment_id', enrollmentId);

    const unitCosts: number[] = [];
    for (const row of enrollmentDependents ?? []) {
      // Skip enrollment rows for a removed (soft-deleted) dependent. The old
      // hard-delete cascade-removed these rows, so excluding them keeps the
      // unit-cost average — and thus every dependent's fallback price —
      // identical to the previous behavior.
      if (row.dependent_id && !liveDependentIds.has(row.dependent_id)) continue;
      const cost = Number(row.additional_cost);
      if (Number.isFinite(cost) && cost > 0) {
        unitCosts.push(cost);
        if (row.dependent_id) additionalCostByDependent.set(row.dependent_id, cost);
      }
    }
    if (!dependentUnitCost && unitCosts.length > 0) {
      dependentUnitCost = unitCosts.reduce((sum, c) => sum + c, 0) / unitCosts.length;
    }
  }

  const breakdown: BillingBreakdownLine[] = [
    { label: 'Subscriber base', amount: roundMoney(subscriberBase) },
  ];

  let dependentTotal = 0;
  for (const dep of coveredDependents) {
    const specific = additionalCostByDependent.get(dep.id);
    const depCost =
      specific != null && specific > 0 ? specific : dependentUnitCost > 0 ? dependentUnitCost : 0;

    dependentTotal += depCost;
    breakdown.push({
      label: `${dep.first_name} ${dep.last_name} (${dep.relationship})`,
      amount: roundMoney(depCost),
    });
  }

  const newAmount = roundMoney(subscriberBase + dependentTotal);

  const nextCustomFields = {
    ...custom,
    subscriber_base_amount: subscriberBase,
    ...(dependentUnitCost > 0 ? { dependent_unit_cost: dependentUnitCost } : {}),
    last_billing_recalc_at: new Date().toISOString(),
    last_covered_dependent_count: coveredCount,
    billing_recalc_breakdown: breakdown,
  };

  const { error: membershipUpdateError } = await supabase
    .from('memberships')
    .update({
      billing_amount: newAmount,
      custom_fields: nextCustomFields,
      updated_at: new Date().toISOString(),
    })
    .eq('id', membership.id);

  if (membershipUpdateError) {
    return { ...empty, previousAmount, coveredCount, error: membershipUpdateError.message };
  }

  if (enrollmentId) {
    await supabase
      .from('enrollments')
      .update({ base_monthly_cost: newAmount, updated_at: new Date().toISOString() })
      .eq('id', enrollmentId);
  }

  await supabase
    .from('billing_schedules')
    .update({ amount: newAmount, updated_at: new Date().toISOString() })
    .eq('member_id', memberId)
    .eq('organization_id', organizationId)
    .eq('status', 'active');

  return {
    success: true,
    previousAmount: roundMoney(previousAmount),
    newAmount,
    coveredCount,
    breakdown,
  };
}

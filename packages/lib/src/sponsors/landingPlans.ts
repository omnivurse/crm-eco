import type { SupabaseClient } from '@supabase/supabase-js';

type AnyClient = SupabaseClient;

export interface EnrollmentPlanOption {
  id: string;
  name: string;
  code: string;
  monthly_share: number;
  description: string | null;
}

export function filterPlansForSponsor<T extends { id: string }>(input: {
  plans: T[];
  landingPlanIds?: string[] | null;
  sponsorPlanIds?: string[] | null;
  allowMultiplePlans?: boolean;
  defaultPlanId?: string | null;
}): T[] {
  let plans = input.plans;
  if (input.landingPlanIds?.length) {
    const allow = new Set(input.landingPlanIds);
    plans = plans.filter((plan) => allow.has(plan.id));
  }
  if (input.sponsorPlanIds?.length) {
    const allow = new Set(input.sponsorPlanIds);
    plans = plans.filter((plan) => allow.has(plan.id));
  }
  if (input.allowMultiplePlans === false && plans.length > 1) {
    const preferred =
      (input.defaultPlanId && plans.find((plan) => plan.id === input.defaultPlanId)) || plans[0];
    return [preferred];
  }
  return plans;
}

export async function loadSponsorEnrollmentFilter(
  supabase: AnyClient,
  sponsorId: string | null | undefined
): Promise<{
  sponsorPlanIds: string[];
  allowMultiplePlans: boolean;
  defaultPlanId: string | null;
}> {
  if (!sponsorId) {
    return { sponsorPlanIds: [], allowMultiplePlans: true, defaultPlanId: null };
  }

  const { data: sponsor } = await supabase
    .from('sponsors')
    .select('allow_multiple_plans, default_plan_id')
    .eq('id', sponsorId)
    .maybeSingle();

  const { data: rows } = await supabase
    .from('sponsor_plans')
    .select('plan_id, is_default, available_for_enrollment')
    .eq('sponsor_id', sponsorId)
    .eq('available_for_enrollment', true);

  const attached = rows ?? [];
  return {
    sponsorPlanIds: attached.map((row: { plan_id: string }) => row.plan_id),
    allowMultiplePlans: sponsor?.allow_multiple_plans ?? true,
    defaultPlanId:
      sponsor?.default_plan_id ??
      attached.find((row: { is_default?: boolean }) => row.is_default)?.plan_id ??
      null,
  };
}

export async function resolveEnrollmentPlansForLanding(
  supabase: AnyClient,
  landing: {
    organization_id: string;
    plan_ids?: string[] | null;
    sponsor_id?: string | null;
    default_plan_id?: string | null;
  }
): Promise<EnrollmentPlanOption[]> {
  let query = supabase
    .from('plans')
    .select('id, name, code, monthly_share, description')
    .eq('is_active', true);

  query = landing.plan_ids?.length
    ? query.in('id', landing.plan_ids)
    : query.eq('organization_id', landing.organization_id);

  const { data } = await query.order('monthly_share');
  const filter = await loadSponsorEnrollmentFilter(supabase, landing.sponsor_id);

  return filterPlansForSponsor({
    plans: (data ?? []) as EnrollmentPlanOption[],
    landingPlanIds: landing.plan_ids,
    sponsorPlanIds: filter.sponsorPlanIds,
    allowMultiplePlans: landing.sponsor_id ? filter.allowMultiplePlans : true,
    defaultPlanId: filter.defaultPlanId ?? landing.default_plan_id ?? null,
  });
}

import 'server-only';

import { cache } from 'react';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';
import { getMemberInsuranceDetails } from './insurance';
import {
  countCurrentlyCoveredDependents,
  summarizeRecentCoverageChanges,
  type DependentCoveragePeriod,
  type DependentWithCoverage,
} from '@crm-eco/lib';

/**
 * Server-only data accessors for the member portal.
 * Each function calls requireActiveMembership() first to enforce the gate
 * and is wrapped in React's cache() so a single request only does one round-trip.
 */

export const getMemberContext = cache(async () => {
  return requireActiveMembership();
});

export const listMemberEnrollments = cache(async () => {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('enrollments')
    .select(`
      id, enrollment_number, status, enrollment_mode, enrollment_source,
      requested_effective_date, effective_date, base_monthly_cost,
      created_at, updated_at,
      plans:selected_plan_id (id, name, code, monthly_share)
    `)
    .eq('primary_member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id)
    .order('created_at', { ascending: false });
  return data ?? [];
});

export const getActiveMembership = cache(async () => {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('memberships')
    .select(`
      id, status, billing_amount, effective_date, end_date,
      plans:plan_id (id, name, code, monthly_share, description)
    `)
    .eq('member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id)
    .eq('status', 'active')
    .order('effective_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
});

export interface PlanBenefit {
  label: string;
  detail?: string;
}

/**
 * A normalized, correctly-sourced coverage summary for the premium "My Plan"
 * card. Each field comes from its REAL home — premium from
 * `memberships.billing_amount`, deductible/IUA from the joined `plans`, and the
 * coverage option + member number from the `members` row (NOT from phantom
 * columns on `memberships`). Benefits are returned only when the plan actually
 * has a structured list; they are never fabricated.
 */
export interface PlanOverview {
  planName: string | null;
  planType: string | null;
  marketType: string | null;
  status: string | null;
  premium: number | null;
  premiumFrequency: string;
  deductible: number | null;
  effectiveDate: string | null;
  memberNumber: string | null;
  membershipNumber: string | null;
  coverageOption: string | null;
  benefits: PlanBenefit[] | null;
  /** Insurance carrier name, when the member is insurance-market and the CRM record has it. */
  carrier: string | null;
}

function firstNumber(...values: Array<number | string | null | undefined>): number | null {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

/** "member_only" | "Member Only" → "Member Only"; null/blank → null (never a fake default). */
function humanizeCoverageOption(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  return value
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Read a structured benefits array off plan `metadata`/`custom_fields` jsonb. Returns null when absent. */
function extractBenefits(source: unknown): PlanBenefit[] | null {
  const raw =
    source && typeof source === 'object' && !Array.isArray(source)
      ? (source as Record<string, unknown>).benefits
      : undefined;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: PlanBenefit[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      if (item.trim()) out.push({ label: item.trim() });
      continue;
    }
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      const label = o.label ?? o.name ?? o.title;
      if (typeof label === 'string' && label.trim()) {
        const detailRaw = o.amount ?? o.detail ?? o.description;
        const detail =
          typeof detailRaw === 'string' && detailRaw.trim()
            ? detailRaw.trim()
            : typeof detailRaw === 'number'
              ? String(detailRaw)
              : undefined;
        out.push({ label: label.trim(), detail });
      }
    }
  }
  return out.length ? out : null;
}

export const getPlanOverview = cache(async (): Promise<PlanOverview | null> => {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('memberships')
    .select(`
      id, status, billing_amount, billing_frequency, effective_date, end_date, membership_number,
      plans:plan_id (
        id, name, brand_name, code, monthly_share, description,
        iua_amount, default_iua, plan_type, metadata, custom_fields
      )
    `)
    .eq('member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id)
    .eq('status', 'active')
    .order('effective_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  type PlanEmbed = {
    name: string | null;
    brand_name: string | null;
    monthly_share: number | null;
    description: string | null;
    iua_amount: number | null;
    default_iua: number | null;
    plan_type: string | null;
    metadata: unknown;
    custom_fields: unknown;
  };
  const planRaw = (data as { plans?: PlanEmbed | PlanEmbed[] | null }).plans;
  const plan = Array.isArray(planRaw) ? planRaw[0] ?? null : planRaw ?? null;
  const member = ctx.member;

  const overview: PlanOverview = {
    planName: plan?.brand_name || plan?.name || member.plan_name || null,
    planType: plan?.plan_type ?? member.plan_type ?? null,
    marketType: member.market_type ?? null,
    status: data.status ?? null,
    premium: firstNumber(data.billing_amount, plan?.monthly_share, member.monthly_share),
    premiumFrequency: data.billing_frequency ?? 'monthly',
    deductible: firstNumber(plan?.iua_amount, plan?.default_iua),
    effectiveDate: data.effective_date ?? member.effective_date ?? null,
    memberNumber: member.member_number ?? null,
    membershipNumber: data.membership_number ?? null,
    coverageOption: humanizeCoverageOption(member.coverage_type),
    benefits: extractBenefits(plan?.metadata) ?? extractBenefits(plan?.custom_fields),
    carrier: null,
  };

  await enrichWithInsurance(overview, ctx.member.id);
  return overview;
});

/**
 * For insurance-market members, fill the carrier (and, when present, the
 * insurance premium/deductible/plan name) from their CRM record — the only
 * place those live. Read-only + member-scoped; a no-op for health-sharing
 * members and when no insurance data exists. Mutates `overview` in place.
 */
async function enrichWithInsurance(overview: PlanOverview, memberId: string): Promise<void> {
  const isInsurance = overview.marketType === 'insurance' || overview.planType === 'insurance';
  if (!isInsurance) return;
  const ins = await getMemberInsuranceDetails(memberId);
  if (!ins) return;
  overview.carrier = ins.carrier;
  if (ins.premium !== null) overview.premium = ins.premium;
  if (ins.deductible !== null) overview.deductible = ins.deductible;
  overview.planName = overview.planName ?? ins.planName;
}

export { enrichWithInsurance };

/** All dependents on the membership (person records), regardless of current coverage. */
export const listMemberDependents = cache(async (): Promise<DependentWithCoverage[]> => {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('dependents')
    .select(
      'id, first_name, last_name, date_of_birth, gender, relationship, included_in_enrollment, created_at, updated_at',
    )
    .eq('member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id)
    .order('created_at', { ascending: false });
  return (data ?? []) as DependentWithCoverage[];
});

/**
 * @deprecated Prefer listMemberDependents + listDependentCoveragePeriods.
 * Kept for enrollment snapshot views that still need enrollment_dependents joins.
 */
export const listDependentsForMember = cache(async () => {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id')
    .eq('primary_member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id);

  const enrollmentIds = (enrollments ?? []).map((e) => e.id);
  if (enrollmentIds.length === 0) return [];

  const { data } = await supabase
    .from('enrollment_dependents')
    .select(`
      id, enrollment_id, status, inactive_reason, additional_cost,
      dependents:dependent_id (
        id, first_name, last_name, date_of_birth, relationship, custom_fields
      )
    `)
    .in('enrollment_id', enrollmentIds);

  return data ?? [];
});

export const getMemberAdvisor = cache(async () => {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();
  const { data: enroll } = await supabase
    .from('enrollments')
    .select('advisor_id')
    .eq('primary_member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id)
    .not('advisor_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!enroll?.advisor_id) return null;

  const { data: advisor } = await supabase
    .from('advisors')
    .select('id, first_name, last_name, email, phone, profile:profiles!advisors_profile_id_fkey(avatar_url)')
    .eq('id', enroll.advisor_id)
    .maybeSingle();
  if (!advisor) return null;
  return {
    ...advisor,
    avatar_url: (advisor as { profile?: { avatar_url?: string | null } }).profile?.avatar_url ?? null,
  };
});

export const listMemberNotifications = cache(async () => {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('member_notifications')
    .select('*')
    .eq('member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id)
    .order('created_at', { ascending: false })
    .limit(50);
  return data ?? [];
});

export const countUnreadNotifications = cache(async () => {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();
  const { count } = await supabase
    .from('member_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id)
    .eq('is_read', false);
  return count ?? 0;
});

export const listChangeRequests = cache(async () => {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('member_change_requests')
    .select('*')
    .eq('member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id)
    .order('created_at', { ascending: false })
    .limit(50);
  return data ?? [];
});

export const listMemberDocuments = cache(async () => {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('member_documents')
    .select('*')
    .eq('member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id)
    .eq('is_active', true)
    .order('issued_at', { ascending: false });
  return data ?? [];
});

export const listAgreementSignatures = cache(async () => {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id')
    .eq('primary_member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id);
  const ids = (enrollments ?? []).map((e) => e.id);
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from('agreement_signatures')
    .select('*')
    .in('enrollment_id', ids)
    .order('signed_at', { ascending: false });
  return data ?? [];
});

/**
 * Coverage periods for all dependents on the membership.
 * Source of truth for add/remove dates (school, summer work, back-dated history).
 */
export const listDependentCoveragePeriods = cache(async (): Promise<DependentCoveragePeriod[]> => {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('dependent_coverage_periods')
    .select('*')
    .eq('member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id)
    .order('effective_from', { ascending: false });
  return (data ?? []) as DependentCoveragePeriod[];
});

/** Dependents + periods + covered count + recent changes — for plan/billing/dashboard surfaces. */
export const getFamilyCoverageSummary = cache(async () => {
  const [dependents, periods] = await Promise.all([
    listMemberDependents(),
    listDependentCoveragePeriods(),
  ]);

  const coveredCount = countCurrentlyCoveredDependents(dependents, periods);
  const recentChanges = summarizeRecentCoverageChanges(dependents, periods, 5);

  return {
    dependents,
    periods,
    coveredCount,
    totalDependents: dependents.length,
    recentChanges,
  };
});

/**
 * Canonical member plan/product management (memberships) for staff surfaces.
 *
 * `memberships` is the source of truth for a member's plan; a DB trigger
 * (sync_member_active_plan_type) fans the active membership's plan_id out to the
 * denormalized members.plan_* columns. Managing a member's plan therefore means
 * creating / updating / terminating a membership here — NOT writing members.plan_*
 * directly.
 *
 * Like the dependent/coverage writer, ctx.supabase MUST be a SERVICE-ROLE client:
 * the post-change billing recalc writes memberships/billing_schedules, which RLS
 * restricts to owner/admin/service_role. Callers verify staff authz with their
 * own client first; these functions re-assert org/membership ownership in code.
 */
import { recalculateMemberBillingFromCoverage } from './membershipBillingRecalc';
import type { StaffCoverageContext, StaffActionResult } from './staffDependentCoverage';

async function assertMemberInOrg(
  ctx: StaffCoverageContext,
  memberId: string,
): Promise<StaffActionResult<{ id: string }>> {
  const { data, error } = await ctx.supabase
    .from('members')
    .select('id')
    .eq('id', memberId)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: 'Member not found in this organization' };
  return { success: true, data: { id: data.id } };
}

async function getPlanInOrg(
  ctx: StaffCoverageContext,
  planId: string,
): Promise<StaffActionResult<{ id: string; name: string; monthly_share: number | null }>> {
  const { data, error } = await ctx.supabase
    .from('plans')
    .select('id, name, monthly_share, is_active')
    .eq('id', planId)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: 'Plan not found in this organization' };
  return {
    success: true,
    data: { id: data.id as string, name: data.name as string, monthly_share: (data.monthly_share as number | null) ?? null },
  };
}

async function getMembershipForMember(
  ctx: StaffCoverageContext,
  membershipId: string,
  memberId: string,
): Promise<StaffActionResult<{ id: string }>> {
  const { data, error } = await ctx.supabase
    .from('memberships')
    .select('id')
    .eq('id', membershipId)
    .eq('member_id', memberId)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: 'Membership not found for this member' };
  return { success: true, data: { id: data.id } };
}

async function syncBilling(
  ctx: StaffCoverageContext,
  memberId: string,
): Promise<{ billing?: Awaited<ReturnType<typeof recalculateMemberBillingFromCoverage>>; billingError?: string }> {
  try {
    const billing = await recalculateMemberBillingFromCoverage(ctx.supabase, memberId, ctx.organizationId);
    return { billing };
  } catch (error) {
    console.error('[plan] billing recalculation failed', error);
    return { billingError: error instanceof Error ? error.message : 'Billing could not be updated automatically.' };
  }
}

/**
 * Assign a plan to a member (creates an active membership). Fails if the member
 * already has an active membership — use staffChangePlan or staffEndPlan first,
 * so a member always has at most one active plan.
 */
export async function staffAssignPlan(
  ctx: StaffCoverageContext,
  input: { member_id: string; plan_id: string; effective_date: string },
): Promise<StaffActionResult<{ membershipId: string }>> {
  if (!input.plan_id) return { success: false, error: 'A plan is required' };
  if (!input.effective_date) return { success: false, error: 'An effective date is required' };

  const memberCheck = await assertMemberInOrg(ctx, input.member_id);
  if (!memberCheck.success) return { success: false, error: memberCheck.error };

  const planCheck = await getPlanInOrg(ctx, input.plan_id);
  if (!planCheck.success) return { success: false, error: planCheck.error };

  const { data: existingActive } = await ctx.supabase
    .from('memberships')
    .select('id')
    .eq('member_id', input.member_id)
    .eq('organization_id', ctx.organizationId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (existingActive?.id) {
    return {
      success: false,
      error: 'This member already has an active plan. Change or end it before assigning a new one.',
    };
  }

  const { data: inserted, error: insErr } = await ctx.supabase
    .from('memberships')
    .insert({
      organization_id: ctx.organizationId,
      member_id: input.member_id,
      plan_id: input.plan_id,
      status: 'active',
      effective_date: input.effective_date,
      billing_amount: planCheck.data!.monthly_share,
      billing_frequency: 'monthly',
    })
    .select('id')
    .single();

  if (insErr || !inserted?.id) {
    return { success: false, error: insErr?.message ?? 'Failed to assign plan' };
  }

  const billingSync = await syncBilling(ctx, input.member_id);
  return { success: true, data: { membershipId: inserted.id }, ...billingSync };
}

/** Change the plan on an existing membership. */
export async function staffChangePlan(
  ctx: StaffCoverageContext,
  input: { member_id: string; membership_id: string; plan_id: string; effective_date?: string },
): Promise<StaffActionResult> {
  if (!input.plan_id) return { success: false, error: 'A plan is required' };

  const memCheck = await getMembershipForMember(ctx, input.membership_id, input.member_id);
  if (!memCheck.success) return { success: false, error: memCheck.error };

  const planCheck = await getPlanInOrg(ctx, input.plan_id);
  if (!planCheck.success) return { success: false, error: planCheck.error };

  const { error } = await ctx.supabase
    .from('memberships')
    .update({
      plan_id: input.plan_id,
      billing_amount: planCheck.data!.monthly_share,
      ...(input.effective_date ? { effective_date: input.effective_date } : {}),
      status: 'active',
      end_date: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.membership_id);

  if (error) return { success: false, error: error.message };

  const billingSync = await syncBilling(ctx, input.member_id);
  return { success: true, ...billingSync };
}

/** Terminate a membership (removes the member's plan). */
export async function staffEndPlan(
  ctx: StaffCoverageContext,
  input: { member_id: string; membership_id: string; end_date: string; reason?: string },
): Promise<StaffActionResult> {
  if (!input.end_date) return { success: false, error: 'An end date is required' };

  const memCheck = await getMembershipForMember(ctx, input.membership_id, input.member_id);
  if (!memCheck.success) return { success: false, error: memCheck.error };

  const { error } = await ctx.supabase
    .from('memberships')
    .update({
      status: 'terminated',
      end_date: input.end_date,
      ...(input.reason ? { cancellation_reason: input.reason } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.membership_id);

  if (error) return { success: false, error: error.message };

  const billingSync = await syncBilling(ctx, input.member_id);
  return { success: true, ...billingSync };
}

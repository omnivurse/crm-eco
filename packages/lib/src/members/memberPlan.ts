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
  if (input.effective_date > todayIso()) {
    return {
      success: false,
      error:
        'A plan cannot be assigned before its effective date. Use today or an earlier date.',
    };
  }

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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Day before an ISO date, in UTC (no local-time drift). */
function previousDayIso(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Schedule a plan change: the current active membership keeps covering until
 * the day before `effective_date`, and a new `pending` membership starts on
 * `effective_date`. The activate-due-memberships cron performs the switch
 * (terminate old + activate new + billing handoff) on the day itself — nothing
 * about the member's current coverage or billing changes at scheduling time.
 *
 * The pending row carries custom_fields.scheduled_change as provenance (and as
 * the back-pointer staffCancelScheduledPlanChange uses to undo), plus
 * subscriber_base_amount so the post-switch billing recalc prices from the NEW
 * plan even though the row has no enrollment of its own.
 */
export async function staffSchedulePlanChange(
  ctx: StaffCoverageContext,
  input: { member_id: string; plan_id: string; effective_date: string; reason?: string },
): Promise<StaffActionResult<{ membershipId: string; currentEndsOn: string }>> {
  if (!input.plan_id) return { success: false, error: 'A plan is required' };
  if (!input.effective_date) return { success: false, error: 'An effective date is required' };
  if (input.effective_date <= todayIso()) {
    return {
      success: false,
      error: 'The effective date must be in the future. For a change starting today, use Change plan instead.',
    };
  }

  const memberCheck = await assertMemberInOrg(ctx, input.member_id);
  if (!memberCheck.success) return { success: false, error: memberCheck.error };

  const planCheck = await getPlanInOrg(ctx, input.plan_id);
  if (!planCheck.success) return { success: false, error: planCheck.error };
  if (planCheck.data!.monthly_share == null) {
    // Without a standard price the post-switch recalc has no base to price
    // from and would fall back to the OLD enrollment's total — reject rather
    // than schedule a change that reprices wrong.
    return {
      success: false,
      error:
        'This plan has no standard monthly price, so the switch cannot be automated. Change the plan manually on the switch date instead.',
    };
  }

  const { data: current, error: currentError } = await ctx.supabase
    .from('memberships')
    .select('id, plan_id, end_date')
    .eq('member_id', input.member_id)
    .eq('organization_id', ctx.organizationId)
    .eq('status', 'active')
    .order('effective_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (currentError) return { success: false, error: currentError.message };
  if (!current) {
    return {
      success: false,
      error: 'This member has no active plan to change. Use Assign plan instead.',
    };
  }

  // ANY pending row blocks scheduling — including a due-but-not-yet-activated
  // one (cron lag) that would otherwise end up as a second active membership.
  // Checked BEFORE the end-date guard so a member with a scheduled change gets
  // the actionable "cancel it first" message, not the misleading end-date one.
  const { data: existingPending } = await ctx.supabase
    .from('memberships')
    .select('id, effective_date')
    .eq('member_id', input.member_id)
    .eq('organization_id', ctx.organizationId)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle();
  if (existingPending?.id) {
    return {
      success: false,
      error: `This member already has a pending plan (effective ${existingPending.effective_date}). Cancel it or wait for it to activate before scheduling another change.`,
    };
  }

  const currentEndsOn = previousDayIso(input.effective_date);
  if (current.end_date && current.end_date < currentEndsOn) {
    return {
      success: false,
      error: `The current plan already ends on ${current.end_date}, before this change would start. End the plan or pick an earlier effective date.`,
    };
  }

  const { data: inserted, error: insErr } = await ctx.supabase
    .from('memberships')
    .insert({
      organization_id: ctx.organizationId,
      member_id: input.member_id,
      plan_id: input.plan_id,
      status: 'pending',
      effective_date: input.effective_date,
      billing_amount: planCheck.data!.monthly_share,
      billing_frequency: 'monthly',
      custom_fields: {
        ...(planCheck.data!.monthly_share != null
          ? { subscriber_base_amount: planCheck.data!.monthly_share }
          : {}),
        scheduled_change: {
          from_membership_id: current.id,
          from_plan_id: current.plan_id,
          from_end_date: current.end_date,
          scheduled_at: new Date().toISOString(),
          scheduled_by: ctx.profileId,
          ...(input.reason ? { reason: input.reason } : {}),
        },
      },
    })
    .select('id')
    .single();

  if (insErr || !inserted?.id) {
    return { success: false, error: insErr?.message ?? 'Failed to schedule the plan change' };
  }

  const { error: endErr } = await ctx.supabase
    .from('memberships')
    .update({ end_date: currentEndsOn, updated_at: new Date().toISOString() })
    .eq('id', current.id);
  if (endErr) {
    // Roll back the pending row so a failed schedule leaves nothing behind.
    await ctx.supabase.from('memberships').delete().eq('id', inserted.id);
    return { success: false, error: endErr.message };
  }

  const billingSync = await syncBilling(ctx, input.member_id);
  return {
    success: true,
    data: { membershipId: inserted.id, currentEndsOn },
    ...billingSync,
  };
}

/**
 * Cancel a scheduled plan change before it activates: deletes the pending
 * membership (it is intent, not history) and restores the current membership's
 * original end date via the scheduled_change back-pointer.
 */
export async function staffCancelScheduledPlanChange(
  ctx: StaffCoverageContext,
  input: { member_id: string; pending_membership_id: string },
): Promise<StaffActionResult> {
  const memCheck = await getMembershipForMember(ctx, input.pending_membership_id, input.member_id);
  if (!memCheck.success) return { success: false, error: memCheck.error };

  const { data: pending, error: pendingError } = await ctx.supabase
    .from('memberships')
    .select('id, status, effective_date, custom_fields')
    .eq('id', input.pending_membership_id)
    .maybeSingle();
  if (pendingError) return { success: false, error: pendingError.message };

  const scheduledChange = asRecord(asRecord(pending?.custom_fields).scheduled_change);
  if (
    !pending ||
    pending.status !== 'pending' ||
    !scheduledChange.from_membership_id ||
    (pending.effective_date ?? '') <= todayIso()
  ) {
    return {
      success: false,
      error: 'Only a scheduled plan change that has not started yet can be cancelled.',
    };
  }

  // Restore FIRST, delete second: if the delete then fails, the pending row
  // still exists and the change simply happens on schedule (the supersede
  // pass recomputes a null end date; a restored non-null one is kept as-is).
  // The reverse order would strand a wrong end date with no back-pointer.
  const { error: restoreErr } = await ctx.supabase
    .from('memberships')
    .update({
      end_date: (scheduledChange.from_end_date as string | null) ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', scheduledChange.from_membership_id as string)
    .eq('member_id', input.member_id);
  if (restoreErr) return { success: false, error: restoreErr.message };

  const { error: delErr } = await ctx.supabase
    .from('memberships')
    .delete()
    .eq('id', input.pending_membership_id)
    .eq('status', 'pending');
  if (delErr) {
    return {
      success: false,
      error: `The scheduled plan is still in place (${delErr.message}). Try cancelling again.`,
    };
  }

  const billingSync = await syncBilling(ctx, input.member_id);
  return { success: true, ...billingSync };
}

/** Terminate a membership (removes the member's plan). */
export async function staffEndPlan(
  ctx: StaffCoverageContext,
  input: { member_id: string; membership_id: string; end_date: string; reason?: string },
): Promise<StaffActionResult> {
  if (!input.end_date) return { success: false, error: 'An end date is required' };
  if (input.end_date > todayIso()) {
    return {
      success: false,
      error:
        'A plan cannot be ended before its end date. Use today or an earlier date.',
    };
  }

  const memCheck = await getMembershipForMember(ctx, input.membership_id, input.member_id);
  if (!memCheck.success) return { success: false, error: memCheck.error };

  // A scheduled plan change would resurrect coverage on its effective date
  // (and its pending row would hijack the recalc once this row terminates) —
  // require it to be cancelled first.
  const { data: scheduledPending } = await ctx.supabase
    .from('memberships')
    .select('id, effective_date, custom_fields')
    .eq('member_id', input.member_id)
    .eq('organization_id', ctx.organizationId)
    .eq('status', 'pending')
    .gt('effective_date', todayIso())
    .limit(1)
    .maybeSingle();
  if (
    scheduledPending?.id &&
    asRecord(asRecord(scheduledPending.custom_fields).scheduled_change).from_membership_id
  ) {
    return {
      success: false,
      error: `A plan change is scheduled for ${scheduledPending.effective_date}. Cancel the scheduled change before ending this plan.`,
    };
  }

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

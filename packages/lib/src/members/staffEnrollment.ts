/**
 * Staff/admin manual enrollment creation.
 *
 * Admins must be able to create enrollments by hand for situations that arise
 * (back-office corrections, phone enrollments, edge cases). This uses the SAME
 * canonical primitive as every other create path — the idempotent
 * `create_enrollment_tx` RPC — so there's no parallel enrollment-create logic.
 *
 * ctx.supabase MUST be a service-role client (the RPC is SECURITY DEFINER, but
 * the follow-up recalc writes memberships/billing_schedules). Caller verifies
 * staff authz first; this re-asserts member + plan belong to the org.
 *
 * Creates the enrollment as 'draft' (the RPC's behaviour); approve it via the
 * existing enrollment review flow to generate the membership + billing schedule.
 */
import { recalculateMemberBillingFromCoverage } from './membershipBillingRecalc';
import type { StaffCoverageContext, StaffActionResult } from './staffDependentCoverage';

export async function staffCreateEnrollment(
  ctx: StaffCoverageContext,
  input: {
    member_id: string;
    plan_id: string;
    effective_date: string;
    advisor_id?: string | null;
  },
): Promise<StaffActionResult<{ enrollmentId: string; idempotentReplay: boolean }>> {
  if (!input.plan_id) return { success: false, error: 'A plan is required' };
  if (!input.effective_date) return { success: false, error: 'An effective date is required' };

  const { data: member, error: memErr } = await ctx.supabase
    .from('members')
    .select('id, advisor_id')
    .eq('id', input.member_id)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();
  if (memErr) return { success: false, error: memErr.message };
  if (!member) return { success: false, error: 'Member not found in this organization' };

  const { data: plan, error: planErr } = await ctx.supabase
    .from('plans')
    .select('id')
    .eq('id', input.plan_id)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();
  if (planErr) return { success: false, error: planErr.message };
  if (!plan) return { success: false, error: 'Plan not found in this organization' };

  const payload = {
    primary_member_id: input.member_id,
    selected_plan_id: input.plan_id,
    effective_date: input.effective_date,
    advisor_id: input.advisor_id ?? (member.advisor_id as string | null) ?? null,
    enrollment_source: 'admin',
    channel: 'direct',
    // Deterministic key: re-creating the same member+plan+date returns the
    // existing enrollment instead of a duplicate.
    idempotency_key: `admin_${input.member_id}_${input.plan_id}_${input.effective_date}`,
  };

  const { data, error } = await ctx.supabase.rpc('create_enrollment_tx', {
    p_org_id: ctx.organizationId,
    p_payload: payload as unknown as never,
  });
  if (error) return { success: false, error: `Failed to create enrollment: ${error.message}` };

  const row = (data ?? {}) as { enrollment_id?: string; idempotent_replay?: boolean };
  if (!row.enrollment_id) return { success: false, error: 'Enrollment was not created' };

  let billing;
  let billingError: string | undefined;
  try {
    billing = await recalculateMemberBillingFromCoverage(ctx.supabase, input.member_id, ctx.organizationId);
  } catch (e) {
    console.error('[enrollment] billing recalc failed', e);
    billingError = e instanceof Error ? e.message : 'Billing could not be updated automatically.';
  }

  return {
    success: true,
    data: { enrollmentId: row.enrollment_id, idempotentReplay: Boolean(row.idempotent_replay) },
    billing,
    billingError,
  };
}

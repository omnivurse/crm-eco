/**
 * Canonical member merge — thin wrapper over the atomic merge_members_tx RPC.
 *
 * The RPC does the transactional repoint of all child tables + terminates the
 * duplicate's active financials + soft-merges the secondary. Here we recalc the
 * keeper's billing afterward (its household may have grown from absorbed
 * dependents). ctx.supabase MUST be a service-role client; the caller verifies
 * staff authz first.
 */
import { recalculateMemberBillingFromCoverage } from './membershipBillingRecalc';
import type { StaffCoverageContext, StaffActionResult } from './staffDependentCoverage';

export async function staffMergeMembers(
  ctx: StaffCoverageContext,
  input: { keeper_id: string; secondary_id: string },
): Promise<StaffActionResult<{ summary: Record<string, unknown> }>> {
  if (!input.keeper_id || !input.secondary_id) {
    return { success: false, error: 'Both members are required' };
  }
  if (input.keeper_id === input.secondary_id) {
    return { success: false, error: 'Cannot merge a member into itself' };
  }

  const { data, error } = await ctx.supabase.rpc('merge_members_tx', {
    p_org_id: ctx.organizationId,
    p_keeper_id: input.keeper_id,
    p_secondary_id: input.secondary_id,
    p_actor_profile_id: ctx.profileId,
  });

  if (error) return { success: false, error: `Merge failed: ${error.message}` };

  let billing;
  let billingError: string | undefined;
  try {
    billing = await recalculateMemberBillingFromCoverage(ctx.supabase, input.keeper_id, ctx.organizationId);
  } catch (e) {
    console.error('[merge] keeper billing recalc failed', e);
    billingError = e instanceof Error ? e.message : 'Billing could not be updated automatically.';
  }

  return {
    success: true,
    data: { summary: (data ?? {}) as Record<string, unknown> },
    billing,
    billingError,
  };
}

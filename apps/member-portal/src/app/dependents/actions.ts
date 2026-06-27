'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient, createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import {
  getMemberForUser,
  staffAddDependentWithCoverage,
  staffUpdateDependentInfo,
  staffStartDependentCoverage,
  staffEndDependentCoverage,
  staffLogHistoricalCoveragePeriod,
  staffPurgeDependentRecord,
  type StaffCoverageContext,
  type StaffActionResult,
} from '@crm-eco/lib';
import type { CoverageReason } from '@crm-eco/lib';

/**
 * Member-portal dependent/coverage actions.
 *
 * These are thin wrappers over the CANONICAL dependent/coverage writer in
 * @crm-eco/lib (staffDependentCoverage) — no business logic is duplicated here.
 * Pattern:
 *   1. authenticate + resolve the member with the RLS-bound cookie client,
 *   2. run the privileged write + billing recalc through a SERVICE-ROLE client
 *      (members are SELECT-only on memberships/billing_schedules, so a member
 *      client would silently no-op the recalc and let billing drift),
 *   3. revalidate the member-facing surfaces.
 *
 * Authorization is preserved: member_id always comes from the authenticated
 * session, and the canonical writer re-asserts the dependent belongs to that
 * member + org, so a member can only ever touch their own household.
 */

type PortalContext = {
  ctx: StaffCoverageContext;
  memberId: string;
};

async function resolvePortalCoverageContext(): Promise<PortalContext | { error: string }> {
  const cookieClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await cookieClient.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const context = await getMemberForUser(cookieClient, user.id);
  if (!context?.member?.id || !context.member.organization_id) {
    return { error: 'Member account not found' };
  }

  return {
    memberId: context.member.id,
    ctx: {
      supabase: createServiceRoleClient(),
      organizationId: context.member.organization_id,
      profileId: context.profile.id,
      source: 'portal',
    },
  };
}

function revalidateDependentSurfaces() {
  revalidatePath('/dependents');
  revalidatePath('/plan');
  revalidatePath('/billing');
}

export async function addDependentWithCoverage(input: {
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  gender?: string;
  relationship: string;
  coverage_start_date: string;
}): Promise<StaffActionResult<{ dependentId: string }>> {
  const resolved = await resolvePortalCoverageContext();
  if ('error' in resolved) return { success: false, error: resolved.error };

  const result = await staffAddDependentWithCoverage(resolved.ctx, {
    member_id: resolved.memberId,
    first_name: input.first_name,
    last_name: input.last_name,
    date_of_birth: input.date_of_birth ?? '',
    gender: input.gender,
    relationship: input.relationship,
    coverage_start_date: input.coverage_start_date,
  });
  if (result.success) revalidateDependentSurfaces();
  return result;
}

export async function updateDependentInfo(input: {
  dependent_id: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  gender?: string;
  relationship: string;
}): Promise<StaffActionResult> {
  const resolved = await resolvePortalCoverageContext();
  if ('error' in resolved) return { success: false, error: resolved.error };

  const result = await staffUpdateDependentInfo(resolved.ctx, {
    member_id: resolved.memberId,
    dependent_id: input.dependent_id,
    first_name: input.first_name,
    last_name: input.last_name,
    date_of_birth: input.date_of_birth,
    gender: input.gender,
    relationship: input.relationship,
  });
  if (result.success) revalidateDependentSurfaces();
  return result;
}

export async function startDependentCoverage(input: {
  dependent_id: string;
  effective_from: string;
  reason?: CoverageReason | string;
  notes?: string;
}): Promise<StaffActionResult> {
  const resolved = await resolvePortalCoverageContext();
  if ('error' in resolved) return { success: false, error: resolved.error };

  const result = await staffStartDependentCoverage(resolved.ctx, {
    member_id: resolved.memberId,
    dependent_id: input.dependent_id,
    effective_from: input.effective_from,
    reason: input.reason,
    notes: input.notes,
  });
  if (result.success) revalidateDependentSurfaces();
  return result;
}

export async function endDependentCoverage(input: {
  dependent_id: string;
  effective_to: string;
  reason?: CoverageReason | string;
  notes?: string;
}): Promise<StaffActionResult> {
  const resolved = await resolvePortalCoverageContext();
  if ('error' in resolved) return { success: false, error: resolved.error };

  const result = await staffEndDependentCoverage(resolved.ctx, {
    member_id: resolved.memberId,
    dependent_id: input.dependent_id,
    effective_to: input.effective_to,
    reason: input.reason,
    notes: input.notes,
  });
  if (result.success) revalidateDependentSurfaces();
  return result;
}

export async function logHistoricalCoveragePeriod(input: {
  dependent_id: string;
  effective_from: string;
  effective_to: string;
  reason?: CoverageReason | string;
  notes?: string;
}): Promise<StaffActionResult> {
  const resolved = await resolvePortalCoverageContext();
  if ('error' in resolved) return { success: false, error: resolved.error };

  const result = await staffLogHistoricalCoveragePeriod(resolved.ctx, {
    member_id: resolved.memberId,
    dependent_id: input.dependent_id,
    effective_from: input.effective_from,
    effective_to: input.effective_to,
    reason: input.reason,
    notes: input.notes,
  });
  if (result.success) revalidateDependentSurfaces();
  return result;
}

export async function purgeDependentRecord(dependentId: string): Promise<StaffActionResult> {
  const resolved = await resolvePortalCoverageContext();
  if ('error' in resolved) return { success: false, error: resolved.error };

  const result = await staffPurgeDependentRecord(resolved.ctx, {
    member_id: resolved.memberId,
    dependent_id: dependentId,
  });
  if (result.success) revalidateDependentSurfaces();
  return result;
}

'use server';

import { revalidatePath } from 'next/cache';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import {
  staffAddDependentWithCoverage,
  staffStartDependentCoverage,
  staffEndDependentCoverage,
  staffLogHistoricalCoveragePeriod,
  type StaffCoverageContext,
  type StaffActionResult,
} from '@crm-eco/lib';
import type { CoverageReason } from '@crm-eco/lib';
import { verifyCrmAccess } from '@/lib/supabase-server';

/**
 * CRM staff dependent/coverage actions — thin wrappers over the CANONICAL
 * dependent/coverage writer in @crm-eco/lib (staffDependentCoverage). No
 * business logic duplicated here.
 *
 * Auth is verified with the staff cookie client (verifyCrmAccess); the
 * privileged write + billing recalc run through a SERVICE-ROLE client because
 * staff are SELECT-only on memberships/billing_schedules under RLS — a staff
 * cookie client would silently no-op the recalc and let billing drift.
 */

async function resolveCrmCoverageContext(): Promise<
  { ctx: StaffCoverageContext } | { error: string }
> {
  const auth = await verifyCrmAccess();
  if (!auth.isAuthorized || !auth.user || !auth.profile?.organization_id) {
    return { error: auth.error || 'Not authorized' };
  }
  return {
    ctx: {
      supabase: createServiceRoleClient(),
      organizationId: auth.profile.organization_id,
      profileId: auth.profile.id,
      source: 'crm',
    },
  };
}

function revalidateCrmMemberSurfaces(memberId: string) {
  revalidatePath(`/crm/members/${memberId}`);
  revalidatePath('/crm/records');
}

export async function crmAddDependentWithCoverage(input: {
  member_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender?: string;
  relationship: string;
  coverage_start_date: string;
}): Promise<StaffActionResult<{ dependentId: string }>> {
  const resolved = await resolveCrmCoverageContext();
  if ('error' in resolved) return { success: false, error: resolved.error };

  const result = await staffAddDependentWithCoverage(resolved.ctx, input);
  if (result.success) revalidateCrmMemberSurfaces(input.member_id);
  return result;
}

export async function crmStartDependentCoverage(input: {
  member_id: string;
  dependent_id: string;
  effective_from: string;
  reason?: CoverageReason | string;
  notes?: string;
}): Promise<StaffActionResult> {
  const resolved = await resolveCrmCoverageContext();
  if ('error' in resolved) return { success: false, error: resolved.error };

  const result = await staffStartDependentCoverage(resolved.ctx, input);
  if (result.success) revalidateCrmMemberSurfaces(input.member_id);
  return result;
}

export async function crmEndDependentCoverage(input: {
  member_id: string;
  dependent_id: string;
  effective_to: string;
  reason?: CoverageReason | string;
  notes?: string;
}): Promise<StaffActionResult> {
  const resolved = await resolveCrmCoverageContext();
  if ('error' in resolved) return { success: false, error: resolved.error };

  const result = await staffEndDependentCoverage(resolved.ctx, input);
  if (result.success) revalidateCrmMemberSurfaces(input.member_id);
  return result;
}

export async function crmLogHistoricalCoveragePeriod(input: {
  member_id: string;
  dependent_id: string;
  effective_from: string;
  effective_to: string;
  reason?: CoverageReason | string;
  notes?: string;
}): Promise<StaffActionResult> {
  const resolved = await resolveCrmCoverageContext();
  if ('error' in resolved) return { success: false, error: resolved.error };

  const result = await staffLogHistoricalCoveragePeriod(resolved.ctx, input);
  if (result.success) revalidateCrmMemberSurfaces(input.member_id);
  return result;
}

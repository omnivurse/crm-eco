'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient, createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import {
  staffAddDependentWithCoverage,
  staffUpdateDependentInfo,
  staffStartDependentCoverage,
  staffEndDependentCoverage,
  staffLogHistoricalCoveragePeriod,
  staffPurgeDependentRecord,
  staffAssignPlan,
  staffChangePlan,
  staffEndPlan,
  staffSchedulePlanChange,
  staffCancelScheduledPlanChange,
  staffCreateEnrollment,
  staffMergeMembers,
  type StaffCoverageContext,
} from '@crm-eco/lib';
import { getActiveTenant, type TenantRole } from '@/lib/tenant';

const STAFF_ROLES: readonly TenantRole[] = ['owner', 'super_admin', 'admin', 'staff'];

async function resolveStaffContext(): Promise<
  | { ok: true; ctx: StaffCoverageContext; memberCommandPath: (memberId: string) => string }
  | { ok: false; error: string }
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Unauthorized' };

  const tenant = await getActiveTenant();
  if (!tenant) return { ok: false, error: 'No active organization' };
  if (!STAFF_ROLES.includes(tenant.role)) {
    return { ok: false, error: 'You do not have permission to manage members.' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', tenant.organizationId)
    .maybeSingle();

  if (!profile?.id) return { ok: false, error: 'Staff profile not found' };

  return {
    ok: true,
    ctx: {
      // Auth + role were verified above with the cookie client. The privileged
      // write + billing recalc run through a SERVICE-ROLE client because the
      // recalc writes memberships/billing_schedules, which owner/admin-only RLS
      // would block for some staff roles (silently no-op'ing the recalc). The
      // canonical lib re-asserts org/dependent ownership as defense in depth.
      supabase: createServiceRoleClient(),
      organizationId: tenant.organizationId,
      profileId: profile.id,
      source: 'admin',
    },
    memberCommandPath: (memberId: string) => `/members/${memberId}`,
  };
}

function revalidateMember(memberId: string) {
  revalidatePath(`/members/${memberId}`);
  revalidatePath('/members');
}

export async function adminAddDependentWithCoverage(
  input: Parameters<typeof staffAddDependentWithCoverage>[1],
) {
  const staff = await resolveStaffContext();
  if (!staff.ok) return { success: false, error: staff.error };
  const result = await staffAddDependentWithCoverage(staff.ctx, input);
  if (result.success) revalidateMember(input.member_id);
  return result;
}

export async function adminUpdateDependentInfo(
  input: Parameters<typeof staffUpdateDependentInfo>[1],
) {
  const staff = await resolveStaffContext();
  if (!staff.ok) return { success: false, error: staff.error };
  const result = await staffUpdateDependentInfo(staff.ctx, input);
  if (result.success) revalidateMember(input.member_id);
  return result;
}

export async function adminStartDependentCoverage(
  input: Parameters<typeof staffStartDependentCoverage>[1],
) {
  const staff = await resolveStaffContext();
  if (!staff.ok) return { success: false, error: staff.error };
  const result = await staffStartDependentCoverage(staff.ctx, input);
  if (result.success) revalidateMember(input.member_id);
  return result;
}

export async function adminEndDependentCoverage(
  input: Parameters<typeof staffEndDependentCoverage>[1],
) {
  const staff = await resolveStaffContext();
  if (!staff.ok) return { success: false, error: staff.error };
  const result = await staffEndDependentCoverage(staff.ctx, input);
  if (result.success) revalidateMember(input.member_id);
  return result;
}

export async function adminLogHistoricalCoveragePeriod(
  input: Parameters<typeof staffLogHistoricalCoveragePeriod>[1],
) {
  const staff = await resolveStaffContext();
  if (!staff.ok) return { success: false, error: staff.error };
  const result = await staffLogHistoricalCoveragePeriod(staff.ctx, input);
  if (result.success) revalidateMember(input.member_id);
  return result;
}

export async function adminPurgeDependentRecord(input: {
  member_id: string;
  dependent_id: string;
}) {
  const staff = await resolveStaffContext();
  if (!staff.ok) return { success: false, error: staff.error };
  const result = await staffPurgeDependentRecord(staff.ctx, input);
  if (result.success) revalidateMember(input.member_id);
  return result;
}

// ── Plan / product management (memberships) ─────────────────────────────────

export async function adminAssignPlan(input: Parameters<typeof staffAssignPlan>[1]) {
  const staff = await resolveStaffContext();
  if (!staff.ok) return { success: false, error: staff.error };
  const result = await staffAssignPlan(staff.ctx, input);
  if (result.success) revalidateMember(input.member_id);
  return result;
}

export async function adminChangePlan(input: Parameters<typeof staffChangePlan>[1]) {
  const staff = await resolveStaffContext();
  if (!staff.ok) return { success: false, error: staff.error };
  const result = await staffChangePlan(staff.ctx, input);
  if (result.success) revalidateMember(input.member_id);
  return result;
}

export async function adminEndPlan(input: Parameters<typeof staffEndPlan>[1]) {
  const staff = await resolveStaffContext();
  if (!staff.ok) return { success: false, error: staff.error };
  const result = await staffEndPlan(staff.ctx, input);
  if (result.success) revalidateMember(input.member_id);
  return result;
}

export async function adminSchedulePlanChange(
  input: Parameters<typeof staffSchedulePlanChange>[1],
) {
  const staff = await resolveStaffContext();
  if (!staff.ok) return { success: false, error: staff.error };
  const result = await staffSchedulePlanChange(staff.ctx, input);
  if (result.success) revalidateMember(input.member_id);
  return result;
}

export async function adminCancelScheduledPlanChange(
  input: Parameters<typeof staffCancelScheduledPlanChange>[1],
) {
  const staff = await resolveStaffContext();
  if (!staff.ok) return { success: false, error: staff.error };
  const result = await staffCancelScheduledPlanChange(staff.ctx, input);
  if (result.success) revalidateMember(input.member_id);
  return result;
}

// ── Manual enrollment creation (admins, full control) ───────────────────────

export async function adminCreateEnrollment(input: Parameters<typeof staffCreateEnrollment>[1]) {
  const staff = await resolveStaffContext();
  if (!staff.ok) return { success: false, error: staff.error };
  const result = await staffCreateEnrollment(staff.ctx, input);
  if (result.success) revalidateMember(input.member_id);
  return result;
}

// ── Member merge ────────────────────────────────────────────────────────────

export interface MergeCandidate {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  member_number: string | null;
  status: string | null;
}

/** Search org members to pick a duplicate to merge into the keeper. */
export async function searchMembersForMerge(
  query: string,
  keeperId: string,
): Promise<{ success: boolean; error?: string; results: MergeCandidate[] }> {
  const staff = await resolveStaffContext();
  if (!staff.ok) return { success: false, error: staff.error, results: [] };

  // Strip PostgREST filter-breaking characters before interpolating into .or().
  const q = query.replace(/[(),%*]/g, ' ').trim();
  if (q.length < 2) return { success: true, results: [] };

  const { data, error } = await staff.ctx.supabase
    .from('members')
    .select('id, first_name, last_name, email, member_number, status')
    .eq('organization_id', staff.ctx.organizationId)
    .is('merged_into_id', null)
    .neq('id', keeperId)
    .or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,member_number.ilike.%${q}%`,
    )
    .order('last_name', { ascending: true })
    .limit(10);

  if (error) return { success: false, error: error.message, results: [] };
  return { success: true, results: (data ?? []) as MergeCandidate[] };
}

/** Merge a duplicate (secondary) into the keeper via the atomic RPC + recalc. */
export async function adminMergeMembers(input: { keeper_id: string; secondary_id: string }) {
  const staff = await resolveStaffContext();
  if (!staff.ok) return { success: false, error: staff.error };
  const result = await staffMergeMembers(staff.ctx, input);
  if (result.success) {
    revalidateMember(input.keeper_id);
    revalidateMember(input.secondary_id);
  }
  return result;
}

'use server';

import { revalidatePath } from 'next/cache';
import {
  validateCoverageDate,
  validateCoverageDateRange,
  recalculateMemberBillingFromCoverage,
} from '@crm-eco/lib';
import type { CoverageReason, BillingRecalcResult } from '@crm-eco/lib';
import { createClient, verifyCrmAccess } from '@/lib/supabase-server';

interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  billing?: BillingRecalcResult;
}

interface StaffAuthContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  profileId: string;
  organizationId: string;
}

async function getStaffAuthContext(): Promise<
  { success: true; context: StaffAuthContext } | { success: false; error: string }
> {
  const auth = await verifyCrmAccess();
  if (!auth.isAuthorized || !auth.user || !auth.profile?.organization_id) {
    return { success: false, error: auth.error || 'Not authorized' };
  }

  const supabase = await createClient();
  return {
    success: true,
    context: {
      supabase,
      userId: auth.user.id,
      profileId: auth.profile.id,
      organizationId: auth.profile.organization_id,
    },
  };
}

async function assertMemberInOrg(
  supabase: StaffAuthContext['supabase'],
  memberId: string,
  organizationId: string,
): Promise<ActionResult<{ id: string }>> {
  const { data, error } = await supabase
    .from('members')
    .select('id')
    .eq('id', memberId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: 'Member not found in your organization' };
  return { success: true, data: { id: data.id } };
}

async function assertDependentForMember(
  supabase: StaffAuthContext['supabase'],
  dependentId: string,
  memberId: string,
  organizationId: string,
): Promise<ActionResult<{ id: string }>> {
  const { data, error } = await supabase
    .from('dependents')
    .select('id')
    .eq('id', dependentId)
    .eq('member_id', memberId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: 'Dependent not found on this membership' };
  return { success: true, data: { id: data.id } };
}

async function syncBillingAfterCoverageChange(
  supabase: StaffAuthContext['supabase'],
  memberId: string,
  organizationId: string,
): Promise<BillingRecalcResult | undefined> {
  try {
    return await recalculateMemberBillingFromCoverage(supabase, memberId, organizationId);
  } catch (error) {
    console.error('[crm coverage] billing recalculation failed', error);
    return undefined;
  }
}

function revalidateCrmMemberSurfaces(memberId: string) {
  revalidatePath(`/crm/members/${memberId}`);
  revalidatePath('/crm/records');
}

export async function crmStartDependentCoverage(input: {
  member_id: string;
  dependent_id: string;
  effective_from: string;
  reason?: CoverageReason | string;
  notes?: string;
}): Promise<ActionResult> {
  const auth = await getStaffAuthContext();
  if (!auth.success) return { success: false, error: auth.error };

  const { supabase, profileId, organizationId } = auth.context;

  const dateErr = validateCoverageDate(input.effective_from, 'Start date');
  if (dateErr) return { success: false, error: dateErr };

  const memberCheck = await assertMemberInOrg(supabase, input.member_id, organizationId);
  if (!memberCheck.success) return { success: false, error: memberCheck.error };

  const depCheck = await assertDependentForMember(
    supabase,
    input.dependent_id,
    input.member_id,
    organizationId,
  );
  if (!depCheck.success) return { success: false, error: depCheck.error };

  const { error: perErr } = await supabase.from('dependent_coverage_periods').insert({
    organization_id: organizationId,
    member_id: input.member_id,
    dependent_id: input.dependent_id,
    effective_from: input.effective_from,
    effective_to: null,
    reason: input.reason || 'resumed',
    notes: input.notes?.trim() || null,
    source: 'crm',
    created_by: profileId,
  });

  if (perErr) return { success: false, error: perErr.message };

  await supabase
    .from('dependents')
    .update({ included_in_enrollment: true })
    .eq('id', input.dependent_id);

  revalidateCrmMemberSurfaces(input.member_id);
  const billing = await syncBillingAfterCoverageChange(supabase, input.member_id, organizationId);
  return { success: true, billing };
}

export async function crmEndDependentCoverage(input: {
  member_id: string;
  dependent_id: string;
  effective_to: string;
  reason?: CoverageReason | string;
  notes?: string;
}): Promise<ActionResult> {
  const auth = await getStaffAuthContext();
  if (!auth.success) return { success: false, error: auth.error };

  const { supabase, organizationId } = auth.context;

  const dateErr = validateCoverageDate(input.effective_to, 'End date');
  if (dateErr) return { success: false, error: dateErr };

  const memberCheck = await assertMemberInOrg(supabase, input.member_id, organizationId);
  if (!memberCheck.success) return { success: false, error: memberCheck.error };

  const depCheck = await assertDependentForMember(
    supabase,
    input.dependent_id,
    input.member_id,
    organizationId,
  );
  if (!depCheck.success) return { success: false, error: depCheck.error };

  const { data: openPeriods, error: fetchErr } = await supabase
    .from('dependent_coverage_periods')
    .select('id')
    .eq('dependent_id', input.dependent_id)
    .eq('member_id', input.member_id)
    .is('effective_to', null);

  if (fetchErr) return { success: false, error: fetchErr.message };

  for (const period of openPeriods ?? []) {
    const { error } = await supabase
      .from('dependent_coverage_periods')
      .update({ effective_to: input.effective_to })
      .eq('id', period.id);
    if (error) return { success: false, error: error.message };
  }

  await supabase
    .from('dependents')
    .update({ included_in_enrollment: false })
    .eq('id', input.dependent_id);

  revalidateCrmMemberSurfaces(input.member_id);
  const billing = await syncBillingAfterCoverageChange(supabase, input.member_id, organizationId);
  return { success: true, billing };
}

export async function crmLogHistoricalCoveragePeriod(input: {
  member_id: string;
  dependent_id: string;
  effective_from: string;
  effective_to: string;
  reason?: CoverageReason | string;
  notes?: string;
}): Promise<ActionResult> {
  const auth = await getStaffAuthContext();
  if (!auth.success) return { success: false, error: auth.error };

  const { supabase, profileId, organizationId } = auth.context;

  const fromErr = validateCoverageDate(input.effective_from, 'Start date');
  if (fromErr) return { success: false, error: fromErr };
  const toErr = validateCoverageDate(input.effective_to, 'End date');
  if (toErr) return { success: false, error: toErr };
  const rangeErr = validateCoverageDateRange(input.effective_from, input.effective_to);
  if (rangeErr) return { success: false, error: rangeErr };

  const memberCheck = await assertMemberInOrg(supabase, input.member_id, organizationId);
  if (!memberCheck.success) return { success: false, error: memberCheck.error };

  const depCheck = await assertDependentForMember(
    supabase,
    input.dependent_id,
    input.member_id,
    organizationId,
  );
  if (!depCheck.success) return { success: false, error: depCheck.error };

  const { error } = await supabase.from('dependent_coverage_periods').insert({
    organization_id: organizationId,
    member_id: input.member_id,
    dependent_id: input.dependent_id,
    effective_from: input.effective_from,
    effective_to: input.effective_to,
    reason: input.reason || 'historical_period',
    notes: input.notes?.trim() || null,
    source: 'crm',
    created_by: profileId,
  });

  if (error) return { success: false, error: error.message };

  revalidateCrmMemberSurfaces(input.member_id);
  const billing = await syncBillingAfterCoverageChange(supabase, input.member_id, organizationId);
  return { success: true, billing };
}

export async function crmAddDependentWithCoverage(input: {
  member_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender?: string;
  relationship: string;
  coverage_start_date: string;
}): Promise<ActionResult<{ dependentId: string }>> {
  const auth = await getStaffAuthContext();
  if (!auth.success) return { success: false, error: auth.error };

  const { supabase, profileId, organizationId } = auth.context;

  if (!input.first_name?.trim() || !input.last_name?.trim() || !input.relationship?.trim()) {
    return { success: false, error: 'First name, last name, and relationship are required' };
  }
  if (!input.date_of_birth) {
    return { success: false, error: 'Date of birth is required' };
  }

  const startErr = validateCoverageDate(input.coverage_start_date, 'Coverage start date');
  if (startErr) return { success: false, error: startErr };

  const memberCheck = await assertMemberInOrg(supabase, input.member_id, organizationId);
  if (!memberCheck.success) return { success: false, error: memberCheck.error };

  const { data: inserted, error: insErr } = await supabase
    .from('dependents')
    .insert({
      member_id: input.member_id,
      organization_id: organizationId,
      first_name: input.first_name.trim(),
      last_name: input.last_name.trim(),
      date_of_birth: input.date_of_birth,
      gender: input.gender || null,
      relationship: input.relationship,
      included_in_enrollment: true,
    })
    .select('id')
    .single();

  if (insErr || !inserted?.id) {
    return { success: false, error: insErr?.message ?? 'Failed to add dependent' };
  }

  const { error: perErr } = await supabase.from('dependent_coverage_periods').insert({
    organization_id: organizationId,
    member_id: input.member_id,
    dependent_id: inserted.id,
    effective_from: input.coverage_start_date,
    effective_to: null,
    reason: 'initial_enrollment',
    notes: null,
    source: 'crm',
    created_by: profileId,
  });

  if (perErr) {
    return {
      success: false,
      error: `Dependent created but coverage period failed: ${perErr.message}`,
    };
  }

  revalidateCrmMemberSurfaces(input.member_id);
  const billing = await syncBillingAfterCoverageChange(supabase, input.member_id, organizationId);
  return { success: true, data: { dependentId: inserted.id }, billing };
}

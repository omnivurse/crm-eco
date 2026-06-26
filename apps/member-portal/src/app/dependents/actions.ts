'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getMemberForUser } from '@crm-eco/lib';
import {
  validateCoverageDate,
  validateCoverageDateRange,
  recalculateMemberBillingFromCoverage,
} from '@crm-eco/lib';
import type { CoverageReason, BillingRecalcResult } from '@crm-eco/lib';
import { findRecentDuplicate } from '@/lib/api/guard';

interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  billing?: BillingRecalcResult;
  /**
   * Set when the coverage change persisted but the downstream billing
   * recalculation failed. The dependent change itself succeeded
   * (success: true); the UI should warn that billing may be briefly out of date
   * rather than imply the whole action failed.
   */
  billingError?: string;
}

async function resolveMemberWriteContext(): Promise<
  | {
      supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
      memberId: string;
      organizationId: string;
      profileId: string;
    }
  | { error: string }
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Not authenticated' };

  const context = await getMemberForUser(supabase, user.id);
  if (!context?.member?.id || !context.member.organization_id) {
    return { error: 'Member account not found' };
  }

  return {
    supabase,
    memberId: context.member.id,
    organizationId: context.member.organization_id,
    profileId: context.profile.id,
  };
}

async function assertDependentOwnership(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
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
  if (!data) return { success: false, error: 'Dependent not found on your membership' };
  return { success: true, data: { id: data.id } };
}

function revalidateDependentSurfaces() {
  revalidatePath('/dependents');
  revalidatePath('/plan');
  revalidatePath('/billing');
}

/**
 * Recalculate member billing after a coverage change.
 *
 * The coverage write has already committed by the time this runs, so a recalc
 * failure must NOT fail the action — but it must no longer be silently
 * swallowed either (that let billing drift undetected). We return a structured
 * outcome so callers surface a non-blocking "billing may be briefly out of date"
 * warning to the member.
 */
async function syncBillingAfterCoverageChange(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  memberId: string,
  organizationId: string,
): Promise<{ billing?: BillingRecalcResult; billingError?: string }> {
  try {
    const billing = await recalculateMemberBillingFromCoverage(supabase, memberId, organizationId);
    return { billing };
  } catch (error) {
    console.error('[coverage] billing recalculation failed', error);
    return {
      billingError:
        error instanceof Error
          ? error.message
          : 'Billing could not be updated automatically. Our team has been notified.',
    };
  }
}

export async function addDependentWithCoverage(input: {
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  gender?: string;
  relationship: string;
  coverage_start_date: string;
}): Promise<ActionResult<{ dependentId: string }>> {
  const ctx = await resolveMemberWriteContext();
  if ('error' in ctx) return { success: false, error: ctx.error };

  if (!input.first_name?.trim() || !input.last_name?.trim() || !input.relationship?.trim()) {
    return { success: false, error: 'First name, last name, and relationship are required' };
  }

  if (!input.date_of_birth) {
    return { success: false, error: 'Date of birth is required' };
  }

  const startErr = validateCoverageDate(input.coverage_start_date, 'Coverage start date');
  if (startErr) return { success: false, error: startErr };

  // Idempotency: a double-submit of the same dependent (same name + DOB on this
  // membership) within the window returns the existing record instead of adding
  // a duplicate person.
  const duplicateDependentId = await findRecentDuplicate(ctx.supabase, 'dependents', {
    member_id: ctx.memberId,
    organization_id: ctx.organizationId,
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    date_of_birth: input.date_of_birth,
  });
  if (duplicateDependentId) {
    return { success: true, data: { dependentId: duplicateDependentId } };
  }

  const { data: inserted, error: insErr } = await ctx.supabase
    .from('dependents')
    .insert({
      member_id: ctx.memberId,
      organization_id: ctx.organizationId,
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

  const { error: perErr } = await ctx.supabase.from('dependent_coverage_periods').insert({
    organization_id: ctx.organizationId,
    member_id: ctx.memberId,
    dependent_id: inserted.id,
    effective_from: input.coverage_start_date,
    effective_to: null,
    reason: 'initial_enrollment',
    notes: null,
    source: 'portal',
    created_by: ctx.profileId,
  });

  if (perErr) {
    return {
      success: false,
      error: `Dependent created but coverage period failed: ${perErr.message}`,
    };
  }

  revalidateDependentSurfaces();
  const billingSync = await syncBillingAfterCoverageChange(
    ctx.supabase,
    ctx.memberId,
    ctx.organizationId,
  );
  return { success: true, data: { dependentId: inserted.id }, ...billingSync };
}

export async function updateDependentInfo(input: {
  dependent_id: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  gender?: string;
  relationship: string;
}): Promise<ActionResult> {
  const ctx = await resolveMemberWriteContext();
  if ('error' in ctx) return { success: false, error: ctx.error };

  const owned = await assertDependentOwnership(
    ctx.supabase,
    input.dependent_id,
    ctx.memberId,
    ctx.organizationId,
  );
  if (!owned.success) return owned;

  const { error } = await ctx.supabase
    .from('dependents')
    .update({
      first_name: input.first_name.trim(),
      last_name: input.last_name.trim(),
      ...(input.date_of_birth ? { date_of_birth: input.date_of_birth } : {}),
      gender: input.gender || null,
      relationship: input.relationship,
    })
    .eq('id', input.dependent_id);

  if (error) return { success: false, error: error.message };

  revalidateDependentSurfaces();
  return { success: true };
}

export async function startDependentCoverage(input: {
  dependent_id: string;
  effective_from: string;
  reason?: CoverageReason | string;
  notes?: string;
}): Promise<ActionResult> {
  const ctx = await resolveMemberWriteContext();
  if ('error' in ctx) return { success: false, error: ctx.error };

  const dateErr = validateCoverageDate(input.effective_from, 'Start date');
  if (dateErr) return { success: false, error: dateErr };

  const owned = await assertDependentOwnership(
    ctx.supabase,
    input.dependent_id,
    ctx.memberId,
    ctx.organizationId,
  );
  if (!owned.success) return owned;

  const { error: perErr } = await ctx.supabase.from('dependent_coverage_periods').insert({
    organization_id: ctx.organizationId,
    member_id: ctx.memberId,
    dependent_id: input.dependent_id,
    effective_from: input.effective_from,
    effective_to: null,
    reason: input.reason || 'resumed',
    notes: input.notes?.trim() || null,
    source: 'portal',
    created_by: ctx.profileId,
  });

  if (perErr) return { success: false, error: perErr.message };

  await ctx.supabase
    .from('dependents')
    .update({ included_in_enrollment: true })
    .eq('id', input.dependent_id);

  revalidateDependentSurfaces();
  const billingSync = await syncBillingAfterCoverageChange(
    ctx.supabase,
    ctx.memberId,
    ctx.organizationId,
  );
  return { success: true, ...billingSync };
}

export async function endDependentCoverage(input: {
  dependent_id: string;
  effective_to: string;
  reason?: CoverageReason | string;
  notes?: string;
}): Promise<ActionResult> {
  const ctx = await resolveMemberWriteContext();
  if ('error' in ctx) return { success: false, error: ctx.error };

  const dateErr = validateCoverageDate(input.effective_to, 'End date');
  if (dateErr) return { success: false, error: dateErr };

  const owned = await assertDependentOwnership(
    ctx.supabase,
    input.dependent_id,
    ctx.memberId,
    ctx.organizationId,
  );
  if (!owned.success) return owned;

  const { data: openPeriods, error: fetchErr } = await ctx.supabase
    .from('dependent_coverage_periods')
    .select('id')
    .eq('dependent_id', input.dependent_id)
    .eq('member_id', ctx.memberId)
    .is('effective_to', null);

  if (fetchErr) return { success: false, error: fetchErr.message };

  for (const p of openPeriods ?? []) {
    const { error } = await ctx.supabase
      .from('dependent_coverage_periods')
      .update({ effective_to: input.effective_to })
      .eq('id', p.id);
    if (error) return { success: false, error: error.message };
  }

  await ctx.supabase
    .from('dependents')
    .update({ included_in_enrollment: false })
    .eq('id', input.dependent_id);

  revalidateDependentSurfaces();
  const billingSync = await syncBillingAfterCoverageChange(
    ctx.supabase,
    ctx.memberId,
    ctx.organizationId,
  );
  return { success: true, ...billingSync };
}

export async function logHistoricalCoveragePeriod(input: {
  dependent_id: string;
  effective_from: string;
  effective_to: string;
  reason?: CoverageReason | string;
  notes?: string;
}): Promise<ActionResult> {
  const ctx = await resolveMemberWriteContext();
  if ('error' in ctx) return { success: false, error: ctx.error };

  const fromErr = validateCoverageDate(input.effective_from, 'Start date');
  if (fromErr) return { success: false, error: fromErr };
  const toErr = validateCoverageDate(input.effective_to, 'End date');
  if (toErr) return { success: false, error: toErr };
  const rangeErr = validateCoverageDateRange(input.effective_from, input.effective_to);
  if (rangeErr) return { success: false, error: rangeErr };

  const owned = await assertDependentOwnership(
    ctx.supabase,
    input.dependent_id,
    ctx.memberId,
    ctx.organizationId,
  );
  if (!owned.success) return owned;

  const { error } = await ctx.supabase.from('dependent_coverage_periods').insert({
    organization_id: ctx.organizationId,
    member_id: ctx.memberId,
    dependent_id: input.dependent_id,
    effective_from: input.effective_from,
    effective_to: input.effective_to,
    reason: input.reason || 'historical_period',
    notes: input.notes?.trim() || null,
    source: 'portal',
    created_by: ctx.profileId,
  });

  if (error) return { success: false, error: error.message };

  revalidateDependentSurfaces();
  const billingSync = await syncBillingAfterCoverageChange(
    ctx.supabase,
    ctx.memberId,
    ctx.organizationId,
  );
  return { success: true, ...billingSync };
}

export async function purgeDependentRecord(dependentId: string): Promise<ActionResult> {
  const ctx = await resolveMemberWriteContext();
  if ('error' in ctx) return { success: false, error: ctx.error };

  const owned = await assertDependentOwnership(
    ctx.supabase,
    dependentId,
    ctx.memberId,
    ctx.organizationId,
  );
  if (!owned.success) return owned;

  const { error } = await ctx.supabase.from('dependents').delete().eq('id', dependentId);
  if (error) return { success: false, error: error.message };

  revalidateDependentSurfaces();
  const billingSync = await syncBillingAfterCoverageChange(
    ctx.supabase,
    ctx.memberId,
    ctx.organizationId,
  );
  return { success: true, ...billingSync };
}

/**
 * Canonical dependent + coverage writer for ALL surfaces (admin, CRM, member portal).
 *
 * This is the ONE implementation of dependent/coverage mutation logic — admin
 * server actions, CRM coverage actions, and the member portal must delegate here
 * rather than re-implement (no duplicated business logic).
 *
 * ── IMPORTANT: ctx.supabase MUST be a SERVICE-ROLE client ──────────────────────
 * Coverage changes trigger recalculateMemberBillingFromCoverage, which writes
 * `memberships` and `billing_schedules`. Under RLS those tables are writable only
 * by owner/admin (and service_role) — NOT by staff or members. So if a caller
 * passes its RLS-bound cookie client, the recalc's UPDATEs match zero rows and
 * billing silently drifts. Every caller therefore:
 *   1. authenticates + authorizes the actor with its OWN (cookie/RLS) client, then
 *   2. constructs a service-role client (server-only) and passes it here.
 * The functions below re-assert org/dependent membership in code as defense in
 * depth, so the service-role client never escapes its intended scope.
 *
 * Recalc contract: a coverage write that succeeds but whose downstream recalc
 * fails returns success:true WITH a populated `billingError`. Callers MUST surface
 * billingError (never swallow it). True atomicity (write+recalc in one txn) is a
 * future RPC; until then billingError is the signal that billing needs attention.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { recalculateMemberBillingFromCoverage, type BillingRecalcResult } from './membershipBillingRecalc';
import {
  validateCoverageDate,
  validateCoverageDateRange,
  type CoverageReason,
} from './dependentCoverage';

export type StaffCoverageSource = 'admin' | 'crm' | 'portal' | 'import' | 'system';

export interface StaffCoverageContext {
  /** MUST be a service-role client — see file header. */
  supabase: SupabaseClient;
  organizationId: string;
  profileId: string;
  source: StaffCoverageSource;
}

export interface StaffActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  billing?: BillingRecalcResult;
  /** Coverage write committed but recalc failed — callers MUST surface this. */
  billingError?: string;
}

async function assertMemberInOrg(
  supabase: SupabaseClient,
  memberId: string,
  organizationId: string,
): Promise<StaffActionResult<{ id: string }>> {
  const { data, error } = await supabase
    .from('members')
    .select('id')
    .eq('id', memberId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: 'Member not found in this organization' };
  return { success: true, data: { id: data.id } };
}

async function assertDependentForMember(
  supabase: SupabaseClient,
  dependentId: string,
  memberId: string,
  organizationId: string,
): Promise<StaffActionResult<{ id: string }>> {
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

/**
 * Double-submit guard: a dependent with the same member + name + DOB created in
 * the recent past is treated as the same person (idempotent add). Returns the
 * existing id when a recent duplicate exists, else null.
 */
async function findRecentDuplicateDependent(
  supabase: SupabaseClient,
  args: {
    member_id: string;
    organization_id: string;
    first_name: string;
    last_name: string;
    date_of_birth: string;
    windowSeconds?: number;
  },
): Promise<string | null> {
  const windowMs = (args.windowSeconds ?? 60) * 1000;
  const { data } = await supabase
    .from('dependents')
    .select('id, created_at')
    .eq('member_id', args.member_id)
    .eq('organization_id', args.organization_id)
    .eq('first_name', args.first_name)
    .eq('last_name', args.last_name)
    .eq('date_of_birth', args.date_of_birth)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.id || !data?.created_at) return null;
  const created = Date.parse(data.created_at as string);
  if (Number.isFinite(created) && Date.now() - created <= windowMs) {
    return data.id as string;
  }
  return null;
}

async function syncBillingAfterCoverageChange(
  supabase: SupabaseClient,
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
          : 'Billing could not be updated automatically.',
    };
  }
}

export async function staffAddDependentWithCoverage(
  ctx: StaffCoverageContext,
  input: {
    member_id: string;
    first_name: string;
    last_name: string;
    date_of_birth: string;
    gender?: string;
    relationship: string;
    coverage_start_date: string;
  },
): Promise<StaffActionResult<{ dependentId: string }>> {
  const { supabase, organizationId, profileId, source } = ctx;

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

  // Idempotent double-submit guard.
  const dupId = await findRecentDuplicateDependent(supabase, {
    member_id: input.member_id,
    organization_id: organizationId,
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    date_of_birth: input.date_of_birth,
  });
  if (dupId) return { success: true, data: { dependentId: dupId } };

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
    source,
    created_by: profileId,
  });

  if (perErr) {
    return {
      success: false,
      error: `Dependent created but coverage period failed: ${perErr.message}`,
    };
  }

  const billingSync = await syncBillingAfterCoverageChange(supabase, input.member_id, organizationId);
  return { success: true, data: { dependentId: inserted.id }, ...billingSync };
}

export async function staffUpdateDependentInfo(
  ctx: StaffCoverageContext,
  input: {
    member_id: string;
    dependent_id: string;
    first_name: string;
    last_name: string;
    date_of_birth?: string;
    gender?: string;
    relationship: string;
  },
): Promise<StaffActionResult> {
  const { supabase, organizationId } = ctx;

  const depCheck = await assertDependentForMember(
    supabase,
    input.dependent_id,
    input.member_id,
    organizationId,
  );
  if (!depCheck.success) return { success: false, error: depCheck.error };

  // PII-only edit: no coverage change, so no recalc needed.
  const { error } = await supabase
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
  return { success: true };
}

export async function staffStartDependentCoverage(
  ctx: StaffCoverageContext,
  input: {
    member_id: string;
    dependent_id: string;
    effective_from: string;
    reason?: CoverageReason | string;
    notes?: string;
  },
): Promise<StaffActionResult> {
  const { supabase, organizationId, profileId, source } = ctx;

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
    source,
    created_by: profileId,
  });

  if (perErr) return { success: false, error: perErr.message };

  const { error: incErr } = await supabase
    .from('dependents')
    .update({ included_in_enrollment: true })
    .eq('id', input.dependent_id);
  if (incErr) return { success: false, error: incErr.message };

  const billingSync = await syncBillingAfterCoverageChange(supabase, input.member_id, organizationId);
  return { success: true, ...billingSync };
}

export async function staffEndDependentCoverage(
  ctx: StaffCoverageContext,
  input: {
    member_id: string;
    dependent_id: string;
    effective_to: string;
    reason?: CoverageReason | string;
    notes?: string;
  },
): Promise<StaffActionResult> {
  const { supabase, organizationId } = ctx;

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

  const { error: incErr } = await supabase
    .from('dependents')
    .update({ included_in_enrollment: false })
    .eq('id', input.dependent_id);
  if (incErr) return { success: false, error: incErr.message };

  const billingSync = await syncBillingAfterCoverageChange(supabase, input.member_id, organizationId);
  return { success: true, ...billingSync };
}

export async function staffLogHistoricalCoveragePeriod(
  ctx: StaffCoverageContext,
  input: {
    member_id: string;
    dependent_id: string;
    effective_from: string;
    effective_to: string;
    reason?: CoverageReason | string;
    notes?: string;
  },
): Promise<StaffActionResult> {
  const { supabase, organizationId, profileId, source } = ctx;

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
    source,
    created_by: profileId,
  });

  if (error) return { success: false, error: error.message };

  const billingSync = await syncBillingAfterCoverageChange(supabase, input.member_id, organizationId);
  return { success: true, ...billingSync };
}

export async function staffPurgeDependentRecord(
  ctx: StaffCoverageContext,
  input: { member_id: string; dependent_id: string },
): Promise<StaffActionResult> {
  const { supabase, organizationId, profileId } = ctx;

  const depCheck = await assertDependentForMember(
    supabase,
    input.dependent_id,
    input.member_id,
    organizationId,
  );
  if (!depCheck.success) return { success: false, error: depCheck.error };

  // Soft-delete (move to Trash) instead of a physical delete: the dependent and
  // its coverage history stay recoverable via Undo. Because the billing recalc
  // and every dependent list exclude soft-deleted rows, the member is no longer
  // billed for the removed dependent — matching the old hard-delete behavior.
  const { data: updated, error } = await supabase
    .from('dependents')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: profileId,
      deleted_origin: 'member',
    })
    .eq('id', input.dependent_id)
    .is('deleted_at', null)
    .select('id');
  if (error) return { success: false, error: error.message };
  if (!updated || updated.length === 0) {
    return { success: false, error: 'Dependent not found or already removed' };
  }

  const billingSync = await syncBillingAfterCoverageChange(supabase, input.member_id, organizationId);
  return { success: true, ...billingSync };
}

export async function staffRestoreDependentRecord(
  ctx: StaffCoverageContext,
  input: { member_id: string; dependent_id: string },
): Promise<StaffActionResult> {
  const { supabase, organizationId } = ctx;

  const depCheck = await assertDependentForMember(
    supabase,
    input.dependent_id,
    input.member_id,
    organizationId,
  );
  if (!depCheck.success) return { success: false, error: depCheck.error };

  const { data: updated, error } = await supabase
    .from('dependents')
    .update({ deleted_at: null, deleted_by: null, deleted_origin: null })
    .eq('id', input.dependent_id)
    .not('deleted_at', 'is', null)
    .select('id');
  if (error) return { success: false, error: error.message };
  if (!updated || updated.length === 0) {
    return { success: false, error: 'Dependent not found or already active' };
  }

  // Re-bill now that the dependent is covered again.
  const billingSync = await syncBillingAfterCoverageChange(supabase, input.member_id, organizationId);
  return { success: true, ...billingSync };
}

/**
 * Shared public enrollment submit orchestrator helpers.
 *
 * Admin and member-portal POST /api/enroll/submit both call into this module
 * for Adult Intake projection, member find-or-create, and household → dependents.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { pickActiveMemberByName } from '../members/memberDedup';
import type { Json } from '../types/database';
import {
  projectAdultIntakeToMember,
  projectAdultIntakeToCustomFields,
  projectHouseholdToDependentRows,
  type AdultIntakeProjectionInput,
  type HouseholdDependentInput,
} from './adultIntakeProjection';
import { resolvePendingMemberEffectiveDate } from './coverageStartDate';

export const ENROLLMENT_COMPLETION_FLAG = 'ENROLLMENT_COMPLETION_ENABLED';

export function isEnrollmentCompletionEnabled(): boolean {
  return process.env.ENROLLMENT_COMPLETION_ENABLED === 'true';
}

export interface PublicSubmitMemberBody extends AdultIntakeProjectionInput {
  first_name: string;
  last_name: string;
  email: string;
}

export interface FindOrCreateMemberResult {
  memberId: string;
  created: boolean;
}

export async function findOrCreatePublicMember(
  supabase: SupabaseClient,
  opts: {
    organizationId: string;
    member: PublicSubmitMemberBody;
    coverageStart: string;
    source: string;
    advisorId?: string | null;
  }
): Promise<FindOrCreateMemberResult | { error: string; message?: string; status: number }> {
  const projected = projectAdultIntakeToMember(opts.member);
  const normalizedEmail = projected.email;

  const { data: emailMatches } = await supabase
    .from('members')
    .select('id, first_name, last_name, merged_into_id')
    .eq('organization_id', opts.organizationId)
    .eq('email', normalizedEmail)
    .is('merged_into_id', null)
    .order('id', { ascending: true })
    .limit(200);

  const existingMember = pickActiveMemberByName(
    emailMatches ?? [],
    projected.first_name,
    projected.last_name
  );

  if (existingMember) {
    // Refresh contact/address on returning prospect (Adult Intake write path).
    await supabase
      .from('members')
      .update({
        phone: projected.phone,
        phone2: projected.phone2,
        date_of_birth: projected.date_of_birth,
        address_line1: projected.address_line1,
        address_line2: projected.address_line2,
        city: projected.city,
        state: projected.state,
        postal_code: projected.postal_code,
        ...(opts.advisorId ? { advisor_id: opts.advisorId } : {}),
      })
      .eq('id', existingMember.id)
      .eq('organization_id', opts.organizationId);

    return { memberId: existingMember.id, created: false };
  }

  const memberNumber = `M-${Date.now().toString(36).toUpperCase()}`;
  const { data: memberRow, error: memberErr } = await supabase
    .from('members')
    .insert({
      organization_id: opts.organizationId,
      member_number: memberNumber,
      first_name: projected.first_name,
      last_name: projected.last_name,
      email: normalizedEmail,
      phone: projected.phone,
      phone2: projected.phone2,
      date_of_birth: projected.date_of_birth,
      address_line1: projected.address_line1,
      address_line2: projected.address_line2,
      city: projected.city,
      state: projected.state,
      postal_code: projected.postal_code,
      status: 'pending',
      effective_date: opts.coverageStart,
      source: opts.source,
      ...(opts.advisorId ? { advisor_id: opts.advisorId } : {}),
    })
    .select('id')
    .single();

  if (memberErr || !memberRow) {
    if (memberErr?.code === '23505') {
      const { data: retryMatches } = await supabase
        .from('members')
        .select('id, first_name, last_name, merged_into_id')
        .eq('organization_id', opts.organizationId)
        .eq('email', normalizedEmail)
        .is('merged_into_id', null)
        .order('id', { ascending: true })
        .limit(1000);
      const recovered = pickActiveMemberByName(
        retryMatches ?? [],
        projected.first_name,
        projected.last_name
      );
      if (!recovered) {
        return {
          error: 'member_create_failed',
          message: memberErr.message,
          status: 500,
        };
      }
      return { memberId: recovered.id, created: false };
    }
    return {
      error: 'member_create_failed',
      message: memberErr?.message,
      status: 500,
    };
  }

  return { memberId: memberRow.id, created: true };
}

/**
 * Insert dependents rows for household members, return RPC-shaped dependent links.
 * Failures are non-fatal for empty household; returns [] on insert error so enrollment
 * can still proceed (snapshot still holds household).
 */
export async function createHouseholdDependentsForEnrollment(
  supabase: SupabaseClient,
  opts: {
    organizationId: string;
    memberId: string;
    household: HouseholdDependentInput[];
  }
): Promise<Array<{ dependentId: string; relationship: string; additionalCost: number }>> {
  if (!opts.household.length) return [];

  const rows = projectHouseholdToDependentRows(
    opts.organizationId,
    opts.memberId,
    opts.household
  );

  const { data, error } = await supabase.from('dependents').insert(rows).select('id, relationship');

  if (error || !data) {
    console.error('createHouseholdDependentsForEnrollment:', error?.message);
    return [];
  }

  return data.map((d) => ({
    dependentId: d.id,
    relationship: d.relationship || 'dependent',
    additionalCost: 0,
  }));
}

export function buildAdultIntakeCustomFields(
  member: AdultIntakeProjectionInput,
  base: Record<string, Json | undefined> = {}
): Record<string, Json | undefined> {
  return {
    ...base,
    ...projectAdultIntakeToCustomFields(member),
    adult_intake: true,
  };
}

/** Early look-up so retries don't insert orphan dependents before create_enrollment_tx. */
export async function findEnrollmentByDraftIdempotencyKey(
  supabase: SupabaseClient,
  organizationId: string,
  draftId: string
): Promise<string | null> {
  const key = `enroll_${draftId}`;
  const { data } = await supabase
    .from('enrollments')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('idempotency_key', key)
    .maybeSingle();
  return data?.id ?? null;
}

export { resolvePendingMemberEffectiveDate, projectAdultIntakeToMember };

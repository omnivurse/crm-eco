/**
 * Member Portal Helpers
 * 
 * Functions for resolving member data in the member-facing portal.
 * Members authenticate via Supabase Auth and are linked to profiles/members.
 */

import type { Database } from '../types/database';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type MemberRow = Database['public']['Tables']['members']['Row'];

export interface MemberPortalContext {
  profile: ProfileRow;
  member: MemberRow;
}

/**
 * Resolve the member record for an authenticated profile.
 *
 * Resolution strategy (preferred → fallback):
 * 1. profiles.member_id (populated by migration 202605220009 and backfilled
 *    from email match — O(1) lookup, never wrong if both rows still exist).
 * 2. Fallback: members.email = profile.email within the same organization.
 *    Used for profiles that haven't been backfilled yet or where the
 *    member row was recreated after the backfill ran.
 *
 * When a member is resolved via the email fallback, we opportunistically
 * persist the linkage on the profile so future lookups hit the fast path.
 *
 * @param supabase - Supabase client instance
 * @param userId - The authenticated user's ID (from auth.users)
 * @returns MemberPortalContext if found, null if not resolvable
 */
export async function getMemberForUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string
): Promise<MemberPortalContext | null> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (profileError || !profile) {
    console.error('Failed to get profile for user:', profileError);
    return null;
  }

  // Fast path: profiles.member_id is already populated.
  if (profile.member_id) {
    const { data: member } = await supabase
      .from('members')
      .select('*')
      .eq('id', profile.member_id)
      .maybeSingle();

    if (member) {
      return { profile, member };
    }
    // Linked member was deleted — fall through to the email fallback.
  }

  // Fallback: match members.email within the same organization.
  // After B1 (shared household email), multiple active members may share one
  // address — disambiguate by profile full_name when possible; never guess.
  const { data: emailMatches, error: memberError } = await supabase
    .from('members')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .eq('email', profile.email)
    .limit(5);

  if (memberError || !emailMatches?.length) {
    return null;
  }

  let member: MemberRow | undefined;
  if (emailMatches.length === 1) {
    member = emailMatches[0] as MemberRow;
  } else {
    const normalizedProfileName = normalizePersonName(profile.full_name);
    const nameMatches = emailMatches.filter((row: MemberRow) => {
      return (
        normalizePersonName(`${row.first_name ?? ''} ${row.last_name ?? ''}`) ===
        normalizedProfileName
      );
    });
    if (nameMatches.length === 1) {
      member = nameMatches[0] as MemberRow;
    } else {
      // Ambiguous shared-email household — do not link the wrong person.
      console.warn(
        'getMemberForUser: ambiguous email match in org',
        profile.organization_id,
        profile.email,
      );
      return null;
    }
  }

  // Self-heal: write the linkage back so the next call hits the fast path.
  if (!profile.member_id) {
    await supabase
      .from('profiles')
      .update({ member_id: member.id })
      .eq('id', profile.id);
  }

  return { profile, member };
}

function normalizePersonName(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Get member's active membership(s) if any
 */
export async function getMemberMemberships(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  memberId: string,
  organizationId: string
) {
  const { data: memberships, error } = await supabase
    .from('memberships')
    .select(`
      *,
      plans:plan_id (id, name, code, monthly_share)
    `)
    .eq('member_id', memberId)
    .eq('organization_id', organizationId)
    .order('effective_date', { ascending: false });

  if (error) {
    console.error('Failed to get memberships:', error);
    return [];
  }

  return memberships || [];
}

/**
 * Get member's enrollment history
 */
export async function getMemberEnrollments(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  memberId: string,
  organizationId: string
) {
  const { data: enrollments, error } = await supabase
    .from('enrollments')
    .select(`
      id,
      enrollment_number,
      status,
      enrollment_mode,
      enrollment_source,
      requested_effective_date,
      effective_date,
      created_at,
      updated_at,
      plans:selected_plan_id (id, name, code)
    `)
    .eq('primary_member_id', memberId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to get enrollments:', error);
    return [];
  }

  return enrollments || [];
}

/**
 * Check if member has any active or pending enrollments
 */
export async function hasActiveEnrollment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  memberId: string,
  organizationId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('id')
    .eq('primary_member_id', memberId)
    .eq('organization_id', organizationId)
    .in('status', ['draft', 'in_progress', 'submitted'])
    .limit(1);

  if (error) {
    console.error('Failed to check active enrollment:', error);
    return false;
  }

  return (data?.length || 0) > 0;
}

/**
 * Check if member has any active membership
 */
export async function hasActiveMembership(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  memberId: string,
  organizationId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('memberships')
    .select('id')
    .eq('member_id', memberId)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .limit(1);

  if (error) {
    console.error('Failed to check active membership:', error);
    return false;
  }

  return (data?.length || 0) > 0;
}

/**
 * Get member's recent needs/sharing activity
 */
export async function getMemberNeeds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  memberId: string,
  organizationId: string,
  limit: number = 5
) {
  const { data: needs, error } = await supabase
    .from('needs')
    .select(`
      id,
      need_type,
      description,
      total_amount,
      eligible_amount,
      reimbursed_amount,
      status,
      urgency_light,
      incident_date,
      created_at,
      updated_at
    `)
    .eq('member_id', memberId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to get member needs:', error);
    return [];
  }

  return needs || [];
}

/**
 * Get member's recent support tickets
 */
export async function getMemberTickets(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  memberId: string,
  organizationId: string,
  limit: number = 5
) {
  const { data: tickets, error } = await supabase
    .from('tickets')
    .select(`
      id,
      subject,
      status,
      priority,
      category,
      created_at
    `)
    .eq('member_id', memberId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to get member tickets:', error);
    return [];
  }

  return tickets || [];
}

/**
 * Get member's latest self-serve enrollment (for portal)
 */
export async function getLatestSelfServeEnrollment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  memberId: string,
  organizationId: string
) {
  const { data: enrollment, error } = await supabase
    .from('enrollments')
    .select(`
      id,
      enrollment_number,
      status,
      enrollment_mode,
      updated_at,
      created_at,
      plans:selected_plan_id (id, name, code)
    `)
    .eq('primary_member_id', memberId)
    .eq('organization_id', organizationId)
    .eq('enrollment_mode', 'member_self_serve')
    .in('status', ['draft', 'in_progress', 'submitted'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Failed to get latest enrollment:', error);
    return null;
  }

  return enrollment;
}

/**
 * Get a specific enrollment for the member (with ownership check)
 */
export async function getEnrollmentForMember(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  enrollmentId: string,
  memberId: string,
  organizationId: string
) {
  const { data: enrollment, error } = await supabase
    .from('enrollments')
    .select(`
      *,
      plans:selected_plan_id (id, name, code, monthly_share, description)
    `)
    .eq('id', enrollmentId)
    .eq('primary_member_id', memberId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) {
    console.error('Failed to get enrollment:', error);
    return null;
  }

  return enrollment;
}

/**
 * Get enrollment steps for a given enrollment
 */
export async function getEnrollmentSteps(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  enrollmentId: string
) {
  // Define step order for consistent display
  const stepOrder = ['intake', 'household', 'plan_selection', 'compliance', 'payment', 'confirmation'];

  const { data: rawSteps, error } = await supabase
    .from('enrollment_steps')
    .select(`
      id,
      step_key,
      is_completed,
      completed_at,
      payload,
      created_at,
      updated_at
    `)
    .eq('enrollment_id', enrollmentId);

  if (error) {
    console.error('Failed to get enrollment steps:', error);
    return [];
  }

  // Adapt DB shape (is_completed, payload) to the legacy API shape (status, data)
  // that the wizard and admin UIs expect.
  const steps = (rawSteps ?? []).map(
    (s: { id: string; step_key: string; is_completed: boolean; completed_at: string | null; payload: unknown; created_at: string; updated_at: string }) => ({
      id: s.id,
      step_key: s.step_key,
      status: s.is_completed ? 'completed' : 'pending',
      completed_at: s.completed_at,
      data: s.payload,
      created_at: s.created_at,
      updated_at: s.updated_at,
    })
  );

  // Sort steps by our defined order
  const sortedSteps = steps.sort((a: { step_key: string }, b: { step_key: string }) => {
    const aIndex = stepOrder.indexOf(a.step_key);
    const bIndex = stepOrder.indexOf(b.step_key);
    return aIndex - bIndex;
  });

  return sortedSteps;
}

/**
 * Get enrollment audit log entries
 */
export async function getEnrollmentAuditLog(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  enrollmentId: string,
  limit: number = 20
) {
  const { data: logs, error } = await supabase
    .from('enrollment_audit_log')
    .select(`
      id,
      event_type,
      message,
      data_before,
      data_after,
      actor_profile_id,
      created_at
    `)
    .eq('enrollment_id', enrollmentId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to get enrollment audit log:', error);
    return [];
  }

  // Map actor_profile_id to user_id for legacy callers expecting that field.
  return (logs ?? []).map(
    (log: { actor_profile_id: string | null; [k: string]: unknown }) => ({
      ...log,
      user_id: log.actor_profile_id,
    })
  );
}

/**
 * Get membership related to an enrollment
 */
export async function getMembershipForEnrollment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  memberId: string,
  planId: string | null,
  organizationId: string
) {
  if (!planId) return null;

  const { data: membership, error } = await supabase
    .from('memberships')
    .select(`
      *,
      plans:plan_id (id, name, code, monthly_share)
    `)
    .eq('member_id', memberId)
    .eq('plan_id', planId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Failed to get membership for enrollment:', error);
    return null;
  }

  return membership;
}

/**
 * Get a specific need for the member (with ownership check)
 */
export async function getNeedForMember(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  needId: string,
  memberId: string,
  organizationId: string
) {
  const { data: need, error } = await supabase
    .from('needs')
    .select(`
      id,
      organization_id,
      member_id,
      advisor_id,
      need_type,
      description,
      total_amount,
      iua_amount,
      eligible_amount,
      reimbursed_amount,
      status,
      urgency_light,
      sla_target_date,
      incident_date,
      facility_name,
      payment_method,
      payment_status,
      payment_date,
      amount_paid,
      reimbursement_method,
      reimbursement_account_last4,
      reimbursement_status,
      has_member_consent,
      custom_fields,
      created_at,
      updated_at
    `)
    .eq('id', needId)
    .eq('member_id', memberId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) {
    console.error('Failed to get need for member:', error);
    return null;
  }

  return need;
}

/**
 * Get events/timeline for a specific need
 */
export async function getNeedEvents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  needId: string,
  limit: number = 50
) {
  const { data: events, error } = await supabase
    .from('need_events')
    .select(`
      id,
      need_id,
      event_type,
      description,
      note,
      old_status,
      new_status,
      metadata,
      created_by_profile_id,
      created_at,
      occurred_at
    `)
    .eq('need_id', needId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to get need events:', error);
    return [];
  }

  return events || [];
}

// Re-export MemberRow type for use in components
export type { MemberRow };


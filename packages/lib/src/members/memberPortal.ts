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
 * Resolution strategy:
 * 1. Try profiles.member_id if that column exists (future enhancement)
 * 2. Fallback: Match members.email = profile.email within same org
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
  // Get the profile for this user
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (profileError || !profile) {
    console.error('Failed to get profile for user:', profileError);
    return null;
  }

  // Try to find the member by email within the same organization
  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .eq('email', profile.email)
    .single();

  if (memberError || !member) {
    // Member not found - this might be a staff user without a member record
    console.log('No member record found for profile:', profile.email);
    return null;
  }

  return { profile, member };
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
      incident_date,
      created_at
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

  const { data: steps, error } = await supabase
    .from('enrollment_steps')
    .select(`
      id,
      step_key,
      status,
      completed_at,
      data,
      created_at,
      updated_at
    `)
    .eq('enrollment_id', enrollmentId);

  if (error) {
    console.error('Failed to get enrollment steps:', error);
    return [];
  }

  // Sort steps by our defined order
  const sortedSteps = (steps || []).sort((a: { step_key: string }, b: { step_key: string }) => {
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
      user_id,
      created_at
    `)
    .eq('enrollment_id', enrollmentId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to get enrollment audit log:', error);
    return [];
  }

  return logs || [];
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


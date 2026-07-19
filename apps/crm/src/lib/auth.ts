import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { cache } from 'react';
import type { Database } from '@crm-eco/lib/types';
import { getActiveTenant } from '@/lib/tenant';

type Profile = Database['public']['Tables']['profiles']['Row'] & { organization_id: string };

export type UserRole = 'owner' | 'admin' | 'advisor' | 'staff';

export interface CurrentUserProfile extends Profile {
  advisorId?: string | null;
  /** When set, user reached this org via tenant switch (organization_members). */
  active_tenant_role?: string | null;
}

/**
 * Internal function to fetch profile (uncached)
 * This is wrapped by getCurrentProfile with React's cache()
 */
async function fetchCurrentProfile(): Promise<CurrentUserProfile | null> {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profileData, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error || !profileData) {
    console.error('Error fetching profile:', error);
    return null;
  }

  const profile = profileData as Profile;

  // If the user is an advisor, get their advisor ID
  let advisorId: string | null = null;
  if (profile.role === 'advisor') {
    const { data: advisorData } = await supabase
      .from('advisors')
      .select('id')
      .eq('profile_id', profile.id)
      .single();

    const advisor = advisorData as { id: string } | null;
    advisorId = advisor?.id ?? null;
  }

  // Match getAuthProfile: override organization_id when the user has switched
  // tenants so reports/tickets scoped via this helper use the active org.
  const tenant = await getActiveTenant();
  if (tenant && tenant.organizationId !== profile.organization_id) {
    return {
      ...profile,
      organization_id: tenant.organizationId,
      advisorId,
      active_tenant_role: tenant.role,
    } as CurrentUserProfile;
  }

  return {
    ...profile,
    advisorId,
    active_tenant_role: null,
  } as CurrentUserProfile;
}

/**
 * Get the current user's profile including their role and organization
 *
 * This function is memoized per-request using React's cache() function.
 * Multiple calls during the same request will reuse the cached result,
 * significantly reducing database queries (~5M -> fraction of that).
 */
export const getCurrentProfile = cache(fetchCurrentProfile);

/**
 * Get the advisor ID for the current user if they are an advisor
 */
export async function getUserAdvisorId(): Promise<string | null> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'advisor') return null;
  return profile.advisorId ?? null;
}

/**
 * Check if the user has admin or owner privileges
 */
export function isAdminOrOwner(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * Check if the user is an advisor
 */
export function isAdvisor(role: string | null | undefined): boolean {
  return role === 'advisor';
}

/**
 * Check if the user is staff
 */
export function isStaff(role: string | null | undefined): boolean {
  return role === 'staff';
}

/**
 * Get role display name for UI
 */
export function getRoleDisplayName(role: string | null | undefined): string {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Administrator';
    case 'advisor':
      return 'Advisor';
    case 'staff':
      return 'Staff';
    default:
      return 'User';
  }
}

/**
 * Interface for role-based query context
 */
export interface RoleQueryContext {
  organizationId: string;
  role: UserRole;
  profileId: string;
  advisorId: string | null;
  isAdmin: boolean;
}

/**
 * Get the context needed for role-based queries
 */
export async function getRoleQueryContext(): Promise<RoleQueryContext | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  return {
    organizationId: profile.organization_id,
    role: profile.role as UserRole,
    profileId: profile.id,
    advisorId: profile.advisorId ?? null,
    isAdmin: isAdminOrOwner(profile.role),
  };
}

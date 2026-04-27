import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { cache } from 'react';
import 'server-only';
import type { Database } from '@crm-eco/lib/types';
import { getActiveTenant } from './tenant';

type Profile = Database['public']['Tables']['profiles']['Row'] & { organization_id: string };

export type AdminRole = 'owner' | 'admin' | 'staff';

export interface AdminProfile extends Profile {
  isAdmin: boolean;
  /** The active tenant's organization id (resolved per-request, may differ from `profiles.organization_id` when the user has switched orgs). */
  activeOrganizationId: string;
  activeOrganizationName: string | null;
  /** The user's role within the *active tenant* (from organization_members), not `profiles.role`. */
  activeRole: string | null;
}

/**
 * Internal: fetch the admin profile (uncached).
 *
 * IMPORTANT — multi-tenancy contract:
 * The returned `organization_id` is sourced from the active tenant
 * resolver (header → cookie → subdomain → membership), NOT from
 * `profiles.organization_id`. This means every existing caller of
 * `profile.organization_id` automatically respects the user's
 * tenant choice without code churn at the call sites.
 *
 * If the user has no membership in any organization, this returns
 * `null` (callers redirect to /access-denied or /onboarding).
 */
async function fetchAdminProfile(): Promise<AdminProfile | null> {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profileData, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error || !profileData) {
    console.error('Error fetching admin profile:', error);
    return null;
  }

  const profile = profileData as Profile;

  // Resolve the active tenant. This already verifies membership.
  const tenant = await getActiveTenant();

  // No tenant in scope → user must be onboarded into an org.
  if (!tenant) return null;

  return {
    ...profile,
    // Override organization_id with the resolved tenant. The original
    // value lives on under `profiles.organization_id` if a caller
    // ever needs the persisted "default" org — but for query-scoping
    // purposes this is the single source of truth.
    organization_id: tenant.organizationId,
    activeOrganizationId: tenant.organizationId,
    activeOrganizationName: tenant.organizationName,
    activeRole: tenant.role,
    isAdmin:
      tenant.role === 'owner' ||
      tenant.role === 'super_admin' ||
      tenant.role === 'admin' ||
      tenant.role === 'staff',
  };
}

/**
 * Get the current admin user's profile, scoped to the active tenant.
 *
 * Memoised per request via React's `cache()`.
 */
export const getAdminProfile = cache(fetchAdminProfile);

export function isAdminRole(role: string): role is AdminRole {
  return ['owner', 'admin', 'staff'].includes(role);
}

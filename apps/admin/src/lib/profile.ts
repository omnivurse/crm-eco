import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { cache } from 'react';
import type { Database } from '@crm-eco/lib/types';

type Profile = Database['public']['Tables']['profiles']['Row'];

export type AdminRole = 'owner' | 'admin' | 'staff';

export interface AdminProfile extends Profile {
  isAdmin: boolean;
}

/**
 * Internal function to fetch admin profile (uncached)
 * This is wrapped by getAdminProfile with React's cache()
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

  return {
    ...profile,
    isAdmin: ['owner', 'admin', 'staff'].includes(profile.role),
  };
}

/**
 * Get the current admin user's profile
 *
 * This function is memoized per-request using React's cache() function.
 * Multiple calls during the same request will reuse the cached result,
 * significantly reducing database queries.
 */
export const getAdminProfile = cache(fetchAdminProfile);

/**
 * Check if a role is an admin role
 */
export function isAdminRole(role: string): role is AdminRole {
  return ['owner', 'admin', 'staff'].includes(role);
}

/**
 * Server-side Supabase client with request-scoped caching
 *
 * IMPORTANT: This module prevents the "Too many concurrent token refresh requests"
 * error by:
 * 1. Using React's cache() for request-scoped deduplication
 * 2. Providing a single getUser() per request that all callers share
 *
 * All server components and API routes should use these helpers instead of
 * creating their own Supabase clients.
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';
import type { User } from '@supabase/supabase-js';
import { getActiveTenant } from './tenant';

// Types for better type safety
interface CachedAuthResult {
  user: User | null;
  error: Error | null;
}

interface CachedProfile {
  id: string;
  organization_id: string;
  role: string | null;
  crm_role: string | null;
  full_name: string | null;
  user_id: string;
  /** When set, the user reached this org via tenant switching (organization_members), not their primary profile. */
  active_tenant_role: string | null;
}

/**
 * Creates a Supabase server client with cookie handling.
 * This is request-scoped and safe to call multiple times.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Add them to apps/crm/.env.local and restart the Next.js dev server.',
    );
  }

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Cookie setting may fail in Server Components
            // This is handled by middleware
          }
        },
      },
    }
  );
});

/**
 * Get the current authenticated user with request-scoped caching.
 *
 * This is the ONLY function that should call supabase.auth.getUser().
 * All other code should call this function to avoid concurrent token refresh.
 *
 * @returns The user object or null if not authenticated
 */
export const getAuthUser = cache(async (): Promise<CachedAuthResult> => {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      // Log auth errors but don't throw - return null user
      console.warn('[Auth] getUser error:', error.message);
      return { user: null, error };
    }

    return { user, error: null };
  } catch (error) {
    console.error('[Auth] Unexpected error in getAuthUser:', error);
    return { user: null, error: error as Error };
  }
});

/**
 * Get the current user's profile with request-scoped caching.
 * Automatically fetches the user first using getAuthUser().
 *
 * @returns The profile or null if not found/unauthorized
 */
export const getAuthProfile = cache(async (): Promise<CachedProfile | null> => {
  const { user } = await getAuthUser();

  if (!user) {
    return null;
  }

  try {
    const supabase = await createClient();
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, organization_id, role, crm_role, full_name, user_id')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.warn('[Auth] Profile fetch error:', error.message);
      return null;
    }

    // If the user has resolved an active tenant via organization_members,
    // override organization_id so every existing call site that reads
    // profile.organization_id automatically scopes to the active tenant.
    // The user's primary profile (and crm_role) are unchanged.
    const tenant = await getActiveTenant();
    if (tenant && tenant.organizationId !== profile.organization_id) {
      return {
        ...profile,
        organization_id: tenant.organizationId,
        active_tenant_role: tenant.role,
      };
    }

    return { ...profile, active_tenant_role: null };
  } catch (error) {
    console.error('[Auth] Unexpected error in getAuthProfile:', error);
    return null;
  }
});

/**
 * Verify the user is authenticated and has CRM access.
 * Returns both user and profile if valid, or null values if not.
 *
 * @returns Object with user, profile, and isAuthorized flag
 */
export const verifyCrmAccess = cache(async () => {
  const { user, error: authError } = await getAuthUser();

  if (!user) {
    return {
      user: null,
      profile: null,
      isAuthorized: false,
      error: authError?.message || 'Not authenticated',
    };
  }

  const profile = await getAuthProfile();

  if (!profile) {
    return {
      user,
      profile: null,
      isAuthorized: false,
      error: 'Profile not found',
    };
  }

  // Admit users either via legacy profiles.crm_role OR via an active tenant
  // resolved through organization_members. The new RLS helpers (post-migration
  // 202605080010) honor membership directly, so a user with admin-tier
  // membership is allowed to read CRM data even without profiles.crm_role.
  const admittedViaTenant =
    profile.active_tenant_role !== null &&
    ['owner', 'super_admin', 'admin', 'staff'].includes(profile.active_tenant_role);

  if (!profile.crm_role && !admittedViaTenant) {
    return {
      user,
      profile,
      isAuthorized: false,
      error: 'No CRM access',
    };
  }

  if (!profile.organization_id) {
    return {
      user,
      profile,
      isAuthorized: false,
      error: 'No organization',
    };
  }

  return {
    user,
    profile,
    isAuthorized: true,
    error: null,
  };
});

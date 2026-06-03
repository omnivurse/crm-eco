/**
 * Client-side auth hook with SWR-like caching
 * 
 * Provides request deduplication and caching for client components.
 * Unlike server-side cache(), this uses React state and a singleton promise
 * to prevent multiple concurrent auth fetches.
 * 
 * Benefits:
 * - Single auth fetch per page mount (vs multiple per component)
 * - Deduplicates concurrent requests
 * - Provides loading/error states
 * - Caches profile for session duration
 * 
 * Usage:
 *   const { user, profile, loading, error, refetch } = useClientAuth();
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase-client';
import type { User } from '@supabase/supabase-js';

export interface ClientProfile {
  id: string;
  organization_id: string;
  full_name: string | null;
  crm_role: string | null;
  user_id: string;
}

export interface UseClientAuthResult {
  user: User | null;
  profile: ClientProfile | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Module-level cache for deduplication
let cachedProfile: ClientProfile | null = null;
let cachedUser: User | null = null;
let fetchPromise: Promise<void> | null = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Hook for client-side authentication with caching
 * Deduplicates concurrent requests and caches for session duration
 */
export function useClientAuth(): UseClientAuthResult {
  const [user, setUser] = useState<User | null>(cachedUser);
  const [profile, setProfile] = useState<ClientProfile | null>(cachedProfile);
  const [loading, setLoading] = useState(!cachedProfile);
  const [error, setError] = useState<string | null>(null);

  const fetchAuth = useCallback(async (force = false) => {
    const now = Date.now();
    
    // Return cached if valid and not forcing refresh
    if (!force && cachedProfile && cachedUser && (now - lastFetchTime) < CACHE_DURATION_MS) {
      setUser(cachedUser);
      setProfile(cachedProfile);
      setLoading(false);
      return;
    }

    // If a fetch is already in progress, wait for it. Swallow rejections so an
    // aborted/failed shared fetch (e.g. getUser() cancelled by a navigation)
    // reflects cached state instead of throwing an uncaught "Failed to fetch"
    // out of this deduplicated path.
    if (fetchPromise) {
      try {
        await fetchPromise;
      } catch {
        // ignore — fall through to reflect whatever is cached
      }
      setUser(cachedUser);
      setProfile(cachedProfile);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Create a new fetch promise for deduplication
    fetchPromise = (async () => {
      try {
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !authUser) {
          cachedUser = null;
          cachedProfile = null;
          throw new Error(authError?.message || 'Not authenticated');
        }

        cachedUser = authUser;

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, organization_id, full_name, crm_role, user_id')
          .eq('user_id', authUser.id)
          .single();

        if (profileError || !profileData) {
          throw new Error(profileError?.message || 'Profile not found');
        }

        cachedProfile = profileData as ClientProfile;
        lastFetchTime = Date.now();
      } catch (err) {
        throw err;
      } finally {
        fetchPromise = null;
      }
    })();

    try {
      await fetchPromise;
      setUser(cachedUser);
      setProfile(cachedProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load auth');
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    await fetchAuth(true);
  }, [fetchAuth]);

  useEffect(() => {
    // Swallow rejections from an in-flight getUser() that gets aborted when this
    // hook (mounted globally via ThemeProvider) unmounts during a navigation or
    // redirect — otherwise it surfaces as an uncaught "TypeError: Failed to
    // fetch" in the console and can flash a transient logged-out state.
    fetchAuth().catch(() => {});
  }, [fetchAuth]);

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any) => {
      if (event === 'SIGNED_OUT') {
        cachedUser = null;
        cachedProfile = null;
        lastFetchTime = 0;
        setUser(null);
        setProfile(null);
      } else if (event === 'SIGNED_IN') {
        fetchAuth(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchAuth]);

  return { user, profile, loading, error, refetch };
}

/**
 * Clear the auth cache (call on logout)
 */
export function clearClientAuthCache(): void {
  cachedUser = null;
  cachedProfile = null;
  lastFetchTime = 0;
  fetchPromise = null;
}

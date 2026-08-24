/**
 * Client-side auth hook with SWR-like caching.
 *
 * Provides request deduplication and caching for client components.
 * Unlike server-side cache(), this uses a module-level store and a singleton
 * promise to prevent multiple concurrent auth fetches.
 *
 * Benefits:
 * - Single auth fetch per page mount (vs multiple per component)
 * - Deduplicates concurrent requests
 * - Provides loading/error states
 * - Caches profile for session duration
 *
 * HYDRATION (why this is a store and not `useState`).
 * The cache is module-level and one instance of this hook is mounted globally
 * (ThemeProvider), so it is usually already WARM by the time a component inside
 * a streamed <Suspense> boundary hydrates. Seeding component state from it —
 * `useState(cachedProfile)` — therefore gave the hydrating render a profile the
 * SERVER render never had, and any tree that branches on the profile came out
 * different on the two sides. Measured on /crm/modules/contacts: the server
 * omitted ModuleHeader's create button (no profile → canCreate false) and the
 * client drew it, so React threw the whole list subtree away and re-rendered it
 * on the client — "Hydration failed…" in dev, minified error #418 in
 * production. `useSyncExternalStore` is the fix React ships for exactly this:
 * `getServerSnapshot` is used for BOTH the server render and the hydrating
 * client render, so both sides start from the same empty snapshot, and React
 * re-reads the live snapshot immediately after hydration commits.
 *
 * Usage:
 *   const { user, profile, loading, error, refetch } = useClientAuth();
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react';
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

interface AuthSnapshot {
  user: User | null;
  profile: ClientProfile | null;
  loading: boolean;
  error: string | null;
}

/**
 * The snapshot the SERVER renders and the client HYDRATES with. Nothing is
 * known about the viewer at that point on either side, so both must agree on
 * "nobody yet, still loading". Frozen and never replaced: useSyncExternalStore
 * compares snapshots by reference.
 */
const EMPTY_SNAPSHOT: AuthSnapshot = Object.freeze({
  user: null,
  profile: null,
  loading: true,
  error: null,
});

// Module-level cache for deduplication (shared by every mounted hook).
let snapshot: AuthSnapshot = EMPTY_SNAPSHOT;
let fetchPromise: Promise<void> | null = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

const listeners = new Set<() => void>();

function setSnapshot(next: Partial<AuthSnapshot>): void {
  const merged: AuthSnapshot = { ...snapshot, ...next };
  if (
    merged.user === snapshot.user &&
    merged.profile === snapshot.profile &&
    merged.loading === snapshot.loading &&
    merged.error === snapshot.error
  ) {
    return; // no change — do not churn a new object past useSyncExternalStore
  }
  snapshot = merged;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AuthSnapshot {
  return snapshot;
}

/** Used on the server AND during hydration — see the HYDRATION note above. */
function getServerSnapshot(): AuthSnapshot {
  return EMPTY_SNAPSHOT;
}

/**
 * Fetch (or reuse) the current user + profile. Shared across every mounted
 * hook: concurrent callers await the one in-flight promise, and a fresh cache
 * short-circuits entirely.
 */
async function fetchAuth(force = false): Promise<void> {
  const now = Date.now();

  // Return cached if valid and not forcing refresh
  if (!force && snapshot.profile && snapshot.user && now - lastFetchTime < CACHE_DURATION_MS) {
    setSnapshot({ loading: false });
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
    setSnapshot({ loading: false });
    return;
  }

  setSnapshot({ loading: true, error: null });

  // Create a new fetch promise for deduplication
  fetchPromise = (async () => {
    try {
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !authUser) {
        setSnapshot({ user: null, profile: null });
        throw new Error(authError?.message || 'Not authenticated');
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, organization_id, full_name, crm_role, user_id')
        .eq('user_id', authUser.id)
        .single();

      if (profileError || !profileData) {
        setSnapshot({ user: authUser });
        throw new Error(profileError?.message || 'Profile not found');
      }

      setSnapshot({ user: authUser, profile: profileData as ClientProfile });
      lastFetchTime = Date.now();
    } finally {
      fetchPromise = null;
    }
  })();

  try {
    await fetchPromise;
    setSnapshot({ loading: false, error: null });
  } catch (err) {
    setSnapshot({
      user: null,
      profile: null,
      loading: false,
      error: err instanceof Error ? err.message : 'Failed to load auth',
    });
  }
}

/**
 * Hook for client-side authentication with caching.
 * Deduplicates concurrent requests and caches for session duration.
 */
export function useClientAuth(): UseClientAuthResult {
  const { user, profile, loading, error } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const refetch = useCallback(async () => {
    await fetchAuth(true);
  }, []);

  useEffect(() => {
    // Swallow rejections from an in-flight getUser() that gets aborted when this
    // hook (mounted globally via ThemeProvider) unmounts during a navigation or
    // redirect — otherwise it surfaces as an uncaught "TypeError: Failed to
    // fetch" in the console and can flash a transient logged-out state.
    fetchAuth().catch(() => {});
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'SIGNED_OUT') {
        lastFetchTime = 0;
        setSnapshot({ user: null, profile: null, loading: false, error: null });
      } else if (event === 'SIGNED_IN') {
        fetchAuth(true).catch(() => {});
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { user, profile, loading, error, refetch };
}

/**
 * Clear the auth cache (call on logout)
 */
export function clearClientAuthCache(): void {
  lastFetchTime = 0;
  fetchPromise = null;
  snapshot = EMPTY_SNAPSHOT;
  for (const listener of listeners) listener();
}

/** Test-only view of the store — never used by product code. */
export const __authStoreInternals = {
  getSnapshot,
  getServerSnapshot,
  setSnapshot,
  subscribe,
  EMPTY_SNAPSHOT,
};

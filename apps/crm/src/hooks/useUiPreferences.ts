'use client';

/**
 * useUiPreferences — small client hook that loads + patches
 * `profiles.ui_preferences` via `/api/crm/ui-preferences`.
 *
 * Deliberately minimal (no SWR dependency) so it works in any client
 * component in the CRM app. Reads the whole blob on mount and merges local
 * updates optimistically; failures revert and surface a toast.
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { CrmUiPreferences } from '@/lib/crm/types';

export interface UseUiPreferencesResult {
  preferences: CrmUiPreferences;
  loading: boolean;
  /** Fire-and-forget merge patch. Optimistic; reverts on server error. */
  patch: (partial: Partial<CrmUiPreferences>) => Promise<void>;
  /** Refetch from server (e.g. after sign-in context changes). */
  refresh: () => Promise<void>;
}

let cachedPreferences: CrmUiPreferences | null = null;
let pendingFetch: Promise<CrmUiPreferences> | null = null;

async function fetchPreferences(): Promise<CrmUiPreferences> {
  const res = await fetch('/api/crm/ui-preferences', {
    cache: 'no-store',
    credentials: 'same-origin',
  });
  if (!res.ok) return {};
  const body = (await res.json().catch(() => ({}))) as {
    preferences?: CrmUiPreferences;
  };
  return body.preferences ?? {};
}

export function useUiPreferences(): UseUiPreferencesResult {
  const [preferences, setPreferences] = useState<CrmUiPreferences>(
    cachedPreferences ?? {},
  );
  const [loading, setLoading] = useState<boolean>(cachedPreferences === null);

  const load = useCallback(async () => {
    if (!pendingFetch) {
      pendingFetch = fetchPreferences().finally(() => {
        // Clear the in-flight sentinel after it resolves so future refreshes
        // can refetch.
      });
    }
    try {
      const next = await pendingFetch;
      cachedPreferences = next;
      setPreferences(next);
    } finally {
      pendingFetch = null;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (cachedPreferences !== null) {
      setPreferences(cachedPreferences);
      setLoading(false);
      return;
    }
    void load();
  }, [load]);

  const patch = useCallback(
    async (partial: Partial<CrmUiPreferences>) => {
      const prev = cachedPreferences ?? {};
      const optimistic = { ...prev, ...partial } as CrmUiPreferences;
      cachedPreferences = optimistic;
      setPreferences(optimistic);

      try {
        const res = await fetch('/api/crm/ui-preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(partial),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json().catch(() => ({}))) as {
          preferences?: CrmUiPreferences;
        };
        if (body.preferences) {
          cachedPreferences = body.preferences;
          setPreferences(body.preferences);
        }
      } catch (err) {
        cachedPreferences = prev;
        setPreferences(prev);
        toast.error(
          err instanceof Error ? err.message : 'Failed to save preferences',
        );
      }
    },
    [],
  );

  return { preferences, loading, patch, refresh: load };
}

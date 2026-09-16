'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useUiPreferences } from '@/hooks/useUiPreferences';
import {
  type CoverageSnapshotLayoutPrefs,
  coverageSnapshotLayoutStorageKey,
  mergeCoverageSnapshotLayoutMap,
  parseCoverageSnapshotLayoutMap,
  readCoverageSnapshotLayout,
  writeCoverageSnapshotLayout,
} from '@/lib/crm/coverage-snapshot-layout';

const listeners = new Set<() => void>();
const snapshotCache = new Map<string, { raw: string | null; value: CoverageSnapshotLayoutPrefs | null }>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function readCached(moduleKey: string): CoverageSnapshotLayoutPrefs | null {
  if (typeof window === 'undefined' || !moduleKey) return null;
  const storageKey = coverageSnapshotLayoutStorageKey(moduleKey);
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(storageKey);
  } catch {
    raw = null;
  }
  const cached = snapshotCache.get(storageKey);
  if (cached && cached.raw === raw) return cached.value;
  const value = readCoverageSnapshotLayout(moduleKey);
  snapshotCache.set(storageKey, { raw, value });
  return value;
}

export function useCoverageSnapshotLayout(moduleKey: string): {
  prefs: CoverageSnapshotLayoutPrefs | null;
  save: (next: CoverageSnapshotLayoutPrefs) => void;
  reset: () => void;
} {
  const { preferences, patch } = useUiPreferences();
  const key = moduleKey.trim();
  const local = useSyncExternalStore(
    subscribe,
    () => (key ? readCached(key) : null),
    () => null,
  );

  const serverMap = useMemo(
    () => parseCoverageSnapshotLayoutMap(preferences.coverage_snapshot_layout),
    [preferences.coverage_snapshot_layout],
  );
  const server = key ? (serverMap[key] ?? null) : null;
  const prefs =
    (server?.updated_at ?? 0) >= (local?.updated_at ?? 0) ? server : local;

  const save = useCallback(
    (next: CoverageSnapshotLayoutPrefs) => {
      if (!key) return;
      const stamped = { ...next, updated_at: Date.now() };
      writeCoverageSnapshotLayout(key, stamped);
      emit();
      void patch({
        coverage_snapshot_layout: mergeCoverageSnapshotLayoutMap(
          preferences.coverage_snapshot_layout,
          key,
          stamped,
        ),
      });
    },
    [key, patch, preferences.coverage_snapshot_layout],
  );

  const reset = useCallback(() => {
    if (!key) return;
    writeCoverageSnapshotLayout(key, null);
    emit();
    void patch({
      coverage_snapshot_layout: mergeCoverageSnapshotLayoutMap(
        preferences.coverage_snapshot_layout,
        key,
        null,
      ),
    });
  }, [key, patch, preferences.coverage_snapshot_layout]);

  return { prefs, save, reset };
}

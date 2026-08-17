'use client';

/**
 * useListPreferences — remembers one module's list shape (columns, sort,
 * scope, viewMode) for the current user.
 *
 * Storage: `profiles.ui_preferences.list_prefs[moduleKey]` via the existing
 * `useUiPreferences().patch` (top-level merge; the whole `list_prefs` map is
 * re-sent so other modules' entries survive), mirrored to localStorage so a
 * fresh tab hydrates before the profile round-trip.
 *
 * Writes are debounced (rapid column toggles → one PATCH) and only happen
 * when the caller calls `save()` — i.e. on explicit user action, never on
 * render and never while a saved view is being applied.
 *
 * The localStorage mirror is exposed through `useSyncExternalStore` (server
 * snapshot = null) so SSR markup stays deterministic and no state is set
 * synchronously inside effects.
 *
 * The mirror key is scoped by the viewer's profile id (read-only lookup via
 * the cached `useClientAuth`) so user B never hydrates user A's layout on a
 * shared browser. Until the profile is known the mirror is neither read nor
 * written — the caller simply renders defaults, then the server copy lands.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useUiPreferences } from './useUiPreferences';
import { useClientAuth } from './useClientAuth';
import {
  legacyUnscopedListPrefsStorageKey,
  listPrefsEqual,
  listPrefsStorageKey,
  mergeListPrefs,
  pickNewerListPrefs,
  sanitizeListPrefs,
  sanitizeListPrefsMap,
  type ListPrefsMap,
  type ModuleListPrefs,
} from '@/lib/crm/list-preferences';

const SAVE_DEBOUNCE_MS = 500;

// ============================================================================
// localStorage mirror as an external store
// ============================================================================

const listeners = new Set<() => void>();
const snapshotCache = new Map<string, { raw: string | null; value: ModuleListPrefs | null }>();

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Stable-by-value snapshot: same raw string → same object identity.
 * Returns null (never reads storage) until the profile id is known.
 */
function readLocalMirror(moduleKey: string, profileId: string | null): ModuleListPrefs | null {
  if (typeof window === 'undefined' || !profileId) return null;
  const key = listPrefsStorageKey(moduleKey, profileId);
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    raw = null;
  }
  const cached = snapshotCache.get(key);
  if (cached && cached.raw === raw) return cached.value;
  const value = raw ? sanitizeListPrefs(safeParse(raw)) : null;
  snapshotCache.set(key, { raw, value });
  return value;
}

function writeLocalMirror(
  moduleKey: string,
  profileId: string | null,
  prefs: ModuleListPrefs | null,
): void {
  if (typeof window === 'undefined' || !profileId) return;
  try {
    const key = listPrefsStorageKey(moduleKey, profileId);
    if (prefs) window.localStorage.setItem(key, JSON.stringify(prefs));
    else window.localStorage.removeItem(key);
  } catch {
    /* quota / private mode — the server copy still wins next load */
  }
  listeners.forEach((l) => l());
}

/**
 * One-time hygiene: drop the pre-scoping (user-less) mirror for this module.
 * It cannot be attributed to a user, so it is never read — only removed.
 */
function purgeLegacyUnscopedMirror(moduleKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(legacyUnscopedListPrefsStorageKey(moduleKey));
  } catch {
    /* ignore */
  }
}

function subscribeMirror(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

const subscribeNoop = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

// ============================================================================
// Hook
// ============================================================================

export interface UseListPreferencesResult {
  /**
   * The remembered prefs for this module, or `null` when nothing is
   * remembered yet. `null` also while `hydrated` is false (SSR / first
   * paint) so the caller can render deterministic defaults first.
   */
  prefs: ModuleListPrefs | null;
  /** True once we are on the client (local mirror readable). */
  hydrated: boolean;
  /** True once the server copy has been merged in. */
  serverLoaded: boolean;
  /** Merge a partial change and persist (debounced) — call on user action only. */
  save: (patch: Partial<Omit<ModuleListPrefs, 'v' | 'updated_at'>>) => void;
}

export function useListPreferences(moduleKey: string): UseListPreferencesResult {
  const { preferences, loading, patch } = useUiPreferences();
  // Read-only viewer lookup (cached, single fetch per session) — scopes the
  // localStorage mirror so a shared browser never leaks one user's layout to
  // the next. Null until known → mirror is neither read nor written.
  const { profile: viewerProfile } = useClientAuth();
  const profileId = viewerProfile?.id ?? null;

  const hydrated = useSyncExternalStore(subscribeNoop, getTrue, getFalse);
  const localMirror = useSyncExternalStore(
    subscribeMirror,
    () => readLocalMirror(moduleKey, profileId),
    () => null,
  );

  // External-system write only — remove the un-attributable legacy mirror.
  useEffect(() => {
    if (profileId) purgeLegacyUnscopedMirror(moduleKey);
  }, [moduleKey, profileId]);

  // Server copy (undefined while the profile is still loading).
  const serverPrefs = useMemo(() => {
    if (loading) return undefined;
    return sanitizeListPrefsMap(preferences.list_prefs)[moduleKey] ?? null;
  }, [loading, preferences.list_prefs, moduleKey]);
  const serverLoaded = hydrated && serverPrefs !== undefined;

  // The user's own writes during this mount always win over a (possibly
  // stale / slower) server load. Scoped by module key.
  const [localWrite, setLocalWrite] = useState<{ moduleKey: string; prefs: ModuleListPrefs } | null>(null);
  const dirty = localWrite?.moduleKey === moduleKey;

  const prefs = useMemo<ModuleListPrefs | null>(() => {
    if (!hydrated) return null;
    if (dirty && localWrite) return localWrite.prefs;
    if (serverPrefs === undefined) return localMirror;
    return pickNewerListPrefs(serverPrefs, localMirror);
  }, [hydrated, dirty, localWrite, serverPrefs, localMirror]);

  // Keep the mirror fresh when the server copy is the newer one (other
  // device / cleared storage). External-system write only — no setState.
  useEffect(() => {
    if (!serverLoaded || dirty || !serverPrefs) return;
    const winner = pickNewerListPrefs(serverPrefs, localMirror);
    if (winner === serverPrefs && !listPrefsEqual(serverPrefs, localMirror)) {
      writeLocalMirror(moduleKey, profileId, serverPrefs);
    }
  }, [serverLoaded, dirty, serverPrefs, localMirror, moduleKey, profileId]);

  // Refs so `save` stays referentially stable.
  const prefsRef = useRef(prefs);
  const preferencesRef = useRef(preferences);
  useEffect(() => {
    prefsRef.current = prefs;
    preferencesRef.current = preferences;
  }, [prefs, preferences]);

  const timerRef = useRef<number | null>(null);
  const pendingRef = useRef<ModuleListPrefs | null>(null);

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    const currentMap = sanitizeListPrefsMap(preferencesRef.current.list_prefs);
    const nextMap: ListPrefsMap = { ...currentMap, [moduleKey]: pending };
    void patch({ list_prefs: nextMap });
  }, [moduleKey, patch]);

  const save = useCallback<UseListPreferencesResult['save']>(
    (partial) => {
      const next = mergeListPrefs(prefsRef.current, partial);
      if (prefsRef.current && listPrefsEqual(next, prefsRef.current)) return;
      prefsRef.current = next;
      setLocalWrite({ moduleKey, prefs: next });
      writeLocalMirror(moduleKey, profileId, next);
      pendingRef.current = next;
      if (typeof window === 'undefined') return;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [moduleKey, profileId, flush],
  );

  // Flush a pending write when the module changes / component unmounts so
  // a quick "toggle column → click sidebar link" is not lost.
  useEffect(() => flush, [flush]);

  return { prefs, hydrated, serverLoaded, save };
}

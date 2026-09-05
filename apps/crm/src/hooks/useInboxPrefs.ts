'use client';

/**
 * useInboxPrefs — the mailbox looks the way this user left it.
 *
 * Storage mirrors `useListPreferences`: the canonical copy lives in
 * `profiles.ui_preferences.inbox_prefs` behind the existing
 * `/api/crm/ui-preferences` PATCH, with a localStorage mirror so the first
 * paint is already the user's layout rather than the default one. No
 * migration: `ui_preferences` is a passthrough JSONB bag.
 *
 * The mirror key is scoped by profile id so user B never hydrates user A's
 * layout on a shared browser; until the viewer is known the mirror is neither
 * read nor written and the caller simply renders defaults.
 *
 * Writes are debounced (three quick filter clicks are one PATCH) and only
 * happen on explicit user action.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useUiPreferences } from './useUiPreferences';
import { useClientAuth } from './useClientAuth';
import {
  type InboxPrefs,
  inboxPrefsEqual,
  inboxPrefsStorageKey,
  mergeInboxPrefs,
  normalizeInboxPrefs,
  pickFresherInboxPrefs,
  resolveInboxPrefs,
} from '@/lib/inbox/inbox-prefs';

const SAVE_DEBOUNCE_MS = 500;

const listeners = new Set<() => void>();
const snapshotCache = new Map<string, { raw: string | null; value: InboxPrefs | null }>();

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Stable-by-value snapshot: the same raw string yields the same object identity. */
function readLocalMirror(profileId: string | null): InboxPrefs | null {
  if (typeof window === 'undefined' || !profileId) return null;
  const key = inboxPrefsStorageKey(profileId);
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    raw = null;
  }
  const cached = snapshotCache.get(key);
  if (cached && cached.raw === raw) return cached.value;
  const value = raw ? normalizeInboxPrefs(safeParse(raw)) : null;
  snapshotCache.set(key, { raw, value });
  return value;
}

function writeLocalMirror(profileId: string | null, prefs: InboxPrefs | null): void {
  if (typeof window === 'undefined' || !profileId) return;
  try {
    const key = inboxPrefsStorageKey(profileId);
    if (prefs) window.localStorage.setItem(key, JSON.stringify(prefs));
    else window.localStorage.removeItem(key);
  } catch {
    /* quota / private mode — the server copy still wins on the next load */
  }
  listeners.forEach((listener) => listener());
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

export interface UseInboxPrefsResult {
  /** Saved prefs over shipping defaults — always safe to read and render. */
  prefs: ReturnType<typeof resolveInboxPrefs>;
  /** The raw saved copy: null means "this user has no opinion yet". */
  saved: InboxPrefs | null;
  /** True once we are on the client and the local mirror is readable. */
  hydrated: boolean;
  /** True once the server copy has been merged in. */
  serverLoaded: boolean;
  /** Merge a partial change and persist it (debounced). User action only. */
  save: (patch: Partial<Omit<InboxPrefs, 'v' | 'updated_at'>>) => void;
}

export function useInboxPrefs(): UseInboxPrefsResult {
  const { preferences, loading, patch } = useUiPreferences();
  const { profile: viewerProfile } = useClientAuth();
  const profileId = viewerProfile?.id ?? null;

  const hydrated = useSyncExternalStore(subscribeNoop, getTrue, getFalse);
  const localMirror = useSyncExternalStore(
    subscribeMirror,
    () => readLocalMirror(profileId),
    () => null,
  );

  const serverPrefs = useMemo(() => {
    if (loading) return undefined;
    const raw = (preferences as Record<string, unknown>).inbox_prefs;
    return raw ? normalizeInboxPrefs(raw) : null;
  }, [loading, preferences]);
  const serverLoaded = hydrated && serverPrefs !== undefined;

  // This mount's own writes always beat a slower or staler server load.
  const [localWrite, setLocalWrite] = useState<InboxPrefs | null>(null);

  const saved = useMemo<InboxPrefs | null>(() => {
    if (!hydrated) return null;
    if (localWrite) return localWrite;
    if (serverPrefs === undefined) return localMirror;
    return pickFresherInboxPrefs(serverPrefs, localMirror);
  }, [hydrated, localWrite, serverPrefs, localMirror]);

  // Refresh the mirror when the server copy is the newer one (another device,
  // or storage was cleared). External-system write only — never setState.
  useEffect(() => {
    if (!serverLoaded || localWrite || !serverPrefs) return;
    const winner = pickFresherInboxPrefs(serverPrefs, localMirror);
    if (winner === serverPrefs && !inboxPrefsEqual(serverPrefs, localMirror)) {
      writeLocalMirror(profileId, serverPrefs);
    }
  }, [serverLoaded, localWrite, serverPrefs, localMirror, profileId]);

  const savedRef = useRef(saved);
  useEffect(() => {
    savedRef.current = saved;
  }, [saved]);

  const timerRef = useRef<number | null>(null);
  const pendingRef = useRef<InboxPrefs | null>(null);

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    void patch({ inbox_prefs: pending } as Record<string, unknown>);
  }, [patch]);

  const save = useCallback<UseInboxPrefsResult['save']>(
    (partial) => {
      const next = mergeInboxPrefs(savedRef.current, partial);
      if (savedRef.current && inboxPrefsEqual(next, savedRef.current)) return;
      savedRef.current = next;
      setLocalWrite(next);
      writeLocalMirror(profileId, next);
      pendingRef.current = next;
      if (typeof window === 'undefined') return;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [profileId, flush],
  );

  // Flush on unmount so "toggle density → click a sidebar link" is not lost.
  useEffect(() => flush, [flush]);

  const prefs = useMemo(() => resolveInboxPrefs(saved), [saved]);

  return { prefs, saved, hydrated, serverLoaded, save };
}

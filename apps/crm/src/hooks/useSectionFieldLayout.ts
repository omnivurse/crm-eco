'use client';

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useUiPreferences } from '@/hooks/useUiPreferences';
import {
  type ModuleSectionFieldMap,
  type SectionFieldPrefs,
  mergeSectionFieldLayout,
  parseSectionFieldLayoutMap,
  readSectionFieldLayout,
  sectionFieldLayoutStorageKey,
  writeSectionFieldLayout,
} from '@/lib/crm/section-field-layout';

const EMPTY: ModuleSectionFieldMap = {};
const listeners = new Set<() => void>();
const snapshotCache = new Map<string, { raw: string | null; value: ModuleSectionFieldMap }>();

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

function readCached(moduleKey: string): ModuleSectionFieldMap {
  if (typeof window === 'undefined' || !moduleKey) return EMPTY;
  const storageKey = sectionFieldLayoutStorageKey(moduleKey);
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(storageKey);
  } catch {
    raw = null;
  }
  const cached = snapshotCache.get(storageKey);
  if (cached && cached.raw === raw) return cached.value;
  const value = readSectionFieldLayout(moduleKey);
  snapshotCache.set(storageKey, { raw, value });
  return value;
}

export function useSectionFieldLayout(moduleKey: string): {
  prefsFor: (sectionKey: string) => SectionFieldPrefs | null;
  save: (sectionKey: string, next: SectionFieldPrefs) => void;
  reset: (sectionKey: string) => void;
} {
  const { preferences, patch } = useUiPreferences();
  const key = moduleKey.trim();
  const mapRef = useRef(preferences.section_field_layout);
  useEffect(() => {
    mapRef.current = preferences.section_field_layout;
  }, [preferences.section_field_layout]);

  const local = useSyncExternalStore(
    subscribe,
    () => (key ? readCached(key) : EMPTY),
    () => EMPTY,
  );

  const server = useMemo(() => {
    const map = parseSectionFieldLayoutMap(preferences.section_field_layout);
    return key ? (map[key] ?? EMPTY) : EMPTY;
  }, [key, preferences.section_field_layout]);

  const prefsFor = useCallback(
    (sectionKey: string) => {
      const sk = sectionKey.trim();
      const fromServer = server[sk] ?? null;
      const fromLocal = local[sk] ?? null;
      if (!fromServer) return fromLocal;
      if (!fromLocal) return fromServer;
      return (fromServer.updated_at ?? 0) >= (fromLocal.updated_at ?? 0)
        ? fromServer
        : fromLocal;
    },
    [local, server],
  );

  const save = useCallback(
    (sectionKey: string, next: SectionFieldPrefs) => {
      if (!key || !sectionKey.trim()) return;
      const stamped = { ...next, updated_at: Date.now() };
      const merged = { ...readCached(key), [sectionKey]: stamped };
      writeSectionFieldLayout(key, merged);
      emit();
      const nextMap = mergeSectionFieldLayout(
        mapRef.current,
        key,
        sectionKey,
        stamped,
      );
      mapRef.current = nextMap;
      void patch({ section_field_layout: nextMap });
    },
    [key, patch],
  );

  const reset = useCallback(
    (sectionKey: string) => {
      if (!key || !sectionKey.trim()) return;
      const merged = { ...readCached(key) };
      delete merged[sectionKey];
      writeSectionFieldLayout(key, Object.keys(merged).length ? merged : null);
      emit();
      const nextMap = mergeSectionFieldLayout(
        mapRef.current,
        key,
        sectionKey,
        null,
      );
      mapRef.current = nextMap;
      void patch({ section_field_layout: nextMap });
    },
    [key, patch],
  );

  return { prefsFor, save, reset };
}

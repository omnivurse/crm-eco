'use client';

import { useState, useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useClientAuth } from './useClientAuth';

const MIN_COLUMN_WIDTH = 80;

interface UseColumnResizeOptions {
  columns: string[];
  getDefaultWidth: (col: string) => number;
  /** localStorage key suffix -- widths persist under `crm_col_widths_u:{viewer}:{storageKey}` */
  storageKey: string;
  /**
   * Viewer (profile) id that scopes the persisted widths so a second user on
   * the same browser starts from defaults (LS-8). `undefined` → resolved from
   * the cached `useClientAuth` profile; `null` → viewer unknown (nothing is
   * read or written — fail closed).
   */
  scopeId?: string | null;
}

interface UseColumnResizeReturn {
  /** Current width for each column (user-adjusted or default) */
  columnWidths: Record<string, number>;
  /** Whether a resize drag is currently in progress */
  isResizing: boolean;
  /** Call on mousedown from the resize handle */
  onResizeStart: (col: string, startX: number) => void;
  /** Reset a single column to its default width (double-click) */
  resetColumnWidth: (col: string) => void;
  /** Reset all columns to defaults */
  resetAllColumnWidths: () => void;
}

/** Viewer-scoped localStorage key (exported for tests / the reset event). */
export function columnWidthsStorageKey(storageKey: string, scopeId: string): string {
  return `crm_col_widths_u:${scopeId}:${storageKey}`;
}

/** Pre-scoping key (no viewer) — purge target only, never read. */
export function legacyColumnWidthsStorageKey(storageKey: string): string {
  return `crm_col_widths_${storageKey}`;
}

// ---------------------------------------------------------------------------
// Persisted widths as an external store (same shape as lib/crm/filter-rail):
// the raw string is the snapshot (primitive → stable), parsed in a memo. The
// server snapshot is null, so SSR markup uses defaults and hydration
// re-renders with the remembered widths before paint.
// ---------------------------------------------------------------------------

const listeners = new Set<() => void>();

function subscribeWidths(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== 'undefined') window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') window.removeEventListener('storage', listener);
  };
}

function readPersistedRaw(key: string, scopeId: string | null): string | null {
  if (!scopeId || typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(columnWidthsStorageKey(key, scopeId));
  } catch {
    return null;
  }
}

function parsePersistedWidths(raw: string | null): Record<string, number> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const out: Record<string, number> = {};
    for (const [col, w] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof w === 'number' && Number.isFinite(w)) out[col] = w;
    }
    return out;
  } catch {
    return null;
  }
}

function persistWidths(key: string, scopeId: string | null, widths: Record<string, number>) {
  if (!scopeId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(columnWidthsStorageKey(key, scopeId), JSON.stringify(widths));
  } catch {
    // localStorage quota exceeded or unavailable -- silently ignore
  }
  listeners.forEach((l) => l());
}

/** One-time hygiene: the un-attributable pre-scoping entry is removed, never read. */
function purgeLegacyWidths(key: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(legacyColumnWidthsStorageKey(key));
  } catch {
    /* ignore */
  }
}

/**
 * Manages column widths with drag-to-resize support and localStorage persistence.
 * Attach the returned `onResizeStart` to a resize handle's `onMouseDown`.
 *
 * Width precedence per column: this-session adjustment > remembered (viewer-
 * scoped) width > `getDefaultWidth`. Derived on render, so a column added to
 * `columns` or a viewer resolved after first paint needs no sync effect.
 */
export function useColumnResize({
  columns,
  getDefaultWidth,
  storageKey,
  scopeId: scopeIdProp,
}: UseColumnResizeOptions): UseColumnResizeReturn {
  // Viewer lookup is the cached single-fetch hook (no extra request once the
  // shell has resolved the profile); an explicit `scopeId` prop wins.
  const { profile } = useClientAuth();
  const scopeId = scopeIdProp === undefined ? (profile?.id ?? null) : scopeIdProp;

  const persistedRaw = useSyncExternalStore(
    subscribeWidths,
    () => readPersistedRaw(storageKey, scopeId),
    () => null,
  );
  const persisted = useMemo(() => parsePersistedWidths(persistedRaw), [persistedRaw]);

  // Drags / resets made in this session (win over the remembered widths).
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  const columnWidths = useMemo(() => {
    const out: Record<string, number> = {};
    for (const col of columns) {
      out[col] = overrides[col] ?? persisted?.[col] ?? getDefaultWidth(col);
    }
    return out;
  }, [columns, overrides, persisted, getDefaultWidth]);

  const [isResizing, setIsResizing] = useState(false);

  // Refs to avoid stale closures in mousemove/mouseup handlers
  const dragRef = useRef<{
    col: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  const widthsRef = useRef(columnWidths);
  useEffect(() => {
    widthsRef.current = columnWidths;
  }, [columnWidths]);

  // External-system write only: drop the legacy unscoped entry once the
  // viewer is known (it is never read).
  useEffect(() => {
    if (scopeId) purgeLegacyWidths(storageKey);
  }, [scopeId, storageKey]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current) return;
    const { col, startX, startWidth } = dragRef.current;
    const delta = e.clientX - startX;
    const newWidth = Math.max(MIN_COLUMN_WIDTH, startWidth + delta);

    setOverrides((prev) => ({ ...prev, [col]: newWidth }));
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Persist final widths (mouseup itself is registered `{ once: true }`).
    persistWidths(storageKey, scopeId, widthsRef.current);

    document.removeEventListener('mousemove', handleMouseMove);
  }, [storageKey, scopeId, handleMouseMove]);

  const onResizeStart = useCallback(
    (col: string, startX: number) => {
      const startWidth = widthsRef.current[col] ?? getDefaultWidth(col);
      dragRef.current = { col, startX, startWidth };
      setIsResizing(true);

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp, { once: true });
    },
    [getDefaultWidth, handleMouseMove, handleMouseUp],
  );

  const resetColumnWidth = useCallback(
    (col: string) => {
      const next = { ...widthsRef.current, [col]: getDefaultWidth(col) };
      setOverrides((prev) => ({ ...prev, [col]: getDefaultWidth(col) }));
      persistWidths(storageKey, scopeId, next);
    },
    [getDefaultWidth, storageKey, scopeId],
  );

  const resetAllColumnWidths = useCallback(() => {
    const defaults: Record<string, number> = {};
    for (const col of columns) {
      defaults[col] = getDefaultWidth(col);
    }
    setOverrides(defaults);
    persistWidths(storageKey, scopeId, defaults);
  }, [columns, getDefaultWidth, storageKey, scopeId]);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return { columnWidths, isResizing, onResizeStart, resetColumnWidth, resetAllColumnWidths };
}

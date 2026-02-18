'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

const MIN_COLUMN_WIDTH = 80;

interface UseColumnResizeOptions {
  columns: string[];
  getDefaultWidth: (col: string) => number;
  /** localStorage key suffix -- widths persist under `crm_col_widths_{storageKey}` */
  storageKey: string;
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

function loadPersistedWidths(key: string): Record<string, number> | null {
  try {
    const raw = localStorage.getItem(`crm_col_widths_${key}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function persistWidths(key: string, widths: Record<string, number>) {
  try {
    localStorage.setItem(`crm_col_widths_${key}`, JSON.stringify(widths));
  } catch {
    // localStorage quota exceeded or unavailable -- silently ignore
  }
}

/**
 * Manages column widths with drag-to-resize support and localStorage persistence.
 * Attach the returned `onResizeStart` to a resize handle's `onMouseDown`.
 */
export function useColumnResize({
  columns,
  getDefaultWidth,
  storageKey,
}: UseColumnResizeOptions): UseColumnResizeReturn {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const persisted = loadPersistedWidths(storageKey);
    const defaults: Record<string, number> = {};
    for (const col of columns) {
      defaults[col] = persisted?.[col] ?? getDefaultWidth(col);
    }
    return defaults;
  });

  const [isResizing, setIsResizing] = useState(false);

  // Refs to avoid stale closures in mousemove/mouseup handlers
  const dragRef = useRef<{
    col: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  const widthsRef = useRef(columnWidths);
  widthsRef.current = columnWidths;

  // Sync new columns into state when the columns array changes
  useEffect(() => {
    setColumnWidths((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const col of columns) {
        if (next[col] === undefined) {
          next[col] = getDefaultWidth(col);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [columns, getDefaultWidth]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current) return;
    const { col, startX, startWidth } = dragRef.current;
    const delta = e.clientX - startX;
    const newWidth = Math.max(MIN_COLUMN_WIDTH, startWidth + delta);

    setColumnWidths((prev) => ({ ...prev, [col]: newWidth }));
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Persist final widths
    persistWidths(storageKey, widthsRef.current);

    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [storageKey, handleMouseMove]);

  const onResizeStart = useCallback(
    (col: string, startX: number) => {
      const startWidth = widthsRef.current[col] ?? getDefaultWidth(col);
      dragRef.current = { col, startX, startWidth };
      setIsResizing(true);

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [getDefaultWidth, handleMouseMove, handleMouseUp],
  );

  const resetColumnWidth = useCallback(
    (col: string) => {
      setColumnWidths((prev) => {
        const next = { ...prev, [col]: getDefaultWidth(col) };
        persistWidths(storageKey, next);
        return next;
      });
    },
    [getDefaultWidth, storageKey],
  );

  const resetAllColumnWidths = useCallback(() => {
    const defaults: Record<string, number> = {};
    for (const col of columns) {
      defaults[col] = getDefaultWidth(col);
    }
    setColumnWidths(defaults);
    persistWidths(storageKey, defaults);
  }, [columns, getDefaultWidth, storageKey]);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return { columnWidths, isResizing, onResizeStart, resetColumnWidth, resetAllColumnWidths };
}

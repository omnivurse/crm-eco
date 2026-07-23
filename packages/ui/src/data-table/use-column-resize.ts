'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';

const MIN_COLUMN_WIDTH = 80;

type Options = {
  columns: string[];
  getDefaultWidth: (col: string) => number;
  /** Persists under `dt_col_widths_{storageKey}` */
  storageKey: string;
};

type Return = {
  columnWidths: Record<string, number>;
  isResizing: boolean;
  onResizeStart: (col: string, startX: number) => void;
  resetColumnWidth: (col: string) => void;
  resetAllColumnWidths: () => void;
};

function loadPersistedWidths(key: string): Record<string, number> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`dt_col_widths_${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return null;
  }
}

function persistWidths(key: string, widths: Record<string, number>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`dt_col_widths_${key}`, JSON.stringify(widths));
  } catch {
    /* quota / private mode */
  }
}

/**
 * Drag-to-resize column widths with localStorage persistence.
 * Lifted from CRM `useColumnResize` with a shared `dt_` storage prefix.
 */
export function useColumnResize({
  columns,
  getDefaultWidth,
  storageKey,
}: Options): Return {
  const [overrides, setOverrides] = useState<Record<string, number>>(() => {
    return loadPersistedWidths(storageKey) ?? {};
  });

  const [isResizing, setIsResizing] = useState(false);
  const dragRef = useRef<{ col: string; startX: number; startWidth: number } | null>(null);
  const widthsRef = useRef<Record<string, number>>({});
  const storageKeyRef = useRef(storageKey);
  const getDefaultWidthRef = useRef(getDefaultWidth);

  useEffect(() => {
    storageKeyRef.current = storageKey;
  }, [storageKey]);

  useEffect(() => {
    getDefaultWidthRef.current = getDefaultWidth;
  }, [getDefaultWidth]);

  const columnWidths = useMemo(() => {
    const next: Record<string, number> = {};
    for (const col of columns) {
      next[col] = overrides[col] ?? getDefaultWidth(col);
    }
    return next;
  }, [columns, getDefaultWidth, overrides]);

  useEffect(() => {
    widthsRef.current = columnWidths;
  }, [columnWidths]);

  const onResizeStart = useCallback((col: string, startX: number) => {
    const startWidth = widthsRef.current[col] ?? getDefaultWidthRef.current(col);
    dragRef.current = { col, startX, startWidth };
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { col: dragCol, startX: sx, startWidth: sw } = dragRef.current;
      const newWidth = Math.max(MIN_COLUMN_WIDTH, sw + (e.clientX - sx));
      setOverrides((prev) => ({ ...prev, [dragCol]: newWidth }));
    };

    const onUp = () => {
      dragRef.current = null;
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      persistWidths(storageKeyRef.current, widthsRef.current);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const resetColumnWidth = useCallback((col: string) => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[col];
      const resolved: Record<string, number> = { ...widthsRef.current, [col]: getDefaultWidthRef.current(col) };
      persistWidths(storageKeyRef.current, resolved);
      return next;
    });
  }, []);

  const resetAllColumnWidths = useCallback(() => {
    setOverrides({});
    const defaults: Record<string, number> = {};
    for (const col of columns) {
      defaults[col] = getDefaultWidthRef.current(col);
    }
    persistWidths(storageKeyRef.current, defaults);
  }, [columns]);

  return { columnWidths, isResizing, onResizeStart, resetColumnWidth, resetAllColumnWidths };
}

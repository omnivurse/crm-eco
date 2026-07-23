'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildCsv, downloadCsv } from './export-csv';
import { useColumnResize } from './use-column-resize';
import type {
  AppliedFilter,
  FilterOperator,
  ListQuery,
  ResourceDescriptor,
  ResourceListState,
} from './types';

const DEFAULT_PAGE_SIZE = 25;

function todayStamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function useResourceList<Row>(
  descriptor: ResourceDescriptor<Row>,
): ResourceListState<Row> {
  const pageSize = descriptor.pageSize ?? DEFAULT_PAGE_SIZE;
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<AppliedFilter[]>([]);
  const [sort, setSort] = useState<ListQuery['sort']>(undefined);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const columnKeys = useMemo(
    () => descriptor.columns.map((c) => c.key),
    [descriptor.columns],
  );

  const getDefaultWidth = useCallback(
    (col: string) => {
      const def = descriptor.columns.find((c) => c.key === col);
      return def?.defaultWidth ?? 140;
    },
    [descriptor.columns],
  );

  const { columnWidths, onResizeStart } = useColumnResize({
    columns: columnKeys,
    getDefaultWidth,
    storageKey: descriptor.resource,
  });

  // Debounce search → server query
  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query: ListQuery = {
        search: search || undefined,
        filters,
        sort,
        page,
        pageSize,
      };
      const result = await descriptor.dataSource.load(query);
      setRows(result.rows);
      setTotal(result.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load';
      setError(message);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [descriptor.dataSource, filters, page, pageSize, search, sort]);

  // Keep a stable refresh that always calls latest load
  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(async () => {
    await loadRef.current();
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilter = useCallback(
    (key: string, value: string | null, operator: FilterOperator = 'equals') => {
      setPage(1);
      setFilters((prev) => {
        const without = prev.filter((f) => f.key !== key);
        if (value === null || value === '' || value === 'all') return without;
        return [...without, { key, operator, value }];
      });
    },
    [],
  );

  const clearFilters = useCallback(() => {
    setFilters([]);
    setSearchInput('');
    setSearch('');
    setPage(1);
  }, []);

  const toggleSort = useCallback((key: string) => {
    setPage(1);
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return undefined;
    });
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const selectAllPage = useCallback(() => {
    setSelectedIds(new Set(rows.map((r) => descriptor.getRowId(r))));
  }, [descriptor, rows]);

  const exportCsv = useCallback(() => {
    const csv = buildCsv(rows, descriptor.columns);
    const cfg = descriptor.export;
    const filename =
      typeof cfg === 'object' && cfg.filename
        ? cfg.filename
        : `${descriptor.resource}-${todayStamp()}.csv`;
    downloadCsv(filename, csv);
  }, [descriptor.columns, descriptor.export, descriptor.resource, rows]);

  const ctx = useMemo(() => ({ refresh }), [refresh]);

  return {
    rows,
    total,
    loading,
    error,
    search: searchInput,
    setSearch: setSearchInput,
    filters,
    setFilter,
    clearFilters,
    sort,
    toggleSort,
    page,
    setPage,
    pageSize,
    selectedIds,
    toggleSelected,
    clearSelection,
    selectAllPage,
    columnWidths,
    onResizeStart,
    refresh,
    exportCsv,
    ctx,
  };
}

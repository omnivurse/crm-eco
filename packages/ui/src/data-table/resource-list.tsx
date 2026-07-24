'use client';

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { Button } from '../components/button';
import { Checkbox } from '../components/checkbox';
import { cn } from '../lib/utils';
import { useCan } from './can';
import { FilterBar } from './filter-bar';
import type { ResourceDescriptor, RowAction } from './types';
import { useResourceList } from './use-resource-list';

function SortIcon({
  active,
  dir,
}: {
  active: boolean;
  dir?: 'asc' | 'desc';
}) {
  if (!active) return <ArrowUpDown className="ml-1 inline h-3.5 w-3.5 opacity-40" />;
  if (dir === 'asc') return <ArrowUp className="ml-1 inline h-3.5 w-3.5" />;
  return <ArrowDown className="ml-1 inline h-3.5 w-3.5" />;
}

function RowActionsMenu<Row>({
  row,
  actions,
  ctx,
}: {
  row: Row;
  actions: RowAction<Row>[];
  ctx: { refresh: () => Promise<void> };
}) {
  const visible = actions.filter((a) => !a.visible || a.visible(row));
  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {visible.map((action) => (
        <RowActionButton key={action.id} action={action} row={row} ctx={ctx} />
      ))}
    </div>
  );
}

function RowActionButton<Row>({
  action,
  row,
  ctx,
}: {
  action: RowAction<Row>;
  row: Row;
  ctx: { refresh: () => Promise<void> };
}) {
  const allowed = useCan(action.permission);
  if (!allowed) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      title={action.label}
      aria-label={action.label}
      className={cn(action.variant === 'destructive' && 'text-destructive')}
      onClick={() => void action.run(row, ctx)}
    >
      {action.icon ?? <span className="text-xs">{action.label}</span>}
    </Button>
  );
}

export function ResourceList<Row>({
  descriptor,
}: {
  descriptor: ResourceDescriptor<Row>;
}) {
  const state = useResourceList(descriptor);
  const {
    rows,
    total,
    loading,
    exporting,
    error,
    search,
    setSearch,
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
    selectAllPage,
    clearSelection,
    columnWidths,
    onResizeStart,
    refresh,
    exportCsv,
    ctx,
  } = state;

  const enableExport = descriptor.export !== false;
  const enableBulk = Boolean(descriptor.bulkActions?.length);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const allPageSelected =
    rows.length > 0 && rows.every((r) => selectedIds.has(descriptor.getRowId(r)));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{descriptor.title}</h1>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={descriptor.searchPlaceholder}
          filterDefs={descriptor.filters ?? []}
          filters={filters}
          onFilterChange={(key, value) => {
            const def = descriptor.filters?.find((f) => f.key === key);
            setFilter(key, value, def?.operator ?? 'equals');
          }}
          onClear={clearFilters}
          onRefresh={() => void refresh()}
          onExport={enableExport ? exportCsv : undefined}
          loading={loading}
          exporting={exporting}
          toolbar={descriptor.toolbar}
        />
      </div>

      {enableBulk && selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-sm">
          <span className="font-medium">{selectedIds.size} selected</span>
          <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
            Clear
          </Button>
          {descriptor.bulkActions?.map((action) => (
            <BulkActionButton
              key={action.id}
              action={action}
              rows={rows.filter((r) => selectedIds.has(descriptor.getRowId(r)))}
              ctx={ctx}
            />
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-card">
        {error && (
          <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <p className="text-lg font-medium">
              {descriptor.emptyState?.title ?? 'No results'}
            </p>
            {descriptor.emptyState?.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {descriptor.emptyState.description}
              </p>
            )}
            {descriptor.emptyState?.action && (
              <div className="mt-4">{descriptor.emptyState.action}</div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full caption-bottom text-sm" role="grid">
              <thead>
                <tr className="border-b bg-muted/40">
                  {enableBulk && (
                    <th className="w-10 px-3 py-3">
                      <Checkbox
                        checked={allPageSelected}
                        onCheckedChange={(v) => {
                          if (v === true) selectAllPage();
                          else clearSelection();
                        }}
                        aria-label="Select all on page"
                      />
                    </th>
                  )}
                  {descriptor.columns.map((col) => {
                    const sortable = col.sortable !== false;
                    const active = sort?.key === col.key;
                    const width = columnWidths[col.key] ?? col.defaultWidth ?? 140;
                    return (
                      <th
                        key={col.key}
                        className={cn(
                          'relative px-3 py-3 text-left font-medium text-muted-foreground',
                          col.align === 'right' && 'text-right',
                          col.align === 'center' && 'text-center',
                        )}
                        style={{ width, minWidth: width }}
                      >
                        {sortable ? (
                          <button
                            type="button"
                            className="inline-flex items-center hover:text-foreground"
                            onClick={() => toggleSort(col.key)}
                          >
                            {col.header}
                            <SortIcon active={Boolean(active)} dir={sort?.dir} />
                          </button>
                        ) : (
                          col.header
                        )}
                        <span
                          role="separator"
                          aria-orientation="vertical"
                          aria-label={`Resize ${col.header}`}
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/40"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            onResizeStart(col.key, e.clientX);
                          }}
                          onDoubleClick={() => {
                            /* reset handled by hook consumer if needed */
                          }}
                        />
                      </th>
                    );
                  })}
                  {descriptor.rowActions?.length ? (
                    <th className="px-3 py-3 text-right font-medium text-muted-foreground">
                      Actions
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const id = descriptor.getRowId(row);
                  return (
                    <tr
                      key={id}
                      className={cn(
                        'border-b transition-colors hover:bg-muted/40',
                        descriptor.onRowClick && 'cursor-pointer',
                        selectedIds.has(id) && 'bg-muted/60',
                      )}
                      onClick={() => descriptor.onRowClick?.(row)}
                    >
                      {enableBulk && (
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(id)}
                            onCheckedChange={() => toggleSelected(id)}
                            aria-label={`Select row ${id}`}
                          />
                        </td>
                      )}
                      {descriptor.columns.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            'px-3 py-3 align-middle',
                            col.align === 'right' && 'text-right',
                            col.align === 'center' && 'text-center',
                          )}
                          style={{
                            width: columnWidths[col.key],
                            maxWidth: columnWidths[col.key],
                          }}
                        >
                          <div className="truncate">
                            {col.cell
                              ? col.cell(row)
                              : String(col.accessor(row) ?? '—')}
                          </div>
                        </td>
                      ))}
                      {descriptor.rowActions?.length ? (
                        <td className="px-3 py-3">
                          <RowActionsMenu
                            row={row}
                            actions={descriptor.rowActions}
                            ctx={ctx}
                          />
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Showing {from} to {to} of {total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Page {page} of {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BulkActionButton<Row>({
  action,
  rows,
  ctx,
}: {
  action: {
    id: string;
    label: string;
    run: (rows: Row[], ctx: { refresh: () => Promise<void> }) => void | Promise<void>;
    permission?: string;
    confirm?: string;
  };
  rows: Row[];
  ctx: { refresh: () => Promise<void> };
}) {
  const allowed = useCan(action.permission);
  if (!allowed) return null;
  return (
    <Button
      type="button"
      size="sm"
      onClick={() => {
        if (action.confirm && !window.confirm(action.confirm)) return;
        void action.run(rows, ctx);
      }}
    >
      {action.label}
    </Button>
  );
}

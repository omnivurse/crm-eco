'use client';

/**
 * Generic fetch-and-render panel for V2 related lists backed by
 * GET /api/crm/records/[id]/related/[kind].
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@crm-eco/ui/components/badge';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';
import type { RelatedListKind } from '@/lib/crm/record-related-lists';

export interface RelatedListColumn<T> {
  key: keyof T | string;
  label: string;
  render?: (row: T) => ReactNode;
}

export interface RecordRelatedListDataPanelProps<T extends { id: string }> {
  recordId: string;
  kind: RelatedListKind;
  title: string;
  emptyTitle: string;
  emptyHint: string;
  columns: RelatedListColumn<T>[];
  viewAllHref?: string;
  queryParams?: Record<string, string>;
  className?: string;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'MMM d, yyyy h:mm a');
}

function formatMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function formatRelatedCell(value: unknown): ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span className="text-slate-400">—</span>;
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return formatDate(value);
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return String(value);
}

export { formatDate, formatMoney };

export function RecordRelatedListDataPanel<T extends { id: string }>({
  recordId,
  kind,
  title,
  emptyTitle,
  emptyHint,
  columns,
  viewAllHref,
  queryParams,
  className,
}: RecordRelatedListDataPanelProps<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const queryKey = queryParams ? JSON.stringify(queryParams) : '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = queryParams ? new URLSearchParams(queryParams) : new URLSearchParams();
      const qs = params.toString();
      const res = await fetch(
        `/api/crm/records/${encodeURIComponent(recordId)}/related/${kind}${qs ? `?${qs}` : ''}`,
        { credentials: 'same-origin' },
      );
      if (!res.ok) throw new Error('Failed to load');
      const data = (await res.json()) as { items?: T[] };
      setRows(Array.isArray(data.items) ? data.items : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [recordId, kind, queryKey]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div
        className={cn(
          'rounded-xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/30 py-10 px-6 text-center',
          className,
        )}
      >
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{emptyTitle}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">{emptyHint}</p>
        {viewAllHref ? (
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href={viewAllHref}>Open {title}</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden', className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900/40">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          <Badge variant="secondary" className="text-xs">
            {rows.length}
          </Badge>
        </div>
        {viewAllHref ? (
          <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
            <Link href={viewAllHref}>
              View all
              <ExternalLink className="w-3 h-3 ml-1" />
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-white/5 text-left">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50/80 dark:hover:bg-white/5"
              >
                {columns.map((col) => (
                  <td key={String(col.key)} className="px-4 py-2.5 text-slate-700 dark:text-slate-200">
                    {col.render
                      ? col.render(row)
                      : formatRelatedCell((row as Record<string, unknown>)[col.key as string])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

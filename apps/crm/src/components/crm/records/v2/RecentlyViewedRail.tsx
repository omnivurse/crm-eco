'use client';

/**
 * Horizontal "Recently viewed" rail for list pages. Fetches the current
 * user's last N record visits (optionally scoped to a module) and shows
 * them as scrollable chips. Clicking a chip navigates straight to the
 * record detail page.
 *
 * Designed as a lightweight additive UI — if the API is unavailable or
 * the user has no history yet, the component renders nothing so list
 * pages degrade cleanly.
 */

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Clock, ChevronRight } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { formatDistanceToNowStrict } from 'date-fns';

export interface RecentlyViewedItem {
  recordId: string;
  moduleId: string;
  moduleKey: string | null;
  moduleName: string | null;
  title: string | null;
  data: Record<string, unknown> | null;
  lastViewedAt: string;
  viewCount: number;
  updatedAt: string | null;
}

export interface RecentlyViewedRailProps {
  /** Optional module filter — if provided, only shows records from this module. */
  moduleKey?: string;
  /** Cap visible chips. Defaults to 8. */
  limit?: number;
  className?: string;
  /** `inline` — compact strip for dashboard hero (no outer card chrome). */
  variant?: 'card' | 'inline';
}

function getInitials(title: string | null | undefined): string {
  if (!title) return '—';
  const parts = title.trim().split(/\s+/);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return (parts[0][0] ?? '').toUpperCase() || '—';
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? ''))
    .toUpperCase() || '—';
}

/** Resolve the display name from the recently-viewed payload (item.title → data fields → 'Untitled') */
function getItemDisplayName(item: RecentlyViewedItem): string {
  if (item.title && item.title !== 'Untitled') return item.title;
  const d = item.data;
  if (d) {
    const preferred = typeof d.preferred_name === 'string' ? d.preferred_name.trim() : '';
    const first = typeof d.first_name === 'string' ? d.first_name.trim() : '';
    const last = typeof d.last_name === 'string' ? d.last_name.trim() : '';
    const displayFirst = preferred || first;
    const fullName = [displayFirst, last].filter(Boolean).join(' ');
    if (fullName) return fullName;
    if (typeof d.account_name === 'string' && d.account_name.trim()) return d.account_name.trim();
    if (typeof d.name === 'string' && d.name.trim()) return d.name.trim();
  }
  return item.title || 'Untitled';
}

export const RecentlyViewedRail = memo(function RecentlyViewedRail({
  moduleKey,
  limit = 8,
  className,
  variant = 'card',
}: RecentlyViewedRailProps) {
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL('/api/crm/recently-viewed', window.location.origin);
      if (moduleKey) url.searchParams.set('module_key', moduleKey);
      url.searchParams.set('limit', String(limit));
      const res = await fetch(url.toString(), { credentials: 'same-origin' });
      if (!res.ok) {
        setItems([]);
        return;
      }
      const body = (await res.json()) as { data?: RecentlyViewedItem[] };
      setItems(body.data ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [moduleKey, limit]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const visible = useMemo(() => items.slice(0, limit), [items, limit]);

  if (!loading && visible.length === 0) return null;

  const isInline = variant === 'inline';

  return (
    <section
      aria-label="Recently viewed"
      className={cn(
        isInline
          ? 'rounded-lg border border-slate-200/70 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/30'
          : 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm',
        className,
      )}
    >
      <div
        className={cn(
          'px-3 flex items-center gap-2 border-b border-slate-100 dark:border-white/5',
          isInline ? 'py-1.5' : 'py-1.5 px-4',
        )}
      >
        <Clock className="w-3.5 h-3.5 text-slate-400" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
          Recently viewed
        </h3>
        {!loading && (
          <span className="text-[11px] text-slate-400">
            {visible.length} item{visible.length === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <div className={cn('flex gap-2 overflow-x-auto [scrollbar-width:thin]', isInline ? 'px-2 py-2' : 'px-3 py-2')}>
        {loading
          ? Array.from({ length: isInline ? 4 : 5 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-xl bg-slate-100 dark:bg-slate-800/50 animate-pulse',
                  isInline ? 'min-w-[160px] h-[52px]' : 'min-w-[180px] h-[52px]',
                )}
              />
            ))
          : visible.map((item) => (
              <Link
                key={item.recordId}
                href={`/crm/r/${item.recordId}`}
                prefetch={false}
                className={cn(
                  'group shrink-0 rounded-xl border border-slate-200 dark:border-white/10',
                  'bg-white dark:bg-slate-900/60 hover:border-teal-400 dark:hover:border-teal-500/60 hover:shadow-sm',
                  'flex items-center gap-2 transition-colors',
                  isInline ? 'min-w-[160px] max-w-[220px] px-2.5 py-1.5' : 'min-w-[180px] max-w-[240px] px-3 py-1.5',
                )}
              >
                <div
                  aria-hidden
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-semibold',
                    'bg-gradient-to-br from-teal-100 to-cyan-100 text-teal-700',
                    'dark:from-teal-500/20 dark:to-cyan-500/20 dark:text-teal-300',
                  )}
                >
                  {getInitials(getItemDisplayName(item))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {getItemDisplayName(item)}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {item.moduleName ?? 'Record'}
                    {' · '}
                    <span suppressHydrationWarning>
                      {formatDistanceToNowStrict(new Date(item.lastViewedAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-teal-500 transition-colors" />
              </Link>
            ))}
      </div>
    </section>
  );
});

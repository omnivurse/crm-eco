'use client';

/**
 * FilterableTimeline — V2-only wrapper that adds filter pills above the
 * shared `RecordTimeline` component. Fetches events client-side from
 * `GET /api/crm/records/[id]/timeline` so filter toggles are instant (no
 * round-trips). V1 continues to use the SSR-rendered timeline.
 *
 * Behaviour:
 *   - Loads events on mount (skeleton shown while loading).
 *   - Pills toggle which `type` values are visible; "All" clears filters.
 *   - Pill counts update in real-time based on the fetched event set.
 *   - A refresh button re-fetches without a route transition.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Filter } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';
import { RecordTimeline } from '@/components/crm/records/RecordTimeline';
import type { TimelineEvent, TimelineEventType } from '@/lib/crm/types';

export interface FilterableTimelineProps {
  recordId: string;
  /** Optional initial events (for SSR hydration). */
  initialEvents?: TimelineEvent[];
  className?: string;
}

interface Pill {
  id: TimelineEventType | 'all';
  label: string;
}

const PILLS: Pill[] = [
  { id: 'all', label: 'All' },
  { id: 'activity', label: 'Activities' },
  { id: 'note', label: 'Notes' },
  { id: 'stage_change', label: 'Stage changes' },
  { id: 'attachment', label: 'Attachments' },
  { id: 'audit', label: 'Audit' },
];

export function FilterableTimeline({
  recordId,
  initialEvents,
  className,
}: FilterableTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>(initialEvents ?? []);
  const [loading, setLoading] = useState<boolean>(!initialEvents);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTypes, setActiveTypes] = useState<Set<TimelineEventType>>(
    new Set(),
  );

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await fetch(`/api/crm/records/${recordId}/timeline`, {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { events?: TimelineEvent[] };
        setEvents(body.events ?? []);
      } catch (err) {
        console.warn('[FilterableTimeline] load failed:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [recordId],
  );

  useEffect(() => {
    if (!initialEvents) void load();
  }, [load, initialEvents]);

  // Per-type counts for the pill badges.
  const counts = useMemo(() => {
    const acc: Record<string, number> = { all: events.length };
    for (const ev of events) {
      acc[ev.type] = (acc[ev.type] ?? 0) + 1;
    }
    return acc;
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (activeTypes.size === 0) return events;
    return events.filter((ev) => activeTypes.has(ev.type));
  }, [events, activeTypes]);

  const togglePill = (id: TimelineEventType | 'all') => {
    if (id === 'all') {
      setActiveTypes(new Set());
      return;
    }
    setActiveTypes((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isActive = (id: TimelineEventType | 'all'): boolean => {
    if (id === 'all') return activeTypes.size === 0;
    return activeTypes.has(id);
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1">
          <Filter className="w-3 h-3" />
          Filter
        </span>
        {PILLS.map((pill) => {
          const active = isActive(pill.id);
          const count = counts[pill.id] ?? 0;
          return (
            <button
              key={pill.id}
              type="button"
              onClick={() => togglePill(pill.id)}
              disabled={pill.id !== 'all' && count === 0}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors',
                active
                  ? 'bg-teal-600 border-teal-600 text-white'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-teal-400 hover:text-teal-600 dark:hover:text-teal-400',
                pill.id !== 'all' && count === 0 && 'opacity-40 cursor-not-allowed hover:border-slate-200 hover:text-slate-600',
              )}
              aria-pressed={active}
            >
              <span>{pill.label}</span>
              <span
                className={cn(
                  'inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full text-[10px] font-semibold',
                  active
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300',
                )}
              >
                {count}
              </span>
            </button>
          );
        })}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load(true)}
          disabled={refreshing || loading}
          className="ml-auto text-xs text-slate-500 hover:text-teal-600"
        >
          <RefreshCw className={cn('w-3.5 h-3.5 mr-1', refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <RecordTimeline events={filteredEvents} isLoading={loading} />
    </div>
  );
}

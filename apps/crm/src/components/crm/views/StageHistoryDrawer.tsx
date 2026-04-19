'use client';

/**
 * StageHistoryDrawer — a compact side-drawer opened from a kanban card's
 * clock/history icon. Shows:
 *
 *   1. **Time in current stage** (with a warning pill when a deal has been
 *      parked longer than the average cycle time, so reps can spot
 *      stalled work at a glance).
 *   2. **Stage-velocity summary** (avg time between transitions, total
 *      transitions) — rep-facing, not a manager dashboard, so it stays
 *      terse on purpose.
 *   3. **Chronological transition feed** rendered as a colored vertical
 *      timeline with per-transition duration, the name of the person who
 *      moved the deal, and the stage colors from the deal catalog.
 *
 * The drawer is stateless beyond its open/close toggle — all data comes
 * from `GET /api/crm/records/[id]/stage-history` so refreshes just refetch.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@crm-eco/ui/components/sheet';
import { Badge } from '@crm-eco/ui/components/badge';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  AlertTriangle,
  Clock,
  History,
  Loader2,
  Trophy,
  User,
  XCircle,
} from 'lucide-react';
import type { CrmDealStage } from '@/lib/crm/types';

interface Transition {
  id: string;
  from_stage: string | null;
  to_stage: string;
  duration_seconds: number | null;
  changed_by: string | null;
  changed_by_name: string | null;
  reason: string | null;
  created_at: string;
}

interface StageHistoryResponse {
  record_id: string;
  current_stage: string | null;
  current_stage_since: string | null;
  current_stage_seconds: number | null;
  transitions: Transition[];
  average_duration_seconds: number | null;
  total_transitions: number;
}

export interface StageHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId: string | null;
  recordTitle?: string;
  stages?: CrmDealStage[];
}

/** Human-friendly duration like "3 days", "2h 14m", "45s". */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  if (h < 24) return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const remH = h % 24;
  return remH > 0 ? `${d}d ${remH}h` : `${d}d`;
}

function relativeDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function StageHistoryDrawer({
  open,
  onOpenChange,
  recordId,
  recordTitle,
  stages,
}: StageHistoryDrawerProps) {
  const [data, setData] = useState<StageHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build a fast key → stage lookup so we can color timeline dots and
  // surface won/lost semantics alongside each transition.
  const stagesByKey = useMemo(() => {
    const map = new Map<string, CrmDealStage>();
    (stages ?? []).forEach((s) => map.set(s.key, s));
    return map;
  }, [stages]);

  useEffect(() => {
    if (!open || !recordId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/crm/records/${recordId}/stage-history`,
          { credentials: 'same-origin' },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `Failed (${res.status})`);
        }
        const json = (await res.json()) as StageHistoryResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, recordId]);

  // When the drawer re-opens on a different record, clear stale data so we
  // don't flash the previous deal's history while the new fetch lands.
  useEffect(() => {
    if (!open) setData(null);
  }, [open]);

  const currentStage = data?.current_stage
    ? stagesByKey.get(data.current_stage)
    : null;
  const isStalled =
    data?.current_stage_seconds &&
    data.average_duration_seconds &&
    data.current_stage_seconds > data.average_duration_seconds * 1.5;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-white/10 overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
            <History className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            Stage history
          </SheetTitle>
          {recordTitle ? (
            <SheetDescription className="text-slate-500 dark:text-slate-400">
              {recordTitle}
            </SheetDescription>
          ) : null}
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading history…
            </div>
          ) : error ? (
            <div className="text-sm text-rose-600 dark:text-rose-400">
              {error}
            </div>
          ) : !data ? null : (
            <>
              {/* Velocity summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 dark:border-white/10 p-3">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <Clock className="w-3 h-3" />
                    In current stage
                  </div>
                  <div
                    className={cn(
                      'mt-1 text-base font-bold text-slate-900 dark:text-white',
                      isStalled && 'text-amber-600 dark:text-amber-400',
                    )}
                  >
                    {data.current_stage_seconds != null
                      ? formatDuration(data.current_stage_seconds)
                      : '—'}
                  </div>
                  {currentStage ? (
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: currentStage.color || '#6366f1',
                        }}
                      />
                      <span className="truncate">{currentStage.name}</span>
                      {currentStage.is_won ? (
                        <Trophy className="w-3 h-3 text-emerald-500" />
                      ) : currentStage.is_lost ? (
                        <XCircle className="w-3 h-3 text-rose-500" />
                      ) : null}
                    </div>
                  ) : null}
                  {isStalled ? (
                    <Badge
                      variant="secondary"
                      className="mt-2 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-500/30"
                    >
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Stalled
                    </Badge>
                  ) : null}
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-white/10 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Avg per stage
                  </div>
                  <div className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                    {data.average_duration_seconds != null
                      ? formatDuration(data.average_duration_seconds)
                      : '—'}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {data.total_transitions} transition
                    {data.total_transitions === 1 ? '' : 's'}
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
                  Timeline
                </h4>
                {data.transitions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 dark:border-white/10 p-4 text-sm text-slate-500 dark:text-slate-400 text-center">
                    No stage changes recorded yet.
                  </div>
                ) : (
                  <ol className="relative pl-5 border-l border-slate-200 dark:border-white/10 space-y-4">
                    {data.transitions.map((t) => {
                      const toStage = stagesByKey.get(t.to_stage);
                      const fromStage = t.from_stage
                        ? stagesByKey.get(t.from_stage)
                        : null;
                      return (
                        <li key={t.id} className="relative">
                          <span
                            className="absolute -left-[27px] top-1 w-3 h-3 rounded-full ring-2 ring-white dark:ring-slate-900"
                            style={{
                              backgroundColor:
                                toStage?.color || '#6366f1',
                            }}
                            aria-hidden
                          />
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-sm font-medium text-slate-900 dark:text-white">
                              {fromStage?.name ?? t.from_stage ?? 'Created'}
                            </span>
                            <span className="text-xs text-slate-400">→</span>
                            <span className="text-sm font-medium text-slate-900 dark:text-white">
                              {toStage?.name ?? t.to_stage}
                            </span>
                            {toStage?.is_won ? (
                              <Trophy className="w-3 h-3 text-emerald-500" />
                            ) : toStage?.is_lost ? (
                              <XCircle className="w-3 h-3 text-rose-500" />
                            ) : null}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                            <span>{relativeDate(t.created_at)}</span>
                            {t.duration_seconds != null &&
                            t.duration_seconds > 0 ? (
                              <>
                                <span>·</span>
                                <span>
                                  {formatDuration(t.duration_seconds)} in
                                  prior stage
                                </span>
                              </>
                            ) : null}
                          </div>
                          {t.changed_by_name ? (
                            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                              <User className="w-3 h-3" />
                              <span>{t.changed_by_name}</span>
                            </div>
                          ) : null}
                          {t.reason ? (
                            <div className="mt-1 text-[11px] italic text-slate-600 dark:text-slate-400">
                              “{t.reason}”
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

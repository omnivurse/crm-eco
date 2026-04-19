'use client';

/**
 * UnsavedChangesPill — compact status chip for the V2 header.
 *
 * Shows, in priority order:
 *   1. An error state if any field save failed — offers retry via click.
 *   2. A "Saving X changes…" state if any field is pending or in-flight.
 *   3. A "Saved Xs ago" state for 6s after the last successful save.
 *   4. Nothing (returns null) in the steady idle state.
 *
 * Reads entirely from `RecordFieldSaveContext` so it stays in sync with
 * every inline editor on the page.
 */

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, CloudOff, Loader2 } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { useRecordFieldSaveOptional } from '@/hooks/useRecordFieldSave';
import { useMutationQueue } from '@/hooks/useMutationQueue';

export interface UnsavedChangesPillProps {
  className?: string;
  /**
   * How long the "Saved" confirmation persists after the last successful
   * save. Defaults to 6s.
   */
  savedLingerMs?: number;
  /**
   * The record this pill belongs to. When provided, the pill can
   * detect queued-but-not-yet-synced mutations scoped to this record
   * and surface a "X queued" state — critical in weak-network
   * scenarios where the local save succeeded but the server replay
   * is still pending.
   */
  recordId?: string;
}

export function UnsavedChangesPill({
  className,
  savedLingerMs = 6000,
  recordId,
}: UnsavedChangesPillProps) {
  const ctx = useRecordFieldSaveOptional();
  const queue = useMutationQueue();
  // `now` is advanced on an interval instead of being read directly
  // from `Date.now()` during render — that's the react-hooks/purity
  // rule, and it keeps the "Saved Xs ago" label fresh without making
  // the component non-deterministic.
  const [now, setNow] = useState<number>(() => Date.now());

  // Re-render every second while showing "Saved Xs ago" so the label
  // stays fresh without pulling a heavy relative-time library.
  useEffect(() => {
    if (!ctx?.lastSavedAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [ctx?.lastSavedAt]);

  // Narrow the queue to mutations that belong to *this* record so a
  // busy teammate editing another deal doesn't make this pill flash.
  const recordQueued = useMemo(() => {
    if (!recordId) return 0;
    return queue.pending.filter((m) => m.recordId === recordId).length;
  }, [queue.pending, recordId]);

  if (!ctx) return null;
  const { pendingCount, lastError, lastSavedAt } = ctx;

  if (lastError && pendingCount === 0) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium',
          'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300',
          className,
        )}
        title={lastError}
        role="status"
      >
        <AlertTriangle className="w-3 h-3" />
        <span>Save failed</span>
      </span>
    );
  }

  if (pendingCount > 0) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium',
          'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300',
          className,
        )}
        role="status"
        aria-live="polite"
      >
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>
          Saving {pendingCount} change{pendingCount === 1 ? '' : 's'}…
        </span>
      </span>
    );
  }

  // Queued state — local save succeeded but the server replay hasn't
  // landed yet. Renders between the in-flight and "saved" states so
  // the rep knows the edit is safe but not yet remote.
  if (recordQueued > 0) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium',
          'bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/30 text-sky-700 dark:text-sky-300',
          className,
        )}
        role="status"
        title={
          queue.isOnline
            ? 'Saved locally · syncing to server'
            : 'Saved locally · will sync when back online'
        }
      >
        <CloudOff className="w-3 h-3" />
        <span>
          Queued · {recordQueued} change{recordQueued === 1 ? '' : 's'}
        </span>
      </span>
    );
  }

  if (lastSavedAt && now - lastSavedAt <= savedLingerMs) {
    const seconds = Math.max(1, Math.round((now - lastSavedAt) / 1000));
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium',
          'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
          className,
        )}
        role="status"
      >
        <Check className="w-3 h-3" />
        <span>
          Saved {seconds <= 2 ? 'just now' : `${seconds}s ago`}
        </span>
      </span>
    );
  }

  return null;
}

'use client';

/**
 * RecordQueuedBadge — tiny indicator that sits inside a list-view
 * row when there are queued (locally-saved but not-yet-synced)
 * mutations for that record.
 *
 * Drops the rep a breadcrumb before they click into a record: "this
 * one has edits on the wire". Tapping the badge opens the pending-
 * changes pill via the `data-queue-badge` attribute, which the topbar
 * pill listens for — see `PendingChangesPill`.
 *
 * Keeps the UI quiet in the happy path: renders null when nothing is
 * queued for the given record.
 */

import { CloudOff } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { useMutationQueue } from '@/hooks/useMutationQueue';

export interface RecordQueuedBadgeProps {
  recordId: string;
  className?: string;
  /** Render as a compact single-icon dot rather than a text pill.
   *  Useful inside the main table where space is at a premium. */
  compact?: boolean;
}

export function RecordQueuedBadge({
  recordId,
  className,
  compact = false,
}: RecordQueuedBadgeProps) {
  const { pending, failed } = useMutationQueue();
  const queuedHere = pending.filter((m) => m.recordId === recordId).length;
  const failedHere = failed.filter((m) => m.recordId === recordId).length;
  const total = queuedHere + failedHere;
  if (total === 0) return null;

  const hasFailure = failedHere > 0;
  const label = hasFailure
    ? `${failedHere} failed`
    : `${queuedHere} queued`;

  if (compact) {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center w-4 h-4 rounded-full border',
          hasFailure
            ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300'
            : 'bg-sky-50 border-sky-200 text-sky-600 dark:bg-sky-500/10 dark:border-sky-500/30 dark:text-sky-300',
          className,
        )}
        title={label}
        aria-label={label}
        role="status"
      >
        <CloudOff className="w-2.5 h-2.5" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-medium',
        hasFailure
          ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300'
          : 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-500/10 dark:border-sky-500/30 dark:text-sky-300',
        className,
      )}
      title={label}
      role="status"
    >
      <CloudOff className="w-2.5 h-2.5" />
      <span>{label}</span>
    </span>
  );
}

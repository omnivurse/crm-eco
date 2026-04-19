'use client';

/**
 * PendingChangesPill — topbar affordance that surfaces queued / failed
 * mutations managed by `mutationQueue`. Click to open an inspector
 * dialog listing each entry with retry / discard controls.
 *
 * Hidden entirely when the queue is empty so the topbar stays clean.
 */

import { memo, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CloudOff,
  RefreshCcw,
  X,
  AlertCircle,
  Loader2,
  Wifi,
  WifiOff,
  ChevronRight,
  ExternalLink,
  GitCompareArrows,
} from 'lucide-react';
import type { QueuedMutation } from '@/lib/offline/mutation-queue';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@crm-eco/ui/components/dialog';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';
import { useMutationQueue } from '@/hooks/useMutationQueue';

export const PendingChangesPill = memo(function PendingChangesPill({
  className,
}: {
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const router = useRouter();
  const {
    pending,
    failed,
    isOnline,
    isSyncing,
    flush,
    retry,
    remove,
    clearFailed,
  } = useMutationQueue();
  // Hoisted out of JSX so the hook call order stays stable across
  // renders. Returns null when no conflict is being reviewed.
  const reviewMutation = useMemo(
    () => failed.find((m) => m.id === reviewId) ?? null,
    [failed, reviewId],
  );

  const total = pending.length + failed.length;
  if (total === 0) return null;

  const hasFailures = failed.length > 0;
  const label = hasFailures
    ? `${failed.length} failed`
    : `${pending.length} pending`;

  const Icon = hasFailures ? AlertCircle : isSyncing ? Loader2 : CloudOff;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium border transition-colors',
          hasFailures
            ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300'
            : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-200',
          className,
        )}
        aria-label={`${label} — open sync inspector`}
        title={`${label} — click to inspect`}
      >
        <Icon className={cn('w-3.5 h-3.5', isSyncing && 'animate-spin')} />
        <span>{label}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <CloudOff className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              Pending changes
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              Edits waiting to sync to the server. They&apos;ll replay
              automatically — you can also retry or discard individual
              entries below.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 flex items-center gap-2 text-xs">
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border',
                isOnline
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300'
                  : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-200',
              )}
            >
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isOnline ? 'Online' : 'Offline'}
            </span>
            {isSyncing && (
              <span className="inline-flex items-center gap-1 text-slate-500">
                <Loader2 className="w-3 h-3 animate-spin" /> Syncing…
              </span>
            )}
          </div>

          <div className="mt-4 max-h-[50vh] overflow-y-auto space-y-2 pr-1">
            {pending.length === 0 && failed.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
                No pending changes. Everything is in sync.
              </p>
            ) : (
              <>
                {pending.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/40 px-3 py-2"
                  >
                    <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-slate-800 dark:text-slate-100 truncate">
                        {m.label}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {m.method} · attempt {m.attempts + 1}
                        {m.lastError ? ` · ${m.lastError}` : ''}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-rose-600"
                      onClick={() => remove(m.id)}
                      title="Discard"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}

                {failed.map((m) => {
                  const isConflict = m.failureKind === 'conflict';
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2"
                    >
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-rose-900 dark:text-rose-100 truncate">
                          {m.label}
                          {isConflict ? (
                            <span className="ml-2 inline-flex items-center rounded-full bg-rose-200/70 dark:bg-rose-500/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                              Conflict
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[11px] text-rose-700 dark:text-rose-300 truncate">
                          {m.lastError ?? 'Failed after max retries'}
                        </div>
                      </div>
                      {isConflict ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-rose-700 hover:text-rose-900 dark:text-rose-300 dark:hover:text-rose-100"
                          onClick={() => setReviewId(m.id)}
                          title="Review conflict"
                        >
                          <GitCompareArrows className="w-3.5 h-3.5" />
                        </Button>
                      ) : null}
                      {m.recordId ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-rose-700 hover:text-rose-900 dark:text-rose-300 dark:hover:text-rose-100"
                          onClick={() => {
                            setOpen(false);
                            router.push(`/crm/r/${m.recordId}`);
                          }}
                          title="Open record"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-rose-700 hover:text-rose-900 dark:text-rose-300 dark:hover:text-rose-100"
                        onClick={() => retry(m.id)}
                        title="Retry"
                      >
                        <RefreshCcw className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-rose-600"
                        onClick={() => remove(m.id)}
                        title="Discard"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          <DialogFooter className="mt-2">
            {failed.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFailed}
                className="border-slate-200 dark:border-white/10"
              >
                Discard all failed
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => void flush()}
              disabled={!isOnline || isSyncing || pending.length === 0}
              className="bg-teal-500 hover:bg-teal-600 text-white"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Syncing…
                </>
              ) : (
                <>
                  <RefreshCcw className="w-3.5 h-3.5 mr-1.5" />
                  Sync now
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConflictReviewDialog
        mutation={reviewMutation}
        onClose={() => setReviewId(null)}
        onRetry={(id) => {
          // Force-retry strips any stale If-Match/version precondition
          // so the replay bypasses the optimistic concurrency check that
          // originally surfaced the 409. User's explicit decision to
          // "keep my change" upgrades CAS to last-write-wins.
          retry(id, { force: true });
          setReviewId(null);
        }}
        onDiscard={(id) => {
          remove(id);
          setReviewId(null);
        }}
        onOpenRecord={(id) => {
          setReviewId(null);
          setOpen(false);
          router.push(`/crm/r/${id}`);
        }}
      />
    </>
  );
});

/**
 * ConflictReviewDialog — shows the queued mutation's payload so the
 * user can decide whether to reapply (retry) against fresh server
 * state or drop the local change. Rather than try to fetch the live
 * server value (which requires network anyway), we render the fields
 * the user tried to change and link them to the record page where
 * they can see the current value and re-edit with full context.
 */
function ConflictReviewDialog({
  mutation,
  onClose,
  onRetry,
  onDiscard,
  onOpenRecord,
}: {
  mutation: QueuedMutation | null;
  onClose: () => void;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
  onOpenRecord: (recordId: string) => void;
}) {
  const payloadFields = mutation ? parsePayloadFields(mutation) : [];

  return (
    <Dialog open={!!mutation} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
            <GitCompareArrows className="w-4 h-4 text-rose-500" />
            Review conflict
          </DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-slate-400">
            This record was updated on the server while you were offline.
            Choose whether to reapply your pending change over the new
            server value.
          </DialogDescription>
        </DialogHeader>

        {mutation ? (
          <div className="mt-3 space-y-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {mutation.label}
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/40 px-3 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                Your pending change
              </div>
              {payloadFields.length === 0 ? (
                <div className="text-sm text-slate-500 italic">
                  (no field preview available)
                </div>
              ) : (
                <dl className="space-y-1 text-sm">
                  {payloadFields.map(([field, value]) => (
                    <div key={field} className="flex gap-2">
                      <dt className="text-slate-500 dark:text-slate-400 min-w-[100px]">
                        {field}
                      </dt>
                      <dd className="text-slate-900 dark:text-slate-100 break-words min-w-0">
                        {formatValue(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              The server&apos;s current value isn&apos;t available offline —
              open the record to compare before reapplying.
            </p>
          </div>
        ) : null}

        <DialogFooter className="mt-3 gap-2 flex-wrap">
          {mutation?.recordId ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenRecord(mutation.recordId!)}
              className="border-slate-200 dark:border-white/10"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Open record
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutation && onDiscard(mutation.id)}
            className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
          >
            Discard my change
          </Button>
          <Button
            size="sm"
            onClick={() => mutation && onRetry(mutation.id)}
            className="bg-teal-500 hover:bg-teal-600 text-white"
          >
            <RefreshCcw className="w-3.5 h-3.5 mr-1.5" />
            Keep my change (retry)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Extract `[field, value]` pairs from a queued mutation's JSON body.
 * Handles both top-level column writes (`{ title: 'x' }`) and JSONB
 * data writes (`{ data: { tags: [...] } }`) so the review dialog
 * shows something meaningful regardless of the field target.
 */
function parsePayloadFields(mutation: QueuedMutation): Array<[string, unknown]> {
  if (!mutation.body) return [];
  try {
    const parsed = JSON.parse(mutation.body) as Record<string, unknown>;
    const pairs: Array<[string, unknown]> = [];
    for (const [k, v] of Object.entries(parsed)) {
      if (k === 'data' && v && typeof v === 'object') {
        for (const [dk, dv] of Object.entries(v as Record<string, unknown>)) {
          pairs.push([dk, dv]);
        }
        continue;
      }
      if (k === 'record_ids' || k === 'updates') {
        // Bulk mutation shape — summarise the updates.
        if (k === 'updates' && v && typeof v === 'object') {
          for (const [uk, uv] of Object.entries(v as Record<string, unknown>)) {
            pairs.push([uk, uv]);
          }
        }
        continue;
      }
      pairs.push([k, v]);
    }
    return pairs;
  } catch {
    return [];
  }
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((v) => formatValue(v)).join(', ');
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

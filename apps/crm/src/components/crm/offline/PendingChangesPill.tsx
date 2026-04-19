'use client';

/**
 * PendingChangesPill — topbar affordance that surfaces queued / failed
 * mutations managed by `mutationQueue`. Click to open an inspector
 * dialog listing each entry with retry / discard controls.
 *
 * Hidden entirely when the queue is empty so the topbar stays clean.
 */

import { memo, useState } from 'react';
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
} from 'lucide-react';
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

                {failed.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-rose-900 dark:text-rose-100 truncate">
                        {m.label}
                      </div>
                      <div className="text-[11px] text-rose-700 dark:text-rose-300 truncate">
                        {m.lastError ?? 'Failed after max retries'}
                      </div>
                    </div>
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
                ))}
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
    </>
  );
});

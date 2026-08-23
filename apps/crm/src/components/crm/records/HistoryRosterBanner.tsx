'use client';

/**
 * History / cancelled-Members chrome.
 * Reactivate returns them to the working list (same UUID) and appends `returned`.
 * Previously-cancelled chip opens the immutable period ledger.
 */

import { memo, useCallback, useEffect, useState } from 'react';
import { Archive, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { toastCopy } from '@/lib/crm/toast-copy';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';
import { canCreateRecords } from '@/lib/crm/can-create-records';
import { useClientAuth } from '@/hooks/useClientAuth';
import { hasEverCancelled } from '@/lib/crm/person-lifecycle-ledger';
import { PeriodLedgerSheet } from './PeriodLedgerSheet';

interface HistoryRosterBannerProps {
  recordId: string;
  status?: string | null;
  variant?: 'history' | 'members';
  className?: string;
  onReactivated?: () => void;
}

interface LifecyclePayload {
  events?: Array<{ event_type?: string }>;
}

export const HistoryRosterBanner = memo(function HistoryRosterBanner({
  recordId,
  status,
  variant = 'history',
  className,
  onReactivated,
}: HistoryRosterBannerProps) {
  const { profile } = useClientAuth();
  const canReactivate = canCreateRecords(profile?.crm_role);
  const [pending, setPending] = useState(false);
  const [previouslyCancelled, setPreviouslyCancelled] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/crm/lifecycle/${recordId}`);
        if (!res.ok) return;
        const body = (await res.json()) as LifecyclePayload;
        if (cancelled) return;
        setPreviouslyCancelled(hasEverCancelled(body.events ?? []));
      } catch {
        if (!cancelled) setPreviouslyCancelled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recordId]);

  const reactivate = useCallback(async () => {
    setPending(true);
    try {
      const res = await fetch(`/api/crm/records/${recordId}/reactivate`, { method: 'POST' });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error || 'Reactivate failed');
      }
      toast.success(toastCopy.updated('Record'));
      onReactivated?.();
    } catch (err) {
      toast.error(toastCopy.failed('reactivate this person', err, 'Try again'));
    } finally {
      setPending(false);
    }
  }, [onReactivated, recordId]);

  const isMembers = variant === 'members';

  return (
    <div
      className={cn(
        'mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-900/60',
        className,
      )}
      data-testid={isMembers ? 'crm-members-cancelled-banner' : 'crm-history-roster-banner'}
    >
      <Archive className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-800 dark:text-slate-100">
          {isMembers ? 'This person is cancelled on Members' : 'This person is in History'}
          {status ? <span className="font-normal text-slate-500"> · {status}</span> : null}
        </p>
        <p className="text-slate-500 dark:text-slate-400">
          {isMembers
            ? 'Reactivate sets them Active on Members. Cancellation periods stay on this same record.'
            : 'Membership is closed. Notes and this URL stay with the same record. Reactivate to put them back on Contacts.'}
        </p>
      </div>
      {previouslyCancelled ? (
        <PreviouslyCancelledChip recordId={recordId} onOpen={() => setSheetOpen(true)} />
      ) : null}
      {canReactivate ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => void reactivate()}
          data-testid="crm-history-reactivate"
          className="h-8 shrink-0"
        >
          {pending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          )}
          Reactivate
        </Button>
      ) : null}
      <PeriodLedgerSheet recordId={recordId} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
});

export const PreviouslyCancelledChip = memo(function PreviouslyCancelledChip({
  recordId,
  className,
  onOpen,
}: {
  recordId: string;
  className?: string;
  onOpen?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/crm/lifecycle/${recordId}`);
        if (!res.ok) return;
        const body = (await res.json()) as LifecyclePayload;
        if (cancelled) return;
        setVisible(hasEverCancelled(body.events ?? []));
      } catch {
        if (!cancelled) setVisible(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recordId]);

  if (!visible) return null;

  const open = () => {
    if (onOpen) onOpen();
    else setSheetOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        className={cn(
          'rounded-full bg-slate-200/80 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-300/80 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15',
          className,
        )}
        data-testid="crm-previously-cancelled-chip"
      >
        Previously cancelled
      </button>
      {onOpen ? null : (
        <PeriodLedgerSheet recordId={recordId} open={sheetOpen} onOpenChange={setSheetOpen} />
      )}
    </>
  );
});

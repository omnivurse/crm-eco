'use client';

/**
 * Immutable cancellation periods from member_lifecycle_events.
 * Not membership_changes (those are editable plan-upgrade rows).
 */

import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@crm-eco/ui/components/sheet';
import {
  hasEverCancelled,
  pairCancellationPeriods,
  type LifecycleEventLike,
} from '@/lib/crm/person-lifecycle-ledger';

interface PeriodLedgerSheetProps {
  recordId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LifecyclePayload {
  events?: Array<LifecycleEventLike & { reason?: string | null }>;
}

function formatDate(value: string | undefined): string {
  if (!value) return '—';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function PeriodLedgerSheet({ recordId, open, onOpenChange }: PeriodLedgerSheetProps) {
  const [events, setEvents] = useState<LifecycleEventLike[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch(`/api/crm/lifecycle/${recordId}`);
        const body = (await res.json().catch(() => ({}))) as LifecyclePayload & { error?: string };
        if (!res.ok) throw new Error(body.error || 'Failed to load cancellation periods');
        if (cancelled) return;
        setEvents(body.events ?? []);
      } catch (err) {
        if (!cancelled) {
          setEvents([]);
          setError(err instanceof Error ? err.message : 'Failed to load cancellation periods');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, recordId]);

  const periods = pairCancellationPeriods(events);
  const everCancelled = hasEverCancelled(events);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md" data-testid="crm-period-ledger-sheet">
        <SheetHeader>
          <SheetTitle>Cancellation periods</SheetTitle>
          <SheetDescription>
            Every cancel and return for this person. History is only who is
            cancelled right now — these periods stay after reactivate.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-slate-500">Loading periods…</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : !everCancelled ? (
            <p className="text-sm text-slate-500">No cancellation periods recorded yet.</p>
          ) : (
            periods.map((period, index) => (
              <div
                key={`${period.cancelled.event_date}-${period.cancelled.created_at ?? index}`}
                className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm dark:border-white/10"
                data-testid="crm-cancellation-period"
              >
                <p className="font-medium text-slate-800 dark:text-slate-100">
                  Cancelled {formatDate(period.cancelled.event_date)}
                </p>
                <p className="text-slate-500 dark:text-slate-400">
                  {period.returned
                    ? `Returned ${formatDate(period.returned.event_date)}`
                    : 'Open — still cancelled'}
                </p>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

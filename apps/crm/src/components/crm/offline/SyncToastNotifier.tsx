'use client';

/**
 * SyncToastNotifier — mounted once in the CRM shell. Listens for
 * mutation-queue success events and emits a single consolidated
 * "Synced N changes" toast when the queue drains after a reconnect.
 *
 * Rationale: without this, a user who queues 5 edits offline and then
 * regains connectivity would see 5 toasts fire in quick succession as
 * each replay lands. That's noisy and hides the fact that the queue
 * is now empty. We debounce by 1.5s after the last success event and
 * emit one summary toast keyed on the count.
 *
 * This component renders nothing — it's a pure side-effect bridge.
 */

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { CloudOff, CheckCircle2, AlertTriangle } from 'lucide-react';
import { mutationQueue } from '@/lib/offline/mutation-queue';

const DRAIN_DEBOUNCE_MS = 1500;
/**
 * Minimum cadence between success toasts. Without this, a user who
 * burst-edits fifty fields and reconnects gets ten "Synced N changes"
 * toasts stacked in quick succession (each debounce window flushes
 * on its own). The floor keeps the UI calm while still feeling
 * responsive.
 */
const SUCCESS_TOAST_MIN_INTERVAL_MS = 4000;
/**
 * Stable toast ids so sonner replaces in place instead of stacking
 * multiple copies of the same status toast.
 */
const TOAST_IDS = {
  sync: 'crm.sync',
  online: 'crm.connection.online',
  offline: 'crm.connection.offline',
  failure: 'crm.sync.failure',
} as const;

export function SyncToastNotifier() {
  // Counter + timer held in refs so the listener stays stable for the
  // lifetime of the component.
  const countRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastToastAtRef = useRef<number>(0);

  useEffect(() => {
    const flush = () => {
      const count = countRef.current;
      countRef.current = 0;
      timerRef.current = null;
      if (count === 0) return;
      // Respect the minimum-cadence floor. If we're inside the
      // cooldown, reschedule ourselves to run at the next eligible
      // tick — this preserves the count while staying quiet.
      const elapsed = Date.now() - lastToastAtRef.current;
      if (elapsed < SUCCESS_TOAST_MIN_INTERVAL_MS) {
        countRef.current = count;
        timerRef.current = setTimeout(
          flush,
          SUCCESS_TOAST_MIN_INTERVAL_MS - elapsed,
        );
        return;
      }
      lastToastAtRef.current = Date.now();
      toast.success(
        `Synced ${count} change${count === 1 ? '' : 's'}`,
        {
          id: TOAST_IDS.sync,
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
          description: 'Queued edits are now live on the server.',
        },
      );
    };

    const unsubSuccess = mutationQueue.onSuccess(() => {
      countRef.current += 1;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, DRAIN_DEBOUNCE_MS);
    });

    // Online/offline transitions deserve their own breadcrumb.
    // "Back online, syncing N changes..." gives the user immediate
    // feedback before the summary toast lands 1.5s later.
    const onOnline = () => {
      const pending = mutationQueue.snapshot().pending.length;
      if (pending > 0) {
        toast.info(
          `Back online — syncing ${pending} change${pending === 1 ? '' : 's'}`,
          { id: TOAST_IDS.online, duration: 2500 },
        );
      } else {
        // No pending work, just dismiss any lingering offline toast
        // so the UI returns to a clean state the moment connectivity
        // restores.
        toast.dismiss(TOAST_IDS.offline);
      }
    };
    const onOffline = () => {
      toast(
        'You\'re offline',
        {
          id: TOAST_IDS.offline,
          icon: <CloudOff className="w-4 h-4 text-amber-500" />,
          description: 'Changes will be saved locally and synced when you reconnect.',
          duration: 3500,
        },
      );
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Failure summary — when a mutation enters the `failed` list (eg.
    // 409 conflict), surface it as a distinct toast pointing at the
    // inspector. We subscribe to the snapshot and watch for new
    // failure ids rather than adding a dedicated listener to keep the
    // queue API minimal.
    let knownFailedIds = new Set(
      mutationQueue.snapshot().failed.map((m) => m.id),
    );
    const unsubSnapshot = mutationQueue.subscribe((snap) => {
      const current = new Set(snap.failed.map((m) => m.id));
      const newIds: string[] = [];
      current.forEach((id) => {
        if (!knownFailedIds.has(id)) newIds.push(id);
      });
      knownFailedIds = current;
      if (newIds.length === 0) return;
      const first = snap.failed.find((m) => m.id === newIds[0]);
      toast.error(
        newIds.length === 1
          ? `Couldn't sync: ${first?.label ?? 'a change'}`
          : `Couldn't sync ${newIds.length} changes`,
        {
          id: TOAST_IDS.failure,
          icon: <AlertTriangle className="w-4 h-4 text-rose-500" />,
          description: 'Open the pending-changes pill to review.',
          duration: 6000,
        },
      );
    });

    return () => {
      unsubSuccess();
      unsubSnapshot();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return null;
}

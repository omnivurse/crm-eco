'use client';

/**
 * OfflineDebugClient — JSON dump + controls for the client-side
 * offline stack. Used by support + engineering to triage out-of-sync
 * devices without shipping a new build.
 *
 * Surfaces four things:
 *   1. Mutation-queue snapshot (pending + failed entries).
 *   2. Cached JSON GET responses (keys + age).
 *   3. Recently-viewed record index.
 *   4. Aggregate counters (for a quick "is this device healthy?" read).
 *
 * Actions:
 *   - "Refresh" — re-reads all stores.
 *   - "Flush queue" — manually triggers drain (useful when debugging
 *     why a mutation didn't replay).
 *   - "Wipe all offline state" — nukes the queue + response cache +
 *     recent-records index. Destructive, confirm before firing.
 *
 * Note: `/crm/*` is already auth-gated by the parent layout, so this
 * page is only reachable by signed-in CRM users. There is no further
 * authorisation check — any user on the device can inspect *their own*
 * offline state, which is exactly what support needs.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Database,
  RefreshCw,
  Trash2,
  Zap,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  GitCompareArrows,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import { useMutationQueue } from '@/hooks/useMutationQueue';
import { cacheKeys, cacheGet } from '@/lib/offline/response-cache';
import {
  listRecentRecords,
  type RecentRecord,
} from '@/lib/offline/recent-records';
import { clearOfflineState } from '@/lib/offline/reset';
import {
  listReceipts,
  type SyncReceipt,
} from '@/lib/offline/receipt-log';
import {
  subscribeOfflineEventBuffer,
  type RecordedOfflineEvent,
} from '@/lib/offline/instrumentation';
import { useSyncReceiptRealtime } from '@/hooks/useSyncReceiptRealtime';

interface CachedEntryRow {
  key: string;
  storedAt: number;
  ttlMs: number;
  sizeBytes: number;
}

/** A row from the server-side idempotency ledger. Shape matches
 *  `GET /api/crm/debug/idempotency-receipts`. */
interface ServerReceipt {
  id: string;
  key: string;
  method: string;
  path: string;
  status_code: number;
  created_at: string;
  expires_at: string;
  trace_id: string | null;
}

/** One row of the reconciliation table. `status` summarises the
 *  agreement between client and server for a single receipt id. */
type ReconciliationStatus =
  | 'both' /* Client + server both have it. */
  | 'client-only' /* Client logged it, server can't find it (possible loss). */
  | 'server-only'; /* Server has it, client never logged it (orphaned ack). */

interface ReconciliationRow {
  receiptId: string;
  status: ReconciliationStatus;
  clientEntry?: SyncReceipt;
  serverEntry?: ServerReceipt;
}

export interface OfflineDebugClientProps {
  /** Caller's organization id, plumbed from the server component so
   *  the realtime subscription is scoped correctly. */
  organizationId: string | null;
}

export default function OfflineDebugClient({
  organizationId,
}: OfflineDebugClientProps) {
  const router = useRouter();
  const queue = useMutationQueue();
  const [cacheRows, setCacheRows] = useState<CachedEntryRow[]>([]);
  const [recents, setRecents] = useState<RecentRecord[]>([]);
  const [clientReceipts, setClientReceipts] = useState<SyncReceipt[]>([]);
  const [serverReceipts, setServerReceipts] = useState<ServerReceipt[]>([]);
  const [receiptsError, setReceiptsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [wiping, setWiping] = useState(false);
  // "Now" snapshot used to compute ages in the render. Refreshed on
  // every reload so the Refresh button visibly re-times every entry
  // without calling `Date.now()` during render (which would violate
  // the react-hooks/purity rule).
  const [renderedAt, setRenderedAt] = useState<number>(() => Date.now());
  const [eventBuffer, setEventBuffer] = useState<RecordedOfflineEvent[]>([]);

  // Subscribe to the offline-event ring buffer so the timeline
  // updates live while support is watching a device replay its
  // queue. The buffer is populated by `recordOfflineEvent` in every
  // stage of the drain lifecycle.
  useEffect(() => subscribeOfflineEventBuffer(setEventBuffer), []);

  // Count of cross-device receipts observed since mount — useful
  // when support is verifying that the realtime channel is actually
  // wired up end to end.
  const [realtimeReceiptCount, setRealtimeReceiptCount] = useState(0);

  const reload = useCallback(async () => {
    setLoading(true);
    setRenderedAt(Date.now());
    try {
      const [keys, recentList, receiptList] = await Promise.all([
        cacheKeys(),
        listRecentRecords(),
        listReceipts(),
      ]);
      const rows: CachedEntryRow[] = [];
      // Fetching each entry just to read metadata is wasteful at
      // scale, but in practice the cache holds tens of entries, not
      // thousands. Sequential awaits keep the UI responsive.
      for (const key of keys) {
        const entry = await cacheGet(key);
        if (!entry) continue;
        rows.push({
          key,
          storedAt: entry.storedAt,
          ttlMs: entry.ttlMs,
          sizeBytes: JSON.stringify(entry.value).length,
        });
      }
      rows.sort((a, b) => b.storedAt - a.storedAt);
      setCacheRows(rows);
      setRecents(recentList);
      setClientReceipts(receiptList);

      // Server-side receipts are fetched in a separate branch because
      // the endpoint is permission-gated to admin/manager — a plain
      // agent on the device will get 403 and we want to degrade
      // gracefully rather than blow up the whole page.
      try {
        // Narrow to the last 24h (matches the server ledger's TTL) so
        // we never compare against rows that have already been GC'd.
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const res = await fetch(
          `/api/crm/debug/idempotency-receipts?since=${encodeURIComponent(since)}`,
          { credentials: 'same-origin' },
        );
        if (res.ok) {
          const payload = (await res.json()) as { receipts: ServerReceipt[] };
          setServerReceipts(payload.receipts ?? []);
          setReceiptsError(null);
        } else if (res.status === 403) {
          setServerReceipts([]);
          setReceiptsError(
            'Server reconciliation requires admin or manager role.',
          );
        } else {
          setServerReceipts([]);
          setReceiptsError(`Failed to load server receipts (${res.status})`);
        }
      } catch (err) {
        setServerReceipts([]);
        setReceiptsError(
          err instanceof Error ? err.message : 'Network error loading receipts',
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Cross-device realtime: any device in this org landing a mutation
  // streams a new `crm_idempotency_keys` row, which lets us bump the
  // counter and reload the server-side reconciliation view without
  // forcing the operator to click Refresh.
  useSyncReceiptRealtime({
    organizationId,
    onReceipt: () => {
      setRealtimeReceiptCount((c) => c + 1);
      void reload();
    },
  });

  const totalBytes = useMemo(
    () => cacheRows.reduce((acc, r) => acc + r.sizeBytes, 0),
    [cacheRows],
  );

  /**
   * Left-right joined view of client receipts against the server
   * ledger. Rows are keyed by receipt id and tagged `both`,
   * `client-only`, or `server-only` so the UI can render a traffic
   * light at a glance.
   */
  const reconciliation = useMemo<ReconciliationRow[]>(() => {
    const byClient = new Map<string, SyncReceipt>();
    for (const c of clientReceipts) byClient.set(c.receiptId, c);
    const byServer = new Map<string, ServerReceipt>();
    for (const s of serverReceipts) byServer.set(s.id, s);

    const ids = new Set<string>([...byClient.keys(), ...byServer.keys()]);
    const rows: ReconciliationRow[] = [];
    for (const id of ids) {
      const client = byClient.get(id);
      const server = byServer.get(id);
      const status: ReconciliationStatus = client && server
        ? 'both'
        : client
          ? 'client-only'
          : 'server-only';
      rows.push({ receiptId: id, status, clientEntry: client, serverEntry: server });
    }
    // Surface mismatches first so support eyes don't get lost in the
    // matched rows.
    const order: Record<ReconciliationStatus, number> = {
      'client-only': 0,
      'server-only': 1,
      both: 2,
    };
    rows.sort((a, b) => {
      const diff = order[a.status] - order[b.status];
      if (diff !== 0) return diff;
      const tA = a.clientEntry?.recordedAt
        ?? (a.serverEntry ? new Date(a.serverEntry.created_at).getTime() : 0);
      const tB = b.clientEntry?.recordedAt
        ?? (b.serverEntry ? new Date(b.serverEntry.created_at).getTime() : 0);
      return tB - tA;
    });
    return rows;
  }, [clientReceipts, serverReceipts]);

  const mismatchCount = useMemo(
    () => reconciliation.filter((r) => r.status !== 'both').length,
    [reconciliation],
  );

  /** Ring-buffer stats used by the summary grid + timeline. */
  const eventStats = useMemo(() => {
    let drainSuccess = 0;
    let drainReplayed = 0;
    for (const { event } of eventBuffer) {
      if (event.type === 'drain.success') {
        drainSuccess += 1;
        if (event.replayed) drainReplayed += 1;
      }
    }
    return { drainSuccess, drainReplayed };
  }, [eventBuffer]);

  /** Reversed so the newest event sits at the top of the table. */
  const timelineRows = useMemo(
    () => [...eventBuffer].reverse().slice(0, 50),
    [eventBuffer],
  );

  const handleWipe = async () => {
    if (
      !window.confirm(
        'Wipe ALL offline state?\n\nThis removes queued edits, cached reads, and the recent-records index on this device. Use only for support triage.',
      )
    ) {
      return;
    }
    setWiping(true);
    try {
      await clearOfflineState();
      toast.success('Offline state wiped');
      await reload();
    } catch (err) {
      toast.error(
        `Failed to wipe: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    } finally {
      setWiping(false);
    }
  };

  const handleFlush = async () => {
    try {
      await queue.flush();
      toast.success('Flush triggered');
    } catch (err) {
      toast.error(
        `Flush failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <PageHeader
        title="Offline debug"
        description="Inspect and reset the offline mutation queue, response cache, and recent-records index on this device."
        icon={<Database className="w-5 h-5 text-teal-500" />}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="text-slate-600 dark:text-slate-300"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Back
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={reload}
              disabled={loading}
              className="border-slate-200 dark:border-white/10"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleFlush}
              disabled={!queue.isOnline}
              className="border-teal-200 text-teal-700 hover:bg-teal-50 dark:border-teal-500/30 dark:text-teal-300 dark:hover:bg-teal-500/10"
            >
              <Zap className="w-3.5 h-3.5 mr-1.5" />
              Flush queue
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleWipe}
              disabled={wiping}
              className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              {wiping ? 'Wiping…' : 'Wipe all offline state'}
            </Button>
          </div>
        }
      />

      <div className="mb-3 flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
        <span>
          Snapshot taken{' '}
          <span className="text-slate-700 dark:text-slate-200">
            {formatAge(renderedAt - renderedAt) === '<1s'
              ? 'just now'
              : `${formatAge(renderedAt - renderedAt)} ago`}
          </span>
        </span>
        {queue.lastSyncedAt ? (
          <>
            <span>•</span>
            <span>
              Last drain{' '}
              <span className="text-slate-700 dark:text-slate-200">
                {formatAge(renderedAt - queue.lastSyncedAt)} ago
              </span>
            </span>
          </>
        ) : null}
        {organizationId ? (
          <>
            <span>•</span>
            <span>
              Realtime{' '}
              <span
                className={
                  realtimeReceiptCount > 0
                    ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                    : 'text-slate-700 dark:text-slate-200'
                }
              >
                {realtimeReceiptCount} receipt
                {realtimeReceiptCount === 1 ? '' : 's'}
              </span>
            </span>
          </>
        ) : null}
      </div>

      <SummaryGrid
        online={queue.isOnline}
        pending={queue.pending.length}
        failed={queue.failed.length}
        cacheCount={cacheRows.length}
        cacheBytes={totalBytes}
        recentCount={recents.length}
        drainSuccess={eventStats.drainSuccess}
        drainReplayed={eventStats.drainReplayed}
      />

      <Section
        title="Mutation queue"
        count={queue.pending.length + queue.failed.length}
      >
        {queue.pending.length === 0 && queue.failed.length === 0 ? (
          <Empty label="Queue is empty." />
        ) : (
          <pre className="text-xs leading-relaxed overflow-x-auto">
            {JSON.stringify(
              {
                pending: queue.pending,
                failed: queue.failed,
                isOnline: queue.isOnline,
                isSyncing: queue.isSyncing,
                lastSyncedAt: queue.lastSyncedAt,
              },
              null,
              2,
            )}
          </pre>
        )}
      </Section>

      <Section title="Response cache" count={cacheRows.length}>
        {cacheRows.length === 0 ? (
          <Empty label="No cached GET responses." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400">
                  <th className="pb-2 pr-4">Key</th>
                  <th className="pb-2 pr-4">Age</th>
                  <th className="pb-2 pr-4">TTL</th>
                  <th className="pb-2">Size</th>
                </tr>
              </thead>
              <tbody>
                {cacheRows.map((r) => (
                  <tr
                    key={r.key}
                    className="border-t border-slate-100 dark:border-white/5"
                  >
                    <td className="py-1.5 pr-4 font-mono text-slate-900 dark:text-slate-100 break-all">
                      {r.key}
                    </td>
                    <td className="py-1.5 pr-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {formatAge(Date.now() - r.storedAt)}
                    </td>
                    <td className="py-1.5 pr-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {formatAge(r.ttlMs)}
                    </td>
                    <td className="py-1.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {formatBytes(r.sizeBytes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Recent records" count={recents.length}>
        {recents.length === 0 ? (
          <Empty label="No recent records tracked." />
        ) : (
          <pre className="text-xs leading-relaxed overflow-x-auto">
            {JSON.stringify(recents, null, 2)}
          </pre>
        )}
      </Section>

      <Section title="Event timeline" count={timelineRows.length}>
        {timelineRows.length === 0 ? (
          <Empty label="No offline events recorded yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400">
                  <th className="pb-2 pr-4">When</th>
                  <th className="pb-2 pr-4">Event</th>
                  <th className="pb-2 pr-4">Mutation / url</th>
                  <th className="pb-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {timelineRows.map((entry, idx) => (
                  <TimelineRow
                    key={`${entry.recordedAt}-${idx}`}
                    entry={entry}
                    now={renderedAt}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Sync reconciliation" count={reconciliation.length}>
        {receiptsError ? (
          <Empty label={receiptsError} />
        ) : reconciliation.length === 0 ? (
          <Empty label="No receipts recorded yet." />
        ) : (
          <>
            <div className="mb-3 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span>
                Client: <strong>{clientReceipts.length}</strong>
              </span>
              <span>•</span>
              <span>
                Server: <strong>{serverReceipts.length}</strong>
              </span>
              <span>•</span>
              <span
                className={
                  mismatchCount === 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }
              >
                Mismatches: <strong>{mismatchCount}</strong>
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 dark:text-slate-400">
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Receipt</th>
                    <th className="pb-2 pr-4">Method + path</th>
                    <th className="pb-2 pr-4">Client</th>
                    <th className="pb-2 pr-4">Server</th>
                    <th className="pb-2">Trace</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliation.map((row) => (
                    <ReconciliationTableRow
                      key={row.receiptId}
                      row={row}
                      /* Pass a single "now" for every row in this
                       * render pass so `formatAge` stays pure —
                       * required by react-hooks/purity. */
                      now={renderedAt}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Section>
    </div>
  );
}

function ReconciliationTableRow({
  row,
  now,
}: {
  row: ReconciliationRow;
  now: number;
}) {
  const clientTime = row.clientEntry
    ? formatAge(now - row.clientEntry.recordedAt)
    : '—';
  const serverTime = row.serverEntry
    ? formatAge(now - new Date(row.serverEntry.created_at).getTime())
    : '—';
  const method = row.clientEntry?.method ?? row.serverEntry?.method ?? '—';
  const path = row.clientEntry?.url ?? row.serverEntry?.path ?? '—';
  // Prefer the server-side trace because it's the authoritative one
  // (stored in `crm_idempotency_keys.trace_id`). Fall back to what
  // the client logged when the row is client-only.
  const traceId =
    row.serverEntry?.trace_id ?? row.clientEntry?.traceId ?? null;
  return (
    <tr className="border-t border-slate-100 dark:border-white/5 align-top">
      <td className="py-1.5 pr-4">
        <ReconciliationBadge status={row.status} />
      </td>
      <td className="py-1.5 pr-4 font-mono text-slate-900 dark:text-slate-100 break-all">
        {row.receiptId}
        {row.clientEntry?.replayed ? (
          <span className="ml-1 text-[10px] uppercase text-slate-400">
            replay
          </span>
        ) : null}
      </td>
      <td className="py-1.5 pr-4 text-slate-600 dark:text-slate-300 break-all">
        <span className="font-semibold mr-1">{method}</span>
        <span className="font-mono">{path}</span>
      </td>
      <td className="py-1.5 pr-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
        {clientTime}
      </td>
      <td className="py-1.5 pr-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
        {serverTime}
        {row.serverEntry ? (
          <span className="ml-1 text-slate-400">({row.serverEntry.status_code})</span>
        ) : null}
      </td>
      <td className="py-1.5 font-mono text-[10px] text-slate-500 dark:text-slate-400 break-all">
        {traceId ? traceId : '—'}
      </td>
    </tr>
  );
}

function TimelineRow({
  entry,
  now,
}: {
  entry: RecordedOfflineEvent;
  now: number;
}) {
  const { event, recordedAt } = entry;
  const age = formatAge(now - recordedAt);
  const tone =
    event.type === 'drain.failure'
      ? 'text-rose-600 dark:text-rose-400'
      : event.type === 'drain.retry'
        ? 'text-amber-600 dark:text-amber-400'
        : event.type === 'drain.success'
          ? 'text-emerald-600 dark:text-emerald-400'
          : event.type === 'connection'
            ? 'text-sky-600 dark:text-sky-400'
            : 'text-slate-700 dark:text-slate-200';

  // `detail` is a compact right-side summary chosen per event type.
  // Kept as a string so the table stays dense and copy-pasteable.
  let mutationRef = '—';
  let detail = '';
  switch (event.type) {
    case 'enqueue':
      mutationRef = `${event.method} ${event.url}`;
      detail = `queue depth ${event.queueDepth} — ${event.label}`;
      break;
    case 'drain.success':
      mutationRef = event.mutationId;
      detail = `${event.latencyMs}ms · attempt ${event.attempts}${
        event.replayed ? ' · replayed' : ''
      }${event.receiptId ? ` · receipt ${event.receiptId.slice(0, 8)}…` : ''}`;
      break;
    case 'drain.retry':
      mutationRef = event.mutationId;
      detail = `attempt ${event.attempts} — ${event.reason}`;
      break;
    case 'drain.failure':
      mutationRef = event.mutationId;
      detail = `${event.failureKind} after ${event.attempts} · ${event.reason}`;
      break;
    case 'connection':
      mutationRef = event.online ? 'online' : 'offline';
      detail = event.online ? 'network returned' : 'network lost';
      break;
  }

  return (
    <tr className="border-t border-slate-100 dark:border-white/5 align-top">
      <td className="py-1.5 pr-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
        {age}
      </td>
      <td className={`py-1.5 pr-4 font-medium whitespace-nowrap ${tone}`}>
        {event.type}
      </td>
      <td className="py-1.5 pr-4 font-mono text-[10px] text-slate-700 dark:text-slate-200 break-all">
        {mutationRef}
      </td>
      <td className="py-1.5 text-slate-600 dark:text-slate-300 break-all">
        {detail}
      </td>
    </tr>
  );
}

function ReconciliationBadge({ status }: { status: ReconciliationStatus }) {
  if (status === 'both') {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="w-3 h-3" /> synced
      </span>
    );
  }
  if (status === 'client-only') {
    return (
      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
        <GitCompareArrows className="w-3 h-3" /> client only
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400">
      <GitCompareArrows className="w-3 h-3" /> server only
    </span>
  );
}

function SummaryGrid({
  online,
  pending,
  failed,
  cacheCount,
  cacheBytes,
  recentCount,
  drainSuccess,
  drainReplayed,
}: {
  online: boolean;
  pending: number;
  failed: number;
  cacheCount: number;
  cacheBytes: number;
  recentCount: number;
  /** Count of `drain.success` events in the current ring buffer. */
  drainSuccess: number;
  /** Count of those successes that were server-side replays. */
  drainReplayed: number;
}) {
  // Replay-suppression rate: high values mean the idempotency wrapper
  // is actually earning its keep. Low or zero means the client isn't
  // retrying (maybe no network events in the window) or the key
  // stamping is broken — both worth investigating.
  const replayPct = drainSuccess > 0
    ? Math.round((drainReplayed / drainSuccess) * 100)
    : 0;
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
      <Metric
        label="Connection"
        value={online ? 'Online' : 'Offline'}
        tone={online ? 'ok' : 'warn'}
      />
      <Metric label="Pending" value={String(pending)} tone={pending > 0 ? 'warn' : 'neutral'} />
      <Metric label="Failed" value={String(failed)} tone={failed > 0 ? 'bad' : 'neutral'} />
      <Metric label="Cached reads" value={String(cacheCount)} tone="neutral" />
      <Metric label="Cache size" value={formatBytes(cacheBytes)} tone="neutral" />
      <Metric
        label="Replay suppressed"
        value={drainSuccess === 0 ? '—' : `${replayPct}%`}
        tone={replayPct > 0 ? 'ok' : 'neutral'}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'ok' | 'warn' | 'bad' | 'neutral';
}) {
  const toneClass =
    tone === 'ok'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'warn'
      ? 'text-amber-600 dark:text-amber-400'
      : tone === 'bad'
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-slate-900 dark:text-slate-100';
  return (
    <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">
        {label}
      </div>
      <div className={`text-lg font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-900/30 backdrop-blur-sm">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          {title}
        </h2>
        <Badge variant="outline" className="text-xs">
          {count}
        </Badge>
      </header>
      <div className="p-4 text-slate-900 dark:text-slate-100">{children}</div>
    </section>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
      <AlertTriangle className="w-3.5 h-3.5" />
      {label}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatAge(ms: number): string {
  if (ms < 0) return '-';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

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

interface CachedEntryRow {
  key: string;
  storedAt: number;
  ttlMs: number;
  sizeBytes: number;
}

export default function OfflineDebugClient() {
  const router = useRouter();
  const queue = useMutationQueue();
  const [cacheRows, setCacheRows] = useState<CachedEntryRow[]>([]);
  const [recents, setRecents] = useState<RecentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [wiping, setWiping] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [keys, recentList] = await Promise.all([
        cacheKeys(),
        listRecentRecords(),
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const totalBytes = useMemo(
    () => cacheRows.reduce((acc, r) => acc + r.sizeBytes, 0),
    [cacheRows],
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

      <SummaryGrid
        online={queue.isOnline}
        pending={queue.pending.length}
        failed={queue.failed.length}
        cacheCount={cacheRows.length}
        cacheBytes={totalBytes}
        recentCount={recents.length}
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
    </div>
  );
}

function SummaryGrid({
  online,
  pending,
  failed,
  cacheCount,
  cacheBytes,
  recentCount,
}: {
  online: boolean;
  pending: number;
  failed: number;
  cacheCount: number;
  cacheBytes: number;
  recentCount: number;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      <Metric
        label="Connection"
        value={online ? 'Online' : 'Offline'}
        tone={online ? 'ok' : 'warn'}
      />
      <Metric label="Pending" value={String(pending)} tone={pending > 0 ? 'warn' : 'neutral'} />
      <Metric label="Failed" value={String(failed)} tone={failed > 0 ? 'bad' : 'neutral'} />
      <Metric label="Cached reads" value={String(cacheCount)} tone="neutral" />
      <Metric label="Cache size" value={formatBytes(cacheBytes)} tone="neutral" />
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

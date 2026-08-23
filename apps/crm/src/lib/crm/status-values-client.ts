'use client';

/**
 * ONE client-side fetcher for GET /api/crm/records/status-values.
 *
 * The module's distinct raw `status` spellings (with counts and the read-side
 * lane each belongs to) feed three places on a list page — the QuickFilterChips
 * lane counts, the Filters sidebar status picker and the bulk "Change Status"
 * dialog. They all used to fetch the endpoint independently; this module keeps
 * a single 60s promise cache per module (and per narrowing query, see below)
 * so one list page makes one request, and every consumer sees the same values.
 *
 * Truthful counts (LS-5 / D11): the cache is an in-memory promise cache, the
 * endpoint answers `Cache-Control: no-store`, and `invalidateStatusValues`
 * evicts a module (or everything) and bumps a version every mounted
 * `useStatusValues` subscribes to — so after a bulk status change / trash /
 * undo the chips refetch on the next paint instead of showing last minute's
 * numbers. While the refetch is in flight the previous rows stay visible
 * (stale-while-revalidate), so the chips never flash back to "loading".
 *
 * `narrowing` (optional) is the list's row-set query string (search / scope /
 * territory / filters, see lib/crm/list-query-resolve) — forwarded to the
 * endpoint and part of the cache key so filter-aware lane counts (option B)
 * can plug in without another cache.
 *
 * Read-only: nothing here rewrites the client's free-text statuses.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { StatusLane, StatusValueCount } from '@/lib/crm/status-lanes';

/** One row from the endpoint (`{ values: [{ value, count, lane }] }`). */
export interface StatusValueRow extends StatusValueCount {
  lane?: StatusLane;
}

interface StatusValuesResponse {
  values?: Array<{ value?: unknown; count?: unknown; lane?: unknown }>;
}

export interface FetchStatusValuesOptions {
  /**
   * Row-set query string of the list (e.g. `search=wen&scope=mine`). Part of
   * the cache key and forwarded to the endpoint. Empty / undefined = the whole
   * module (the default every consumer uses today).
   */
  narrowing?: string;
}

const STATUS_VALUES_TTL_MS = 60_000;
const statusValuesCache = new Map<string, { at: number; promise: Promise<StatusValueRow[]> }>();

/** Cache key separator — a character no module key contains. */
const KEY_SEP = '|';

function cacheKey(moduleKey: string, narrowing: string | undefined): string {
  return `${moduleKey}${KEY_SEP}${narrowing ?? ''}`;
}

function endpointUrl(moduleKey: string, narrowing: string | undefined): string {
  const params = new URLSearchParams(narrowing ?? '');
  params.set('module_key', moduleKey);
  return `/api/crm/records/status-values?${params.toString()}`;
}

// ── Invalidation store (version + listeners) ────────────────────────────────
let statusValuesVersion = 0;
const listeners = new Set<() => void>();

function subscribeStatusValues(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getStatusValuesVersion(): number {
  return statusValuesVersion;
}

/**
 * Drop the cached status values for one module (every narrowing) — or for
 * every module when `moduleKey` is omitted — and tell every mounted
 * `useStatusValues` to refetch. Call after anything that changes how many
 * records carry each status: bulk status change, move to Trash, undo/restore.
 */
export function invalidateStatusValues(moduleKey?: string): void {
  if (moduleKey === undefined) {
    statusValuesCache.clear();
  } else {
    const prefix = `${moduleKey}${KEY_SEP}`;
    for (const key of Array.from(statusValuesCache.keys())) {
      if (key.startsWith(prefix)) statusValuesCache.delete(key);
    }
  }
  statusValuesVersion += 1;
  for (const listener of Array.from(listeners)) listener();
}

/**
 * Fetch (or reuse the in-flight / recent) status values for a module.
 *
 * The promise is shared between mounts, so no AbortSignal is threaded through
 * (an unmounting first caller must not reject the promise for the others);
 * hooks ignore results after their own cleanup instead. A failed fetch is
 * evicted from the cache so the next call (retry) hits the network again.
 */
export function fetchStatusValues(
  moduleKey: string,
  options?: FetchStatusValuesOptions,
): Promise<StatusValueRow[]> {
  const narrowing = options?.narrowing || undefined;
  const key = cacheKey(moduleKey, narrowing);
  const cached = statusValuesCache.get(key);
  if (cached && Date.now() - cached.at < STATUS_VALUES_TTL_MS) return cached.promise;
  const promise = fetch(endpointUrl(moduleKey, narrowing), {
    credentials: 'same-origin',
    cache: 'no-store',
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`status-values ${res.status}`);
      const json = (await res.json()) as StatusValuesResponse;
      const rows: StatusValueRow[] = [];
      for (const v of json.values ?? []) {
        // Blank spellings cannot be filtered on with `in`; the API already
        // drops them, this is belt-and-braces.
        if (!v || typeof v.value !== 'string' || v.value === '') continue;
        const row: StatusValueRow = { value: v.value, count: Number(v.count) || 0 };
        if (typeof v.lane === 'string') row.lane = v.lane as StatusLane;
        rows.push(row);
      }
      return rows;
    })
    .catch((err) => {
      // Only evict our own entry (an invalidate may have replaced it meanwhile).
      if (statusValuesCache.get(key)?.promise === promise) statusValuesCache.delete(key);
      throw err;
    });
  statusValuesCache.set(key, { at: Date.now(), promise });
  return promise;
}

/** Test hook — clears the module-level cache (listeners / version untouched). */
export function __resetStatusValuesCache(): void {
  statusValuesCache.clear();
}

/** Test hook — how many entries the cache currently holds. */
export function __statusValuesCacheSize(): number {
  return statusValuesCache.size;
}

export type StatusValuesStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Stable empty rows (so `values` keeps its identity while idle / loading / error). */
const NO_ROWS: StatusValueRow[] = [];

export interface StatusValuesState {
  status: StatusValuesStatus;
  /** Empty unless `status === 'ready'`. */
  values: StatusValueRow[];
  /** Re-fetch after an error (no-op while idle / loading / ready). */
  retry: () => void;
}

/**
 * React hook over {@link fetchStatusValues}.
 *
 * `idle` when there is no module key or the caller opted out (`enabled` =
 * false); `loading` until the shared promise settles; then `ready` (with the
 * rows) or `error`. The result is tagged with the module + attempt it belongs
 * to and "loading" is DERIVED (no synchronous setState in the effect) — a stale
 * result for a previous module simply does not match and reads as loading.
 *
 * After `invalidateStatusValues` the hook refetches; a previous `ready` result
 * for the same module stays on screen until the new rows arrive.
 */
export function useStatusValues(
  moduleKey: string | undefined,
  enabled = true,
  narrowing?: string,
): StatusValuesState {
  const version = useSyncExternalStore(
    subscribeStatusValues,
    getStatusValuesVersion,
    getStatusValuesVersion,
  );
  const [result, setResult] = useState<
    {
      key: string;
      narrowing: string | undefined;
      attempt: number;
      version: number;
      status: 'ready' | 'error';
      values: StatusValueRow[];
    } | null
  >(null);
  const [attempt, setAttempt] = useState(0);
  const narrowingKey = narrowing || undefined;

  useEffect(() => {
    if (!moduleKey || !enabled) return;
    let cancelled = false;
    fetchStatusValues(moduleKey, { narrowing: narrowingKey })
      .then((values) => {
        if (!cancelled) {
          setResult({ key: moduleKey, narrowing: narrowingKey, attempt, version, status: 'ready', values });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResult({ key: moduleKey, narrowing: narrowingKey, attempt, version, status: 'error', values: NO_ROWS });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [moduleKey, enabled, attempt, version, narrowingKey]);

  let status: StatusValuesStatus;
  let values: StatusValueRow[] = NO_ROWS;
  if (!moduleKey || !enabled) {
    status = 'idle';
  } else if (result && result.key === moduleKey && result.narrowing === narrowingKey) {
    const current = result.attempt === attempt && result.version === version;
    if (result.status === 'ready' || current) {
      // A ready result for this module survives an invalidate until the
      // refetch lands (stale-while-revalidate); an error is only shown for
      // the attempt/version it belongs to.
      status = result.status;
      values = result.values;
    } else {
      status = 'loading';
    }
  } else {
    status = 'loading';
  }

  return {
    status,
    values,
    retry: () => {
      if (status === 'error') setAttempt((n) => n + 1);
    },
  };
}

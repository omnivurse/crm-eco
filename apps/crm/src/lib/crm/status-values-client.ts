'use client';

/**
 * ONE client-side fetcher for GET /api/crm/records/status-values.
 *
 * The module's distinct raw `status` spellings (with counts and the read-side
 * lane each belongs to) feed three places on a list page — the QuickFilterChips
 * lane counts, the Filters sidebar status picker and the bulk "Change Status"
 * dialog. They all used to fetch the endpoint independently; this module keeps
 * a single 60s promise cache per module so one list page makes one request,
 * and every consumer sees the same values.
 *
 * Read-only: nothing here rewrites the client's free-text statuses.
 */

import { useEffect, useState } from 'react';
import type { StatusLane, StatusValueCount } from '@/lib/crm/status-lanes';

/** One row from the endpoint (`{ values: [{ value, count, lane }] }`). */
export interface StatusValueRow extends StatusValueCount {
  lane?: StatusLane;
}

interface StatusValuesResponse {
  values?: Array<{ value?: unknown; count?: unknown; lane?: unknown }>;
}

const STATUS_VALUES_TTL_MS = 60_000;
const statusValuesCache = new Map<string, { at: number; promise: Promise<StatusValueRow[]> }>();

/**
 * Fetch (or reuse the in-flight / recent) status values for a module.
 *
 * The promise is shared between mounts, so no AbortSignal is threaded through
 * (an unmounting first caller must not reject the promise for the others);
 * hooks ignore results after their own cleanup instead. A failed fetch is
 * evicted from the cache so the next call (retry) hits the network again.
 */
export function fetchStatusValues(moduleKey: string): Promise<StatusValueRow[]> {
  const cached = statusValuesCache.get(moduleKey);
  if (cached && Date.now() - cached.at < STATUS_VALUES_TTL_MS) return cached.promise;
  const promise = fetch(
    `/api/crm/records/status-values?module_key=${encodeURIComponent(moduleKey)}`,
    { credentials: 'same-origin' },
  )
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
      statusValuesCache.delete(moduleKey);
      throw err;
    });
  statusValuesCache.set(moduleKey, { at: Date.now(), promise });
  return promise;
}

/** Test hook — clears the module-level cache. */
export function __resetStatusValuesCache(): void {
  statusValuesCache.clear();
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
 */
export function useStatusValues(moduleKey: string | undefined, enabled = true): StatusValuesState {
  const [result, setResult] = useState<
    { key: string; attempt: number; status: 'ready' | 'error'; values: StatusValueRow[] } | null
  >(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!moduleKey || !enabled) return;
    let cancelled = false;
    fetchStatusValues(moduleKey)
      .then((values) => {
        if (!cancelled) setResult({ key: moduleKey, attempt, status: 'ready', values });
      })
      .catch(() => {
        if (!cancelled) setResult({ key: moduleKey, attempt, status: 'error', values: NO_ROWS });
      });
    return () => {
      cancelled = true;
    };
  }, [moduleKey, enabled, attempt]);

  let status: StatusValuesStatus;
  let values: StatusValueRow[] = NO_ROWS;
  if (!moduleKey || !enabled) {
    status = 'idle';
  } else if (result && result.key === moduleKey && result.attempt === attempt) {
    status = result.status;
    values = result.values;
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

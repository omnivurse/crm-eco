'use client';

/**
 * response-cache — a minimal IndexedDB-backed JSON response cache.
 *
 * Purpose: let the UI serve stale reads (record insights, calendar
 * tasks, related lists, etc.) while the network is down OR while the
 * fresh request is in flight. Pairs with `cachedFetch` to implement
 * stale-while-revalidate.
 *
 * Why IDB (not localStorage):
 *   - JSON response bodies can grow to 100+ KB for a record with a
 *     long activity feed. localStorage's 5 MB shared budget is tight
 *     and synchronous — IDB gives us ~50% of disk on most browsers
 *     and is async so large payloads don't block the main thread.
 *   - We only store JSON, so a single object store with `{ key,
 *     value, storedAt, ttlMs }` rows is plenty — no schema upgrades.
 *
 * The module is a ~150-line singleton: open the DB once, expose
 * `get` / `put` / `remove` / `keys`. Callers that want SWR semantics
 * layer them on top via `cached-fetch`.
 */

import { runTx, RESPONSE_STORE } from './idb';

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24; // 24h

export interface CachedEntry<T = unknown> {
  key: string;
  value: T;
  storedAt: number;
  /** Soft TTL — data older than this is considered `stale` but still
   *  served while offline. Caller decides whether to revalidate. */
  ttlMs: number;
}

function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return runTx(RESPONSE_STORE, mode, fn);
}

export async function cacheGet<T = unknown>(
  key: string,
): Promise<CachedEntry<T> | null> {
  try {
    const entry = (await tx<CachedEntry<T> | undefined>('readonly', (s) =>
      s.get(key) as IDBRequest<CachedEntry<T> | undefined>,
    )) as CachedEntry<T> | undefined;
    return entry ?? null;
  } catch {
    // IDB can fail in private-browsing mode, Safari quotas, etc. Treat
    // a failure as a cache miss — the UI falls back to a live fetch.
    return null;
  }
}

export async function cachePut<T = unknown>(
  key: string,
  value: T,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<void> {
  const entry: CachedEntry<T> = {
    key,
    value,
    storedAt: Date.now(),
    ttlMs,
  };
  try {
    await tx('readwrite', (s) => s.put(entry));
  } catch {
    /* swallow — we never want a cache write to break the UX */
  }
}

export async function cacheRemove(key: string): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete(key));
  } catch {
    /* noop */
  }
}

export async function cacheKeys(prefix?: string): Promise<string[]> {
  try {
    const all = (await tx<IDBValidKey[]>('readonly', (s) =>
      s.getAllKeys(),
    )) as IDBValidKey[];
    const keys = all.map((k) => String(k));
    return prefix ? keys.filter((k) => k.startsWith(prefix)) : keys;
  } catch {
    return [];
  }
}

/** Check whether an entry is older than its TTL. */
export function isStale(entry: CachedEntry<unknown>): boolean {
  return Date.now() - entry.storedAt > entry.ttlMs;
}

/** Clear cached entries whose keys match the predicate. Primarily for
 *  test harnesses and the future "sign out" flow. */
export async function cacheClear(
  predicate?: (key: string) => boolean,
): Promise<void> {
  try {
    if (!predicate) {
      await tx('readwrite', (s) => s.clear());
      return;
    }
    const keys = await cacheKeys();
    await Promise.all(
      keys.filter(predicate).map((k) => cacheRemove(k)),
    );
  } catch {
    /* noop */
  }
}

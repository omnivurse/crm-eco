'use client';

/**
 * cachedFetch — stale-while-revalidate wrapper around `fetch` for
 * idempotent JSON GETs (e.g. record insights, calendar tasks, related
 * lists). Pairs with the mutation queue: writes go through
 * `queuedSend`, reads go through `cachedFetch`, and the two layers
 * together give us a usable offline round-trip.
 *
 * Semantics:
 *   - When online: fire the network request and the cache read in
 *     parallel. Resolve with the cached value immediately (if any and
 *     fresh), then revalidate in the background and emit a second
 *     "fresh" result to the caller's `onFresh` callback. On live
 *     success, write the new body into IDB.
 *   - When offline: resolve with cached data (fresh or stale) without
 *     making the network call. Surface `{ fromCache: true, isStale }`
 *     so the caller can show a "showing cached data" pill.
 *   - On 4xx/5xx: pass through as a normal error; do NOT poison the
 *     cache with error bodies.
 *
 * This intentionally does NOT cover POST/PATCH/DELETE (that's what
 * `queuedSend` is for) and doesn't attempt to generate ETag / 304
 * round-trips — those require server cooperation and the servers
 * here don't set `Last-Modified` consistently yet.
 */

import { cacheGet, cachePut, isStale as idbIsStale } from './response-cache';
import { isEffectiveOnline } from './force-offline';

export interface CachedFetchOptions<T> {
  /** Unique cache key for this request. Callers usually pass the URL
   *  plus any relevant query params already serialised. */
  key: string;
  url: string;
  /** Soft TTL; data older than this is `isStale` but still served. */
  ttlMs?: number;
  /** Validate / parse the response body. Must throw on shape errors
   *  so we don't cache garbage. */
  parse?: (raw: unknown) => T;
  /**
   * Called with a fresh result after a successful background
   * revalidation. Only fires when the new body is *different* from
   * what we already resolved with (shallow JSON equality).
   */
  onFresh?: (value: T) => void;
  /** Forward any additional fetch init (headers, signal…). */
  init?: RequestInit;
}

export interface CachedFetchResult<T> {
  value: T;
  fromCache: boolean;
  isStale: boolean;
  /** When the cached copy was stored. Null on a live fetch. */
  cachedAt: number | null;
}

function isOnline(): boolean {
  return isEffectiveOnline();
}

/** Shallow-ish equality that's good enough for "did the server
 *  return new JSON?" without pulling in a deep-equal dependency. */
function sameJson(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Event bus for UI components that want to know when any read served
 * from cache — powers the "viewing cached data" pill in the offline
 * banner without requiring every caller to wire up its own state.
 */
type CacheEventListener = (detail: {
  key: string;
  fromCache: boolean;
}) => void;
const listeners = new Set<CacheEventListener>();
let cacheServedCount = 0;

export function subscribeCacheServed(fn: CacheEventListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getCacheServedCount(): number {
  return cacheServedCount;
}

function emit(key: string, fromCache: boolean) {
  if (fromCache) cacheServedCount += 1;
  for (const fn of listeners) fn({ key, fromCache });
}

export async function cachedFetch<T = unknown>(
  options: CachedFetchOptions<T>,
): Promise<CachedFetchResult<T>> {
  const { key, url, ttlMs, parse, onFresh, init } = options;

  const cached = await cacheGet<T>(key);
  const cachedValue = cached?.value ?? null;
  const cachedAt = cached?.storedAt ?? null;
  const stale = cached ? idbIsStale(cached) : false;

  // Offline path — serve what we have, don't hit the network.
  if (!isOnline()) {
    if (cached) {
      emit(key, true);
      return {
        value: cached.value,
        fromCache: true,
        isStale: stale,
        cachedAt,
      };
    }
    throw new Error('Offline and no cached data available');
  }

  // Online path with cached data: resolve optimistically and
  // revalidate in the background.
  if (cached && !stale) {
    emit(key, true);
    // Fire-and-forget revalidation so subsequent navigations see
    // fresh data. We don't await it.
    void revalidate(key, url, ttlMs, parse, onFresh, cachedValue, init);
    return {
      value: cached.value,
      fromCache: true,
      isStale: false,
      cachedAt,
    };
  }

  // Either no cache or cache is stale — fetch live. If the fetch
  // fails and we *do* have stale cache, serve it with the stale flag
  // so the user sees something rather than nothing.
  try {
    const fresh = await fetchAndCache(key, url, ttlMs, parse, init);
    emit(key, false);
    return { value: fresh, fromCache: false, isStale: false, cachedAt: null };
  } catch (err) {
    if (cached) {
      emit(key, true);
      return {
        value: cached.value,
        fromCache: true,
        isStale: true,
        cachedAt,
      };
    }
    throw err;
  }
}

async function fetchAndCache<T>(
  key: string,
  url: string,
  ttlMs: number | undefined,
  parse: ((raw: unknown) => T) | undefined,
  init: RequestInit | undefined,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: init?.credentials ?? 'same-origin',
  });
  if (!res.ok) {
    throw new Error(`Cached GET failed (${res.status})`);
  }
  const raw = await res.json();
  const value = (parse ? parse(raw) : raw) as T;
  await cachePut(key, value, ttlMs);
  return value;
}

async function revalidate<T>(
  key: string,
  url: string,
  ttlMs: number | undefined,
  parse: ((raw: unknown) => T) | undefined,
  onFresh: ((value: T) => void) | undefined,
  previousValue: T | null,
  init: RequestInit | undefined,
): Promise<void> {
  try {
    const value = await fetchAndCache<T>(key, url, ttlMs, parse, init);
    if (onFresh && !sameJson(previousValue, value)) onFresh(value);
  } catch {
    /* revalidation failures are non-fatal — cache stays as-is */
  }
}

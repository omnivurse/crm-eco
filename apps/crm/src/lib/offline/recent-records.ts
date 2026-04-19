'use client';

/**
 * recent-records — small IDB-backed index of records the user has
 * opened recently. Drives the "Available offline" list on `/offline.html`
 * and gives the service-worker shell something actionable to display
 * when the network is unreachable.
 *
 * Design notes:
 *   - Stored in the same IDB database as the response cache so we only
 *     open one DB handle. Different object store keeps concerns cleanly
 *     split and lets us evict independently.
 *   - Capped at `MAX_ENTRIES` so we never balloon IndexedDB. Eviction
 *     is LRU on `viewedAt`.
 *   - The offline page reads this store raw via vanilla JS (no bundle
 *     dependency), so the shape here is also the public contract.
 *     KEEP fields primitive — no Date, no Map, no class instances.
 */

import { openOfflineDb, RECENT_STORE } from './idb';

const MAX_ENTRIES = 20;

export interface RecentRecord {
  id: string;
  moduleKey: string;
  title: string;
  subtitle?: string;
  /** Last viewed timestamp (ms). */
  viewedAt: number;
}

/** Upsert a recent-record entry. Called from RecordDetailShellV2 on
 *  mount so every visit keeps the index fresh. */
export async function trackRecentRecord(
  input: Omit<RecentRecord, 'viewedAt'>,
): Promise<void> {
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(RECENT_STORE, 'readwrite');
      const store = tx.objectStore(RECENT_STORE);
      const put = store.put({ ...input, viewedAt: Date.now() });
      put.onsuccess = () => resolve();
      put.onerror = () => reject(put.error);
    });
    await enforceCap();
  } catch {
    /* never block the UI on IDB — the index is best-effort */
  }
}

async function enforceCap(): Promise<void> {
  try {
    const db = await openOfflineDb();
    const all = await new Promise<RecentRecord[]>((resolve, reject) => {
      const tx = db.transaction(RECENT_STORE, 'readonly');
      const req = tx
        .objectStore(RECENT_STORE)
        .getAll() as IDBRequest<RecentRecord[]>;
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => reject(req.error);
    });
    if (all.length <= MAX_ENTRIES) return;

    const sorted = [...all].sort((a, b) => b.viewedAt - a.viewedAt);
    const toEvict = sorted.slice(MAX_ENTRIES);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(RECENT_STORE, 'readwrite');
      const store = tx.objectStore(RECENT_STORE);
      for (const r of toEvict) store.delete(r.id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* noop */
  }
}

export async function listRecentRecords(): Promise<RecentRecord[]> {
  try {
    const db = await openOfflineDb();
    const all = await new Promise<RecentRecord[]>((resolve, reject) => {
      const tx = db.transaction(RECENT_STORE, 'readonly');
      const req = tx
        .objectStore(RECENT_STORE)
        .getAll() as IDBRequest<RecentRecord[]>;
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => reject(req.error);
    });
    return [...all].sort((a, b) => b.viewedAt - a.viewedAt);
  } catch {
    return [];
  }
}

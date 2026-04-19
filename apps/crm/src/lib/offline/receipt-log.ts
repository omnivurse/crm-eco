'use client';

/**
 * receipt-log — append-only client-side log of server-issued sync
 * receipts (`x-sync-receipt` header values) observed after each
 * successful mutation drain.
 *
 * Paired with the server route `/api/crm/debug/idempotency-receipts`,
 * this lets the offline debug page reconcile:
 *   - Receipts the client logged BUT the server can no longer find
 *     → indicates a write the server GC'd or never persisted.
 *   - Receipts the server has BUT the client never logged
 *     → indicates a write we never got the ack for; probably fine
 *       (the user's mutation was re-enqueued by a different path).
 *
 * Storage is capped at `MAX_ENTRIES` (LRU-evicted by `recordedAt`) and
 * each row also has a 72h TTL so the log stays small even for busy
 * users. 72h > the server's 24h TTL so the reconciliation view always
 * has at least one full ledger lifetime of client history to compare.
 */

import { openOfflineDb, RECEIPT_STORE } from './idb';

const MAX_ENTRIES = 500;
const MAX_AGE_MS = 1000 * 60 * 60 * 72; // 72h

export interface SyncReceipt {
  /** Server-issued receipt id from the `x-sync-receipt` header. */
  receiptId: string;
  /** Client-local timestamp (ms) when the successful drain happened. */
  recordedAt: number;
  /** Queue id the receipt belonged to — useful for cross-referencing
   *  with the mutation-queue inspector when diagnosing a support
   *  ticket. */
  mutationId: string;
  /** Short human label copied from the queued mutation. */
  label: string;
  method: string;
  url: string;
  /** True when the server indicated the response was replayed from a
   *  prior request (same idempotency key). */
  replayed: boolean;
  /** Trace id echoed back from the server (`x-trace-id`). Logged so
   *  support can jump straight from a user's device to the matching
   *  platform trace without re-deriving the id. */
  traceId?: string;
}

export async function logReceipt(entry: SyncReceipt): Promise<void> {
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(RECEIPT_STORE, 'readwrite');
      tx.objectStore(RECEIPT_STORE).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    // Evict asynchronously — never block the hot path behind the cap
    // enforcement. A full log just means the next log call does a
    // little more work.
    void enforceCap();
  } catch {
    /* never fail the drain because of a log write */
  }
}

export async function listReceipts(): Promise<SyncReceipt[]> {
  try {
    const db = await openOfflineDb();
    const all = await new Promise<SyncReceipt[]>((resolve, reject) => {
      const tx = db.transaction(RECEIPT_STORE, 'readonly');
      const req = tx
        .objectStore(RECEIPT_STORE)
        .getAll() as IDBRequest<SyncReceipt[]>;
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => reject(req.error);
    });
    const now = Date.now();
    return [...all]
      .filter((r) => now - r.recordedAt <= MAX_AGE_MS)
      .sort((a, b) => b.recordedAt - a.recordedAt);
  } catch {
    return [];
  }
}

async function enforceCap(): Promise<void> {
  try {
    const db = await openOfflineDb();
    const all = await new Promise<SyncReceipt[]>((resolve, reject) => {
      const tx = db.transaction(RECEIPT_STORE, 'readonly');
      const req = tx
        .objectStore(RECEIPT_STORE)
        .getAll() as IDBRequest<SyncReceipt[]>;
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => reject(req.error);
    });
    const now = Date.now();
    const fresh = all.filter((r) => now - r.recordedAt <= MAX_AGE_MS);
    const expired = all.filter((r) => now - r.recordedAt > MAX_AGE_MS);

    const sorted = [...fresh].sort((a, b) => b.recordedAt - a.recordedAt);
    const overflow = sorted.slice(MAX_ENTRIES);
    const toEvict = [...expired, ...overflow];
    if (toEvict.length === 0) return;

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(RECEIPT_STORE, 'readwrite');
      const store = tx.objectStore(RECEIPT_STORE);
      for (const r of toEvict) store.delete(r.receiptId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* noop */
  }
}

export async function clearReceipts(): Promise<void> {
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(RECEIPT_STORE, 'readwrite');
      tx.objectStore(RECEIPT_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* noop */
  }
}

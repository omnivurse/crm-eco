'use client';

/**
 * Shared IndexedDB opener for all offline stores.
 *
 * Both `response-cache` (HTTP JSON cache) and `recent-records` (index
 * of recently-viewed records for the offline shell) live inside the
 * same database so we only hold one handle + one lock. Split into
 * object stores so eviction / schema concerns stay independent.
 *
 * Version upgrades MUST be additive — the `/offline.html` shell opens
 * this same DB from a non-bundled script and can lag behind the
 * production app. Never rename or drop an existing store.
 */

export const DB_NAME = 'crm.responseCache';
export const DB_VERSION = 3;
export const RESPONSE_STORE = 'responses';
export const RECENT_STORE = 'recentRecords';
/** Append-only log of server-issued `x-sync-receipt` ids seen by the
 *  client after a successful drain. Used by the reconciliation view to
 *  flag mutations we thought were synced but the server can no longer
 *  find, and vice versa. */
export const RECEIPT_STORE = 'syncReceipts';

let dbPromise: Promise<IDBDatabase> | null = null;

export function openOfflineDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('indexedDB is not available'));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      const oldVersion = (ev as IDBVersionChangeEvent).oldVersion;

      if (oldVersion < 1 || !db.objectStoreNames.contains(RESPONSE_STORE)) {
        db.createObjectStore(RESPONSE_STORE, { keyPath: 'key' });
      }
      if (oldVersion < 2 || !db.objectStoreNames.contains(RECENT_STORE)) {
        const store = db.createObjectStore(RECENT_STORE, { keyPath: 'id' });
        store.createIndex('viewedAt', 'viewedAt');
      }
      if (oldVersion < 3 || !db.objectStoreNames.contains(RECEIPT_STORE)) {
        const store = db.createObjectStore(RECEIPT_STORE, {
          keyPath: 'receiptId',
        });
        store.createIndex('recordedAt', 'recordedAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () =>
      reject(new Error('IndexedDB open blocked — close other tabs'));
  });
  return dbPromise;
}

export function runTx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openOfflineDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

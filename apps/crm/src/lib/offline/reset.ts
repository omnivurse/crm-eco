'use client';

/**
 * reset — single entry point for wiping all offline state.
 *
 * Covers:
 *   - The persisted mutation queue (localStorage)
 *   - The stale-while-revalidate JSON response cache (IndexedDB)
 *   - The recent-records index (IndexedDB)
 *
 * Two primary callers:
 *   1. `SignOutBridge` — runs before Supabase sign-out so the next
 *      user on the device never inherits PII from the previous user.
 *   2. The `/crm/debug/offline` inspector's "Wipe offline state"
 *      button, for support triage.
 */

import { mutationQueue } from './mutation-queue';
import { cacheClear } from './response-cache';
import { clearRecentRecords } from './recent-records';

export async function clearOfflineState(): Promise<void> {
  // Synchronous pieces first so the UI immediately collapses the
  // pending-changes pill even if IDB is slow to respond.
  try {
    mutationQueue.clearAll();
  } catch {
    /* noop */
  }

  // IDB pieces happen in parallel — neither depends on the other.
  await Promise.allSettled([cacheClear(), clearRecentRecords()]);
}

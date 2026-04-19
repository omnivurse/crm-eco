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
import { clearReceipts } from './receipt-log';
import { clearOfflineEventBuffer } from './instrumentation';

export async function clearOfflineState(): Promise<void> {
  try {
    mutationQueue.clearAll();
  } catch {
    /* noop */
  }
  try {
    clearOfflineEventBuffer();
  } catch {
    /* noop */
  }

  // IDB pieces happen in parallel — none depends on the others.
  await Promise.allSettled([
    cacheClear(),
    clearRecentRecords(),
    clearReceipts(),
  ]);
}

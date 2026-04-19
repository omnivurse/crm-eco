'use client';

/**
 * sync-broadcast — cross-tab fan-out for mutation-queue drains.
 *
 * When a mutation drains successfully in one tab we want sibling
 * tabs on the same device to:
 *   1. Invalidate their local SWR cache for the affected record.
 *   2. Refresh anything on the page they happen to be viewing.
 *
 * We use `BroadcastChannel` because it's built into the browser, has
 * zero setup cost, and is perfectly scoped to "same origin + same
 * device" — no Supabase round-trip required. Cross-device fan-out is
 * handled separately by the Supabase Realtime subscription on
 * `crm_idempotency_keys` (see `useSyncReceiptRealtime`).
 *
 * This module is side-effect free on import: nothing gets posted
 * until a caller explicitly invokes `emitSyncReceipt`, and nothing
 * gets received until a consumer calls `subscribeSyncReceipts`.
 */

export interface SyncReceiptBroadcast {
  receiptId: string;
  recordId?: string;
  moduleKey?: string;
  method: string;
  url: string;
  replayed: boolean;
  traceId?: string;
  emittedAt: number;
}

const CHANNEL_NAME = 'crm.sync.receipts';

let sharedChannel: BroadcastChannel | null = null;
let subscriberCount = 0;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!sharedChannel) {
    sharedChannel = new BroadcastChannel(CHANNEL_NAME);
  }
  return sharedChannel;
}

/**
 * Broadcast a sync-receipt event to sibling tabs. Called from the
 * mutation queue immediately after it logs the receipt locally.
 * Silently no-ops in environments without `BroadcastChannel` (older
 * browsers, or SSR).
 */
export function emitSyncReceipt(event: SyncReceiptBroadcast): void {
  try {
    const ch = getChannel();
    ch?.postMessage(event);
  } catch {
    /* never surface a fan-out failure to the caller */
  }
}

export type SyncReceiptListener = (event: SyncReceiptBroadcast) => void;

/**
 * Subscribe to inbound sync-receipt broadcasts. Returns an
 * unsubscribe handle. The shared channel stays open as long as at
 * least one subscriber is active — it's closed on the last
 * unsubscribe so the tab can be fully GC'd when no consumers care.
 */
export function subscribeSyncReceipts(
  listener: SyncReceiptListener,
): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  const handler = (ev: MessageEvent) => {
    const data = ev.data as SyncReceiptBroadcast | null;
    if (!data || typeof data.receiptId !== 'string') return;
    try {
      listener(data);
    } catch {
      /* never let a listener fault the channel */
    }
  };
  ch.addEventListener('message', handler);
  subscriberCount += 1;
  return () => {
    ch.removeEventListener('message', handler);
    subscriberCount = Math.max(0, subscriberCount - 1);
    if (subscriberCount === 0 && sharedChannel) {
      try {
        sharedChannel.close();
      } catch {
        /* noop */
      }
      sharedChannel = null;
    }
  };
}

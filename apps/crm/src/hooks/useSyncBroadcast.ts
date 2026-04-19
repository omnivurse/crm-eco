'use client';

/**
 * useSyncBroadcast — React-friendly wrapper around the
 * `sync-broadcast` channel.
 *
 * Two usage modes:
 *
 *   1. As a plain listener:
 *      ```ts
 *      useSyncBroadcast((event) => { router.refresh(); });
 *      ```
 *   2. Scoped to a single record — only fires when a sibling tab
 *      broadcasts a receipt tied to the same recordId. Perfect for
 *      record-detail pages that want to auto-refresh when a
 *      teammate's draining tab lands a change:
 *      ```ts
 *      useSyncBroadcast((event) => refresh(event), { recordId });
 *      ```
 */

import { useEffect, useRef } from 'react';
import {
  subscribeSyncReceipts,
  type SyncReceiptBroadcast,
} from '@/lib/offline/sync-broadcast';

export interface UseSyncBroadcastOptions {
  /** Only invoke the listener for receipts tagged to this record. */
  recordId?: string;
  /** Only invoke the listener for receipts on this module. */
  moduleKey?: string;
  /** Invoke the listener even for replayed receipts. Defaults to
   *  `false` because replays usually mean "we already know about
   *  this" — the remote side already accepted the original write. */
  includeReplays?: boolean;
}

export function useSyncBroadcast(
  listener: (event: SyncReceiptBroadcast) => void,
  options: UseSyncBroadcastOptions = {},
): void {
  // Ref-latest pattern so callers don't need to memoise the listener
  // to avoid re-subscribing on every render. Populated via effect so
  // we don't violate the react-hooks/refs rule.
  const listenerRef = useRef(listener);
  useEffect(() => {
    listenerRef.current = listener;
  }, [listener]);

  const { recordId, moduleKey, includeReplays = false } = options;

  useEffect(() => {
    return subscribeSyncReceipts((event) => {
      if (recordId && event.recordId !== recordId) return;
      if (moduleKey && event.moduleKey !== moduleKey) return;
      if (!includeReplays && event.replayed) return;
      listenerRef.current(event);
    });
  }, [recordId, moduleKey, includeReplays]);
}

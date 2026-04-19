'use client';

/**
 * Fires a single POST to `/api/crm/recently-viewed` when a record detail
 * page mounts. Fire-and-forget — the UI should never block on this.
 *
 * Deduplicates via a module-level Set so rapid remounts (e.g. React
 * Strict Mode, Suspense boundaries, presence hook reconnects) don't
 * spam the endpoint. A record becomes eligible for re-logging after 30s.
 */

import { useEffect } from 'react';

const lastLoggedAt = new Map<string, number>();
const DEDUPE_WINDOW_MS = 30_000;

export function useRecentlyViewedTracker(recordId: string | null | undefined) {
  useEffect(() => {
    if (!recordId) return;
    const now = Date.now();
    const last = lastLoggedAt.get(recordId) ?? 0;
    if (now - last < DEDUPE_WINDOW_MS) return;
    lastLoggedAt.set(recordId, now);

    const controller = new AbortController();
    fetch('/api/crm/recently-viewed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ recordId }),
      signal: controller.signal,
    }).catch(() => {
      lastLoggedAt.delete(recordId);
    });

    return () => {
      controller.abort();
    };
  }, [recordId]);
}

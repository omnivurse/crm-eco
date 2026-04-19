'use client';

/**
 * OfflineAnalyticsBoot — wires the offline-stack event sink at shell
 * boot. Mounts once per session, no UI.
 *
 * Default behaviour:
 *   - In dev, leave the console sink as-is (super chatty; useful).
 *   - In production, swap in the beacon sink which POSTs each event
 *     to `NEXT_PUBLIC_OFFLINE_BEACON_URL` via `navigator.sendBeacon`
 *     (falls back to `fetch` with `keepalive: true`).
 *
 * If `NEXT_PUBLIC_OFFLINE_BEACON_URL` isn't set in production, we
 * install a *silent* sink so we don't accidentally leak PII into the
 * browser console. Set the env var to turn instrumentation on in prod.
 *
 * Why `sendBeacon` over `fetch`:
 *   sendBeacon is guaranteed to run even when the page is being
 *   dismissed (tab close, nav away). That's exactly when we care
 *   most — a mutation failure on unload would otherwise vanish.
 */

import { useEffect } from 'react';
import {
  setOfflineEventSink,
  type OfflineEvent,
  type OfflineEventSink,
} from '@/lib/offline/instrumentation';

/** Build a sink that POSTs events to the beacon endpoint. Events are
 *  sent one at a time; the server should shape them into whatever
 *  the downstream analytics platform expects. */
function createBeaconSink(url: string): OfflineEventSink {
  return (event: OfflineEvent) => {
    const payload = JSON.stringify({
      ...event,
      sentAt: new Date().toISOString(),
    });
    // Prefer sendBeacon — it survives unload and doesn't block the
    // task queue. Fall back to fetch with keepalive for environments
    // that disable sendBeacon (or when the payload exceeds its 64k
    // budget — a single event is nowhere near this, but defensive).
    try {
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.sendBeacon === 'function'
      ) {
        const blob = new Blob([payload], { type: 'application/json' });
        const ok = navigator.sendBeacon(url, blob);
        if (ok) return;
      }
      if (typeof fetch !== 'undefined') {
        void fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          credentials: 'same-origin',
          keepalive: true,
        }).catch(() => {
          /* never throw from a sink */
        });
      }
    } catch {
      /* sinks must never throw */
    }
  };
}

export function OfflineAnalyticsBoot() {
  useEffect(() => {
    const beaconUrl = process.env.NEXT_PUBLIC_OFFLINE_BEACON_URL?.trim();

    // Dev: keep the default console.debug sink from `instrumentation.ts`.
    // Prod without beacon: install silent sink to avoid logging PII.
    // Prod with beacon: POST events to the configured endpoint.
    if (process.env.NODE_ENV !== 'production') {
      return;
    }
    if (!beaconUrl) {
      setOfflineEventSink(() => {
        /* silent */
      });
      return;
    }
    setOfflineEventSink(createBeaconSink(beaconUrl));
  }, []);

  return null;
}

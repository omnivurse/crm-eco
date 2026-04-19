'use client';

/**
 * instrumentation — tiny event bus for the offline stack.
 *
 * Purpose: emit structured, typed events for each mutation-queue /
 * cache / sync transition so we can wire real analytics (Segment,
 * Datadog RUM, PostHog, etc.) without touching call sites later.
 *
 * Design:
 *   - A single function `recordOfflineEvent(event)` that fans out to
 *     whatever sinks are currently registered. Default sink in dev is
 *     a namespaced `console.debug`; production starts silent so we
 *     don't leak PII into the console until a sink is wired.
 *   - Events are typed via a discriminated union so consumers get
 *     autocompletion on the payload. Adding a new event is a single
 *     variant in the union.
 *   - Sinks are pluggable via `setOfflineEventSink`. Calling this
 *     replaces (not adds to) the current sink so product code stays
 *     simple and we don't accumulate sinks between hot-reloads.
 */

export type OfflineEvent =
  | {
      type: 'enqueue';
      mutationId: string;
      method: string;
      url: string;
      label: string;
      recordId?: string;
      moduleKey?: string;
      /** Number of mutations already in the queue at the moment of
       *  this enqueue — helps us chart queue depth over time. */
      queueDepth: number;
    }
  | {
      type: 'drain.success';
      mutationId: string;
      attempts: number;
      latencyMs: number;
      /** Value of the `x-sync-receipt` response header, when the server
       *  returned one. Matches a row in `crm_idempotency_keys` and is
       *  useful for reconciling client-side logs with server state. */
      receiptId?: string;
      /** True when the server indicated this was a cached replay of a
       *  prior mutation (via `x-sync-replayed: 1`). Lets us chart
       *  "duplicate save suppressed" rates in production. */
      replayed?: boolean;
    }
  | {
      type: 'drain.retry';
      mutationId: string;
      attempts: number;
      reason: string;
    }
  | {
      type: 'drain.failure';
      mutationId: string;
      attempts: number;
      failureKind: 'conflict' | 'server-error' | 'retry-exhausted';
      reason: string;
    }
  | {
      type: 'connection';
      online: boolean;
    };

export type OfflineEventSink = (event: OfflineEvent) => void;

const consoleSink: OfflineEventSink = (event) => {
  if (typeof console === 'undefined') return;
  if (process.env.NODE_ENV === 'production') return;
  console.debug('[offline]', event.type, event);
};

let currentSink: OfflineEventSink = consoleSink;

/** Swap the event sink. Call once at app boot to wire analytics. */
export function setOfflineEventSink(sink: OfflineEventSink): void {
  currentSink = sink;
}

export function recordOfflineEvent(event: OfflineEvent): void {
  try {
    currentSink(event);
  } catch {
    /* A sink must never be able to break the offline stack. */
  }
}

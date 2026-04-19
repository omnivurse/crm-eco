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
      /** Trace id echoed by the server in `x-trace-id`. Usually the
       *  client's `X-Request-Id` but the server may substitute its own
       *  (e.g. Vercel's `x-vercel-id`) when the request wasn't stamped. */
      traceId?: string;
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

/** Monotonic wall-clock timestamp attached to every ring-buffer entry
 *  so the debug timeline can render "N seconds ago" without pulling
 *  it from whatever sink happens to be attached. */
export interface RecordedOfflineEvent {
  event: OfflineEvent;
  recordedAt: number;
}

const consoleSink: OfflineEventSink = (event) => {
  if (typeof console === 'undefined') return;
  if (process.env.NODE_ENV === 'production') return;
  console.debug('[offline]', event.type, event);
};

let currentSink: OfflineEventSink = consoleSink;

/**
 * Small in-memory ring buffer. Every event is captured here *in
 * addition to* the swappable sink, so the debug page and support
 * tooling can show recent activity without requiring the prod beacon
 * sink to be wired. Capped at 200 entries — more than enough to
 * eyeball a single reconnect burst.
 */
const RING_BUFFER_CAP = 200;
const ring: RecordedOfflineEvent[] = [];
type BufferSubscriber = (snapshot: RecordedOfflineEvent[]) => void;
const bufferSubscribers = new Set<BufferSubscriber>();

function emitBuffer(): void {
  const snapshot = [...ring];
  for (const sub of bufferSubscribers) {
    try {
      sub(snapshot);
    } catch {
      /* Never let a buggy subscriber take the bus down. */
    }
  }
}

/** Swap the event sink. Call once at app boot to wire analytics. */
export function setOfflineEventSink(sink: OfflineEventSink): void {
  currentSink = sink;
}

export function recordOfflineEvent(event: OfflineEvent): void {
  // Push into the ring buffer first so the debug UI still sees the
  // event even if the user-supplied sink throws or swallows it.
  ring.push({ event, recordedAt: Date.now() });
  if (ring.length > RING_BUFFER_CAP) {
    ring.splice(0, ring.length - RING_BUFFER_CAP);
  }
  emitBuffer();
  try {
    currentSink(event);
  } catch {
    /* A sink must never be able to break the offline stack. */
  }
}

export function getOfflineEventBuffer(): RecordedOfflineEvent[] {
  return [...ring];
}

/** Subscribe to ring-buffer changes. Returns the unsubscribe fn.
 *  Subscribers are called on every new event plus once synchronously
 *  with the current snapshot so new mounts render immediately. */
export function subscribeOfflineEventBuffer(
  fn: BufferSubscriber,
): () => void {
  bufferSubscribers.add(fn);
  try {
    fn([...ring]);
  } catch {
    /* noop */
  }
  return () => {
    bufferSubscribers.delete(fn);
  };
}

/** Wipe the ring buffer. Called from `clearOfflineState` so a signed-
 *  out user never leaves event breadcrumbs for the next person on
 *  the device. */
export function clearOfflineEventBuffer(): void {
  ring.length = 0;
  emitBuffer();
}

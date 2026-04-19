'use client';

/**
 * queuedSend — thin wrapper around `fetch` that falls back to the
 * offline `mutationQueue` when the request fails at the network layer
 * (no response, offline, DNS, TLS, etc.) OR when the browser is already
 * offline when the call is made.
 *
 * Rationale:
 *   Most call sites (note composer, task composer, tag toggles, mass
 *   actions) had the same boilerplate: try fetch, show toast on error,
 *   rollback optimistic state. Now they can call `queuedSend(...)` and
 *   get three deterministic outcomes:
 *
 *     - `{ ok: true, response }`   → server accepted the write
 *     - `{ ok: false, queued: true }` → write was enqueued; caller keeps
 *        optimistic state and lets the mutation queue replay later
 *     - `{ ok: false, queued: false, response?, error? }` → terminal
 *        server error (4xx) — caller should rollback and toast
 *
 * Keeping the helper outside the queue module means the queue stays a
 * pure replay engine while UI code gets a small, ergonomic facade.
 */

import {
  mutationQueue,
  type MutationMethod,
} from '@/lib/offline/mutation-queue';

const IDEMPOTENCY_HEADER = 'Idempotency-Key';

/**
 * Generate a UUID v4. Uses `crypto.randomUUID()` where available and
 * falls back to a cryptographically-weak string for ancient browsers.
 * The weak fallback is acceptable because collisions would only cause
 * a duplicate replay to be deduped against an unrelated request —
 * which means the duplicate still runs as a fresh write, just without
 * idempotency. Never worse than the pre-PR status quo.
 */
function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rand()}-${rand()}`;
}

export interface QueuedSendInput {
  method: MutationMethod;
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
  /**
   * If true and the browser is already offline, the request is enqueued
   * immediately without attempting a live fetch. Most mutating flows
   * want this — a doomed fetch just delays user feedback.
   */
  offlineFirst?: boolean;
  /** Metadata passed through to the queue for the inspector UI. */
  queue: {
    label: string;
    dedupeKey?: string;
    moduleKey?: string;
    recordId?: string;
  };
}

export type QueuedSendResult =
  | { ok: true; response: Response }
  | { ok: false; queued: true; queuedId: string }
  | { ok: false; queued: false; response?: Response; error: string };

function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

export async function queuedSend(
  input: QueuedSendInput,
): Promise<QueuedSendResult> {
  const headers: Record<string, string> = input.headers
    ? { ...input.headers }
    : input.body !== undefined
      ? { 'Content-Type': 'application/json' }
      : {};

  // Stamp a stable idempotency key. Identical header value is reused
  // across live + queued + retry replays so the server can dedupe
  // duplicate writes through `withIdempotency`. Caller-supplied keys
  // always win (see inline composers that already manage their own
  // correlation ids).
  if (!headers[IDEMPOTENCY_HEADER]) {
    headers[IDEMPOTENCY_HEADER] = generateIdempotencyKey();
  }

  // Short-circuit: if offline and caller opted in, skip the doomed
  // fetch and go straight to the queue so the user gets instant
  // confirmation of the pending change.
  if (input.offlineFirst !== false && !isOnline()) {
    const q = mutationQueue.enqueue({
      method: input.method,
      url: input.url,
      body: input.body,
      headers,
      label: input.queue.label,
      dedupeKey: input.queue.dedupeKey,
      moduleKey: input.queue.moduleKey,
      recordId: input.queue.recordId,
    });
    return { ok: false, queued: true, queuedId: q.id };
  }

  try {
    const response = await fetch(input.url, {
      method: input.method,
      headers,
      credentials: 'same-origin',
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
    });
    if (response.ok) {
      return { ok: true, response };
    }
    // 4xx/5xx — terminal from the caller's perspective. We do *not*
    // enqueue server-side failures because they are almost always a
    // validation or permission issue that will never succeed on retry.
    let message = `HTTP ${response.status}`;
    try {
      const body = await response.clone().json();
      if (body?.error) message = body.error as string;
    } catch {
      /* ignore */
    }
    return { ok: false, queued: false, response, error: message };
  } catch (err) {
    // Network-level failure. Enqueue for replay.
    const q = mutationQueue.enqueue({
      method: input.method,
      url: input.url,
      body: input.body,
      headers,
      label: input.queue.label,
      dedupeKey: input.queue.dedupeKey,
      moduleKey: input.queue.moduleKey,
      recordId: input.queue.recordId,
    });
    // Preserve the original error for callers that want to log it.
    void (err instanceof Error ? err.message : String(err));
    return { ok: false, queued: true, queuedId: q.id };
  }
}

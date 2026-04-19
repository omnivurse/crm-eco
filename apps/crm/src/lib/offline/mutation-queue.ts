'use client';

/**
 * Mutation queue — persisted, retrying offline queue for PATCH/POST/DELETE
 * mutations that must survive a flaky cell connection or a tab refresh.
 *
 * Design choices:
 *  - Persistence: `localStorage` under a single key. Good for <100 entries;
 *    avoids an IndexedDB dependency for a feature that almost never holds
 *    more than a handful of rows.
 *  - Transport: plain `fetch`, so the queue is transparent to callers —
 *    they enqueue a `{ method, url, body, headers }` descriptor and we
 *    replay it verbatim when the network returns.
 *  - Idempotency: each mutation carries a client-generated `id` and an
 *    optional `dedupeKey` so repeated edits of the same field collapse
 *    into a single queued entry (last-write-wins).
 *  - Retry: exponential back-off with jitter, capped at `MAX_RETRIES`.
 *    4xx responses (except 408/425/429) are considered terminal failures
 *    and surfaced to the user instead of retried forever.
 *  - Fan-out: subscribers get a stable snapshot on every state change,
 *    driving the header pill and inspector dialog.
 *
 * The queue is intentionally a module-level singleton. Auth cookies are
 * shared across all callers, so a second instance would just fight the
 * first one for the same slot.
 */

const STORAGE_KEY = 'crm.mutationQueue.v1';
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1_500;
const MAX_BACKOFF_MS = 30_000;

export type MutationMethod = 'PATCH' | 'POST' | 'PUT' | 'DELETE';

export type MutationStatus =
  | 'queued'
  | 'syncing'
  | 'failed'
  | 'succeeded';

/**
 * Classification of *why* a mutation ended up in `failed`. Drives the
 * inspector UI: conflicts get a "Review" affordance, retry-exhausted
 * entries get a plain "Retry" button, and terminal server errors get
 * a "Discard" hint because they'll never succeed.
 */
export type MutationFailureKind =
  | 'conflict'
  | 'server-error'
  | 'retry-exhausted';

export interface QueuedMutation {
  /** Client-generated UUID so retries are idempotent. */
  id: string;
  method: MutationMethod;
  url: string;
  /** Serialised JSON body — we store strings to keep the blob portable. */
  body?: string;
  headers?: Record<string, string>;
  /**
   * Optional key used to collapse successive edits of the same logical
   * field into a single queued mutation. E.g. `record:123:field:title`.
   */
  dedupeKey?: string;
  /** Short human label for the inspector ("Update Acme Inc · title"). */
  label: string;
  /** Module/record context so the pill can link back to the page. */
  moduleKey?: string;
  recordId?: string;
  /** Status + tracking. */
  status: MutationStatus;
  /** Populated when `status === 'failed'` so the inspector can branch
   *  on the cause without parsing the error string. */
  failureKind?: MutationFailureKind;
  attempts: number;
  lastError?: string;
  nextAttemptAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface QueueSnapshot {
  /** Mutations currently waiting or retrying. Excludes succeeded/cleared. */
  pending: QueuedMutation[];
  /** Mutations that permanently failed (4xx or exhausted retries). */
  failed: QueuedMutation[];
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: number | null;
}

type Subscriber = (snapshot: QueueSnapshot) => void;
type SuccessListener = (mutation: QueuedMutation) => void;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function readPersisted(): QueuedMutation[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isMutation);
  } catch {
    return [];
  }
}

function writePersisted(list: QueuedMutation[]) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* quota exceeded — nothing useful to do here */
  }
}

function isMutation(x: unknown): x is QueuedMutation {
  if (!x || typeof x !== 'object') return false;
  const obj = x as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.method === 'string' &&
    typeof obj.url === 'string' &&
    typeof obj.label === 'string' &&
    typeof obj.status === 'string' &&
    typeof obj.attempts === 'number' &&
    typeof obj.createdAt === 'number'
  );
}

function nowIso(): number {
  return Date.now();
}

function generateId(): string {
  if (isBrowser() && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `mut_${nowIso()}_${Math.random().toString(36).slice(2, 10)}`;
}

function backoffDelay(attempt: number): number {
  const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempt);
  const jitter = Math.random() * BASE_BACKOFF_MS;
  return Math.round(exp + jitter);
}

/** True when a response status is a transient / retryable failure. */
function isRetryableStatus(status: number): boolean {
  if (status >= 500) return true;
  return status === 408 || status === 425 || status === 429;
}

class MutationQueue {
  private mutations: QueuedMutation[] = [];
  private subscribers = new Set<Subscriber>();
  private successListeners = new Set<SuccessListener>();
  private running = false;
  private drainScheduled = false;
  private drainTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSyncedAt: number | null = null;

  constructor() {
    if (isBrowser()) {
      this.mutations = readPersisted();
      // Reset any entries that were mid-sync when the tab last closed.
      for (const m of this.mutations) {
        if (m.status === 'syncing') m.status = 'queued';
      }

      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);

      // Drain on focus in case we missed the online event (iOS Safari).
      window.addEventListener('focus', this.handleFocus);

      // If we came back online while the page was loading, flush ASAP.
      if (navigator.onLine) {
        this.scheduleDrain(0);
      }
    }
  }

  private handleOnline = () => {
    this.emit();
    this.scheduleDrain(250);
  };

  private handleOffline = () => {
    this.emit();
  };

  private handleFocus = () => {
    if (isBrowser() && navigator.onLine) this.scheduleDrain(500);
  };

  private persist() {
    writePersisted(this.mutations);
  }

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    fn(this.snapshot());
    return () => {
      this.subscribers.delete(fn);
    };
  }

  /**
   * Subscribe to "mutation succeeded" events. Used by the sync-toast
   * notifier to count drained mutations across a reconnection window
   * and emit a single "Synced N changes" toast rather than one per
   * mutation. Deliberately separate from `subscribe` so the toast UI
   * doesn't re-render on every snapshot flip.
   */
  onSuccess(fn: SuccessListener): () => void {
    this.successListeners.add(fn);
    return () => {
      this.successListeners.delete(fn);
    };
  }

  snapshot(): QueueSnapshot {
    const pending: QueuedMutation[] = [];
    const failed: QueuedMutation[] = [];
    for (const m of this.mutations) {
      if (m.status === 'failed') failed.push(m);
      else if (m.status !== 'succeeded') pending.push(m);
    }
    return {
      pending,
      failed,
      isOnline: isBrowser() ? navigator.onLine : true,
      isSyncing: this.running,
      lastSyncedAt: this.lastSyncedAt,
    };
  }

  private emit() {
    const snap = this.snapshot();
    for (const sub of this.subscribers) sub(snap);
  }

  /**
   * Enqueue a mutation. If `dedupeKey` is provided and an existing
   * queued mutation shares the same key, it is replaced (last-write-
   * wins) so rapid successive edits don't accumulate.
   */
  enqueue(input: {
    method: MutationMethod;
    url: string;
    body?: unknown;
    headers?: Record<string, string>;
    dedupeKey?: string;
    label: string;
    moduleKey?: string;
    recordId?: string;
  }): QueuedMutation {
    const serializedBody =
      input.body === undefined ? undefined : JSON.stringify(input.body);
    const headers = input.headers
      ? { ...input.headers }
      : input.body !== undefined
        ? { 'Content-Type': 'application/json' }
        : undefined;

    if (input.dedupeKey) {
      const idx = this.mutations.findIndex(
        (m) =>
          m.dedupeKey === input.dedupeKey &&
          (m.status === 'queued' || m.status === 'failed'),
      );
      if (idx !== -1) {
        const prev = this.mutations[idx];
        const next: QueuedMutation = {
          ...prev,
          method: input.method,
          url: input.url,
          body: serializedBody,
          headers,
          label: input.label,
          moduleKey: input.moduleKey ?? prev.moduleKey,
          recordId: input.recordId ?? prev.recordId,
          status: 'queued',
          lastError: undefined,
          // Reset backoff — this is a fresh write, not a replay.
          attempts: 0,
          nextAttemptAt: undefined,
          updatedAt: nowIso(),
        };
        this.mutations[idx] = next;
        this.persist();
        this.emit();
        this.scheduleDrain(0);
        return next;
      }
    }

    const mutation: QueuedMutation = {
      id: generateId(),
      method: input.method,
      url: input.url,
      body: serializedBody,
      headers,
      dedupeKey: input.dedupeKey,
      label: input.label,
      moduleKey: input.moduleKey,
      recordId: input.recordId,
      status: 'queued',
      attempts: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    this.mutations.push(mutation);
    this.persist();
    this.emit();
    this.scheduleDrain(0);
    return mutation;
  }

  /** Remove a mutation by id (user cancels from the inspector). */
  remove(id: string): void {
    const before = this.mutations.length;
    this.mutations = this.mutations.filter((m) => m.id !== id);
    if (this.mutations.length !== before) {
      this.persist();
      this.emit();
    }
  }

  /** Clear all failed mutations (user acks the errors). */
  clearFailed(): void {
    const before = this.mutations.length;
    this.mutations = this.mutations.filter((m) => m.status !== 'failed');
    if (this.mutations.length !== before) {
      this.persist();
      this.emit();
    }
  }

  /** Reset a failed mutation back to queued so it retries again. */
  retry(id: string): void {
    const target = this.mutations.find((m) => m.id === id);
    if (!target) return;
    target.status = 'queued';
    target.attempts = 0;
    target.lastError = undefined;
    target.nextAttemptAt = undefined;
    target.updatedAt = nowIso();
    this.persist();
    this.emit();
    this.scheduleDrain(0);
  }

  /** Force a drain attempt now. No-op when already running. */
  flush(): Promise<void> {
    return this.drain();
  }

  private scheduleDrain(delayMs: number): void {
    if (this.drainTimer) clearTimeout(this.drainTimer);
    if (this.drainScheduled && delayMs === 0) return;
    this.drainScheduled = true;
    this.drainTimer = setTimeout(() => {
      this.drainScheduled = false;
      void this.drain();
    }, delayMs);
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    if (!isBrowser()) return;
    if (!navigator.onLine) return;

    const next = this.mutations.find(
      (m) =>
        m.status === 'queued' &&
        (!m.nextAttemptAt || m.nextAttemptAt <= Date.now()),
    );
    if (!next) return;

    this.running = true;
    next.status = 'syncing';
    this.emit();

    try {
      const res = await fetch(next.url, {
        method: next.method,
        headers: next.headers,
        credentials: 'same-origin',
        body: next.body,
      });

      if (res.ok) {
        next.status = 'succeeded';
        this.lastSyncedAt = nowIso();
        // Succeeded mutations are dropped from the queue — they no
        // longer need to be replayed.
        this.mutations = this.mutations.filter((m) => m.id !== next.id);
        // Fan out to success listeners so consumers (toast notifier,
        // analytics) can react without polling the snapshot.
        for (const fn of this.successListeners) {
          try { fn(next); } catch { /* listener errors are non-fatal */ }
        }
      } else if (isRetryableStatus(res.status) && next.attempts + 1 < MAX_RETRIES) {
        next.attempts += 1;
        next.status = 'queued';
        next.nextAttemptAt = Date.now() + backoffDelay(next.attempts);
        next.lastError = `HTTP ${res.status}`;
        next.updatedAt = nowIso();
      } else {
        next.status = 'failed';
        let message = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          if (body?.error) message = body.error as string;
        } catch {
          /* ignore */
        }
        // 409 is a frequent replay outcome: the user edited a field
        // while offline, someone else edited the same record in the
        // meantime, and the `If-Match` token is now stale. Tag it
        // explicitly so the inspector can open a review dialog.
        if (res.status === 409) {
          message =
            'Record was updated on the server — review to reapply your change';
          next.failureKind = 'conflict';
        } else {
          next.failureKind = 'server-error';
        }
        next.lastError = message;
        next.updatedAt = nowIso();
      }
    } catch (err) {
      // Network error — offline, DNS, TLS, etc. Always retry with
      // backoff because the server never saw the request.
      const message = err instanceof Error ? err.message : String(err);
      if (next.attempts + 1 < MAX_RETRIES) {
        next.attempts += 1;
        next.status = 'queued';
        next.nextAttemptAt = Date.now() + backoffDelay(next.attempts);
        next.lastError = message;
        next.updatedAt = nowIso();
      } else {
        next.status = 'failed';
        next.failureKind = 'retry-exhausted';
        next.lastError = message;
        next.updatedAt = nowIso();
      }
    } finally {
      this.persist();
      this.running = false;
      this.emit();

      // If there's more queued work, schedule the next attempt just
      // after the soonest `nextAttemptAt`.
      const upcoming = this.mutations
        .filter((m) => m.status === 'queued')
        .map((m) => m.nextAttemptAt ?? Date.now())
        .sort((a, b) => a - b);
      const soonest = upcoming[0];
      if (soonest) {
        const delay = Math.max(0, soonest - Date.now());
        this.scheduleDrain(delay);
      }
    }
  }
}

export const mutationQueue = new MutationQueue();

'use client';

/**
 * useRecordFieldSave — shared save-queue context for V2 inline editors.
 *
 * Inline editors ( `InlineFieldEditor` ) push a save through the provider
 * and the provider:
 *   1. Debounces per-field so rapid typing doesn't flood the API.
 *   2. Dispatches `PATCH /api/crm/records/[id]` with `{ [field]: value }`.
 *   3. Tracks `pending`, `saving`, `lastSavedAt`, and `lastError` state
 *      that the header's `UnsavedChangesPill` consumes.
 *   4. Dedupes concurrent saves for the same field (second wins, first is
 *      cancelled via its AbortController).
 *
 * Keeping this in a provider — rather than local `useState` on each
 * editor — means the header pill can render a single source of truth
 * summarising *all* dirty fields, and concurrent edits across multiple
 * inline editors don't race.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { mutationQueue } from '@/lib/offline/mutation-queue';
import { makeIdempotencyKey } from '@/lib/offline/queued-send';

export type FieldSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface FieldSaveState {
  status: FieldSaveStatus;
  /** Last error message, if any. */
  error?: string;
  /** Most recent successful save time. */
  savedAt?: number;
  /** Value last persisted successfully (for optimistic overview UI). */
  lastValue?: unknown;
}

/** Where a field value lives in the `crm_records` row. */
export type FieldSaveTarget = 'row' | 'data';

export interface FieldSaveOptions {
  /**
   * Whether the field is a top-level column on `crm_records` (`'row'`)
   * or nested inside the JSONB `data` column (`'data'`).
   *
   * When omitted the hook auto-detects using a best-effort allowlist of
   * known top-level columns — JSONB is the safer default because the
   * PATCH service silently drops unknown top-level keys.
   */
  target?: FieldSaveTarget;
}

/** Public shape consumed by `UnsavedChangesPill` and friends. */
export interface RecordFieldSaveContextValue {
  /** Per-field state, keyed by the field key passed to `save()`. */
  fields: Record<string, FieldSaveState>;
  /** Number of fields currently pending or saving. */
  pendingCount: number;
  /** Most recent successful save across all fields. */
  lastSavedAt: number | null;
  /** Most recent error across all fields. */
  lastError: string | null;
  /**
   * Queue a save for the given field. Debounces per-field (250ms) and
   * returns a Promise that resolves when the save settles (successful
   * or failed).
   */
  save: (
    field: string,
    value: unknown,
    options?: FieldSaveOptions,
  ) => Promise<void>;
  /**
   * Flush any debounced pending saves immediately. Useful when the user
   * navigates away or the presence "editing" intent ends.
   */
  flush: () => Promise<void>;
}

/**
 * Fields recognized as top-level columns by `executeCrmRecordPatch`. Any
 * key NOT in this list is automatically routed through JSONB `data`.
 * Keep this in sync with CANONICAL_TOP_LEVEL_KEYS in record-patch-service.
 */
const KNOWN_ROW_COLUMNS = new Set<string>([
  'title',
  'status',
  'stage',
  'owner_id',
  'market_type',
  'carrier_id',
  'normalization_status',
  'normalization_notes',
  'canonical_advisor_id',
  'normalized_advisor_name',
  'normalized_agent_name',
  'tobacco_user',
  'record_type',
  'import_source',
  'advisor_id',
  'contact_type',
  'territory_id',
  'source_record_id',
  'import_batch_id',
  'original_start_date',
  'current_year_start_date',
  'cancellation_date',
  'group_name',
]);

const RecordFieldSaveContext =
  createContext<RecordFieldSaveContextValue | null>(null);

export interface RecordFieldSaveProviderProps {
  recordId: string;
  /** Called after each successful save. Use for revalidation / refresh. */
  onSaved?: (field: string, value: unknown) => void;
  /** Debounce window for typed edits. Defaults to 250ms. */
  debounceMs?: number;
  /**
   * Seed value for the optimistic-concurrency token. Usually
   * `record.updated_at` from the server. Sent as `If-Match` on every
   * PATCH and updated in place after each successful save.
   */
  initialUpdatedAt?: string | null;
  /**
   * Called when a save returns HTTP 409 (record was modified by another
   * user). Parent usually triggers `router.refresh()` and/or a toast so
   * the user can retry against the new server state.
   */
  onConflict?: (info: {
    field: string;
    currentUpdatedAt: string | null;
    value: unknown;
  }) => void;
  children: ReactNode;
}

interface PendingEntry {
  field: string;
  value: unknown;
  target: FieldSaveTarget;
  timer: ReturnType<typeof setTimeout>;
  resolve: () => void;
}

export function RecordFieldSaveProvider({
  recordId,
  onSaved,
  debounceMs = 250,
  initialUpdatedAt = null,
  onConflict,
  children,
}: RecordFieldSaveProviderProps) {
  const [fields, setFields] = useState<Record<string, FieldSaveState>>({});
  const pendingRef = useRef<Map<string, PendingEntry>>(new Map());
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  // Optimistic-concurrency token, updated after each successful save.
  // Refs (not state) so closures in debounced timers always read the
  // freshest value without re-creating the debounce timer.
  const updatedAtRef = useRef<string | null>(initialUpdatedAt);
  // Serialise dispatched saves: when the user blurs five fields in 500ms
  // (or `flush()` fires Promise.all on N pending entries), we used to race —
  // every save carried the same `If-Match`, the first one moved updated_at,
  // and the rest got 409. The route retries once, but with 3+ concurrent
  // saves the retry's `If-Match` was already stale too, so the third save
  // silently errored. Result: partial save (some fields persist, others
  // drop). Chaining each dispatchSave behind the previous one trades a
  // little latency for atomicity from the user's perspective.
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    updatedAtRef.current = initialUpdatedAt ?? updatedAtRef.current;
  }, [initialUpdatedAt]);

  const updateField = useCallback(
    (field: string, patch: Partial<FieldSaveState>) => {
      setFields((prev) => ({
        ...prev,
        [field]: { ...(prev[field] ?? { status: 'idle' }), ...patch },
      }));
    },
    [],
  );

  const dispatchSave = useCallback(
    async (field: string, value: unknown, target: FieldSaveTarget) => {
      // Cancel any in-flight save for this field.
      const existing = controllersRef.current.get(field);
      if (existing) existing.abort();
      const controller = new AbortController();
      controllersRef.current.set(field, controller);

      updateField(field, { status: 'saving', error: undefined });
      // Declared outside the try/catch so the network-failure branch
      // below can reuse the *same* key when it enqueues the fallback
      // mutation. Matching keys across live + queued replays is what
      // makes the end-to-end idempotency guarantee work.
      const idempotencyKey = makeIdempotencyKey();
      const payload =
        target === 'data'
          ? { data: { [field]: value } }
          : { [field]: value };

      // Tunables for the 409 retry loop. With saveChainRef we serialise
      // dispatches per-tab, so the only remaining sources of `If-Match`
      // drift are: a second tab from the same user, another rep editing
      // the same row, or a backend trigger writing in the background.
      // Three attempts with exponential backoff (50ms / 200ms) is more
      // than enough to ride out any of those without surfacing the
      // conflict to the user.
      const MAX_409_ATTEMPTS = 3;
      const RETRY_BACKOFF_MS = [50, 200, 500] as const;
      // Per-attempt timeout. A request can occasionally hang on a flaky
      // network or a slow Postgres lock; without this the saveChainRef
      // queue stalls behind it and every subsequent field looks like
      // it's "saving forever". On timeout we abort the in-flight fetch,
      // queue a background retry, and let the chain proceed.
      const ATTEMPT_TIMEOUT_MS = 10_000;

      try {
        let attempt = 0;
        let lastMessage = 'Save failed';
        // eslint-disable-next-line no-constant-condition
        while (true) {
          attempt++;

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            // Reuse the idempotency key only on the very first attempt;
            // subsequent attempts get fresh keys so the backend's
            // dedupe table doesn't replay the original 409 response.
            'Idempotency-Key': attempt === 1 ? idempotencyKey : makeIdempotencyKey(),
          };
          if (updatedAtRef.current) {
            headers['X-If-Updated-At'] = updatedAtRef.current;
          }

          // Per-attempt timeout: chain a temporary AbortController off
          // the field-level controller so timing out one attempt
          // doesn't kill subsequent retries, but cancelling the field
          // (via the field-level controller) does kill the timeout.
          const attemptController = new AbortController();
          const onParentAbort = () => attemptController.abort();
          controller.signal.addEventListener('abort', onParentAbort);
          const timeoutHandle = setTimeout(() => attemptController.abort(), ATTEMPT_TIMEOUT_MS);

          let res: Response;
          try {
            res = await fetch(`/api/crm/records/${recordId}`, {
              method: 'PATCH',
              headers,
              credentials: 'same-origin',
              signal: attemptController.signal,
              body: JSON.stringify(payload),
            });
          } finally {
            clearTimeout(timeoutHandle);
            controller.signal.removeEventListener('abort', onParentAbort);
          }

          if (res.ok) {
            try {
              const body = (await res.clone().json()) as {
                updated_at?: string | null;
              };
              if (body?.updated_at) updatedAtRef.current = body.updated_at;
            } catch {
              /* response not JSON — ignore */
            }
            updateField(field, {
              status: 'saved',
              error: undefined,
              savedAt: Date.now(),
              lastValue: value,
            });
            onSaved?.(field, value);
            return;
          }

          // Non-OK response — read body once for both the 409 retry
          // path and the user-facing error message.
          let currentUpdatedAt: string | null = null;
          try {
            const body = await res.json();
            if (body?.error) lastMessage = body.error as string;
            if (typeof body?.currentUpdatedAt === 'string') {
              currentUpdatedAt = body.currentUpdatedAt;
            }
          } catch {
            lastMessage = `Save failed (${res.status})`;
          }

          // Only 409 with a server-supplied currentUpdatedAt is
          // retryable. Anything else (4xx validation, 5xx) bubbles up.
          if (res.status !== 409 || !currentUpdatedAt) {
            updateField(field, {
              status: 'error',
              error: res.status === 409
                ? 'Record was updated elsewhere — reload to retry'
                : lastMessage,
            });
            return;
          }

          // 409: refresh our token from the server, give the chain a
          // tick to settle, then retry. We notify on the first retry
          // only so the conflict callback isn't spammed for ride-out
          // races.
          updatedAtRef.current = currentUpdatedAt;
          if (attempt === 1) {
            onConflict?.({ field, currentUpdatedAt, value });
          }

          if (attempt >= MAX_409_ATTEMPTS) {
            updateField(field, {
              status: 'error',
              error: 'Record is being edited by someone else — reload to retry',
            });
            return;
          }

          const backoff = RETRY_BACKOFF_MS[attempt - 1] ?? 500;
          await new Promise((r) => setTimeout(r, backoff));
        }
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === 'AbortError') {
          // Distinguish "user-cancelled" (parent controller aborted)
          // from "attempt timed out" (only the per-attempt controller
          // fired). When the parent is aborted, just return — a newer
          // save for the same field is already in flight.
          if (controller.signal.aborted) return;
          // Timeout — fall through to the queue path below so the
          // user's value isn't lost.
        }
        // Network-level failures (or attempt timeout) get queued for
        // background retry so the rep doesn't lose their typed value
        // when the train tunnel drops Wi-Fi. We still mark the field
        // as "saved" locally — the pill in the topbar surfaces the
        // pending sync state globally.
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          // Reuse the same Idempotency-Key the live fetch generated —
          // if the timed-out request actually persisted, the backend
          // dedupes the queued replay against the cached response.
          'Idempotency-Key': idempotencyKey,
        };
        if (updatedAtRef.current) headers['X-If-Updated-At'] = updatedAtRef.current;
        mutationQueue.enqueue({
          method: 'PATCH',
          url: `/api/crm/records/${recordId}`,
          body: payload,
          headers,
          dedupeKey: `record:${recordId}:field:${field}`,
          label: `Update ${field}`,
          recordId,
        });
        updateField(field, {
          status: 'saved',
          error: undefined,
          savedAt: Date.now(),
          lastValue: value,
        });
        onSaved?.(field, value);
      } finally {
        controllersRef.current.delete(field);
      }
    },
    [recordId, onSaved, onConflict, updateField],
  );

  // Chain a save behind whatever's already in flight so two concurrent
  // dispatches never carry the same stale `If-Match`. This is what stops
  // partial-save races when the user edits several fields in quick succession.
  const enqueueDispatch = useCallback(
    (field: string, value: unknown, target: FieldSaveTarget) => {
      const next = saveChainRef.current.then(
        () => dispatchSave(field, value, target),
        () => dispatchSave(field, value, target),
      );
      saveChainRef.current = next;
      return next;
    },
    [dispatchSave],
  );

  const save = useCallback<RecordFieldSaveContextValue['save']>(
    (field, value, options) => {
      const target: FieldSaveTarget =
        options?.target ?? (KNOWN_ROW_COLUMNS.has(field) ? 'row' : 'data');
      // Mark pending immediately so the pill lights up while typing.
      updateField(field, { status: 'pending', error: undefined });

      return new Promise<void>((resolve) => {
        // Cancel any queued save for this field.
        const prior = pendingRef.current.get(field);
        if (prior) {
          clearTimeout(prior.timer);
          prior.resolve();
        }

        const timer = setTimeout(async () => {
          pendingRef.current.delete(field);
          await enqueueDispatch(field, value, target);
          resolve();
        }, debounceMs);

        pendingRef.current.set(field, {
          field,
          value,
          target,
          timer,
          resolve,
        });
      });
    },
    [enqueueDispatch, debounceMs, updateField],
  );

  const flush = useCallback(async () => {
    const entries = Array.from(pendingRef.current.values());
    pendingRef.current.clear();
    // Sequential, not Promise.all — see saveChainRef comment for why.
    for (const entry of entries) {
      clearTimeout(entry.timer);
      await enqueueDispatch(entry.field, entry.value, entry.target);
      entry.resolve();
    }
  }, [enqueueDispatch]);

  // Flush any debounced inline edits when the tab hides (browser close,
  // app switch, navigate away). Without this, a save scheduled by a
  // 250ms debounce can drop on the floor if the rep closes the tab
  // within that window — rare, but it does happen.
  useEffect(() => {
    const flushOnHide = () => {
      if (document.visibilityState === 'hidden' && pendingRef.current.size > 0) {
        void flush();
      }
    };
    document.addEventListener('visibilitychange', flushOnHide);
    return () => document.removeEventListener('visibilitychange', flushOnHide);
  }, [flush]);

  // Derived counters that the pill consumes.
  const { pendingCount, lastSavedAt, lastError } = useMemo(() => {
    let count = 0;
    let savedAt = 0;
    let err: string | null = null;
    for (const state of Object.values(fields)) {
      if (state.status === 'pending' || state.status === 'saving') count++;
      if (state.savedAt && state.savedAt > savedAt) savedAt = state.savedAt;
      if (state.status === 'error' && state.error) err = state.error;
    }
    return {
      pendingCount: count,
      lastSavedAt: savedAt || null,
      lastError: err,
    };
  }, [fields]);

  // Auto-clear stale "saved" statuses after 4s so the pill settles back.
  useEffect(() => {
    const staleFields = Object.entries(fields).filter(
      ([, s]) => s.status === 'saved' && s.savedAt && Date.now() - s.savedAt > 4000,
    );
    if (staleFields.length === 0) return;
    const timer = setTimeout(() => {
      setFields((prev) => {
        const next = { ...prev };
        for (const [key] of staleFields) {
          if (next[key]?.status === 'saved') {
            next[key] = { ...next[key], status: 'idle' };
          }
        }
        return next;
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [fields]);

  // Snapshot controllers/pending refs at effect setup so the cleanup
  // closure doesn't reach into mutable refs after unmount.
  useEffect(() => {
    const controllers = controllersRef.current;
    const pending = pendingRef.current;
    return () => {
      controllers.forEach((c) => c.abort());
      pending.forEach((p) => clearTimeout(p.timer));
    };
  }, []);

  const value = useMemo<RecordFieldSaveContextValue>(
    () => ({ fields, pendingCount, lastSavedAt, lastError, save, flush }),
    [fields, pendingCount, lastSavedAt, lastError, save, flush],
  );

  return (
    <RecordFieldSaveContext.Provider value={value}>
      {children}
    </RecordFieldSaveContext.Provider>
  );
}

export function useRecordFieldSave(): RecordFieldSaveContextValue {
  const ctx = useContext(RecordFieldSaveContext);
  if (!ctx) {
    throw new Error(
      'useRecordFieldSave must be used inside <RecordFieldSaveProvider>',
    );
  }
  return ctx;
}

/** Optional variant that returns null instead of throwing — handy for
 *  components that can be rendered with or without inline editing. */
export function useRecordFieldSaveOptional(): RecordFieldSaveContextValue | null {
  return useContext(RecordFieldSaveContext);
}

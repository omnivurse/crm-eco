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

export type FieldSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface FieldSaveState {
  status: FieldSaveStatus;
  /** Last error message, if any. */
  error?: string;
  /** Most recent successful save time. */
  savedAt?: number;
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
      try {
        const payload =
          target === 'data'
            ? { data: { [field]: value } }
            : { [field]: value };
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (updatedAtRef.current) {
          headers['If-Match'] = updatedAtRef.current;
        }
        const res = await fetch(`/api/crm/records/${recordId}`, {
          method: 'PATCH',
          headers,
          credentials: 'same-origin',
          signal: controller.signal,
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          let message = `Save failed (${res.status})`;
          let currentUpdatedAt: string | null = null;
          try {
            const body = await res.json();
            if (body?.error) message = body.error as string;
            if (typeof body?.currentUpdatedAt === 'string') {
              currentUpdatedAt = body.currentUpdatedAt;
            }
          } catch {
            /* ignore */
          }
          if (res.status === 409) {
            message = 'Record was updated elsewhere — reload to retry';
            // Advance our token so the *next* save (for a different
            // field) doesn't also trip the conflict check on stale data.
            if (currentUpdatedAt) updatedAtRef.current = currentUpdatedAt;
            onConflict?.({ field, currentUpdatedAt, value });
          }
          updateField(field, { status: 'error', error: message });
          return;
        }

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
        });
        onSaved?.(field, value);
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        const msg = err instanceof Error ? err.message : 'Unknown error';
        // Network-level failures (no response from the server) get
        // queued for background retry so the rep doesn't lose their
        // typed value when the train tunnel drops Wi-Fi. We still
        // mark the field as "saved" locally — the pill in the topbar
        // surfaces the pending sync state globally.
        const payload =
          target === 'data'
            ? { data: { [field]: value } }
            : { [field]: value };
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (updatedAtRef.current) headers['If-Match'] = updatedAtRef.current;
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
        });
        onSaved?.(field, value);
      } finally {
        controllersRef.current.delete(field);
      }
    },
    [recordId, onSaved, onConflict, updateField],
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
          await dispatchSave(field, value, target);
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
    [dispatchSave, debounceMs, updateField],
  );

  const flush = useCallback(async () => {
    const entries = Array.from(pendingRef.current.values());
    pendingRef.current.clear();
    await Promise.all(
      entries.map(async (entry) => {
        clearTimeout(entry.timer);
        await dispatchSave(entry.field, entry.value, entry.target);
        entry.resolve();
      }),
    );
  }, [dispatchSave]);

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

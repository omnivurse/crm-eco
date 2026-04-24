'use client';

/**
 * RecordDraftAutosave — keeps the new-record form alive across accidental
 * navigation (browser back, tab reopen, refresh).
 *
 * Behavior:
 *   - On mount, reads `sessionStorage["crm:newdraft:<moduleKey>"]` and feeds
 *     the values to `DynamicRecordForm` as `defaultValues`.
 *   - As the user types, debounces value changes and writes them back to
 *     sessionStorage. We use `sessionStorage` (not `localStorage`) so a draft
 *     stays scoped to the current tab/session and never leaks across users
 *     on shared devices.
 *   - Drafts older than `MAX_AGE_MS` (24h) are ignored on restore.
 *   - When the host `<form>` submits, we clear the draft so a successful
 *     creation doesn't reload stale values next time.
 *   - A small banner notifies the user when a draft was restored, with a
 *     "Start over" affordance.
 *
 * This component must live INSIDE the host `<form>` (it auto-attaches to the
 * nearest form for its `submit` listener).
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { DynamicRecordForm } from './DynamicRecordForm';
import type { CrmField, CrmLayout } from '@/lib/crm/types';

const STORAGE_PREFIX = 'crm:newdraft:';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h
const SAVE_DEBOUNCE_MS = 350;

interface DraftPayload {
  updatedAt: number;
  values: Record<string, unknown>;
}

function readDraft(key: string): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftPayload | null;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.updatedAt !== 'number' ||
      typeof parsed.values !== 'object'
    ) {
      return null;
    }
    if (Date.now() - parsed.updatedAt > MAX_AGE_MS) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    if (!parsed.values || Object.keys(parsed.values).length === 0) return null;
    return parsed.values;
  } catch {
    return null;
  }
}

function writeDraft(key: string, values: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    // Skip empty payloads — avoids a `{}` write storm on first mount.
    const hasAnything = Object.values(values).some(
      (v) =>
        v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0),
    );
    if (!hasAnything) {
      window.sessionStorage.removeItem(key);
      return;
    }
    const payload: DraftPayload = { updatedAt: Date.now(), values };
    window.sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Quota / disabled storage — silently ignore. The user still has the
    // in-memory form state.
  }
}

function clearDraft(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

interface RecordDraftAutosaveProps {
  /** Module slug used to namespace the draft (e.g. "leads", "contacts"). */
  moduleKey: string;
  fields: CrmField[];
  layout?: CrmLayout | null;
  /** Optional extra defaults merged BENEATH the restored draft (draft wins). */
  initialDefaults?: Record<string, unknown>;
  /** Optional override of the storage scope (e.g. include orgId for shared devices). */
  storageScope?: string;
}

export function RecordDraftAutosave({
  moduleKey,
  fields,
  layout,
  initialDefaults,
  storageScope,
}: RecordDraftAutosaveProps) {
  const storageKey = useMemo(
    () =>
      `${STORAGE_PREFIX}${storageScope ? `${storageScope}:` : ''}${moduleKey}`,
    [moduleKey, storageScope],
  );

  // We can't render the form until we've checked sessionStorage on the
  // client — react-hook-form snapshots `defaultValues` on mount, so we need
  // them resolved before the first render of `DynamicRecordForm`.
  const [resolvedDefaults, setResolvedDefaults] =
    useState<Record<string, unknown> | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const draft = readDraft(storageKey);
    if (draft) {
      setResolvedDefaults({ ...(initialDefaults ?? {}), ...draft });
      setRestored(true);
    } else {
      setResolvedDefaults({ ...(initialDefaults ?? {}) });
      setRestored(false);
    }
    // We intentionally only run on mount / when the storage key changes.
    // Re-running on `initialDefaults` identity changes would clobber the
    // user's typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Debounced save on every value change.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleValuesChange = useCallback(
    (values: Record<string, unknown>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        writeDraft(storageKey, values);
      }, SAVE_DEBOUNCE_MS);
    },
    [storageKey],
  );

  // Auto-attach to the nearest <form> so a successful submit clears the draft.
  // We use bubbling capture so we win against nested submit handlers.
  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const form = wrapperRef.current?.closest('form');
    if (!form) return;
    const onSubmit = () => clearDraft(storageKey);
    form.addEventListener('submit', onSubmit);
    return () => form.removeEventListener('submit', onSubmit);
  }, [storageKey]);

  const handleStartOver = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    clearDraft(storageKey);
    setRestored(false);
    setResolvedDefaults({ ...(initialDefaults ?? {}) });
  }, [initialDefaults, storageKey]);

  if (resolvedDefaults === null) {
    // Skeleton during the (very brief) hydration check — keeps SSR markup
    // and client markup in sync.
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="h-9 w-48 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        <div className="h-40 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="space-y-3">
      {restored && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-500/10 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <Save className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Draft restored</p>
              <p className="text-xs text-amber-700/80 dark:text-amber-200/80">
                We brought back what you were typing earlier. Saves
                automatically as you go.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleStartOver}
            className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white/70 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-white dark:border-amber-700/40 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20"
          >
            <RotateCcw className="h-3 w-3" />
            Start over
          </button>
        </div>
      )}

      <DynamicRecordForm
        fields={fields}
        layout={layout || undefined}
        readOnly={false}
        embedded
        defaultValues={resolvedDefaults}
        onValuesChange={handleValuesChange}
      />
    </div>
  );
}

export default RecordDraftAutosave;

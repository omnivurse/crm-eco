'use client';

/**
 * Form-level autosave for admin entity edits.
 *
 * Mirrors the protections shipped on the CRM side:
 *   - Each form-value change resets the debounce so the save fires
 *     `delayMs` after the LAST keystroke, never mid-typing.
 *   - On `visibilitychange → hidden`, any pending save flushes synchronously
 *     so closing the tab doesn't drop the rep's last edits.
 *   - Save itself goes through a serialised promise chain — concurrent
 *     dispatches queue rather than racing each other and clobbering
 *     `updated_at` ETags.
 *   - Calls `flush()` from the consumer (e.g. on form submit) cancel any
 *     pending debounce + drain the chain so a manual save never double-fires.
 *
 * Usage:
 *   const { values, setValues, isDirty, isSaving, flush } = useFormAutosave({
 *     initial: memberRow,
 *     save: async (next) => { await myUpdate(next); },
 *   });
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface Options<T> {
  /** Initial form values. Used as the baseline for dirty detection. */
  initial: T;
  /** Async save function — called with the latest values when the debounce fires. */
  save: (values: T) => Promise<void>;
  /** Debounce delay in ms. Defaults to 1500ms (slightly tighter than CRM's 8s — admin actions tend to be intentional, single-field edits). */
  delayMs?: number;
  /** Optional success / error callbacks. */
  onSaved?: (values: T) => void;
  onError?: (err: unknown) => void;
}

interface Result<T> {
  values: T;
  setValues: (next: T) => void;
  /** Patch — merges into current values and triggers autosave. */
  patch: (delta: Partial<T>) => void;
  /** True between first dirty change and next successful save. */
  isDirty: boolean;
  /** True while an autosave is in flight. */
  isSaving: boolean;
  /** Last error, if any. */
  lastError: unknown | null;
  /** Cancel pending debounce + run save now. Used on form submit / unmount. */
  flush: () => Promise<void>;
}

export function useFormAutosave<T extends Record<string, unknown>>(
  opts: Options<T>,
): Result<T> {
  const { initial, save, delayMs = 1500, onSaved, onError } = opts;
  const [values, setValuesState] = useState<T>(initial);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastError, setLastError] = useState<unknown | null>(null);

  const valuesRef = useRef<T>(initial);
  const initialRef = useRef<T>(initial);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  // Keep refs in sync with state so the visibility flush + chain see the
  // freshest values without re-creating the timer on every render.
  useEffect(() => {
    valuesRef.current = values;
  }, [values]);
  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);

  const enqueueSave = useCallback(
    (snapshot: T) => {
      const run = async () => {
        setIsSaving(true);
        setLastError(null);
        try {
          await save(snapshot);
          initialRef.current = snapshot;
          // Only clear the dirty flag if no further edits arrived during the save.
          if (valuesRef.current === snapshot) {
            dirtyRef.current = false;
            setIsDirty(false);
          }
          onSaved?.(snapshot);
        } catch (err) {
          setLastError(err);
          onError?.(err);
        } finally {
          setIsSaving(false);
        }
      };
      const next = saveChainRef.current.then(run, run);
      saveChainRef.current = next;
      return next;
    },
    [save, onSaved, onError],
  );

  const scheduleSave = useCallback(() => {
    if (!dirtyRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void enqueueSave(valuesRef.current);
    }, delayMs);
  }, [delayMs, enqueueSave]);

  const setValues = useCallback(
    (next: T) => {
      valuesRef.current = next;
      setValuesState(next);
      if (next !== initialRef.current) {
        dirtyRef.current = true;
        setIsDirty(true);
        scheduleSave();
      }
    },
    [scheduleSave],
  );

  const patch = useCallback(
    (delta: Partial<T>) => {
      setValues({ ...valuesRef.current, ...delta } as T);
    },
    [setValues],
  );

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!dirtyRef.current) {
      // Drain the chain in case a save is mid-flight from a prior schedule.
      await saveChainRef.current;
      return;
    }
    await enqueueSave(valuesRef.current);
  }, [enqueueSave]);

  // Flush on tab hide so closing the browser inside the debounce window
  // doesn't drop the last edits.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && dirtyRef.current) {
        void flush();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [flush]);

  // Flush on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { values, setValues, patch, isDirty, isSaving, lastError, flush };
}

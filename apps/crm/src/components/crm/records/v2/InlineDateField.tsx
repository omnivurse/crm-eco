'use client';

/**
 * InlineDateField — click-to-edit date control for V2 record fields.
 *
 * Uses a visible MM/DD/YYYY text input so reps can type historical DOB years
 * (e.g. spouse born 1965) without fighting the native date picker's year
 * segment. A calendar button still opens the browser picker when preferred.
 */

import { memo, useCallback, useEffect, useId, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { normalizeDateColumnValue } from '@/lib/crm/merge-crm-data-json-to-row';
import {
  CRM_DATE_INPUT_MAX,
  CRM_DATE_INPUT_MIN,
  dateValueToMaskedDraft,
  isCompleteIsoDateInputValue,
  maskDateTyping,
} from '@/lib/crm/date-field-bounds';
import { AlertTriangle, CalendarDays, Check, Loader2 } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  useRecordFieldSave,
  type FieldSaveTarget,
} from '@/hooks/useRecordFieldSave';
import {
  useRecordFieldLocks,
  useFieldLockOwner,
} from '@/hooks/useRecordFieldLocks';
import { LockedFieldBadge } from './LockedFieldBadge';

export interface InlineDateFieldProps {
  field: string;
  value: string | null | undefined;
  /** 'date' for yyyy-MM-dd, 'datetime' for ISO strings. */
  mode?: 'date' | 'datetime';
  target?: FieldSaveTarget;
  readOnly?: boolean;
  placeholder?: string;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  className?: string;
  ariaLabel?: string;
}

function toInputValue(value: string | null | undefined, mode: 'date' | 'datetime'): string {
  if (!value) return '';
  if (mode === 'date') {
    return normalizeDateColumnValue(value) ?? '';
  }
  try {
    const d = typeof value === 'string' ? parseISO(value) : new Date(value);
    if (isNaN(d.getTime())) return '';
    return format(d, "yyyy-MM-dd'T'HH:mm");
  } catch {
    return '';
  }
}

function toDisplay(value: string | null | undefined, mode: 'date' | 'datetime'): string | null {
  if (!value) return null;
  if (mode === 'date') {
    const iso = normalizeDateColumnValue(value);
    if (!iso) return null;
    try {
      const d = parseISO(iso);
      if (isNaN(d.getTime())) return null;
      return format(d, 'MMM d, yyyy');
    } catch {
      return null;
    }
  }
  try {
    const d = typeof value === 'string' ? parseISO(value) : new Date(value);
    if (isNaN(d.getTime())) return null;
    return format(d, 'MMM d, yyyy h:mm a');
  } catch {
    return null;
  }
}

export const InlineDateField = memo(function InlineDateField({
  field,
  value,
  mode = 'date',
  target,
  readOnly,
  placeholder = 'Add date',
  onEditStart,
  onEditEnd,
  className,
  ariaLabel,
}: InlineDateFieldProps) {
  const inputId = useId();
  const pickerRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLInputElement>(null);
  const { save, fields } = useRecordFieldSave();
  const state = fields[field];
  const { acquireFieldLock, releaseFieldLock } = useRecordFieldLocks();
  const lockOwner = useFieldLockOwner(field);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(() =>
    mode === 'date' ? dateValueToMaskedDraft(value) : toInputValue(value, mode),
  );
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(mode === 'date' ? dateValueToMaskedDraft(value) : toInputValue(value, mode));
      setLocalError(null);
    }
  }, [value, mode, editing]);

  const commit = useCallback(
    async (nextRaw: string, opts?: { closeEditor?: boolean }) => {
      const normalized = nextRaw.trim();
      if (!normalized) {
        setLocalError(null);
        if (opts?.closeEditor !== false) {
          setEditing(false);
          onEditEnd?.();
          void releaseFieldLock(field);
        }
        await save(field, null, target ? { target } : undefined);
        return true;
      }

      const iso =
        mode === 'date'
          ? normalizeDateColumnValue(maskDateTyping(normalized))
          : normalized;

      if (!iso) {
        setLocalError('Use MM/DD/YYYY (e.g. 3/15/1965)');
        return false;
      }

      setLocalError(null);
      if (opts?.closeEditor !== false) {
        setEditing(false);
        onEditEnd?.();
        void releaseFieldLock(field);
      }
      await save(field, iso, target ? { target } : undefined);
      return true;
    },
    [save, field, target, onEditEnd, releaseFieldLock, mode],
  );

  const startEditing = useCallback(() => {
    setDraft(mode === 'date' ? dateValueToMaskedDraft(value) : toInputValue(value, mode));
    setLocalError(null);
    setEditing(true);
    onEditStart?.();
    void acquireFieldLock(field);
    queueMicrotask(() => textRef.current?.focus());
  }, [acquireFieldLock, field, mode, onEditStart, value]);

  const cancelEditing = useCallback(() => {
    setDraft(mode === 'date' ? dateValueToMaskedDraft(value) : toInputValue(value, mode));
    setLocalError(null);
    setEditing(false);
    onEditEnd?.();
    void releaseFieldLock(field);
  }, [field, mode, onEditEnd, releaseFieldLock, value]);

  const openCalendarPicker = useCallback(() => {
    const picker = pickerRef.current;
    if (!picker) return;
    if (typeof picker.showPicker === 'function') {
      picker.showPicker();
      return;
    }
    picker.focus();
    picker.click();
  }, []);

  if (readOnly || lockOwner) {
    const display = toDisplay(value, mode);
    return (
      <span
        className={cn('inline-flex items-center gap-1.5', className)}
        data-field={field}
        title={
          lockOwner
            ? `${lockOwner.fullName || lockOwner.email || 'Someone'} is editing this field`
            : undefined
        }
      >
        {display ? (
          <span className="text-sm text-slate-700 dark:text-slate-200">{display}</span>
        ) : (
          <span className="text-sm text-slate-400 italic">{placeholder}</span>
        )}
        {lockOwner ? <LockedFieldBadge owner={lockOwner} /> : null}
      </span>
    );
  }

  const displayLabel = toDisplay(
    state?.lastValue !== undefined &&
      (state.status === 'saved' || state.status === 'pending' || state.status === 'saving')
      ? (state.lastValue as string | null)
      : value,
    mode,
  );
  const pickerValue = normalizeDateColumnValue(
    state?.lastValue !== undefined &&
      (state.status === 'saved' || state.status === 'pending' || state.status === 'saving')
      ? (state.lastValue as string | null)
      : value,
  ) ?? '';

  if (editing) {
    return (
      <span
        className={cn('inline-flex flex-col gap-1 min-w-[10rem]', className)}
        data-no-hotkeys
        data-field={field}
      >
        <span className="inline-flex items-center gap-1">
          <input
            ref={textRef}
            id={inputId}
            type="text"
            inputMode="numeric"
            autoComplete="bday"
            placeholder="MM/DD/YYYY"
            value={draft}
            onChange={(e) => {
              // Store raw keystrokes; formatting to MM/DD/YYYY happens on
              // commit (blur/Enter) to avoid caret jumps during typing.
              setDraft(e.target.value);
              setLocalError(null);
            }}
            onBlur={() => {
              void commit(draft);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void commit(draft);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEditing();
              }
            }}
            className={cn(
              'h-8 min-w-[9rem] rounded-md border bg-white dark:bg-slate-900 px-2 text-sm',
              'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30',
              (localError || state?.status === 'error') && 'border-rose-400',
            )}
            aria-label={ariaLabel ?? field}
          />
          {mode === 'date' && (
            <>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={openCalendarPicker}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-teal-600"
                title="Open calendar"
                aria-label={`Open calendar for ${ariaLabel ?? field}`}
              >
                <CalendarDays className="w-4 h-4" />
              </button>
              <input
                ref={pickerRef}
                type="date"
                tabIndex={-1}
                aria-hidden
                className="sr-only"
                min={CRM_DATE_INPUT_MIN}
                max={CRM_DATE_INPUT_MAX}
                value={pickerValue}
                onChange={(e) => {
                  const next = e.target.value;
                  if (!isCompleteIsoDateInputValue(next)) return;
                  setDraft(dateValueToMaskedDraft(next));
                  void commit(next);
                }}
              />
            </>
          )}
          {state?.status === 'saving' || state?.status === 'pending' ? (
            <Loader2 className="w-3 h-3 text-teal-500 animate-spin" />
          ) : state?.status === 'saved' ? (
            <Check className="w-3 h-3 text-emerald-500" />
          ) : null}
        </span>
        {(localError || state?.status === 'error') && (
          <span className="text-xs text-rose-500">{localError ?? state?.error}</span>
        )}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1 -mx-1 text-left',
        'hover:bg-slate-100/70 dark:hover:bg-white/5 transition-colors cursor-pointer',
        className,
      )}
      data-no-hotkeys
      data-field={field}
      aria-label={ariaLabel ?? `Edit ${field}`}
    >
      <CalendarDays className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
      {displayLabel ? (
        <span className="text-sm text-slate-700 dark:text-slate-200">{displayLabel}</span>
      ) : (
        <span className="text-sm text-slate-400 italic">{placeholder}</span>
      )}
      {state?.status === 'error' ? (
        <AlertTriangle className="w-3 h-3 text-rose-500" />
      ) : null}
    </button>
  );
});

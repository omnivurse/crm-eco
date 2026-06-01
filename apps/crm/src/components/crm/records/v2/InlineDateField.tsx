'use client';

/**
 * InlineDateField — click-to-edit date / datetime control. Reuses the
 * native browser picker for the actual input affordance so mobile + a11y
 * are free, and wraps save dispatch / status feedback identically to the
 * text + select inline editors.
 */

import { memo, useCallback, useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { normalizeDateColumnValue } from '@/lib/crm/merge-crm-data-json-to-row';
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
  const { save, fields } = useRecordFieldSave();
  const state = fields[field];
  const { acquireFieldLock, releaseFieldLock } = useRecordFieldLocks();
  const lockOwner = useFieldLockOwner(field);
  const [draft, setDraft] = useState<string>(toInputValue(value, mode));

  useEffect(() => {
    setDraft(toInputValue(value, mode));
  }, [value, mode]);

  const commit = useCallback(
    async (nextRaw: string) => {
      const normalized = nextRaw.trim();
      // For dates, keep the yyyy-MM-dd shape; for datetime, let the browser's
      // value be the canonical ISO-like form (Postgres accepts it).
      const payload = normalized ? normalized : null;
      onEditEnd?.();
      void releaseFieldLock(field);
      await save(field, payload, target ? { target } : undefined);
    },
    [save, field, target, onEditEnd, releaseFieldLock],
  );

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

  const displayLabel = toDisplay(value, mode);

  return (
    <span
      className={cn(
        'relative inline-flex items-center gap-1 rounded-md px-1 -mx-1',
        'hover:bg-slate-100/70 dark:hover:bg-white/5 transition-colors cursor-pointer',
        state?.status === 'error' && 'ring-1 ring-rose-300',
        className,
      )}
      data-no-hotkeys
      data-field={field}
      title={state?.status === 'error' ? state.error : undefined}
    >
      <CalendarDays className="w-3.5 h-3.5 text-slate-400 pointer-events-none" />
      {displayLabel ? (
        <span className="text-sm text-slate-700 dark:text-slate-200 pointer-events-none">
          {displayLabel}
        </span>
      ) : (
        <span className="text-sm text-slate-400 italic pointer-events-none">
          {placeholder}
        </span>
      )}
      <input
        type={mode === 'datetime' ? 'datetime-local' : 'date'}
        className="absolute inset-0 opacity-0 cursor-pointer"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          void commit(e.target.value);
        }}
        onFocus={() => {
          onEditStart?.();
          void acquireFieldLock(field);
        }}
        onBlur={() => {
          onEditEnd?.();
          void releaseFieldLock(field);
        }}
        aria-label={ariaLabel ?? field}
      />
      {state?.status === 'saving' || state?.status === 'pending' ? (
        <Loader2 className="w-3 h-3 text-teal-500 animate-spin" />
      ) : state?.status === 'error' ? (
        <AlertTriangle className="w-3 h-3 text-rose-500" />
      ) : state?.status === 'saved' ? (
        <Check className="w-3 h-3 text-emerald-500" />
      ) : null}
    </span>
  );
});

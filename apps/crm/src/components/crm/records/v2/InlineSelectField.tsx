'use client';

/**
 * InlineSelectField — click-to-edit dropdown for select / picklist fields.
 *
 * Paired with `RecordFieldSaveProvider` so every change plugs into the
 * same debounced save queue that the text editor uses. Uses the native
 * `<select>` in a single-step flow: one click opens the picker and a
 * selection both commits and dispatches the save.
 */

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@crm-eco/ui/components/badge';
import { cn } from '@crm-eco/ui/lib/utils';
import { AlertTriangle, Check, ChevronDown, Loader2, X } from 'lucide-react';
import { useRecordFieldSave, type FieldSaveTarget } from '@/hooks/useRecordFieldSave';
import { useRecordFieldLocks, useFieldLockOwner } from '@/hooks/useRecordFieldLocks';
import { LockedFieldBadge } from './LockedFieldBadge';

export interface InlineSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface InlineSelectFieldProps {
  field: string;
  value: string | null | undefined;
  options: InlineSelectOption[];
  target?: FieldSaveTarget;
  readOnly?: boolean;
  placeholder?: string;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  className?: string;
  ariaLabel?: string;
}

export const InlineSelectField = memo(function InlineSelectField({
  field,
  value,
  options,
  target,
  readOnly,
  placeholder = '— Select —',
  onEditStart,
  onEditEnd,
  className,
  ariaLabel,
}: InlineSelectFieldProps) {
  const { save, fields } = useRecordFieldSave();
  const state = fields[field];
  const { acquireFieldLock, releaseFieldLock } = useRecordFieldLocks();
  const lockOwner = useFieldLockOwner(field);
  /** Shown immediately on change; resets from server props on refresh or on save error */
  const [pick, setPick] = useState<string | null | undefined>(value);

  useEffect(() => {
    setPick(value);
  }, [value]);

  useEffect(() => {
    if (state?.status === 'error') {
      setPick(value);
    }
  }, [state?.status, value, state?.error]);

  /** Editable overlay: optimistic pick so UI updates before refresh */
  const pickLabel = useMemo(() => {
    const found = options.find((o) => o.value === pick);
    return found?.label ?? (pick ? String(pick) : null);
  }, [options, pick]);

  /** Read-only / locked: always reflect server-provided value, not local pick */
  const serverLabel = useMemo(() => {
    const found = options.find((o) => o.value === value);
    return found?.label ?? (value ? String(value) : null);
  }, [options, value]);

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const next = e.target.value || null;
      if (next === (pick ?? '')) return;
      onEditEnd?.();
      void releaseFieldLock(field);
      setPick(next);
      await save(field, next, target ? { target } : undefined);
    },
    [save, field, target, pick, onEditEnd, releaseFieldLock]
  );

  if (readOnly || lockOwner) {
    return (
      <span
        className={cn('inline-flex max-w-full min-w-0 items-center gap-1.5', className)}
        data-field={field}
        title={
          lockOwner
            ? `${lockOwner.fullName || lockOwner.email || 'Someone'} is editing this field`
            : serverLabel || undefined
        }
      >
        {serverLabel ? (
          <Badge
            variant="secondary"
            className="min-w-0 max-w-full truncate font-normal"
          >
            {serverLabel}
          </Badge>
        ) : (
          <span className="text-sm text-slate-400 italic">{placeholder}</span>
        )}
        {lockOwner ? <LockedFieldBadge owner={lockOwner} /> : null}
      </span>
    );
  }

  const handleClear = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setPick(null);
      await save(field, null, target ? { target } : undefined);
    },
    [save, field, target],
  );

  return (
    <span
      className={cn(
        'relative z-10 flex w-full min-w-0 max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 -mx-1',
        'hover:bg-slate-100/70 dark:hover:bg-white/5 transition-colors',
        'focus-within:z-30',
        state?.status === 'error' && 'ring-1 ring-rose-300',
        className
      )}
      data-no-hotkeys
      data-field={field}
      title={state?.status === 'error' ? state.error : pickLabel || undefined}
    >
      {pickLabel ? (
        <Badge
          variant="secondary"
          className="min-w-0 flex-1 truncate font-normal pointer-events-none"
        >
          {pickLabel}
        </Badge>
      ) : (
        <span className="min-w-0 truncate text-sm text-slate-400 italic pointer-events-none">
          {placeholder}
        </span>
      )}
      {/* Clear button — visible when a value is set */}
      {pick && (
        <button
          type="button"
          onClick={handleClear}
          className="relative z-10 shrink-0 rounded p-0.5 text-slate-400 hover:text-rose-500 hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors"
          aria-label="Clear selection"
        >
          <X className="w-3 h-3" />
        </button>
      )}
      <ChevronDown className="h-3 w-3 shrink-0 text-slate-400 pointer-events-none" />
      <select
        className="absolute inset-0 cursor-pointer opacity-0"
        value={pick ?? ''}
        onChange={handleChange}
        onFocus={() => {
          onEditStart?.();
          void acquireFieldLock(field);
        }}
        onBlur={() => {
          onEditEnd?.();
          void releaseFieldLock(field);
        }}
        aria-label={ariaLabel ?? field}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      {state?.status === 'saving' || state?.status === 'pending' ? (
        <Loader2 className="h-3 w-3 shrink-0 animate-spin text-teal-500" />
      ) : state?.status === 'error' ? (
        <AlertTriangle className="h-3 w-3 shrink-0 text-rose-500" />
      ) : state?.status === 'saved' ? (
        <Check className="h-3 w-3 shrink-0 text-emerald-500" />
      ) : null}
    </span>
  );
});

'use client';

/**
 * InlineSelectField — click-to-edit dropdown for select / picklist fields.
 *
 * Paired with `RecordFieldSaveProvider` so every change plugs into the
 * same debounced save queue that the text editor uses. Uses the native
 * `<select>` in a single-step flow: one click opens the picker and a
 * selection both commits and dispatches the save.
 */

import { memo, useCallback, useMemo } from 'react';
import { Badge } from '@crm-eco/ui/components/badge';
import { cn } from '@crm-eco/ui/lib/utils';
import { AlertTriangle, Check, ChevronDown, Loader2 } from 'lucide-react';
import {
  useRecordFieldSave,
  type FieldSaveTarget,
} from '@/hooks/useRecordFieldSave';
import {
  useRecordFieldLocks,
  useFieldLockOwner,
} from '@/hooks/useRecordFieldLocks';
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
  const currentLabel = useMemo(() => {
    const found = options.find((o) => o.value === value);
    return found?.label ?? (value ? String(value) : null);
  }, [options, value]);

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const next = e.target.value || null;
      if (next === (value ?? '')) return;
      onEditEnd?.();
      void releaseFieldLock(field);
      await save(field, next, target ? { target } : undefined);
    },
    [save, field, target, value, onEditEnd, releaseFieldLock],
  );

  if (readOnly || lockOwner) {
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
        {currentLabel ? (
          <Badge variant="secondary" className="font-normal">
            {currentLabel}
          </Badge>
        ) : (
          <span className="text-sm text-slate-400 italic">{placeholder}</span>
        )}
        {lockOwner ? <LockedFieldBadge owner={lockOwner} /> : null}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'relative inline-flex items-center gap-1 rounded-md px-1 -mx-1',
        'hover:bg-slate-100/70 dark:hover:bg-white/5 transition-colors',
        state?.status === 'error' && 'ring-1 ring-rose-300',
        className,
      )}
      data-no-hotkeys
      data-field={field}
      title={state?.status === 'error' ? state.error : undefined}
    >
      {currentLabel ? (
        <Badge variant="secondary" className="font-normal pointer-events-none">
          {currentLabel}
        </Badge>
      ) : (
        <span className="text-sm text-slate-400 italic pointer-events-none">
          {placeholder}
        </span>
      )}
      <ChevronDown className="w-3 h-3 text-slate-400 pointer-events-none" />
      <select
        className="absolute inset-0 opacity-0 cursor-pointer"
        value={value ?? ''}
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
        <Loader2 className="w-3 h-3 text-teal-500 animate-spin" />
      ) : state?.status === 'error' ? (
        <AlertTriangle className="w-3 h-3 text-rose-500" />
      ) : state?.status === 'saved' ? (
        <Check className="w-3 h-3 text-emerald-500" />
      ) : null}
    </span>
  );
});

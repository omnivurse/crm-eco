'use client';

/**
 * InlineBooleanField — click-to-toggle switch for boolean fields.
 * Optimistically flips the local state and dispatches through the shared
 * save context; status indicators mirror the other inline editors.
 */

import { memo, useCallback, useState, useEffect } from 'react';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
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

export interface InlineBooleanFieldProps {
  field: string;
  value: boolean | null | undefined;
  target?: FieldSaveTarget;
  readOnly?: boolean;
  labels?: { on: string; off: string };
  onEditStart?: () => void;
  onEditEnd?: () => void;
  className?: string;
  ariaLabel?: string;
}

export const InlineBooleanField = memo(function InlineBooleanField({
  field,
  value,
  target,
  readOnly,
  labels = { on: 'Yes', off: 'No' },
  onEditStart,
  onEditEnd,
  className,
  ariaLabel,
}: InlineBooleanFieldProps) {
  const { save, fields } = useRecordFieldSave();
  const state = fields[field];
  const { acquireFieldLock, releaseFieldLock } = useRecordFieldLocks();
  const lockOwner = useFieldLockOwner(field);
  const [local, setLocal] = useState<boolean>(!!value);

  useEffect(() => {
    setLocal(!!value);
  }, [value]);

  const onToggle = useCallback(async () => {
    if (readOnly || lockOwner) return;
    const next = !local;
    setLocal(next);
    onEditStart?.();
    void acquireFieldLock(field);
    await save(field, next, target ? { target } : undefined);
    onEditEnd?.();
    void releaseFieldLock(field);
  }, [local, readOnly, lockOwner, save, field, target, onEditStart, onEditEnd, acquireFieldLock, releaseFieldLock]);

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
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full w-2 h-2',
            local ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600',
          )}
        />
        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {local ? labels.on : labels.off}
        </span>
        {lockOwner ? <LockedFieldBadge owner={lockOwner} /> : null}
      </span>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={local}
      aria-label={ariaLabel ?? field}
      onClick={onToggle}
      data-no-hotkeys
      data-field={field}
      title={state?.status === 'error' ? state.error : undefined}
      className={cn(
        'inline-flex items-center gap-2 rounded-md px-1 -mx-1 cursor-pointer',
        'hover:bg-slate-100/70 dark:hover:bg-white/5 transition-colors',
        state?.status === 'error' && 'ring-1 ring-rose-300',
        className,
      )}
    >
      <span
        className={cn(
          'relative inline-block h-4 w-7 rounded-full transition-colors',
          local ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all',
            local ? 'left-[14px]' : 'left-0.5',
          )}
        />
      </span>
      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
        {local ? labels.on : labels.off}
      </span>
      {state?.status === 'saving' || state?.status === 'pending' ? (
        <Loader2 className="w-3 h-3 text-teal-500 animate-spin" />
      ) : state?.status === 'error' ? (
        <AlertTriangle className="w-3 h-3 text-rose-500" />
      ) : state?.status === 'saved' ? (
        <Check className="w-3 h-3 text-emerald-500" />
      ) : null}
    </button>
  );
});

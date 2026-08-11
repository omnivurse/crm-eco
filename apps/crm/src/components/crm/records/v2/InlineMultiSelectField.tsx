'use client';

/**
 * InlineMultiSelectField — click-to-edit multi-select rendered as tag
 * pills. Each value is a removable chip; a compact "+ Add" popover lets
 * the user toggle the remaining options.
 *
 * We save the entire array on every change (add / remove) because the
 * underlying field is a JSONB list — partial updates aren't meaningful.
 * Lock-aware and status-aware like the other V2 inline editors.
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@crm-eco/ui/components/badge';
import { cn } from '@crm-eco/ui/lib/utils';
import { AlertTriangle, Check, Loader2, Plus, X } from 'lucide-react';
import {
  useRecordFieldSave,
  type FieldSaveTarget,
} from '@/hooks/useRecordFieldSave';
import {
  useRecordFieldLocks,
  useFieldLockOwner,
} from '@/hooks/useRecordFieldLocks';
import { LockedFieldBadge } from './LockedFieldBadge';

export interface InlineMultiSelectFieldProps {
  field: string;
  value: string[] | null | undefined;
  options: string[];
  target?: FieldSaveTarget;
  readOnly?: boolean;
  placeholder?: string;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  className?: string;
  ariaLabel?: string;
}

export const InlineMultiSelectField = memo(function InlineMultiSelectField({
  field,
  value,
  options,
  target,
  readOnly,
  placeholder = 'Add options',
  onEditStart,
  onEditEnd,
  className,
  ariaLabel,
}: InlineMultiSelectFieldProps) {
  const { save, fields } = useRecordFieldSave();
  const state = fields[field];
  const { acquireFieldLock, releaseFieldLock } = useRecordFieldLocks();
  const lockOwner = useFieldLockOwner(field);

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const selected = Array.isArray(value) ? value : [];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        onEditEnd?.();
        void releaseFieldLock(field);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onEditEnd, releaseFieldLock, field]);

  const persist = useCallback(
    async (next: string[]) => {
      await save(field, next, target ? { target } : undefined);
    },
    [save, field, target],
  );

  const handleRemove = useCallback(
    async (opt: string) => {
      if (readOnly || lockOwner) return;
      const next = selected.filter((v) => v !== opt);
      await persist(next);
    },
    [readOnly, lockOwner, selected, persist],
  );

  const handleToggle = useCallback(
    async (opt: string) => {
      if (readOnly || lockOwner) return;
      const next = selected.includes(opt)
        ? selected.filter((v) => v !== opt)
        : [...selected, opt];
      await persist(next);
    },
    [readOnly, lockOwner, selected, persist],
  );

  const openPicker = () => {
    if (readOnly || lockOwner) return;
    setOpen(true);
    onEditStart?.();
    void acquireFieldLock(field);
  };

  if (readOnly || lockOwner) {
    return (
      <span
        className={cn('inline-flex flex-wrap items-center gap-1.5', className)}
        data-field={field}
        title={
          lockOwner
            ? `${lockOwner.fullName || lockOwner.email || 'Someone'} is editing this field`
            : undefined
        }
      >
        {selected.length === 0 ? (
          <span className="text-sm text-slate-400 italic">{placeholder}</span>
        ) : (
          selected.map((v) => (
            <Badge key={v} variant="secondary" className="font-normal">
              {v}
            </Badge>
          ))
        )}
        {lockOwner ? <LockedFieldBadge owner={lockOwner} /> : null}
      </span>
    );
  }

  return (
    <span
      ref={containerRef}
      className={cn(
        'relative z-10 flex w-full min-w-0 max-w-full flex-wrap items-center gap-1 rounded-md px-1.5 py-0.5 -mx-1',
        'hover:bg-slate-100/70 dark:hover:bg-white/5 transition-colors',
        open && 'z-30',
        state?.status === 'error' && 'ring-1 ring-rose-300',
        className,
      )}
      data-no-hotkeys
      data-field={field}
      title={state?.status === 'error' ? state.error : undefined}
    >
      {selected.length === 0 ? (
        <span className="min-w-0 truncate text-sm text-slate-400 italic">{placeholder}</span>
      ) : (
        selected.map((v) => (
          <Badge
            key={v}
            variant="secondary"
            className="font-normal gap-1 pr-1"
          >
            {v}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleRemove(v);
              }}
              className="inline-flex items-center justify-center rounded-sm hover:bg-slate-300/70 dark:hover:bg-white/10"
              aria-label={`Remove ${v}`}
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))
      )}
      <button
        type="button"
        onClick={openPicker}
        aria-label={ariaLabel ? `Edit ${ariaLabel}` : `Edit ${field}`}
        className="inline-flex items-center gap-0.5 rounded-md border border-dashed border-slate-300 dark:border-slate-600 px-1.5 py-0.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-400"
      >
        <Plus className="w-3 h-3" />
        Add
      </button>

      {state?.status === 'saving' || state?.status === 'pending' ? (
        <Loader2 className="w-3 h-3 text-teal-500 animate-spin" />
      ) : state?.status === 'error' ? (
        <AlertTriangle className="w-3 h-3 text-rose-500" />
      ) : state?.status === 'saved' ? (
        <Check className="w-3 h-3 text-emerald-500" />
      ) : null}

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[12rem] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1 max-h-60 overflow-y-auto">
          {options.length === 0 ? (
            <div className="p-2 text-xs text-slate-500 text-center">
              No options defined
            </div>
          ) : (
            options.map((opt) => {
              const active = selected.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => void handleToggle(opt)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left',
                    'hover:bg-slate-100 dark:hover:bg-slate-800',
                    active && 'text-teal-700 dark:text-teal-300',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex h-4 w-4 items-center justify-center rounded border',
                      active
                        ? 'bg-teal-500 border-teal-500 text-white'
                        : 'border-slate-300 dark:border-slate-600',
                    )}
                  >
                    {active ? <Check className="h-3 w-3" /> : null}
                  </span>
                  <span className="truncate">{opt}</span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </span>
  );
});

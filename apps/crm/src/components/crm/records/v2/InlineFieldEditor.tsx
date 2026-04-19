'use client';

/**
 * InlineFieldEditor — lightweight click-to-edit primitive for V2.
 *
 * Behaviour:
 *   - Renders the current value in "display" mode with a subtle edit
 *     affordance that appears on hover.
 *   - Click (or focus + Enter) enters "edit" mode with a bordered input
 *     and auto-selected text.
 *   - Blur commits the edit; Enter commits; Escape cancels.
 *   - While a save is in flight (or pending debounce), the editor shows
 *     a spinner; on error it shows an inline message with a retry button.
 *   - Integrates with `RecordFieldSaveProvider` so the header pill
 *     aggregates dirty state across editors.
 *
 * Not intended for complex field types — use the existing
 * DynamicRecordForm for selects, rich text, relations, etc. This is for
 * the simple text-ish header / spotlight fields (title, email, phone,
 * owner-esque rows) where round-tripping to a modal is heavy.
 */

import {
  memo,
  useCallback,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { AlertTriangle, Check, Loader2, Pencil, X } from 'lucide-react';
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
import { AiSuggestChip } from './AiSuggestChip';
import { useRecordAiContext } from './RecordAiContext';

export type InlineFieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'number'
  | 'url'
  | 'textarea';

export interface InlineFieldEditorProps {
  /** The record column / JSONB key that should be PATCHed. */
  field: string;
  /** Current value from the record. */
  value: string | number | null | undefined;
  /** Input type — drives validation + keyboard. */
  type?: InlineFieldType;
  /** Where the field lives on the record (row column or JSONB data). */
  target?: FieldSaveTarget;
  /** Placeholder when the value is empty. */
  placeholder?: string;
  /** Render the display value as a custom node (e.g. a mailto: link). */
  display?: (value: string | number | null | undefined) => ReactNode;
  /** Disable editing — falls back to a plain display row. */
  readOnly?: boolean;
  /** Called whenever focus enters edit mode. Useful for presence intent. */
  onEditStart?: () => void;
  /** Called whenever edit mode ends (commit OR cancel). */
  onEditEnd?: () => void;
  /**
   * Validate value before dispatching. Return a string to surface an
   * inline error and reject the save. Return null / undefined to accept.
   */
  validate?: (value: string) => string | null | undefined;
  className?: string;
  inputClassName?: string;
  /** aria-label for the edit input. Defaults to the field key. */
  ariaLabel?: string;
}

export const InlineFieldEditor = memo(function InlineFieldEditor({
  field,
  value,
  type = 'text',
  target,
  placeholder = 'Click to edit',
  display,
  readOnly,
  onEditStart,
  onEditEnd,
  validate,
  className,
  inputClassName,
  ariaLabel,
}: InlineFieldEditorProps) {
  const { save, fields } = useRecordFieldSave();
  const fieldState = fields[field];
  const { acquireFieldLock, releaseFieldLock } = useRecordFieldLocks();
  const lockOwner = useFieldLockOwner(field);
  const aiCtx = useRecordAiContext();
  const uid = useId();

  const aiSupported = type === 'text' || type === 'textarea' || type === 'email';
  const showAiChip =
    aiSupported && !!aiCtx && aiCtx.enabled && !readOnly;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(stringify(value));
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const isTextarea = type === 'textarea';

  // Keep local draft in sync when the parent value changes (e.g. after
  // a realtime update from another user). Uses React's recommended
  // "storing information from previous renders" pattern instead of an
  // effect, so we never trigger a follow-up render after commit.
  const [lastSyncedValue, setLastSyncedValue] = useState(value);
  if (!editing && value !== lastSyncedValue) {
    setLastSyncedValue(value);
    setDraft(stringify(value));
  }

  const enterEdit = useCallback(() => {
    if (readOnly || lockOwner) return;
    setDraft(stringify(value));
    setLocalError(null);
    setEditing(true);
    onEditStart?.();
    void acquireFieldLock(field);
  }, [readOnly, lockOwner, value, onEditStart, acquireFieldLock, field]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setLocalError(null);
    setDraft(stringify(value));
    onEditEnd?.();
    void releaseFieldLock(field);
  }, [value, onEditEnd, releaseFieldLock, field]);

  const commit = useCallback(async () => {
    const trimmed = draft.trim();
    if (trimmed === stringify(value).trim()) {
      setEditing(false);
      onEditEnd?.();
      return;
    }
    const validationError = validate?.(trimmed);
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    // Coerce back to the input's logical type.
    const payload: unknown =
      type === 'number'
        ? trimmed === ''
          ? null
          : Number(trimmed)
        : trimmed === ''
          ? null
          : trimmed;

    setEditing(false);
    onEditEnd?.();
    void releaseFieldLock(field);
    await save(field, payload, target ? { target } : undefined);
  }, [draft, value, validate, type, save, field, onEditEnd, target, releaseFieldLock]);

  const onKey = (
    e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (e.key === 'Enter' && !e.shiftKey && !isTextarea) {
      // In textarea mode, plain Enter inserts a newline. Ctrl/Cmd+Enter
      // (or the blur handler) commits.
      e.preventDefault();
      void commit();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && isTextarea) {
      e.preventDefault();
      void commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  // Surface global save errors for this field.
  const externalError = fieldState?.status === 'error' ? fieldState.error : null;
  const isSaving = fieldState?.status === 'saving';
  const isPending = fieldState?.status === 'pending';
  const isSaved = fieldState?.status === 'saved';

  if (readOnly) {
    return (
      <span className={cn('inline-flex items-center', className)}>
        {display ? display(value) : <DisplayValue value={value} placeholder={placeholder} />}
      </span>
    );
  }

  if (lockOwner) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-1 -mx-1 cursor-not-allowed',
          'bg-amber-50/40 dark:bg-amber-500/5',
          className,
        )}
        data-field={field}
        data-locked-by={lockOwner.userId}
        title={`${lockOwner.fullName || lockOwner.email || 'Someone'} is editing this field`}
      >
        {display ? display(value) : <DisplayValue value={value} placeholder={placeholder} />}
        <LockedFieldBadge owner={lockOwner} />
      </span>
    );
  }

  if (!editing) {
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={enterEdit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            enterEdit();
          }
        }}
        aria-label={`Edit ${ariaLabel ?? field}`}
        className={cn(
          'group inline-flex items-center gap-1 rounded-md px-1 -mx-1 cursor-text',
          'hover:bg-slate-100/70 dark:hover:bg-white/5 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
          (isSaving || isPending) && 'opacity-80',
          externalError && 'ring-1 ring-rose-300 dark:ring-rose-500/50 bg-rose-50/50 dark:bg-rose-500/5',
          className,
        )}
        data-field={field}
        title={externalError ?? undefined}
      >
        {display ? display(value) : <DisplayValue value={value} placeholder={placeholder} />}
        {isSaving || isPending ? (
          <Loader2 className="w-3 h-3 text-teal-500 animate-spin shrink-0" />
        ) : externalError ? (
          <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
        ) : isSaved ? (
          <Check className="w-3 h-3 text-emerald-500 shrink-0" />
        ) : (
          <Pencil className="w-3 h-3 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        )}
      </span>
    );
  }

  const sharedEditProps = {
    id: `inline-${uid}`,
    value: draft,
    onChange: (
      e:
        | React.ChangeEvent<HTMLInputElement>
        | React.ChangeEvent<HTMLTextAreaElement>,
    ) => {
      setDraft(e.target.value);
      if (localError) setLocalError(null);
    },
    onBlur: () => {
      void commit();
    },
    onKeyDown: onKey,
    'aria-label': ariaLabel ?? field,
    'aria-invalid': !!localError,
  };

  return (
    <span
      className={cn(
        isTextarea ? 'flex flex-col gap-1' : 'inline-flex items-center gap-1',
        className,
      )}
      data-no-hotkeys
    >
      {isTextarea ? (
        <textarea
          ref={(el) => {
            inputRef.current = el;
            if (el) {
              queueMicrotask(() => {
                el.focus();
                el.select();
              });
            }
          }}
          rows={3}
          {...sharedEditProps}
          className={cn(
            'min-w-0 w-full rounded-md border border-teal-400 dark:border-teal-500/60 bg-white dark:bg-slate-900',
            'px-2 py-1 text-sm text-slate-900 dark:text-slate-100',
            'shadow-sm outline-none ring-2 ring-teal-500/20 resize-y',
            inputClassName,
          )}
        />
      ) : (
        <input
          ref={(el) => {
            inputRef.current = el;
            if (el) {
              queueMicrotask(() => {
                el.focus();
                el.select();
              });
            }
          }}
          type={type}
          {...sharedEditProps}
          className={cn(
            'min-w-0 rounded-md border border-teal-400 dark:border-teal-500/60 bg-white dark:bg-slate-900',
            'px-1.5 py-0.5 text-sm text-slate-900 dark:text-slate-100',
            'shadow-sm outline-none ring-2 ring-teal-500/20',
            inputClassName,
          )}
        />
      )}
      {showAiChip && aiCtx ? (
        <AiSuggestChip
          recordId={aiCtx.recordId}
          fieldKey={field}
          fieldLabel={ariaLabel ?? field}
          fieldType={type}
          currentValue={draft}
          onSuggest={(suggestion) => {
            setDraft(suggestion);
            setLocalError(null);
            queueMicrotask(() => inputRef.current?.focus());
          }}
        />
      ) : null}
      <button
        type="button"
        onMouseDown={(e) => {
          // Prevent the input's blur from racing our click.
          e.preventDefault();
        }}
        onClick={cancelEdit}
        className="p-0.5 rounded text-slate-400 hover:text-rose-500"
        aria-label="Cancel edit"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      {localError && (
        <span
          role="alert"
          className="ml-1 text-[10px] font-medium text-rose-600 dark:text-rose-400"
        >
          {localError}
        </span>
      )}
    </span>
  );
});

function DisplayValue({
  value,
  placeholder,
}: {
  value: string | number | null | undefined;
  placeholder: string;
}) {
  const s = stringify(value);
  if (!s) {
    return (
      <span className="text-sm text-slate-400 dark:text-slate-500 italic">
        {placeholder}
      </span>
    );
  }
  return <span>{s}</span>;
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  return String(v);
}

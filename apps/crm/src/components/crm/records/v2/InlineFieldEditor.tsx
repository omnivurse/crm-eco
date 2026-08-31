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
  useEffect,
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
import { serverHasCaughtUp } from '../InlineEditableRecordForm';
import { LockedFieldBadge } from './LockedFieldBadge';
import { AiSuggestChip } from './AiSuggestChip';
import { useRecordAiContext } from './RecordAiContext';
import {
  isValidCurrencyTyping,
  parseCurrencyInput,
} from '@/lib/crm/currency-input';

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
  /** When set (e.g. 2 for USD), allows typing up to that many decimal places. */
  moneyDecimals?: number;
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
  moneyDecimals,
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
  const focusInitialisedRef = useRef(false);
  // A11Y-1: leaving edit mode from the keyboard (Escape / Enter) must hand
  // focus back to the trigger, not drop it on <body> — a keyboard user who
  // cancels an edit would otherwise restart tabbing from the top of the page.
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const restoreFocusRef = useRef(false);
  // A11Y-1: some callers render the value as a real link (tel:/mailto:). A
  // widget (role="button") may not contain focusable descendants — axe flags
  // it `nested-interactive` and AT cannot reach the link inside it. When the
  // rendered value turns out to be interactive, the wrapper stops claiming to
  // be a button and the pencil becomes the real, named edit control.
  const [interactiveDisplay, setInteractiveDisplay] = useState(false);
  const isTextarea = type === 'textarea';

  // Stable ref callback that focus + selects ONCE when the input mounts,
  // not on every render. The previous inline `(el) => { ... el.focus();
  // el.select() }` ran on every keystroke (React re-fires ref callbacks
  // when the function identity changes), so each keystroke select-all'd
  // the input and the next character replaced the selection — the cursor
  // appeared "stuck on the first character".
  const handleInputRef = useCallback(
    (el: HTMLInputElement | HTMLTextAreaElement | null) => {
      inputRef.current = el;
      if (!el) {
        focusInitialisedRef.current = false;
        return;
      }
      if (focusInitialisedRef.current) return;
      focusInitialisedRef.current = true;
      queueMicrotask(() => {
        el.focus();
        el.select();
      });
    },
    [],
  );

  useEffect(() => {
    if (editing || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    triggerRef.current?.focus();
  }, [editing]);

  // Keep local draft in sync when the parent value changes (e.g. after
  // a realtime update from another user). Uses React's recommended
  // "storing information from previous renders" pattern instead of an
  // effect, so we never trigger a follow-up render after commit.
  const [lastSyncedValue, setLastSyncedValue] = useState(value);
  if (!editing && value !== lastSyncedValue) {
    setLastSyncedValue(value);
    setDraft(stringify(value));
  }

  // Surface global save errors for this field.
  const externalError = fieldState?.status === 'error' ? fieldState.error : null;
  const isSaving = fieldState?.status === 'saving';
  const isPending = fieldState?.status === 'pending';
  const isSaved = fieldState?.status === 'saved';
  // Durable optimistic overlay: the save provider flips 'saved' → 'idle' ~4s
  // after the PATCH, but the `value` prop (server RSC data, e.g. record.email
  // in the header) only updates on a full refresh — which the field-save path
  // deliberately doesn't trigger. Keying only on the transient statuses made
  // header fields snap back to the stale server value 4s after every edit.
  // Keep showing the last successfully saved value until the prop reflects it.
  const displayValue: string | number | null | undefined =
    fieldState?.lastValue !== undefined &&
    (isSaving || isPending || isSaved || !serverHasCaughtUp(value, fieldState.lastValue))
      ? (fieldState.lastValue as string | number | null)
      : value;

  // Measured on the value span itself (never on the wrapper, which owns the
  // edit button we add below). The callback identity changes with the value,
  // so React re-runs it whenever the rendered display can have changed.
  const measureDisplay = useCallback(
    (el: HTMLSpanElement | null) => {
      if (!el) return;
      const found =
        el.querySelector('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])') !== null;
      setInteractiveDisplay((prev) => (prev === found ? prev : found));
    },
    [displayValue],
  );

  const enterEdit = useCallback(() => {
    if (readOnly || lockOwner) return;
    setDraft(stringify(displayValue));
    setLocalError(null);
    setEditing(true);
    onEditStart?.();
    void acquireFieldLock(field);
  }, [readOnly, lockOwner, displayValue, onEditStart, acquireFieldLock, field]);

  const cancelEdit = useCallback(() => {
    restoreFocusRef.current = true;
    setEditing(false);
    setLocalError(null);
    setDraft(stringify(displayValue));
    onEditEnd?.();
    void releaseFieldLock(field);
  }, [displayValue, onEditEnd, releaseFieldLock, field]);

  const commit = useCallback(async () => {
    const trimmed = draft.trim();
    if (trimmed === stringify(displayValue).trim()) {
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
      moneyDecimals != null
        ? parseCurrencyInput(trimmed)
        : type === 'number'
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
  }, [draft, displayValue, validate, type, moneyDecimals, save, field, onEditEnd, target, releaseFieldLock]);

  const onKey = (
    e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (e.key === 'Enter' && !e.shiftKey && !isTextarea) {
      // In textarea mode, plain Enter inserts a newline. Ctrl/Cmd+Enter
      // (or the blur handler) commits.
      e.preventDefault();
      restoreFocusRef.current = true;
      void commit();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && isTextarea) {
      e.preventDefault();
      restoreFocusRef.current = true;
      void commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  if (readOnly) {
    return (
      <span className={cn('inline-flex items-center', className)}>
        {display ? display(displayValue) : <DisplayValue value={displayValue} placeholder={placeholder} />}
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
        {display ? display(displayValue) : <DisplayValue value={displayValue} placeholder={placeholder} />}
        <LockedFieldBadge owner={lockOwner} />
      </span>
    );
  }

  if (!editing) {
    const statusIcon =
      isSaving || isPending ? (
        <Loader2 className="w-3 h-3 text-teal-500 animate-spin shrink-0" />
      ) : externalError ? (
        <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
      ) : isSaved ? (
        <Check className="w-3 h-3 text-emerald-500 shrink-0" />
      ) : (
        <Pencil className="w-3 h-3 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0" />
      );
    return (
      <>
      <span
        ref={triggerRef}
        role={interactiveDisplay ? undefined : 'button'}
        tabIndex={interactiveDisplay ? undefined : 0}
        onClick={enterEdit}
        onKeyDown={(e) => {
          // Never swallow a key meant for a link inside the value.
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            enterEdit();
          }
        }}
        aria-label={interactiveDisplay ? undefined : `Edit ${ariaLabel ?? field}`}
        className={cn(
          // Block + full width so overview grid cells don't let the control
          // expand into the neighboring column when the placeholder is long.
          'group flex w-full min-w-0 max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 -mx-1 cursor-text',
          'hover:bg-slate-100/70 dark:hover:bg-white/5 transition-colors',
          // A11Y-1: a 1px offset in the surface colour separates the ring
          // from the hover wash and the rose error fill so the focused cell
          // is unmistakable (1.4.11); wider would risk clipping in the
          // truncating overview grid cells.
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
          'focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950',
          (isSaving || isPending) && 'opacity-80',
          externalError && 'ring-1 ring-rose-300 dark:ring-rose-500/50 bg-rose-50/50 dark:bg-rose-500/5',
          className,
        )}
        data-field={field}
        title={
          externalError ??
          (displayValue != null && String(displayValue).trim() !== ''
            ? String(displayValue)
            : undefined)
        }
      >
        <span ref={measureDisplay} className="min-w-0 flex-1 truncate" data-inline-value>
          {display ? display(displayValue) : <DisplayValue value={displayValue} placeholder={placeholder} />}
        </span>
        {interactiveDisplay ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              enterEdit();
            }}
            aria-label={`Edit ${ariaLabel ?? field}`}
            className={cn(
              'shrink-0 rounded-sm leading-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
              'focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950',
            )}
          >
            {statusIcon}
          </button>
        ) : (
          statusIcon
        )}
      </span>
      {/* RP-M1 / D7: the silent emerald check is the visual voice; this
          always-mounted polite live region makes it perceivable to AT. It is
          a sibling, not a child, of the role=button span (button children are
          presentational, so a nested status would be ignored). No toast. */}
      <span role="status" aria-live="polite" className="sr-only" data-testid="crm-inline-save-status">
        {isSaved ? 'Saved' : ''}
      </span>
      </>
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
      const next = e.target.value;
      if (moneyDecimals != null && next !== '' && !isValidCurrencyTyping(next)) return;
      setDraft(next);
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
        'relative flex w-full min-w-0 max-w-full',
        isTextarea ? 'flex-col gap-1' : 'items-center gap-1',
        className,
      )}
      data-no-hotkeys
    >
      {isTextarea ? (
        <textarea
          ref={handleInputRef}
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
          ref={handleInputRef}
          type={moneyDecimals != null ? 'text' : type}
          inputMode={moneyDecimals != null ? 'decimal' : undefined}
          step={moneyDecimals != null ? '0.01' : undefined}
          {...sharedEditProps}
          placeholder={moneyDecimals != null ? '$0.00' : placeholder}
          className={cn(
            'min-w-0 w-full rounded-md border border-teal-400 dark:border-teal-500/60 bg-white dark:bg-slate-900',
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
  return (
    <span title={s} className="font-medium text-slate-900 dark:text-slate-100">
      {s}
    </span>
  );
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  return String(v);
}

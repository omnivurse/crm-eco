'use client';

import { useCallback, useMemo } from 'react';
import { Input } from '@crm-eco/ui/components/input';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  COMBOBOX_LISTBOX_CLASS,
  COMBOBOX_STATUS_CLASS,
  comboboxOptionClass,
  useComboboxList,
} from './useComboboxList';

export type SuggestStatus = 'idle' | 'loading' | 'error';

export interface SuggestPickerProps<T = string> {
  id?: string;
  /** Current input text (always a string, even when items are objects). */
  value: string;
  /** Input text changed (typing, or the default commit of an item). */
  onChange: (name: string) => void;
  /** Suggestions. Strings by default; any item type with getLabel/onSelect. */
  options: readonly T[];
  className?: string;
  placeholder?: string;
  'aria-label'?: string;
  /** Field-anchored error wiring (the host owns the message element). */
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  /** Display text for an item (default String(item)). */
  getLabel?: (item: T) => string;
  /** React key for an item (default getLabel). */
  getKey?: (item: T) => string;
  /**
   * Item committed by Enter / Tab / click. Default: onChange(getLabel(item)).
   * Pass this to receive the whole object (e.g. `{ name, id }`).
   */
  onSelect?: (item: T) => void;
  /** 'contains' filters client-side on getLabel (default); 'none' shows options as given (server-filtered). */
  filter?: 'contains' | 'none';
  /** Async state of `options`; drives the "Searching…" / error rows. */
  status?: SuggestStatus;
  loadingMessage?: string;
  emptyMessage?: string;
  errorMessage?: string;
  maxVisible?: number;
  /** Fired when the input gains focus (e.g. to start a lazy fetch). */
  onFocus?: () => void;
  'data-testid'?: string;
}

export function SuggestPicker<T = string>({
  id,
  value,
  onChange,
  options,
  className,
  placeholder,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  getLabel,
  getKey,
  onSelect,
  filter = 'contains',
  status = 'idle',
  loadingMessage = 'Searching…',
  emptyMessage = 'No match',
  errorMessage = "Couldn't load suggestions",
  maxVisible = 12,
  onFocus,
  'data-testid': testId,
}: SuggestPickerProps<T>) {
  const label = useCallback((item: T) => (getLabel ? getLabel(item) : String(item)), [getLabel]);
  const keyOf = useCallback((item: T) => (getKey ? getKey(item) : label(item)), [getKey, label]);

  const visible = useMemo(() => {
    const q = value.trim().toLowerCase();
    const list =
      filter === 'contains' && q
        ? options.filter((o) => label(o).toLowerCase().includes(q))
        : options;
    return list.slice(0, maxVisible);
  }, [options, value, filter, label, maxVisible]);

  const commit = useCallback(
    (item: T) => {
      if (onSelect) onSelect(item);
      else onChange(label(item));
    },
    [onSelect, onChange, label],
  );

  const box = useComboboxList<T>({ items: visible, onCommit: commit, listboxId: id ? `${id}-listbox` : undefined });

  const hasQuery = value.trim().length > 0;
  const showEmpty =
    status === 'idle' && visible.length === 0 && (filter === 'none' || (hasQuery && options.length > 0));
  const statusText =
    status === 'loading' ? loadingMessage : status === 'error' ? errorMessage : showEmpty ? emptyMessage : null;
  const showPopup = box.open && (visible.length > 0 || statusText !== null);

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        autoComplete="off"
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid || undefined}
        aria-describedby={ariaDescribedBy}
        placeholder={placeholder}
        className={className}
        data-testid={testId}
        {...box.inputProps}
        onFocus={(e) => {
          box.inputProps.onFocus(e);
          onFocus?.();
        }}
        onChange={(e) => {
          onChange(e.target.value);
          box.onInputChange();
        }}
      />
      {showPopup && (
        <div className={cn(COMBOBOX_LISTBOX_CLASS)}>
          <ul {...box.listboxProps} aria-label={ariaLabel}>
            {visible.map((item, index) => (
              <li
                key={keyOf(item)}
                {...box.getOptionProps(item, index)}
                className={comboboxOptionClass(index === box.activeIndex)}
              >
                {label(item)}
              </li>
            ))}
          </ul>
          {statusText !== null && (
            <div
              role="status"
              aria-live="polite"
              className={cn(COMBOBOX_STATUS_CLASS, status === 'error' && 'text-rose-600 dark:text-rose-400')}
            >
              {statusText}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

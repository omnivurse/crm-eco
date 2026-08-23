'use client';

import {
  useCallback,
  useId,
  useMemo,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';

/**
 * Keyboard + ARIA state for a text-input combobox (WAI-ARIA 1.2 "editable
 * combobox with list autocomplete"). Shared by SuggestPicker and
 * EnrolledByPicker so both pickers move/select/close identically.
 *
 * Generic over the item type so a picker can commit an object
 * (e.g. `{ name, id }`) rather than only a string.
 *
 * Behaviour (only differs from a plain input while the list is open):
 * - ArrowDown / ArrowUp: open the list and move the highlight (wraps).
 * - Enter: open + highlight → commit (preventDefault: the surrounding form
 *   does NOT submit). Open without highlight → close only (no submit).
 *   Closed → untouched, so it falls through to the form's native submit.
 * - Escape: open → close + stopPropagation (the drawer stays open).
 *   Closed → untouched (the drawer handles it).
 * - Tab: commits the highlight (if any) and closes synchronously, then
 *   lets focus move on. Options are tabIndex=-1 so Tab never lands on one.
 * - Blur: closes synchronously (no timer). Option mousedown is
 *   preventDefault'ed so a click commits before the input blurs.
 */
export interface UseComboboxListOptions<T> {
  /** Items currently shown in the listbox (already filtered/sliced). */
  items: readonly T[];
  /** Called when an item is committed by Enter / Tab / click. */
  onCommit: (item: T) => void;
  /** Stable id for the listbox (defaults to a React useId). */
  listboxId?: string;
  /** Open the list when the input gains focus (default true). */
  openOnFocus?: boolean;
}

export interface UseComboboxListResult<T> {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Highlighted row, or -1. Always < items.length. */
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  listboxId: string;
  optionId: (index: number) => string;
  /** Spread onto the text input. Merge with your own onChange/value. */
  inputProps: {
    role: 'combobox';
    'aria-autocomplete': 'list';
    'aria-expanded': boolean;
    'aria-controls': string | undefined;
    'aria-activedescendant': string | undefined;
    'aria-haspopup': 'listbox';
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
    onFocus: (e: FocusEvent<HTMLInputElement>) => void;
    onBlur: (e: FocusEvent<HTMLInputElement>) => void;
  };
  /** Call from the input's onChange after updating the value. */
  onInputChange: () => void;
  listboxProps: { id: string; role: 'listbox' };
  getOptionProps: (
    item: T,
    index: number,
  ) => {
    id: string;
    role: 'option';
    'aria-selected': boolean;
    tabIndex: -1;
    onMouseDown: (e: MouseEvent) => void;
    onMouseMove: () => void;
    onClick: () => void;
  };
}

export function useComboboxList<T>({
  items,
  onCommit,
  listboxId: listboxIdProp,
  openOnFocus = true,
}: UseComboboxListOptions<T>): UseComboboxListResult<T> {
  const reactId = useId();
  const listboxId = listboxIdProp ?? `${reactId}-listbox`;
  const [open, setOpenState] = useState(false);
  const [rawActive, setRawActive] = useState(-1);

  // Derive (not effect) so a shrinking list never leaves a stale highlight.
  const activeIndex = rawActive >= 0 && rawActive < items.length ? rawActive : -1;

  const optionId = useCallback((index: number) => `${listboxId}-opt-${index}`, [listboxId]);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    if (!next) setRawActive(-1);
  }, []);

  const commit = useCallback(
    (index: number) => {
      const item = items[index];
      if (item === undefined) return;
      onCommit(item);
      setOpenState(false);
      setRawActive(-1);
    },
    [items, onCommit],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      const count = items.length;
      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          if (!open) {
            setOpenState(true);
            setRawActive(count > 0 ? 0 : -1);
            return;
          }
          if (count === 0) return;
          setRawActive(activeIndex < 0 || activeIndex >= count - 1 ? 0 : activeIndex + 1);
          return;
        }
        case 'ArrowUp': {
          e.preventDefault();
          if (!open) {
            setOpenState(true);
            setRawActive(count > 0 ? count - 1 : -1);
            return;
          }
          if (count === 0) return;
          setRawActive(activeIndex <= 0 ? count - 1 : activeIndex - 1);
          return;
        }
        case 'Enter': {
          if (!open) return; // closed → native submit
          e.preventDefault();
          if (activeIndex >= 0) commit(activeIndex);
          else setOpen(false);
          return;
        }
        case 'Escape': {
          if (!open) return; // closed → let the drawer handle it
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
          return;
        }
        case 'Tab': {
          if (!open) return;
          if (activeIndex >= 0) commit(activeIndex);
          else setOpen(false);
          // no preventDefault: focus moves to the next field
          return;
        }
        default:
          return;
      }
    },
    [items.length, open, activeIndex, commit, setOpen],
  );

  const onFocus = useCallback(() => {
    if (openOnFocus) setOpenState(true);
  }, [openOnFocus]);

  const onBlur = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const onInputChange = useCallback(() => {
    setOpenState(true);
    setRawActive(-1);
  }, []);

  const getOptionProps = useCallback(
    (_item: T, index: number) => ({
      id: optionId(index),
      role: 'option' as const,
      'aria-selected': index === activeIndex,
      tabIndex: -1 as const,
      onMouseDown: (e: MouseEvent) => e.preventDefault(),
      onMouseMove: () => {
        if (activeIndex !== index) setRawActive(index);
      },
      onClick: () => commit(index),
    }),
    [optionId, activeIndex, commit],
  );

  const inputProps = useMemo(
    () => ({
      role: 'combobox' as const,
      'aria-autocomplete': 'list' as const,
      'aria-expanded': open,
      'aria-controls': open ? listboxId : undefined,
      'aria-activedescendant': open && activeIndex >= 0 ? optionId(activeIndex) : undefined,
      'aria-haspopup': 'listbox' as const,
      onKeyDown,
      onFocus,
      onBlur,
    }),
    [open, listboxId, activeIndex, optionId, onKeyDown, onFocus, onBlur],
  );

  return {
    open,
    setOpen,
    activeIndex,
    setActiveIndex: setRawActive,
    listboxId,
    optionId,
    inputProps,
    onInputChange,
    listboxProps: { id: listboxId, role: 'listbox' as const },
    getOptionProps,
  };
}

/** Shared popup + row classes so both pickers look identical. */
export const COMBOBOX_LISTBOX_CLASS =
  'absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-md dark:border-white/10 dark:bg-slate-900';

export function comboboxOptionClass(active: boolean): string {
  return active
    ? 'cursor-pointer px-3 py-1.5 text-left text-slate-900 bg-slate-100 dark:text-white dark:bg-white/10'
    : 'cursor-pointer px-3 py-1.5 text-left text-slate-800 dark:text-slate-100';
}

export const COMBOBOX_STATUS_CLASS =
  'px-3 py-1.5 text-left text-xs text-slate-500 dark:text-slate-400';

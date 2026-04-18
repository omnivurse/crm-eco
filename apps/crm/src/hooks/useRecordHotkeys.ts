'use client';

/**
 * useRecordHotkeys — single-key shortcuts for the V2 record detail shell.
 *
 * Deliberately small and dependency-free. Each binding is triggered by a
 * single keystroke only when:
 *   1. no input, textarea, contenteditable, or [data-no-hotkeys] element
 *      has focus, and
 *   2. no modifier key (Ctrl/Meta/Alt) is held — so browser/system
 *      shortcuts always win.
 *
 * Bindings mirror Zoho's record-page shortcuts closely enough that users
 * migrating from Zoho feel at home:
 *
 *   e    Edit record
 *   n    Add note
 *   t    Add task
 *   c    Log call
 *   m    Send email
 *   u    Upload file
 *   /    Focus global record search
 *   ?    Open shortcut cheat-sheet
 *
 * The hook accepts a partial handler map so callers can wire only the
 * actions that make sense for their context.
 */

import { useEffect, useMemo } from 'react';

export type RecordHotkeyAction =
  | 'edit'
  | 'note'
  | 'task'
  | 'call'
  | 'email'
  | 'upload'
  | 'search'
  | 'help';

export type RecordHotkeyHandlers = Partial<
  Record<RecordHotkeyAction, () => void>
>;

export interface RecordHotkeyBinding {
  key: string;
  action: RecordHotkeyAction;
  label: string;
}

export const RECORD_HOTKEY_BINDINGS: RecordHotkeyBinding[] = [
  { key: 'e', action: 'edit', label: 'Edit record' },
  { key: 'n', action: 'note', label: 'Add note' },
  { key: 't', action: 'task', label: 'Add task' },
  { key: 'c', action: 'call', label: 'Log a call' },
  { key: 'm', action: 'email', label: 'Send email' },
  { key: 'u', action: 'upload', label: 'Upload file' },
  { key: '/', action: 'search', label: 'Focus record search' },
  { key: '?', action: 'help', label: 'Show keyboard shortcuts' },
];

function shouldIgnoreEvent(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  const target = e.target as HTMLElement | null;
  if (!target) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  // Any ancestor with [data-no-hotkeys] opts out of the handler.
  if (target.closest('[data-no-hotkeys]')) return true;
  return false;
}

export function useRecordHotkeys(
  handlers: RecordHotkeyHandlers,
  enabled: boolean = true,
): void {
  // Memoize the key->handler map so we don't rebuild it on every keystroke.
  const map = useMemo(() => {
    const m = new Map<string, () => void>();
    for (const { key, action } of RECORD_HOTKEY_BINDINGS) {
      const fn = handlers[action];
      if (fn) m.set(key, fn);
    }
    return m;
  }, [handlers]);

  useEffect(() => {
    if (!enabled || map.size === 0) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (shouldIgnoreEvent(e)) return;
      const handler = map.get(e.key);
      if (!handler) return;
      e.preventDefault();
      handler();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [map, enabled]);
}

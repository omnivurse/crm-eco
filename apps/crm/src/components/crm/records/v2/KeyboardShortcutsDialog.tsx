'use client';

/**
 * KeyboardShortcutsDialog — cheat-sheet shown when the user presses `?`
 * from the V2 record detail shell. Driven by `RECORD_HOTKEY_BINDINGS` so
 * it stays in sync with `useRecordHotkeys` automatically.
 */

import { Keyboard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import { RECORD_HOTKEY_BINDINGS } from '@/hooks/useRecordHotkeys';

export interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Keyboard className="w-5 h-5 text-teal-600" />
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            These work anywhere on a record page, as long as no input is
            focused.
          </DialogDescription>
        </DialogHeader>

        <ul className="mt-2 divide-y divide-slate-100 dark:divide-white/5">
          {RECORD_HOTKEY_BINDINGS.map(({ key, label }) => (
            <li
              key={key}
              className="flex items-center justify-between py-2"
            >
              <span className="text-sm text-slate-700 dark:text-slate-200">
                {label}
              </span>
              <kbd className="ml-3 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-2 text-[11px] font-medium text-slate-600 dark:text-slate-300 shadow-sm">
                {key}
              </kbd>
            </li>
          ))}
        </ul>

        <p className="mt-2 text-[11px] text-slate-400">
          Tip: hold <kbd className="rounded border border-slate-200 dark:border-white/10 px-1">Shift</kbd> + <kbd className="rounded border border-slate-200 dark:border-white/10 px-1">/</kbd> anywhere to reopen this dialog.
        </p>
      </DialogContent>
    </Dialog>
  );
}

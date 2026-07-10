'use client';

/**
 * Promise-based confirmation dialog — a branded, accessible replacement for the
 * native `window.confirm()`. Native confirms only offer OK/Cancel (where "OK"
 * silently means "proceed/discard"), which reps mistook for "Save"; this renders
 * the app's AlertDialog with explicit, labelled buttons.
 *
 * Usage:
 *   1. Mount `<ConfirmDialogHost />` once near the app root (e.g. in the root
 *      layout, alongside <Toaster />).
 *   2. Anywhere else: `if (!(await confirmDialog({ ... }))) return;`
 *
 * Modelled after sonner's imperative `toast()` — a single host subscribes to a
 * module-level queue, so callers don't need a provider/context per component.
 */

import * as React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from './alert-dialog';
import { Button } from './button';

export interface ConfirmOptions {
  /** Bold heading. Defaults to "Are you sure?". */
  title?: string;
  /** Supporting copy under the title. */
  description?: React.ReactNode;
  /** Confirm button label. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Cancel button label. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Render the confirm button in the destructive (red) style. */
  destructive?: boolean;
}

interface ConfirmRequest extends ConfirmOptions {
  id: number;
  resolve: (value: boolean) => void;
}

type Listener = (req: ConfirmRequest | null) => void;

let listeners: Listener[] = [];
let active: ConfirmRequest | null = null;
let counter = 0;

function emit(req: ConfirmRequest | null): void {
  active = req;
  for (const listener of listeners) listener(req);
}

function settle(value: boolean): void {
  if (!active) return;
  active.resolve(value);
  emit(null);
}

/**
 * Show a confirmation dialog and resolve `true` if confirmed, `false` if
 * cancelled or dismissed. Accepts a plain message string or a full options
 * object. Always `await` the result — a missed await resolves truthy.
 */
export function confirmDialog(
  options: string | ConfirmOptions = {},
): Promise<boolean> {
  const opts: ConfirmOptions =
    typeof options === 'string' ? { description: options } : options;
  return new Promise<boolean>((resolve) => {
    emit({ ...opts, id: ++counter, resolve });
  });
}

/** Single dialog host. Mount once near the app root. */
export function ConfirmDialogHost() {
  const [req, setReq] = React.useState<ConfirmRequest | null>(active);

  React.useEffect(() => {
    const listener: Listener = (next) => setReq(next);
    listeners.push(listener);
    // Sync in case a request was queued between render and mount.
    setReq(active);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  const open = req !== null;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Escape / outside interaction / close animation → treat as cancel.
        if (!next) settle(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{req?.title ?? 'Are you sure?'}</AlertDialogTitle>
          {req?.description != null && req?.description !== '' ? (
            <AlertDialogDescription>{req.description}</AlertDialogDescription>
          ) : (
            // Radix wants a description for a11y; keep it visually hidden when
            // the caller passed none.
            <AlertDialogDescription className="sr-only">
              This action needs your confirmation.
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{req?.cancelLabel ?? 'Cancel'}</AlertDialogCancel>
          <Button
            variant={req?.destructive ? 'destructive' : 'default'}
            onClick={() => settle(true)}
          >
            {req?.confirmLabel ?? 'Confirm'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

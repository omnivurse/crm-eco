'use client';

/**
 * Promise-based prompt dialog — a branded, accessible replacement for the
 * native `window.prompt()`. Renders the app's AlertDialog with a single text
 * input.
 *
 * Usage:
 *   1. Mount `<PromptDialogHost />` once near the app root (alongside
 *      <ConfirmDialogHost /> / <Toaster />).
 *   2. Anywhere else: `const name = await promptDialog({ title, label });`
 *      Resolves the entered string, or `null` if cancelled/dismissed.
 *
 * Same singleton pattern as ./confirm-dialog — a single host subscribes to a
 * module-level queue, so callers need no provider/context per component.
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
import { Input } from './input';
import { Label } from './label';

export interface PromptOptions {
  /** Bold heading. Defaults to "Enter a value". */
  title?: string;
  /** Supporting copy under the title. */
  description?: React.ReactNode;
  /** Label shown above the input. */
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  /** Confirm button label. Defaults to "OK". */
  confirmLabel?: string;
  /** Cancel button label. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Require a non-empty (trimmed) value before confirm is enabled. Default true. */
  required?: boolean;
  inputType?: 'text' | 'url' | 'email' | 'number';
  /** Return an error message to block submit, or null/undefined to allow. */
  validate?: (value: string) => string | null | undefined;
}

interface PromptRequest extends PromptOptions {
  id: number;
  resolve: (value: string | null) => void;
}

type Listener = (req: PromptRequest | null) => void;

let listeners: Listener[] = [];
let active: PromptRequest | null = null;
let counter = 0;

function emit(req: PromptRequest | null): void {
  active = req;
  for (const listener of listeners) listener(req);
}

function settle(value: string | null): void {
  if (!active) return;
  active.resolve(value);
  emit(null);
}

/**
 * Show a prompt dialog and resolve the entered string, or `null` if cancelled
 * or dismissed. Always `await` the result.
 */
export function promptDialog(options: PromptOptions = {}): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    emit({ ...options, id: ++counter, resolve });
  });
}

/** Single dialog host. Mount once near the app root. */
export function PromptDialogHost() {
  const [req, setReq] = React.useState<PromptRequest | null>(active);
  const [value, setValue] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const listener: Listener = (next) => setReq(next);
    listeners.push(listener);
    setReq(active);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  // Reset + focus the input whenever a new request arrives.
  const reqId = req?.id;
  React.useEffect(() => {
    if (!req) return;
    setValue(req.defaultValue ?? '');
    setError(null);
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 30);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqId]);

  const open = req !== null;
  const required = req?.required ?? true;
  const trimmed = value.trim();
  const canSubmit = required ? trimmed.length > 0 : true;

  const submit = () => {
    if (!req) return;
    if (required && trimmed.length === 0) {
      setError('This field is required.');
      return;
    }
    const validationError = req.validate?.(value);
    if (validationError) {
      setError(validationError);
      return;
    }
    settle(value);
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) settle(null);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{req?.title ?? 'Enter a value'}</AlertDialogTitle>
          {req?.description != null && req?.description !== '' ? (
            <AlertDialogDescription>{req.description}</AlertDialogDescription>
          ) : (
            <AlertDialogDescription className="sr-only">
              Enter a value and confirm.
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <div className="space-y-1.5">
          {req?.label ? (
            <Label htmlFor="prompt-dialog-input">{req.label}</Label>
          ) : null}
          <Input
            id="prompt-dialog-input"
            ref={inputRef}
            type={req?.inputType ?? 'text'}
            value={value}
            placeholder={req?.placeholder}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
            aria-invalid={error ? true : undefined}
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{req?.cancelLabel ?? 'Cancel'}</AlertDialogCancel>
          <Button onClick={submit} disabled={!canSubmit}>
            {req?.confirmLabel ?? 'OK'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

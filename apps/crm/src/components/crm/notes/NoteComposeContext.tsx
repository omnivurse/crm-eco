'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface NoteComposeContextValue {
  /** Increments each time a caller asks to open the in-pane composer. */
  composeNonce: number;
  /**
   * Optional body to seed the composer with for THIS compose request (note
   * templates, TE-6). `null` means "open / focus the composer as it is". The
   * Notes pane never lets a prefill overwrite a non-empty draft (TE-1 guard).
   */
  composePrefill: string | null;
  /** Ask the Notes pane to open its composer, optionally seeded with `body`. */
  requestCompose: (body?: string | null) => void;
}

const NoteComposeContext = createContext<NoteComposeContextValue | null>(null);

export function NoteComposeProvider({
  children,
  composeNonce: controlledNonce,
  composePrefill: controlledPrefill,
  requestCompose: controlledRequest,
}: {
  children: ReactNode;
  composeNonce?: number;
  composePrefill?: string | null;
  requestCompose?: (body?: string | null) => void;
}) {
  const [internalNonce, setInternalNonce] = useState(0);
  const [internalPrefill, setInternalPrefill] = useState<string | null>(null);
  const requestCompose = useCallback(
    (body?: string | null) => {
      if (controlledRequest) {
        controlledRequest(body);
        return;
      }
      setInternalPrefill(body ?? null);
      setInternalNonce((n) => n + 1);
    },
    [controlledRequest],
  );
  const composeNonce = controlledNonce ?? internalNonce;
  const composePrefill = controlledNonce !== undefined ? (controlledPrefill ?? null) : internalPrefill;
  const value = useMemo(
    () => ({ composeNonce, composePrefill, requestCompose }),
    [composeNonce, composePrefill, requestCompose],
  );
  return <NoteComposeContext.Provider value={value}>{children}</NoteComposeContext.Provider>;
}

/**
 * Note templates are authored as plain text with newlines; the in-pane
 * composer is a rich (HTML) editor. A plain body becomes one paragraph per
 * line (blank line → empty paragraph) with text escaped. Bodies that already
 * carry markup pass through untouched; NotesPanel sanitises on save.
 */
export function noteTemplateBodyToHtml(body: string): string {
  if (!body) return '';
  // Only real markup counts as "already HTML" — "<Wendy>" in prose is text.
  if (/<\/?(p|div|br|b|i|u|s|strong|em|ul|ol|li|span|table|thead|tbody|tr|td|th|h[1-6]|img|a|blockquote|pre|code|hr)\b[^>]*>/i.test(body)) {
    return body;
  }
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return body
    .split(/\r?\n/)
    .map((line) => (line.trim() === '' ? '<p><br></p>' : `<p>${escape(line)}</p>`))
    .join('');
}

export function useNoteCompose(): NoteComposeContextValue | null {
  return useContext(NoteComposeContext);
}

export function useNoteComposeRequired(): NoteComposeContextValue {
  const ctx = useContext(NoteComposeContext);
  if (!ctx) {
    throw new Error('useNoteComposeRequired must be used inside NoteComposeProvider');
  }
  return ctx;
}

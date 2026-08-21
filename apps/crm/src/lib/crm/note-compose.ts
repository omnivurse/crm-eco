/**
 * Note compose deep-link — one interface for desk, header, and Notes pane.
 *
 * Invariant: `?pane=notes&compose=1` means "open the in-pane composer".
 * Callers must not invent a second compose dialog.
 */

export const RECORD_NOTE_PANES = [
  'notes',
  'emails',
  'attachments',
  'related',
  'timeline',
] as const;

export type RecordNotePane = (typeof RECORD_NOTE_PANES)[number];

export function isRecordNotePane(value: string | null | undefined): value is RecordNotePane {
  return value != null && (RECORD_NOTE_PANES as readonly string[]).includes(value);
}

function isComposeFlag(value: string | null | undefined): boolean {
  return value === '1' || value === 'true';
}

export function parseRecordComposeParams(search: {
  get(name: string): string | null;
}): { pane: RecordNotePane | null; compose: boolean } {
  const paneRaw = search.get('pane');
  const pane = isRecordNotePane(paneRaw) ? paneRaw : null;
  const compose = isComposeFlag(search.get('compose')) && pane === 'notes';
  return { pane, compose };
}

/** Desk / queue href that lands on the Notes pane with the composer open. */
export function recordNoteComposeHref(recordId: string): string {
  return `/crm/r/${encodeURIComponent(recordId)}?pane=notes&compose=1`;
}

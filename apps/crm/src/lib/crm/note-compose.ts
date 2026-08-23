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

/**
 * RP-7 — the record URL for a pane switch, so reload / share / Back keep the
 * pane. `?pane=` mirrors the active pane (`details` = no param); `compose` is
 * always dropped (a reload must not re-open the composer); every other param
 * — `returnTo` above all — is preserved, so Back still returns to the list
 * with its filters. Pure: callers decide whether to `history.replaceState`.
 *
 *   recordPaneHref('/crm/r/1', new URLSearchParams('returnTo=%2Fcrm%2Fmodules%2Fcontacts%3Fstatus%3DPending'), 'notes')
 *     → '/crm/r/1?returnTo=%2Fcrm%2Fmodules%2Fcontacts%3Fstatus%3DPending&pane=notes'
 *   recordPaneHref('/crm/r/1', new URLSearchParams('pane=notes&compose=1'), 'details')
 *     → '/crm/r/1'
 */
export function recordPaneHref(
  pathname: string,
  searchParams: { toString(): string } | string | null | undefined,
  pane: string | null | undefined,
): string {
  const params = new URLSearchParams(
    searchParams == null ? '' : typeof searchParams === 'string' ? searchParams : searchParams.toString(),
  );
  params.delete('compose');
  if (pane && pane !== 'details') params.set('pane', pane);
  else params.delete('pane');
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

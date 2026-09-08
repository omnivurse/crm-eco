/**
 * When a note draft should persist without a click.
 *
 * The in-pane composer used to sit above a Save button that scrolled off the
 * notes pane. Autosave is the safety net: after a short pause, on hide, and
 * on explicit Done. Blank drafts never create a row.
 */

import { isBlankNoteHtml } from './note-blank';

export { isBlankNoteHtml } from './note-blank';

/** Pause after the last keystroke before the draft is written. */
export const NOTE_AUTOSAVE_MS = 800;

/**
 * True when the draft has visible text that differs from the last successful
 * persist. Compared as trimmed HTML so a trailing `<br>` does not retrigger.
 */
export function noteNeedsAutosave(draftHtml: string, lastSavedHtml: string): boolean {
  if (isBlankNoteHtml(draftHtml)) return false;
  return draftHtml.trim() !== lastSavedHtml.trim();
}

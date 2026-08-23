/**
 * In-pane note composer state — the one open/focus rule shared by every
 * "Add note" entry point (pane button, header button, `n` hotkey,
 * `?pane=notes&compose=1` deep link via NoteComposeContext).
 *
 * Invariant (TE-1 / RP-2): opening the composer never wipes a draft. A fresh
 * open resets the draft + date and remounts the editor (epoch); a repeat open
 * while already composing keeps everything and only re-focuses the editor.
 */

export interface NoteComposerState {
  /** Composer is open in the Notes pane. */
  isAdding: boolean;
  /** Draft HTML. */
  draft: string;
  /** `<input type="date">` value for the note date. */
  noteDate: string;
  /** Keyed remount epoch for the rich editor (fresh editor + autoFocus). */
  epoch: number;
  /** Bumped to re-focus an already-mounted editor without remounting it. */
  focusSignal: number;
}

export function openNoteComposer(state: NoteComposerState, today: string): NoteComposerState {
  if (state.isAdding) {
    // Already composing: keep the draft (even an empty one — the picked date
    // survives too) and just put the caret back in the editor.
    return { ...state, focusSignal: state.focusSignal + 1 };
  }
  return {
    isAdding: true,
    draft: '',
    noteDate: today,
    epoch: state.epoch + 1,
    focusSignal: state.focusSignal,
  };
}

/**
 * Focus a contentEditable editor without scrolling the pane and park the
 * caret after any existing content (re-focusing a draft should not drop the
 * caret at the start). Safe to call with a null ref.
 */
export function focusNoteEditor(el: HTMLElement | null): boolean {
  if (!el) return false;
  el.focus({ preventScroll: true });
  const doc = el.ownerDocument;
  if (!doc || doc.activeElement !== el) return false;
  const selection = doc.getSelection?.();
  if (!selection) return true;
  const range = doc.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

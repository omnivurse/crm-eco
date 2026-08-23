import { describe, expect, it, vi } from 'vitest';
import { focusNoteEditor, openNoteComposer, type NoteComposerState } from './note-composer';

const closed: NoteComposerState = {
  isAdding: false,
  draft: '',
  noteDate: '2026-08-01',
  epoch: 0,
  focusSignal: 0,
};

describe('openNoteComposer', () => {
  it('a fresh open resets the draft/date and remounts the editor', () => {
    const next = openNoteComposer(closed, '2026-08-22');
    expect(next).toEqual({
      isAdding: true,
      draft: '',
      noteDate: '2026-08-22',
      epoch: 1,
      focusSignal: 0,
    });
  });

  it('bumping the compose nonce twice with a draft keeps the draft and only re-focuses', () => {
    const opened = openNoteComposer(closed, '2026-08-22');
    const typed: NoteComposerState = { ...opened, draft: '<p>half-typed</p>', noteDate: '2026-08-10' };

    const second = openNoteComposer(typed, '2026-08-22');
    expect(second.draft).toBe('<p>half-typed</p>');
    expect(second.noteDate).toBe('2026-08-10');
    expect(second.epoch).toBe(typed.epoch); // no remount → caret/undo stack survive
    expect(second.focusSignal).toBe(typed.focusSignal + 1);
    expect(second.isAdding).toBe(true);

    const third = openNoteComposer(second, '2026-08-22');
    expect(third.draft).toBe('<p>half-typed</p>');
    expect(third.epoch).toBe(typed.epoch);
    expect(third.focusSignal).toBe(typed.focusSignal + 2);
  });

  it('keeps an empty draft too (the picked note date survives)', () => {
    const opened = { ...openNoteComposer(closed, '2026-08-22'), noteDate: '2026-07-04' };
    const again = openNoteComposer(opened, '2026-08-22');
    expect(again.noteDate).toBe('2026-07-04');
    expect(again.epoch).toBe(opened.epoch);
  });

  it('resets again once the composer was closed (cancel/save)', () => {
    const stale: NoteComposerState = { ...closed, draft: '<p>old</p>', epoch: 3, focusSignal: 2 };
    const next = openNoteComposer(stale, '2026-08-22');
    expect(next.draft).toBe('');
    expect(next.epoch).toBe(4);
    expect(next.isAdding).toBe(true);
  });
});

function fakeEditor(opts: { focusSucceeds?: boolean; withSelection?: boolean } = {}) {
  const { focusSucceeds = true, withSelection = true } = opts;
  const selection = { removeAllRanges: vi.fn(), addRange: vi.fn() };
  const range = { selectNodeContents: vi.fn(), collapse: vi.fn() };
  const doc = {
    activeElement: null as unknown,
    getSelection: withSelection ? vi.fn(() => selection) : undefined,
    createRange: vi.fn(() => range),
  };
  const el = {
    ownerDocument: doc,
    focus: vi.fn(() => {
      if (focusSucceeds) doc.activeElement = el;
    }),
  };
  return { el: el as unknown as HTMLElement, doc, selection, range, focus: el.focus };
}

describe('focusNoteEditor', () => {
  it('is a no-op for a null ref', () => {
    expect(focusNoteEditor(null)).toBe(false);
  });

  it('focuses without scrolling and parks the caret at the end of the content', () => {
    const f = fakeEditor();
    expect(focusNoteEditor(f.el)).toBe(true);
    expect(f.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(f.doc.activeElement).toBe(f.el);
    expect(f.range.selectNodeContents).toHaveBeenCalledWith(f.el);
    expect(f.range.collapse).toHaveBeenCalledWith(false);
    expect(f.selection.removeAllRanges).toHaveBeenCalled();
    expect(f.selection.addRange).toHaveBeenCalledWith(f.range);
  });

  it('does not touch the selection when focus did not land (hidden/detached editor)', () => {
    const f = fakeEditor({ focusSucceeds: false });
    expect(focusNoteEditor(f.el)).toBe(false);
    expect(f.doc.createRange).not.toHaveBeenCalled();
  });

  it('still reports focus when the document has no selection API', () => {
    const f = fakeEditor({ withSelection: false });
    expect(focusNoteEditor(f.el)).toBe(true);
    expect(f.doc.createRange).not.toHaveBeenCalled();
  });
});

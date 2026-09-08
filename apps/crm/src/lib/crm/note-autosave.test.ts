import { describe, expect, it } from 'vitest';
import { isBlankNoteHtml, noteNeedsAutosave } from './note-autosave';

describe('noteNeedsAutosave', () => {
  it('does not save a blank draft', () => {
    expect(noteNeedsAutosave('', '')).toBe(false);
    expect(noteNeedsAutosave('<p><br></p>', '')).toBe(false);
    expect(noteNeedsAutosave('<p>&nbsp;</p>', '')).toBe(false);
  });

  it('saves the first non-blank draft', () => {
    expect(noteNeedsAutosave('<p>Called Wendy</p>', '')).toBe(true);
  });

  it('does not resave an unchanged draft', () => {
    expect(noteNeedsAutosave('<p>Called Wendy</p>', '<p>Called Wendy</p>')).toBe(false);
  });

  it('saves when the draft changed after a persist', () => {
    expect(noteNeedsAutosave('<p>Called Wendy — left VM</p>', '<p>Called Wendy</p>')).toBe(true);
  });
});

describe('isBlankNoteHtml (re-export)', () => {
  it('matches the composer empty-state rule', () => {
    expect(isBlankNoteHtml('<p>x</p>')).toBe(false);
  });
});

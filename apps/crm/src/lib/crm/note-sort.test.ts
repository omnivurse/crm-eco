import { describe, expect, it } from 'vitest';
import { sortNotesForDisplay } from './note-sort';
import { localDateInputValue } from './note-timestamp';

type TestNote = {
  id: string;
  is_pinned: boolean;
  note_date: string | null;
  created_at: string;
};

function note(
  id: string,
  created: Date,
  noteDate: string | null = null,
  isPinned = false,
): TestNote {
  return { id, is_pinned: isPinned, note_date: noteDate, created_at: created.toISOString() };
}

const morning = new Date(2026, 6, 24, 9, 0, 0); // Jul 24 2026, 09:00 local
const evening = new Date(2026, 6, 24, 17, 0, 0); // Jul 24 2026, 17:00 local
const ids = (notes: TestNote[]) => notes.map((n) => n.id);

describe('sortNotesForDisplay', () => {
  it('puts the note saved later in the day first, even when it carries a note_date (regression)', () => {
    // The original bug: a new note defaulted note_date to today, which sorted at
    // local midnight and so fell *behind* older notes from the same day.
    const older = note('older', morning);
    const newer = note('newer', evening, localDateInputValue(evening));
    expect(ids(sortNotesForDisplay([older, newer], 'newest'))).toEqual(['newer', 'older']);
  });

  it('treats a note_date on the created day as ordering-neutral', () => {
    const withDate = [
      note('a', morning, localDateInputValue(morning)),
      note('b', evening, localDateInputValue(evening)),
    ];
    const withoutDate = [note('a', morning), note('b', evening)];
    expect(ids(sortNotesForDisplay(withDate, 'newest'))).toEqual(
      ids(sortNotesForDisplay(withoutDate, 'newest')),
    );
  });

  it('sorts a back-dated note onto its target day', () => {
    // Written Jul 29 but about Jul 20, so it must fall below a Jul 24 note.
    const backdated = note('about-jul-20', new Date(2026, 6, 29, 10, 0, 0), '2026-07-20');
    const onJul24 = note('created-jul-24', new Date(2026, 6, 24, 12, 0, 0));
    expect(ids(sortNotesForDisplay([backdated, onJul24], 'newest'))).toEqual([
      'created-jul-24',
      'about-jul-20',
    ]);
  });

  it('keeps pinned notes first in both directions', () => {
    const pinned = note('pinned', morning, null, true);
    const recent = note('recent', evening);
    expect(sortNotesForDisplay([recent, pinned], 'newest')[0].id).toBe('pinned');
    expect(sortNotesForDisplay([recent, pinned], 'oldest')[0].id).toBe('pinned');
  });

  it('reverses non-pinned order for oldest-first', () => {
    const a = note('a', morning);
    const b = note('b', evening);
    expect(ids(sortNotesForDisplay([a, b], 'newest'))).toEqual(['b', 'a']);
    expect(ids(sortNotesForDisplay([a, b], 'oldest'))).toEqual(['a', 'b']);
  });

  it('defaults to newest-first and does not mutate the input', () => {
    const input = [note('a', morning), note('b', evening)];
    const snapshot = [...input];
    expect(ids(sortNotesForDisplay(input))).toEqual(['b', 'a']);
    expect(input).toEqual(snapshot);
  });

  it('breaks ties on the same effective date by created_at', () => {
    // Both about Jul 20; the one written later leads under newest-first.
    const writtenEarlier = note('written-jul-21', new Date(2026, 6, 21, 8, 0, 0), '2026-07-20');
    const writtenLater = note('written-jul-29', new Date(2026, 6, 29, 8, 0, 0), '2026-07-20');
    expect(ids(sortNotesForDisplay([writtenEarlier, writtenLater], 'newest'))).toEqual([
      'written-jul-29',
      'written-jul-21',
    ]);
  });
});

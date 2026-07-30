import { describe, expect, it } from 'vitest';
import {
  formatNoteTimestamp,
  formatNoteRelative,
  isNoteEdited,
  localDateInputValue,
  formatNoteDateOnly,
  noteDateDiffersFromCreated,
  noteSortTime,
} from './note-timestamp';

describe('formatNoteTimestamp', () => {
  it('shows weekday, date, and time for current-year notes', () => {
    const d = new Date();
    d.setMonth(2, 10); // Mar 10 of the current year
    d.setHours(15, 5, 0, 0);
    expect(formatNoteTimestamp(d)).toBe('Tue, Mar 10 · 3:05 PM'.replace('Tue', format(d)));
  });

  it('includes the year for notes from previous years', () => {
    const stamp = formatNoteTimestamp('2024-01-05T09:30:00');
    expect(stamp).toContain('Jan 5, 2024');
    expect(stamp).toContain('9:30 AM');
  });

  it('returns empty string for invalid dates', () => {
    expect(formatNoteTimestamp('not-a-date')).toBe('');
    expect(formatNoteRelative('not-a-date')).toBe('');
  });

  it('accepts ISO strings (as stored in created_at)', () => {
    const iso = new Date().toISOString();
    expect(formatNoteTimestamp(iso)).toMatch(/·\s\d{1,2}:\d{2}\s[AP]M$/);
  });
});

describe('isNoteEdited', () => {
  const t = '2026-07-20T10:00:00Z';
  it('is false when never updated or updated within the 2s save jitter', () => {
    expect(isNoteEdited(t, null)).toBe(false);
    expect(isNoteEdited(t, undefined)).toBe(false);
    expect(isNoteEdited(t, t)).toBe(false);
    expect(isNoteEdited(t, '2026-07-20T10:00:01Z')).toBe(false);
  });
  it('is true when meaningfully edited later', () => {
    expect(isNoteEdited(t, '2026-07-20T10:00:05Z')).toBe(true);
  });
});

describe('localDateInputValue', () => {
  it('formats a Date as local YYYY-MM-DD', () => {
    expect(localDateInputValue(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(localDateInputValue(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
  it('defaults to today and returns a YYYY-MM-DD shape', () => {
    expect(localDateInputValue()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('returns empty string for invalid input', () => {
    expect(localDateInputValue('not-a-date')).toBe('');
  });
});

describe('formatNoteDateOnly', () => {
  it('formats a bare YYYY-MM-DD as a readable date', () => {
    expect(formatNoteDateOnly('2026-07-24')).toBe('Jul 24, 2026');
  });
  it('returns empty string for invalid input', () => {
    expect(formatNoteDateOnly('nope')).toBe('');
  });
});

describe('noteDateDiffersFromCreated', () => {
  const created = new Date(2026, 6, 24, 12, 0, 0); // local Jul 24 2026, noon
  const createdIso = created.toISOString();
  const createdDay = localDateInputValue(created);
  it('is false when there is no note date', () => {
    expect(noteDateDiffersFromCreated(null, createdIso)).toBe(false);
    expect(noteDateDiffersFromCreated(undefined, createdIso)).toBe(false);
  });
  it('is false when the note date is the same calendar day it was saved', () => {
    expect(noteDateDiffersFromCreated(createdDay, createdIso)).toBe(false);
  });
  it('is true when the note is back-dated to a different day', () => {
    const earlier = localDateInputValue(new Date(2026, 6, 20, 12, 0, 0));
    expect(noteDateDiffersFromCreated(earlier, createdIso)).toBe(true);
  });
});

describe('noteSortTime', () => {
  const created = '2026-07-20T10:00:00Z';
  it('falls back to created_at when note_date is absent', () => {
    expect(noteSortTime(null, created)).toBe(new Date(created).getTime());
    expect(noteSortTime(undefined, created)).toBe(new Date(created).getTime());
  });
  it('uses local midnight of note_date when present', () => {
    expect(noteSortTime('2026-07-24', created)).toBe(new Date('2026-07-24T00:00:00').getTime());
  });
  it('orders back-dated notes by their intended date', () => {
    expect(noteSortTime('2026-07-25', created)).toBeGreaterThan(noteSortTime('2026-07-24', created));
  });
});

/** Weekday of an arbitrary date varies by year — derive it so the test is stable. */
function format(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

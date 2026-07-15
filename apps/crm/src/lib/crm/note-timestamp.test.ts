import { describe, expect, it } from 'vitest';
import { formatNoteTimestamp, formatNoteRelative } from './note-timestamp';

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

/** Weekday of an arbitrary date varies by year — derive it so the test is stable. */
function format(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

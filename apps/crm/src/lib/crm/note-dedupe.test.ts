import { describe, expect, it } from 'vitest';
import {
  dedupeNotesForDisplay,
  exactNoteDedupeKey,
  isLegacyNotesHistoryHtml,
  legacyBodyDedupeKey,
  normalizeNoteBodyForDedupe,
} from './note-dedupe';

describe('normalizeNoteBodyForDedupe', () => {
  it('strips tags and collapses whitespace', () => {
    expect(normalizeNoteBodyForDedupe('<p>Hello&nbsp;  World</p>')).toBe('hello world');
  });
});

describe('legacyBodyDedupeKey', () => {
  it('fingerprints imported notes and leaves CRM-authored notes alone', () => {
    expect(
      legacyBodyDedupeKey({
        body: 'Spoke with Asia at Cigna',
        created_at: '2026-08-19T16:22:00Z',
        created_by: null,
      }),
    ).toMatch(/^legacy:spoke with asia/);
    expect(
      legacyBodyDedupeKey({
        body: 'Spoke with Asia at Cigna',
        created_at: '2026-08-19T16:22:00Z',
        created_by: 'user-1',
      }),
    ).toBeNull();
  });
});

describe('dedupeNotesForDisplay', () => {
  it('keeps both current notes a rep wrote the same day (Ashley Cigna pair)', () => {
    const notes = [
      {
        id: 'newer',
        body: '8-19-26 I figure it out! I had to cancel through Colorado Connect.',
        created_at: '2026-08-19T16:26:29Z',
        created_by: 'wendy',
      },
      {
        id: 'older',
        body: '8-19-26 I spoke with Asia at Cigna to cancel Ashley.',
        created_at: '2026-08-19T16:22:34Z',
        created_by: 'wendy',
      },
    ];
    expect(dedupeNotesForDisplay(notes).map((n) => n.id)).toEqual(['newer', 'older']);
  });

  it('collapses Zoho UTC/local twins on one record so 2025 copies do not bury new work', () => {
    const body = '9-23-25 Ashley is now enrolled through Colorado Connect.';
    const notes = [
      {
        id: 'current',
        body: '8-19-26 cancelled through Colorado Connect',
        created_at: '2026-08-19T16:26:29Z',
        created_by: 'wendy',
      },
      {
        id: 'utc',
        body,
        created_at: '2025-09-23T22:26:25Z',
        created_by: null,
      },
      {
        id: 'local',
        body,
        created_at: '2025-09-23T16:26:25Z',
        created_by: null,
      },
    ];
    expect(dedupeNotesForDisplay(notes).map((n) => n.id)).toEqual(['current', 'utc']);
  });

  it('collapses exact body+timestamp copies from lead+contact lineage', () => {
    const stamp = '2025-09-23T16:26:25Z';
    const body = 'same imported payload';
    const a = { id: 'a', body, created_at: stamp, created_by: null };
    const b = { id: 'b', body, created_at: stamp, created_by: null };
    expect(exactNoteDedupeKey(a)).toBe(exactNoteDedupeKey(b));
    expect(dedupeNotesForDisplay([a, b]).map((n) => n.id)).toEqual(['a']);
  });
});

describe('isLegacyNotesHistoryHtml', () => {
  it('rejects plan IDs and other scalars stuffed into notes_history', () => {
    expect(isLegacyNotesHistoryHtml('Plan ID 49375CO0060034-00')).toBe(false);
    expect(isLegacyNotesHistoryHtml('')).toBe(false);
    expect(isLegacyNotesHistoryHtml(null)).toBe(false);
  });

  it('accepts Zoho HTML dumps', () => {
    expect(
      isLegacyNotesHistoryHtml('<b>9-23-25</b>: Ashley enrolled<hr/>Next note'),
    ).toBe(true);
  });
});

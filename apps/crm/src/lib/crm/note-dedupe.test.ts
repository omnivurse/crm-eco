import {
  hasLegacyNotesHistory, describe, expect, it } from 'vitest';
import {
  dedupeNotesForDisplay,
  exactNoteDedupeKey,
  hasLegacyNotesHistory,
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

describe('imported history is shown whether or not Zoho wrote it as HTML', () => {
  // 703 prod records store plain-text call history in notes_history. Gating
  // the card on HTML markers hid every one of them — the "my notes vanished"
  // report this module exists to end.
  const plain =
    "11-6-15 He's in CA 'til Mon. next week.  12-3-15 Completed his enrollment today and sent the welcome pack.";

  it('renders plain-text history that carries no markup', () => {
    expect(hasLegacyNotesHistory(plain)).toBe(true);
    expect(isLegacyNotesHistoryHtml(plain)).toBe(false);
  });

  it('still suppresses short scalars stuffed into the same key', () => {
    expect(hasLegacyNotesHistory('Plan ID 49375CO0060034-00')).toBe(false);
    expect(hasLegacyNotesHistory('')).toBe(false);
    expect(hasLegacyNotesHistory(null)).toBe(false);
  });
});

describe('legacy twin collapse is bounded by time', () => {
  const body = 'Left a detailed message on voicemail. Sent email to book the welcome call';
  const legacy = (id: string, created_at: string) => ({ id, body, created_at, created_by: null });

  it('collapses the UTC/local double-load a few hours apart', () => {
    const rows = [
      legacy('a', '2026-03-02T01:00:00Z'),
      legacy('b', '2026-03-01T19:00:00Z'),
    ];
    expect(dedupeNotesForDisplay(rows).map((n) => n.id)).toEqual(['a']);
  });

  it('keeps the same templated line sent again months later', () => {
    // Three genuine outreach attempts, 816h / 822h / 2737h apart in prod.
    const rows = [
      legacy('sep', '2026-09-01T12:00:00Z'),
      legacy('jun', '2026-06-01T12:00:00Z'),
      legacy('mar', '2026-03-01T12:00:00Z'),
    ];
    expect(dedupeNotesForDisplay(rows).map((n) => n.id)).toEqual(['sep', 'jun', 'mar']);
  });

  it('never collapses notes a rep actually wrote', () => {
    const rep = (id: string, created_at: string) => ({
      id, body, created_at, created_by: 'user-1',
    });
    const rows = [rep('a', '2026-03-01T12:00:00Z'), rep('b', '2026-03-01T13:00:00Z')];
    expect(dedupeNotesForDisplay(rows).map((n) => n.id)).toEqual(['a', 'b']);
  });
});

import { describe, expect, it } from 'vitest';

/**
 * Mirrors parsePlainTextNotes in
 * apps/crm/src/app/crm/r/[recordId]/LegacyNotesCard.tsx.
 *
 * Zoho's plain-text history dumps carry no separator, so several
 * conversations months apart rendered as one wall of text. A line that STARTS
 * with a date begins a new entry; a date mid-sentence must never split.
 * Measured against all 703 plain-text records in production: 639 stayed a
 * single entry, 64 split into 2-6, and no fragment came out under 25 chars.
 */
const PLAIN_ENTRY_DATE = /^[ \t]*(\d{1,2}[-./]\d{1,2}[-./]\d{2,4})[.:\s-]/gm;
const MAX_MERGED_PREAMBLE = 40;

function splitPlain(raw: string): string[] {
  const starts: number[] = [];
  PLAIN_ENTRY_DATE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PLAIN_ENTRY_DATE.exec(raw)) !== null) starts.push(m.index);
  if (starts.length === 0) return [raw.trim()].filter(Boolean);
  const chunks = starts.map((s, i) =>
    raw.slice(s, i + 1 < starts.length ? starts[i + 1] : raw.length).trim(),
  );
  const preamble = raw.slice(0, starts[0]).trim();
  if (preamble) {
    if (preamble.length < MAX_MERGED_PREAMBLE) chunks[0] = `${preamble}\n${chunks[0]}`;
    else chunks.unshift(preamble);
  }
  return chunks.filter((c) => c.length > 0);
}

describe('plain-text imported history splits on date-led lines', () => {
  it('separates real conversations (Else Engel: 6 dated entries)', () => {
    const raw = [
      '10.29.15:  Met Else at a Women’s Event. Practice Liaison for Vado Therapy.',
      '10.31.15:  Emailed Else a flyer and link to the website.',
      '11.04.15:  Else emailed. Her office manager Marie has questions.',
      '11.05.15:  Emailed agreement and confirmed the date.',
      '11.06.15: Emailed Else confirmation of meeting.',
      '11.11.15:  Met with Else and Marie. Currently on Medishare.',
    ].join('\n\n');
    const parts = splitPlain(raw);
    expect(parts).toHaveLength(6);
    expect(parts[0]).toContain('Vado Therapy');
    expect(parts[5]).toContain('Medishare');
  });

  it('handles the Steve Spencer shape: two dated entries plus an undated tail', () => {
    const raw =
      "2-18-16 Spoke with Dee extensively. She's going to apply for HES.\n\n" +
      '1-22-16 Works for Celestial Seasonings and is turning 64 in two months.\n\n' +
      'Steve had a heart condition four years ago and sticks with regular insurance.';
    const parts = splitPlain(raw);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain('2-18-16');
    // the undated tail stays attached to the entry it followed
    expect(parts[1]).toContain('heart condition');
  });

  it('never splits on a date in the MIDDLE of a sentence', () => {
    const raw =
      '3-15-16 Client is turning 64 in 3/2016 and renewed on 5/1/2016 per the carrier.';
    expect(splitPlain(raw)).toHaveLength(1);
  });

  it('keeps history with no dates as a single entry', () => {
    const raw =
      'We would like to find a plan to keep indefinitely. We are tired of switching plans every six months.';
    expect(splitPlain(raw)).toEqual([raw]);
  });

  it('folds a short undated preamble (a rep name) into the first entry', () => {
    const parts = splitPlain('Dasia\n\n3-15-16 Called and left a voicemail.');
    expect(parts).toHaveLength(1);
    expect(parts[0]).toContain('Dasia');
    expect(parts[0]).toContain('3-15-16');
  });

  it('keeps a LONG undated preamble as its own entry', () => {
    const long = 'x'.repeat(60);
    const parts = splitPlain(`${long}\n\n3-15-16 Called and left a voicemail.`);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBe(long);
  });

  it('accepts the date formats actually present in production', () => {
    for (const d of ['12-8-16', '5/31/16', '10.29.15', '9/14/2016', '10/13/20']) {
      expect(splitPlain(`${d} first note.\n${d} second note.`)).toHaveLength(2);
    }
  });
});

describe('the promoted date is not printed twice', () => {
  // The date becomes the entry header, so it must not also lead the body.
  function headerAndBody(text: string) {
    const m = text.match(/^[ \t]*(\d{1,2}[-./]\d{1,2}[-./]\d{2,4})[.:\s-]*/);
    return { timestamp: m ? m[1] : null, body: m ? text.slice(m[0].length) : text };
  }

  it('strips the leading date from the body', () => {
    const { timestamp, body } = headerAndBody('2-18-16 Spoke with Dee extensively.');
    expect(timestamp).toBe('2-18-16');
    expect(body).toBe('Spoke with Dee extensively.');
  });

  it('handles the dotted, colon-suffixed form', () => {
    const { timestamp, body } = headerAndBody('10.29.15:  Met Else at the event.');
    expect(timestamp).toBe('10.29.15');
    expect(body).toBe('Met Else at the event.');
  });

  it('leaves a date mentioned INSIDE the note untouched', () => {
    const { body } = headerAndBody('3-15-16 Renewed on 5/1/2016 per the carrier.');
    expect(body).toBe('Renewed on 5/1/2016 per the carrier.');
  });

  it('leaves an undated entry completely alone', () => {
    const { timestamp, body } = headerAndBody('We would like a plan to keep indefinitely.');
    expect(timestamp).toBeNull();
    expect(body).toBe('We would like a plan to keep indefinitely.');
  });
});

describe('HTML imported history: the bold timestamp is not printed twice', () => {
  // Mirrors parseNotesHtml. Across 680 production records, 2,426 of 2,475
  // entries carry a bold prefix and every one is a date, so stripping the
  // promoted prefix loses nothing the header does not already show.
  function headerAndBody(html: string) {
    const m = html.match(/^<b>(.*?)<\/b>\s*:\s*/i);
    return {
      timestamp: m ? m[1].trim() : null,
      body: m ? html.slice(m[0].length) : html,
    };
  }

  it('strips the promoted bold timestamp from the body', () => {
    const { timestamp, body } = headerAndBody(
      '<b>1/4/2015 12:32 PM</b>: Spoke with the member about renewal.',
    );
    expect(timestamp).toBe('1/4/2015 12:32 PM');
    expect(body).toBe('Spoke with the member about renewal.');
  });

  it('leaves bold text that is NOT a leading prefix alone', () => {
    const html = 'Member said <b>do not call</b>: before noon.';
    const { timestamp, body } = headerAndBody(html);
    expect(timestamp).toBeNull();
    expect(body).toBe(html);
  });

  it('leaves an entry with no prefix untouched', () => {
    const html = 'Follow-up scheduled for next week.';
    expect(headerAndBody(html).body).toBe(html);
  });
});

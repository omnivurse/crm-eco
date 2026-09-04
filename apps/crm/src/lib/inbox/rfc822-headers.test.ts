import { describe, expect, it } from 'vitest';
import {
  buildReferencesChain,
  inboundSentAt,
  parseMessageIdHeader,
  parseReferencesHeader,
} from '../../../../../supabase/functions/_shared/rfc822-headers';

const ROOT = '<SN4PR14MB9585651514F5BF2D973904C1F4FAA82@SN4PR14MB958565.namprd14.prod.outlook.com>';
const SECOND = '<PH6PR14MB958163D0D76677107CA71D9E999CB62@PH6PR14MB958163.namprd14.prod.outlook.com>';

describe('parseReferencesHeader', () => {
  it('parses the ordinary space-delimited RFC822 form', () => {
    expect(parseReferencesHeader(`${ROOT} ${SECOND}`)).toEqual([ROOT, SECOND]);
  });

  it('parses a folded header spanning multiple lines', () => {
    expect(parseReferencesHeader(`${ROOT}\r\n\t${SECOND}`)).toEqual([ROOT, SECOND]);
  });

  it('parses the JSON-encoded form that used to corrupt the chain', () => {
    // The exact shape that reached production: a stringified array, which
    // whitespace-splitting collapsed into one bogus id.
    expect(parseReferencesHeader(`["${ROOT}","${SECOND}"]`)).toEqual([ROOT, SECOND]);
  });

  it('parses an array that arrives already decoded', () => {
    expect(parseReferencesHeader([ROOT, SECOND])).toEqual([ROOT, SECOND]);
  });

  it('parses the double-encoded value stored on the corrupted row', () => {
    expect(parseReferencesHeader([`["${ROOT}","${SECOND}"]`])).toEqual([ROOT, SECOND]);
  });

  it('parses comma-delimited ids', () => {
    expect(parseReferencesHeader(`${ROOT}, ${SECOND}`)).toEqual([ROOT, SECOND]);
  });

  it('deduplicates while preserving order', () => {
    expect(parseReferencesHeader(`${ROOT} ${SECOND} ${ROOT}`)).toEqual([ROOT, SECOND]);
  });

  it('returns nothing for empty, null, or junk input', () => {
    expect(parseReferencesHeader(null)).toEqual([]);
    expect(parseReferencesHeader(undefined)).toEqual([]);
    expect(parseReferencesHeader('')).toEqual([]);
    expect(parseReferencesHeader('   ')).toEqual([]);
    expect(parseReferencesHeader({})).toEqual([]);
  });

  it('keeps unbracketed ids from legacy senders', () => {
    expect(parseReferencesHeader('abc@example.com def@example.com')).toEqual([
      'abc@example.com',
      'def@example.com',
    ]);
  });
});

describe('corrupted values recovered from production', () => {
  // The defect compounded: each reply wrapped the previous blob in angle
  // brackets and the next inbound quoted that, nesting one level per round
  // trip. Recovery has to survive arbitrary nesting depth.
  const SES = '<010001a0359f99a3-07815ce1-87c4-4b02-90ac-10060bd058b9-000000@email.amazonses.com>';
  const OUTLOOK = '<EA2PR16MB6253FC524FFA5CF753A8C6A6C0A02@EA2PR16MB6253.namprd16.prod.outlook.com>';
  const LATEST = '<EA2PR16MB625391897A2C59B15AA5CBC1C0AF2@EA2PR16MB6253.namprd16.prod.outlook.com>';

  it('recovers ids from a singly nested JSON blob', () => {
    expect(parseReferencesHeader([`["${SES}","${OUTLOOK}"]`])).toEqual([SES, OUTLOOK]);
  });

  it('recovers ids from a doubly nested angle-wrapped blob', () => {
    const stored = [`<["<[\\"${SES}\\",\\"${OUTLOOK}\\"]>","${LATEST}"]>`];
    expect(parseReferencesHeader(stored)).toEqual([SES, OUTLOOK, LATEST]);
  });
});

describe('inboundSentAt', () => {
  const RECEIVED = '2026-09-03T22:50:56.000Z';

  it('uses the Date header so a delayed webhook still sorts correctly', () => {
    expect(inboundSentAt('Thu, 3 Sep 2026 20:45:13 +0000', RECEIVED)).toBe(
      '2026-09-03T20:45:13.000Z',
    );
  });

  it('honours the sender timezone offset', () => {
    expect(inboundSentAt('Thu, 3 Sep 2026 14:45:13 -0600', RECEIVED)).toBe(
      '2026-09-03T20:45:13.000Z',
    );
  });

  it('falls back to arrival time when the header is missing or unparseable', () => {
    expect(inboundSentAt(null, RECEIVED)).toBe(RECEIVED);
    expect(inboundSentAt('', RECEIVED)).toBe(RECEIVED);
    expect(inboundSentAt('not a date', RECEIVED)).toBe(RECEIVED);
  });

  it('accepts an older date, because forwarded mail is legitimately old', () => {
    expect(inboundSentAt('Tue, 1 Sep 2026 22:48:36 +0000', RECEIVED)).toBe(
      '2026-09-01T22:48:36.000Z',
    );
  });

  it('rejects a far-future date that would pin the message to the thread end', () => {
    expect(inboundSentAt('Fri, 3 Sep 2027 20:45:13 +0000', RECEIVED)).toBe(RECEIVED);
  });

  it('tolerates modest clock skew', () => {
    expect(inboundSentAt('Thu, 3 Sep 2026 23:10:00 +0000', RECEIVED)).toBe(
      '2026-09-03T23:10:00.000Z',
    );
  });
});

describe('parseMessageIdHeader', () => {
  it('returns the single id', () => {
    expect(parseMessageIdHeader(ROOT)).toBe(ROOT);
  });

  it('unwraps a JSON-encoded single id', () => {
    expect(parseMessageIdHeader(`["${ROOT}"]`)).toBe(ROOT);
  });

  it('takes the first id when a sender crams in several', () => {
    expect(parseMessageIdHeader(`${ROOT} ${SECOND}`)).toBe(ROOT);
  });

  it('returns null when absent', () => {
    expect(parseMessageIdHeader(null)).toBeNull();
    expect(parseMessageIdHeader('')).toBeNull();
  });
});

describe('buildReferencesChain', () => {
  it('accumulates the whole thread and ends on the parent', () => {
    const chain = buildReferencesChain(
      [
        { message_id: ROOT, references_ids: null },
        { message_id: SECOND, references_ids: [ROOT] },
      ],
      SECOND,
    );
    expect(chain).toEqual([ROOT, SECOND]);
  });

  it('recovers the full chain even when one stored row is corrupted', () => {
    // Regression: the corrupted row truncated the outgoing header to one id.
    const chain = buildReferencesChain(
      [
        { message_id: ROOT, references_ids: null },
        { message_id: SECOND, references_ids: [`["${ROOT}","${SECOND}"]`] },
      ],
      SECOND,
    );
    expect(chain).toEqual([ROOT, SECOND]);
  });

  it('never repeats an id', () => {
    const chain = buildReferencesChain(
      [
        { message_id: ROOT, references_ids: [ROOT] },
        { message_id: SECOND, references_ids: [ROOT, SECOND] },
      ],
      SECOND,
    );
    expect(chain).toEqual([ROOT, SECOND]);
  });

  it('works with no parent', () => {
    expect(buildReferencesChain([{ message_id: ROOT }], null)).toEqual([ROOT]);
  });

  it('returns nothing for an empty thread', () => {
    expect(buildReferencesChain([], null)).toEqual([]);
  });

  it('keeps the root id when trimming a long thread', () => {
    const messages = Array.from({ length: 60 }, (_, i) => ({
      message_id: `<msg-${i}@example.com>`,
    }));
    const chain = buildReferencesChain(messages, '<msg-59@example.com>', 40);
    expect(chain).toHaveLength(40);
    expect(chain[0]).toBe('<msg-0@example.com>');
    expect(chain[chain.length - 1]).toBe('<msg-59@example.com>');
  });
});

import { describe, expect, it } from 'vitest';
import { buildInviteIcs } from './ics';
import type { InviteIcsInput } from './ics';

function baseInput(overrides: Partial<InviteIcsInput> = {}): InviteIcsInput {
  return {
    event: {
      title: 'Enrollment review',
      description: 'Walk through the enrollment paperwork.',
      location: 'Suite 210, 1 Main St',
      meeting_url: 'https://meet.example.com/room/abc123',
      start_at: '2026-09-10T14:30:00.000Z', // 10:30 in America/New_York (EDT)
      end_at: '2026-09-10T15:30:00.000Z',
      all_day: false,
      timezone: 'America/New_York',
      ical_uid: 'evt-1a2b3c@crm-eco',
      ical_sequence: 3,
      status: 'confirmed',
    },
    organizer: { email: 'dana@example.com', name: 'Dana Organizer' },
    attendees: [
      { email: 'pat@example.com', name: 'Pat Example', role: 'required', rsvp_status: 'needs_action' },
      { email: 'sam@example.com', name: null, role: 'optional', rsvp_status: 'accepted' },
    ],
    method: 'REQUEST',
    ...overrides,
  };
}

/** Normalize CRLF to LF for substring assertions. */
function normalize(content: string): string {
  return content.replace(/\r\n/g, '\n');
}

/** Undo RFC 5545 line folding, then normalize CRLF. */
function unfold(content: string): string {
  return normalize(content.replace(/\r\n[ \t]/g, ''));
}

describe('buildInviteIcs', () => {
  it('emits METHOD:REQUEST with matching filename and content type', () => {
    const part = buildInviteIcs(baseInput());
    expect(normalize(part.content)).toContain('METHOD:REQUEST');
    expect(part.filename).toBe('invite.ics');
    expect(part.contentType).toBe('text/calendar; method=REQUEST; charset=UTF-8');
  });

  it('emits METHOD:CANCEL with STATUS:CANCELLED, cancel filename and content type', () => {
    const part = buildInviteIcs(baseInput({ method: 'CANCEL' }));
    const text = normalize(part.content);
    expect(text).toContain('METHOD:CANCEL');
    expect(text).toContain('STATUS:CANCELLED');
    expect(text).not.toContain('STATUS:CONFIRMED');
    expect(part.filename).toBe('cancel.ics');
    expect(part.contentType).toBe('text/calendar; method=CANCEL; charset=UTF-8');
  });

  it('carries the calendar envelope: PRODID, VERSION, CALSCALE and STATUS:CONFIRMED', () => {
    const text = normalize(buildInviteIcs(baseInput()).content);
    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text).toContain('VERSION:2.0');
    expect(text).toContain('PRODID:-//crm-eco//CRM Calendar//EN');
    expect(text).toContain('CALSCALE:GREGORIAN');
    expect(text).toContain('STATUS:CONFIRMED');
    expect(text).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
  });

  it('propagates UID and SEQUENCE verbatim', () => {
    const text = normalize(buildInviteIcs(baseInput()).content);
    expect(text).toContain('UID:evt-1a2b3c@crm-eco');
    expect(text).toContain('SEQUENCE:3');
  });

  it('emits TZID wall times and a VTIMEZONE block for a timed event', () => {
    const text = unfold(buildInviteIcs(baseInput()).content);
    expect(text).toContain('DTSTART;TZID=America/New_York:20260910T103000');
    expect(text).toContain('DTEND;TZID=America/New_York:20260910T113000');
    expect(text).toContain('BEGIN:VTIMEZONE');
    expect(text).toContain('TZID:America/New_York');
    expect(text).toContain('END:VTIMEZONE');
  });

  it('uses DATE values for all-day events', () => {
    const input = baseInput();
    input.event = {
      ...input.event,
      all_day: true,
      start_at: '2026-09-10T04:00:00.000Z', // midnight in America/New_York (EDT)
      end_at: '2026-09-11T04:00:00.000Z',
    };
    const text = unfold(buildInviteIcs(input).content);
    expect(text).toContain('DTSTART;VALUE=DATE:20260910');
    expect(text).toContain('DTEND;VALUE=DATE:20260911');
    expect(text).not.toContain('DTSTART;TZID=');
  });

  it('maps attendees to RSVP=TRUE lines with the right ROLE, PARTSTAT, CUTYPE and CN', () => {
    const input = baseInput({
      attendees: [
        { email: 'pat@example.com', name: 'Pat Example', role: 'required', rsvp_status: 'needs_action' },
        { email: 'sam@example.com', name: null, role: 'optional', rsvp_status: 'accepted' },
        { email: 'lee@example.com', name: 'Lee Decline', role: 'required', rsvp_status: 'declined' },
        { email: 'kim@example.com', name: 'Kim Maybe', role: 'required', rsvp_status: 'tentative' },
      ],
    });
    const text = unfold(buildInviteIcs(input).content);
    const attendeeLines = text.split('\n').filter((line) => line.startsWith('ATTENDEE'));
    expect(attendeeLines).toHaveLength(4);

    const pat = attendeeLines.find((line) => line.includes('MAILTO:pat@example.com'));
    expect(pat).toContain('ROLE=REQ-PARTICIPANT');
    expect(pat).toContain('PARTSTAT=NEEDS-ACTION');
    expect(pat).toContain('RSVP=TRUE');
    expect(pat).toContain('CUTYPE=INDIVIDUAL');
    expect(pat).toContain('CN="Pat Example"');

    const sam = attendeeLines.find((line) => line.includes('MAILTO:sam@example.com'));
    expect(sam).toContain('ROLE=OPT-PARTICIPANT');
    expect(sam).toContain('PARTSTAT=ACCEPTED');
    expect(sam).toContain('RSVP=TRUE');
    expect(sam).not.toContain('CN=');

    const lee = attendeeLines.find((line) => line.includes('MAILTO:lee@example.com'));
    expect(lee).toContain('PARTSTAT=DECLINED');

    const kim = attendeeLines.find((line) => line.includes('MAILTO:kim@example.com'));
    expect(kim).toContain('PARTSTAT=TENTATIVE');
  });

  it('emits the organizer with a CN', () => {
    const text = unfold(buildInviteIcs(baseInput()).content);
    expect(text).toContain('ORGANIZER;CN="Dana Organizer":mailto:dana@example.com');
  });

  it('does not duplicate an attendee row that mirrors the organizer', () => {
    const input = baseInput({
      attendees: [
        { email: 'dana@example.com', name: 'Dana Organizer', role: 'organizer', rsvp_status: 'accepted' },
        { email: 'pat@example.com', name: 'Pat Example', role: 'required', rsvp_status: 'needs_action' },
      ],
    });
    const text = unfold(buildInviteIcs(input).content);
    const attendeeLines = text.split('\n').filter((line) => line.startsWith('ATTENDEE'));
    expect(attendeeLines).toHaveLength(1);
    expect(attendeeLines[0]).toContain('MAILTO:pat@example.com');
    expect(text.match(/mailto:dana@example\.com/gi)).toHaveLength(1); // ORGANIZER line only
  });

  it('includes the meeting URL in DESCRIPTION, URL and the LOCATION fallback', () => {
    const withLocation = unfold(buildInviteIcs(baseInput()).content);
    expect(withLocation).toContain('Join: https://meet.example.com/room/abc123');
    expect(withLocation).toContain('URL;VALUE=URI:https://meet.example.com/room/abc123');
    expect(withLocation).toContain('LOCATION:Suite 210');

    const input = baseInput();
    input.event = { ...input.event, location: null };
    const withoutLocation = unfold(buildInviteIcs(input).content);
    expect(withoutLocation).toContain('LOCATION:https://meet.example.com/room/abc123');
  });

  it('folds long lines so no raw line exceeds 76 octets', () => {
    const input = baseInput();
    input.event = {
      ...input.event,
      description:
        'This agenda intentionally rambles far beyond the seventy-five octet limit of RFC 5545 ' +
        'content lines so that the generator is forced to fold it across several continuation ' +
        'lines, each of which must begin with a single space character.',
    };
    const content = buildInviteIcs(input).content;
    const lines = content.split('\r\n');
    for (const line of lines) {
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(76);
    }
    expect(lines.some((line) => line.startsWith(' '))).toBe(true);
  });
});

/**
 * iCalendar (iTIP) generation for meeting invites.
 *
 * Builds the `text/calendar` MIME part attached to invite (METHOD:REQUEST) and
 * cancellation (METHOD:CANCEL) emails. Timed events carry the event's IANA
 * timezone as a TZID on DTSTART/DTEND plus a matching VTIMEZONE block (emitted
 * by @touch4it/ical-timezones through ical-generator's VTimezone generator
 * hook); all-day events use DATE values instead.
 *
 * Pure and deterministic apart from DTSTAMP, which ical-generator stamps with
 * the generation time as iTIP requires.
 */

import { getVtimezoneComponent } from '@touch4it/ical-timezones';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import ical, {
  ICalAttendeeRole,
  ICalAttendeeStatus,
  ICalAttendeeType,
  ICalCalendarMethod,
  ICalEventStatus,
} from 'ical-generator';

import type { CalendarAttendeeRow, CalendarEventRow } from './types';

export interface InviteIcsInput {
  event: Pick<
    CalendarEventRow,
    | 'title'
    | 'description'
    | 'location'
    | 'meeting_url'
    | 'start_at'
    | 'end_at'
    | 'all_day'
    | 'timezone'
    | 'ical_uid'
    | 'ical_sequence'
    | 'status'
  >;
  organizer: { email: string; name?: string | null };
  attendees: Array<Pick<CalendarAttendeeRow, 'email' | 'name' | 'role' | 'rsvp_status'>>;
  method: 'REQUEST' | 'CANCEL';
}

export interface InviteIcsPart {
  /** 'invite.ics' for REQUEST, 'cancel.ics' for CANCEL. */
  filename: string;
  /** Full VCALENDAR text (CRLF line endings, folded per RFC 5545). */
  content: string;
  /** MIME type carrying the iTIP method, e.g. `text/calendar; method=REQUEST; charset=UTF-8`. */
  contentType: string;
}

const PARTSTAT_BY_RSVP_STATUS: Record<CalendarAttendeeRow['rsvp_status'], ICalAttendeeStatus> = {
  accepted: ICalAttendeeStatus.ACCEPTED,
  declined: ICalAttendeeStatus.DECLINED,
  needs_action: ICalAttendeeStatus.NEEDSACTION,
  tentative: ICalAttendeeStatus.TENTATIVE,
};

const STATUS_BY_EVENT_STATUS: Record<CalendarEventRow['status'], ICalEventStatus> = {
  cancelled: ICalEventStatus.CANCELLED,
  confirmed: ICalEventStatus.CONFIRMED,
  tentative: ICalEventStatus.TENTATIVE,
};

/**
 * ical-generator formats a plain Date through the machine-local getters when an
 * event timezone is set, so shift the UTC instant to a Date whose local fields
 * read as the wall-clock time in the event's zone (`toZonedTime`). The emitted
 * DTSTART/DTEND is then the floating wall time that the TZID qualifies.
 */
function toEventWallTime(isoUtc: string, timezone: string): Date {
  return toZonedTime(new Date(isoUtc), timezone);
}

/**
 * All-day events carry no TZID (DATE values are zone-less), and without an
 * event timezone ical-generator reads the UTC getters — so pin the calendar
 * date of the instant in the event's zone to midnight UTC.
 */
function toAllDayDate(isoUtc: string, timezone: string): Date {
  return new Date(`${formatInTimeZone(new Date(isoUtc), timezone, 'yyyy-MM-dd')}T00:00:00Z`);
}

function buildDescription(description: string | null, meetingUrl: string | null): string | null {
  const parts: string[] = [];
  if (description && description.trim()) {
    parts.push(description.trim());
  }
  if (meetingUrl) {
    parts.push(`Join: ${meetingUrl}`);
  }
  return parts.length > 0 ? parts.join('\n\n') : null;
}

export function buildInviteIcs(input: InviteIcsInput): InviteIcsPart {
  const { attendees, event, method, organizer } = input;

  const calendar = ical({
    method: method === 'CANCEL' ? ICalCalendarMethod.CANCEL : ICalCalendarMethod.REQUEST,
    prodId: { company: 'crm-eco', product: 'CRM Calendar' },
    scale: 'GREGORIAN',
    // name: null keeps TIMEZONE-ID/X-WR-TIMEZONE off the feed; the generator
    // still runs for every event timezone and emits its VTIMEZONE block.
    timezone: { generator: getVtimezoneComponent, name: null },
  });

  const icalEvent = calendar.createEvent({
    allDay: event.all_day,
    description: buildDescription(event.description, event.meeting_url),
    end: event.all_day
      ? toAllDayDate(event.end_at, event.timezone)
      : toEventWallTime(event.end_at, event.timezone),
    id: event.ical_uid,
    location: event.location || event.meeting_url || null,
    organizer: {
      email: organizer.email,
      // ical-generator always emits CN; fall back to the address when the
      // organizer has no display name.
      name: organizer.name || organizer.email,
    },
    sequence: event.ical_sequence,
    start: event.all_day
      ? toAllDayDate(event.start_at, event.timezone)
      : toEventWallTime(event.start_at, event.timezone),
    status: method === 'CANCEL' ? ICalEventStatus.CANCELLED : STATUS_BY_EVENT_STATUS[event.status],
    summary: event.title,
    url: event.meeting_url,
  });

  if (!event.all_day) {
    icalEvent.timezone(event.timezone);
  }

  const organizerEmail = organizer.email.trim().toLowerCase();
  for (const attendee of attendees) {
    // The organizer already appears on the ORGANIZER line; do not repeat them
    // as an ATTENDEE.
    if (attendee.role === 'organizer' && attendee.email.trim().toLowerCase() === organizerEmail) {
      continue;
    }
    icalEvent.createAttendee({
      email: attendee.email,
      name: attendee.name || undefined,
      role: attendee.role === 'optional' ? ICalAttendeeRole.OPT : ICalAttendeeRole.REQ,
      rsvp: true,
      status: PARTSTAT_BY_RSVP_STATUS[attendee.rsvp_status],
      type: ICalAttendeeType.INDIVIDUAL,
    });
  }

  return {
    content: calendar.toString(),
    contentType: `text/calendar; method=${method}; charset=UTF-8`,
    filename: method === 'CANCEL' ? 'cancel.ics' : 'invite.ics',
  };
}

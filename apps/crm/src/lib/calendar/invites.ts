// ============================================================================
// Meeting invite orchestration: fan out iTIP emails through sendEmail().
//
// One email per attendee (identical ICS listing everyone, personalized RSVP
// links), riding the existing send pipeline so provider selection, threading,
// outbox durability, logging, and suppression behavior all apply. RSVP state
// lands on crm_calendar_event_attendees via /api/rsvp/[token] (links) today
// and iTIP REPLY parsing later — both write the same columns.
// ============================================================================

import { formatInTimeZone } from 'date-fns-tz';
import { sendEmail } from '@/lib/email/send-service';
import { buildInviteIcs } from './ics';
import type { CalendarAttendeeRow, CalendarEventRow } from './types';

const RSVP_ACTIONS = [
  { intent: 'accepted', label: 'Accept', bg: '#0d9488' },
  { intent: 'tentative', label: 'Maybe', bg: '#64748b' },
  { intent: 'declined', label: 'Decline', bg: '#b91c1c' },
] as const;

export function appBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_SITE_URL is required for meeting invites');
  }
  return url.replace(/\/$/, '');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Human date line rendered in the event's own timezone, tz label included. */
export function formatEventWindow(event: Pick<CalendarEventRow, 'start_at' | 'end_at' | 'all_day' | 'timezone'>): string {
  const tz = event.timezone || 'UTC';
  try {
    if (event.all_day) {
      return `${formatInTimeZone(new Date(event.start_at), tz, 'EEEE, MMMM d, yyyy')} (all day)`;
    }
    const day = formatInTimeZone(new Date(event.start_at), tz, 'EEEE, MMMM d, yyyy');
    const from = formatInTimeZone(new Date(event.start_at), tz, 'h:mm a');
    const to = formatInTimeZone(new Date(event.end_at), tz, 'h:mm a zzz');
    return `${day} · ${from} – ${to}`;
  } catch {
    return new Date(event.start_at).toUTCString();
  }
}

/** Inline-styled meeting card + personalized RSVP buttons for one attendee. */
export function buildInviteEmailHtml(input: {
  event: Pick<CalendarEventRow, 'title' | 'description' | 'location' | 'meeting_url' | 'start_at' | 'end_at' | 'all_day' | 'timezone'>;
  organizerName: string;
  rsvpToken: string;
  cancelled?: boolean;
}): string {
  const { event, organizerName, rsvpToken, cancelled } = input;
  const base = appBaseUrl();
  const when = formatEventWindow(event);

  const detailRow = (label: string, valueHtml: string) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#64748b;font-size:13px;vertical-align:top;white-space:nowrap">${label}</td>` +
    `<td style="padding:4px 0;color:#1f2937;font-size:13px">${valueHtml}</td></tr>`;

  const rows = [
    detailRow('When', escapeHtml(when)),
    event.location ? detailRow('Where', escapeHtml(event.location)) : '',
    event.meeting_url
      ? detailRow('Join', `<a href="${escapeHtml(event.meeting_url)}" style="color:#0d9488">${escapeHtml(event.meeting_url)}</a>`)
      : '',
  ].join('');

  const buttons = cancelled
    ? ''
    : `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0 0"><tr>` +
      RSVP_ACTIONS.map(
        (action) =>
          `<td style="padding:0 8px 0 0"><a href="${base}/rsvp/${rsvpToken}?intent=${action.intent}" ` +
          `style="display:inline-block;padding:10px 22px;background-color:${action.bg};color:#ffffff;` +
          `font-size:14px;text-decoration:none;border-radius:6px">${action.label}</a></td>`
      ).join('') +
      `</tr></table>` +
      `<p style="margin:10px 0 0;font-size:12px;color:#94a3b8">Or reply from your calendar — this invitation works natively in Gmail and Outlook.</p>`;

  return (
    `<div style="font-family:Arial, Helvetica, sans-serif;font-size:14px;color:#1f2937;line-height:1.5">` +
    `<p style="margin:0 0 12px">${escapeHtml(organizerName)} ${cancelled ? 'cancelled this meeting' : 'invited you to a meeting'}.</p>` +
    `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;background-color:#f8fafc">` +
    `<p style="margin:0 0 8px;font-size:16px;font-weight:bold;color:#0f172a">${escapeHtml(event.title)}${cancelled ? ' (cancelled)' : ''}</p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${rows}</table>` +
    (event.description
      ? `<p style="margin:12px 0 0;font-size:13px;color:#475569">${escapeHtml(event.description)}</p>`
      : '') +
    buttons +
    `</div></div>`
  );
}

export interface SendInvitesInput {
  event: CalendarEventRow;
  attendees: CalendarAttendeeRow[];
  organizer: { email: string; name: string };
  method: 'REQUEST' | 'CANCEL';
  /** Persist one copy of the invite onto this inbox thread. */
  conversationId?: string | null;
  /** Called after each successful send to stamp invited_sequence/invited_at. */
  onInvited: (attendeeId: string) => Promise<void>;
}

export interface SendInvitesResult {
  sent: number;
  failed: Array<{ email: string; error: string }>;
}

/**
 * Fan out one iTIP email per non-organizer attendee. Recurring events are
 * refused here (v1: recurrence is stored but invites for it are not defined).
 */
export async function sendMeetingInvites(input: SendInvitesInput): Promise<SendInvitesResult> {
  const { event, attendees, organizer, method } = input;
  if (event.recurrence_rule) {
    throw new Error('Invites for recurring meetings are not supported yet.');
  }

  const recipients = attendees.filter(
    (attendee) =>
      attendee.role !== 'organizer' &&
      attendee.email.trim().toLowerCase() !== organizer.email.trim().toLowerCase(),
  );

  const ics = buildInviteIcs({
    event,
    organizer,
    attendees: attendees.map(({ email, name, role, rsvp_status }) => ({ email, name, role, rsvp_status })),
    method,
  });

  const cancelled = method === 'CANCEL';
  const subject = cancelled
    ? `Cancelled: ${event.title}`
    : `Invitation: ${event.title} — ${formatEventWindow(event)}`;

  const result: SendInvitesResult = { sent: 0, failed: [] };
  let persistedToThread = false;

  for (const attendee of recipients) {
    const sendResult = await sendEmail({
      to: attendee.email,
      to_name: attendee.name ?? undefined,
      subject,
      body_html: buildInviteEmailHtml({
        event,
        organizerName: organizer.name,
        rsvpToken: attendee.rsvp_token,
        cancelled,
      }),
      calendar: { method, ics: ics.content, filename: ics.filename },
      calendar_event_id: event.id,
      // One copy on the linked thread is enough — not one per attendee.
      conversation_id: !persistedToThread && input.conversationId ? input.conversationId : undefined,
      persist_inbox: !persistedToThread && Boolean(input.conversationId),
      idempotency_key: `meeting-invite/${event.id}/${attendee.id}/${event.ical_sequence}/${method}`,
    });

    if (sendResult.success) {
      result.sent += 1;
      if (input.conversationId) persistedToThread = true;
      await input.onInvited(attendee.id);
    } else {
      result.failed.push({ email: attendee.email, error: sendResult.error || 'send failed' });
    }
  }

  return result;
}

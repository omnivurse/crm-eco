/**
 * GET /api/cron/meeting-reminders
 *
 * Sends reminder emails (and in-app notifications for attendees with a
 * profile) for confirmed calendar events whose reminder window has opened
 * but whose start time hasn't passed yet.
 *
 * Idempotent per attendee — `reminder_sent_at` is stamped on the attendee
 * row right after a successful send, so a crashed run resends at most the
 * unstamped remainder.
 *
 * Cross-org by design: the event query is not filtered by organization
 * (service-role cron sweeps every org); every follow-up query is scoped by
 * primary key (event id / attendee id) and organization_id is carried
 * through for logging and notification inserts.
 *
 * Schedule: every 5 minutes (via Vercel cron)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { appBaseUrl, formatEventWindow } from '@/lib/calendar/invites';
import type { CalendarAttendeeRow, CalendarEventRow } from '@/lib/calendar/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Reminder windows can be long (up to weeks), so candidates are fetched over
// a wide horizon and the per-row reminder_minutes filter is applied in JS.
const CANDIDATE_HORIZON_MS = 28 * 24 * 60 * 60 * 1000;

type ReminderEventRow = Pick<
  CalendarEventRow,
  | 'id'
  | 'organization_id'
  | 'title'
  | 'description'
  | 'location'
  | 'meeting_url'
  | 'start_at'
  | 'end_at'
  | 'all_day'
  | 'timezone'
  | 'status'
  | 'reminder_minutes'
  | 'conversation_id'
>;

type ReminderAttendeeRow = Pick<
  CalendarAttendeeRow,
  | 'id'
  | 'organization_id'
  | 'event_id'
  | 'profile_id'
  | 'email'
  | 'name'
  | 'role'
  | 'rsvp_status'
  | 'reminder_sent_at'
  | 'rsvp_token'
>;

function authorised(request: NextRequest): boolean {
  if (request.headers.get('x-vercel-cron')) return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

// ============================================================================
// Email (same Resend pattern as src/lib/email/transactional.ts — that module
// exports no generic send helper, so the pattern is followed inline here)
// ============================================================================

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is required for meeting reminders');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

function getDefaultFromEmail(): string {
  const email = process.env.RESEND_FROM_EMAIL;
  if (!email) throw new Error('RESEND_FROM_EMAIL environment variable is required');
  return email;
}
const DEFAULT_FROM_NAME = process.env.RESEND_FROM_NAME || 'Pay It Forward Health';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildReminderEmailHtml(input: {
  event: ReminderEventRow;
  attendee: ReminderAttendeeRow;
}): string {
  const { event, attendee } = input;
  const when = formatEventWindow(event);

  const detailRow = (label: string, valueHtml: string) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#64748b;font-size:13px;vertical-align:top;white-space:nowrap">${label}</td>` +
    `<td style="padding:4px 0;color:#1f2937;font-size:13px">${valueHtml}</td></tr>`;

  const rows = [
    detailRow('When', escapeHtml(when)),
    event.location ? detailRow('Where', escapeHtml(event.location)) : '',
  ].join('');

  const joinButton = event.meeting_url
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0 0"><tr>` +
      `<td><a href="${escapeHtml(event.meeting_url)}" ` +
      `style="display:inline-block;padding:10px 22px;background-color:#0d9488;color:#ffffff;` +
      `font-size:14px;text-decoration:none;border-radius:6px">Join meeting</a></td>` +
      `</tr></table>`
    : '';

  const rsvpLink =
    attendee.role !== 'organizer'
      ? `<p style="margin:12px 0 0;font-size:12px;color:#94a3b8">Need to change your response? ` +
        `<a href="${appBaseUrl()}/rsvp/${attendee.rsvp_token}" style="color:#0d9488">Update your RSVP</a>.</p>`
      : '';

  return (
    `<div style="font-family:Arial, Helvetica, sans-serif;font-size:14px;color:#1f2937;line-height:1.5">` +
    `<p style="margin:0 0 12px">This is a reminder about your upcoming meeting.</p>` +
    `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;background-color:#f8fafc">` +
    `<p style="margin:0 0 8px;font-size:16px;font-weight:bold;color:#0f172a">${escapeHtml(event.title)}</p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${rows}</table>` +
    joinButton +
    rsvpLink +
    `</div></div>`
  );
}

function buildReminderEmailText(input: {
  event: ReminderEventRow;
  attendee: ReminderAttendeeRow;
}): string {
  const { event, attendee } = input;
  const lines = [
    `Reminder: ${event.title}`,
    '',
    `When: ${formatEventWindow(event)}`,
  ];
  if (event.location) lines.push(`Where: ${event.location}`);
  if (event.meeting_url) lines.push(`Join: ${event.meeting_url}`);
  if (attendee.role !== 'organizer') {
    lines.push('', `Update your RSVP: ${appBaseUrl()}/rsvp/${attendee.rsvp_token}`);
  }
  return lines.join('\n');
}

async function sendReminderEmail(input: {
  event: ReminderEventRow;
  attendee: ReminderAttendeeRow;
}): Promise<{ success: boolean; error?: string }> {
  const { event, attendee } = input;
  try {
    const resend = getResendClient();
    const { error } = await resend.emails.send({
      from: `${DEFAULT_FROM_NAME} <${getDefaultFromEmail()}>`,
      to: [attendee.email],
      subject: `Reminder: ${event.title} — ${formatEventWindow(event)}`,
      html: buildReminderEmailHtml({ event, attendee }),
      text: buildReminderEmailText({ event, attendee }),
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Handler
// ============================================================================

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Service role unavailable' }, { status: 500 });
  }

  const supabase = createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  try {
    const now = Date.now();

    // Candidate sweep: confirmed, reminder configured, not yet started.
    // reminder_minutes varies per row, so the due check happens in JS below.
    // Cross-org by design — no organization filter here.
    const { data: candidates, error: fetchError } = await supabase
      .from('crm_calendar_events')
      .select(
        'id, organization_id, title, description, location, meeting_url, start_at, end_at, all_day, timezone, status, reminder_minutes, conversation_id',
      )
      .eq('status', 'confirmed')
      .not('reminder_minutes', 'is', null)
      .gt('start_at', new Date(now).toISOString())
      .lte('start_at', new Date(now + CANDIDATE_HORIZON_MS).toISOString())
      .order('start_at', { ascending: true })
      .limit(200);

    if (fetchError) {
      console.error('[meeting-reminder-cron] fetch error:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const dueEvents = ((candidates ?? []) as ReminderEventRow[]).filter((event) => {
      if (event.reminder_minutes == null) return false;
      const startAt = new Date(event.start_at);
      return startAt.getTime() - event.reminder_minutes * 60_000 <= Date.now();
    });

    let eventsProcessed = 0;
    let remindersSent = 0;
    let failures = 0;

    for (const event of dueEvents) {
      const { data: attendeeData, error: attendeeError } = await supabase
        .from('crm_calendar_event_attendees')
        .select(
          'id, organization_id, event_id, profile_id, email, name, role, rsvp_status, reminder_sent_at, rsvp_token',
        )
        .eq('event_id', event.id)
        .is('reminder_sent_at', null)
        .neq('rsvp_status', 'declined');

      if (attendeeError) {
        console.error(
          `[meeting-reminder-cron] attendee fetch error for event ${event.id} (org ${event.organization_id}):`,
          attendeeError,
        );
        failures++;
        continue;
      }

      eventsProcessed++;
      const attendees = (attendeeData ?? []) as ReminderAttendeeRow[];

      for (const attendee of attendees) {
        const sendResult = await sendReminderEmail({ event, attendee });

        if (!sendResult.success) {
          console.error(
            `[meeting-reminder-cron] send failed for attendee ${attendee.id} on event ${event.id} (org ${event.organization_id}):`,
            sendResult.error,
          );
          failures++;
          continue;
        }

        // Per-attendee idempotency stamp — keyed by primary key.
        const { error: stampError } = await supabase
          .from('crm_calendar_event_attendees')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('id', attendee.id);

        if (stampError) {
          console.error(
            `[meeting-reminder-cron] reminder_sent_at stamp error for attendee ${attendee.id} on event ${event.id} (org ${event.organization_id}):`,
            stampError,
          );
          failures++;
          continue;
        }

        remindersSent++;

        // In-app notification for attendees with a profile — same
        // crm_notifications shape as the follow-up-reminders cron.
        if (attendee.profile_id) {
          const { error: insertError } = await supabase
            .from('crm_notifications')
            .insert({
              org_id: event.organization_id,
              user_id: attendee.profile_id,
              title: `📅 Reminder: ${event.title}`,
              body: formatEventWindow(event),
              href: '/crm/calendar',
              icon: 'bell',
              meta: {
                event_id: event.id,
                attendee_id: attendee.id,
                source: 'meeting_reminder_cron',
              },
            });

          if (insertError) {
            // The reminder email already went out — log, don't fail the run.
            console.error(
              `[meeting-reminder-cron] notification insert error for attendee ${attendee.id} on event ${event.id} (org ${event.organization_id}):`,
              insertError,
            );
          }
        }
      }
    }

    console.log(
      `[meeting-reminder-cron] events_processed=${eventsProcessed} reminders_sent=${remindersSent} failures=${failures}`,
    );

    return NextResponse.json({
      events_processed: eventsProcessed,
      reminders_sent: remindersSent,
      failures,
    });
  } catch (error) {
    console.error('[meeting-reminder-cron] unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

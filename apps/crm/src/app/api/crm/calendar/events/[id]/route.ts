import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, getAuthProfile, getAuthUser } from '@/lib/supabase-server';
import { sendMeetingInvites } from '@/lib/calendar/invites';
import type { CalendarAttendeeRow, CalendarEventRow } from '@/lib/calendar/types';

// PATCH: edit a meeting — material changes bump SEQUENCE and re-invite.
// DELETE: soft-cancel — status='cancelled' + METHOD:CANCEL to invited attendees.

const patchEventSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  meeting_url: z.string().url().nullable().optional(),
  start_at: z.string().datetime({ offset: true }).optional(),
  end_at: z.string().datetime({ offset: true }).optional(),
  all_day: z.boolean().optional(),
  timezone: z.string().min(1).max(64).optional(),
  reminder_minutes: z.number().int().min(0).max(40320).nullable().optional(),
  send_updates: z.boolean().optional().default(true),
});

/** Fields whose change alters what recipients' calendars must show. */
const MATERIAL_FIELDS = [
  'title', 'location', 'meeting_url', 'start_at', 'end_at', 'all_day', 'timezone',
] as const;

async function loadEventWithAttendees(supabase: any, organizationId: string, id: string) {
  const { data: event } = await supabase
    .from('crm_calendar_events')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('id', id)
    .maybeSingle();
  if (!event) return null;
  const { data: attendees } = await supabase
    .from('crm_calendar_event_attendees')
    .select('*')
    .eq('event_id', id)
    .order('created_at', { ascending: true });
  return {
    event: event as CalendarEventRow,
    attendees: (attendees ?? []) as CalendarAttendeeRow[],
  };
}

async function resolveOrganizer(supabase: any, event: CalendarEventRow, userEmail: string | null) {
  const organizerRow = await supabase
    .from('crm_calendar_event_attendees')
    .select('email, name')
    .eq('event_id', event.id)
    .eq('role', 'organizer')
    .maybeSingle();
  const email: string | null = organizerRow.data?.email ?? userEmail;
  return email ? { email, name: organizerRow.data?.name || email } : null;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = (await createClient()) as any;
  const profile = await getAuthProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const loaded = await loadEventWithAttendees(supabase, profile.organization_id, id);
  if (!loaded) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(loaded);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = (await createClient()) as any;
    const profile = await getAuthProfile();
    const { user } = await getAuthUser();
    if (!profile || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const parsed = patchEventSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const input = parsed.data;

    const loaded = await loadEventWithAttendees(supabase, profile.organization_id, id);
    if (!loaded) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (loaded.event.status === 'cancelled') {
      return NextResponse.json({ error: 'Cancelled meetings cannot be edited' }, { status: 409 });
    }

    const { send_updates, ...changes } = input;
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(changes)) {
      if (value !== undefined) updates[key] = value;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ event: loaded.event, attendees: loaded.attendees, invites: null });
    }

    const nextStart = (updates.start_at as string) ?? loaded.event.start_at;
    const nextEnd = (updates.end_at as string) ?? loaded.event.end_at;
    if (new Date(nextEnd) < new Date(nextStart)) {
      return NextResponse.json({ error: 'end_at must be after start_at' }, { status: 400 });
    }

    const material = MATERIAL_FIELDS.some(
      (field) => field in updates && updates[field] !== loaded.event[field],
    );
    const everInvited = loaded.attendees.some((a) => a.invited_sequence != null);

    if (material && everInvited) {
      // Optimistic-concurrency SEQUENCE bump: the eq() guard makes racing
      // editors fail with 0 rows instead of reusing a sequence number.
      updates.ical_sequence = loaded.event.ical_sequence + 1;
      // A moved meeting deserves a fresh reminder.
      if ('start_at' in updates) {
        await supabase
          .from('crm_calendar_event_attendees')
          .update({ reminder_sent_at: null })
          .eq('event_id', id);
      }
    }

    const { data: updatedRows, error: updateError } = await supabase
      .from('crm_calendar_events')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .eq('ical_sequence', loaded.event.ical_sequence)
      .select('*');

    if (updateError) {
      console.error('Update calendar event error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    const updatedEvent = (updatedRows?.[0] ?? null) as CalendarEventRow | null;
    if (!updatedEvent) {
      return NextResponse.json(
        { error: 'The meeting changed underneath you — reload and try again.' },
        { status: 409 },
      );
    }

    let invites: { sent: number; failed: Array<{ email: string; error: string }> } | null = null;
    if (material && everInvited && send_updates) {
      const organizer = await resolveOrganizer(supabase, updatedEvent, user.email ?? null);
      if (organizer) {
        const recipients = loaded.attendees.filter((a) => a.rsvp_status !== 'declined');
        invites = await sendMeetingInvites({
          event: updatedEvent,
          attendees: recipients,
          organizer,
          method: 'REQUEST',
          conversationId: updatedEvent.conversation_id,
          onInvited: async (attendeeId) => {
            await supabase
              .from('crm_calendar_event_attendees')
              .update({
                invited_sequence: updatedEvent.ical_sequence,
                invited_at: new Date().toISOString(),
              })
              .eq('id', attendeeId);
          },
        });
      }
    }

    const reloaded = await loadEventWithAttendees(supabase, profile.organization_id, id);
    return NextResponse.json({
      event: reloaded?.event ?? updatedEvent,
      attendees: reloaded?.attendees ?? loaded.attendees,
      invites,
    });
  } catch (error) {
    console.error('Update calendar event error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = (await createClient()) as any;
    const profile = await getAuthProfile();
    const { user } = await getAuthUser();
    if (!profile || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const notify = new URL(request.url).searchParams.get('notify') !== 'false';

    const loaded = await loadEventWithAttendees(supabase, profile.organization_id, id);
    if (!loaded) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (loaded.event.status === 'cancelled') {
      return NextResponse.json({ event: loaded.event, invites: null });
    }

    const { data: cancelledRows, error: cancelError } = await supabase
      .from('crm_calendar_events')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        ical_sequence: loaded.event.ical_sequence + 1,
      })
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .eq('ical_sequence', loaded.event.ical_sequence)
      .select('*');

    if (cancelError) {
      console.error('Cancel calendar event error:', cancelError);
      return NextResponse.json({ error: cancelError.message }, { status: 500 });
    }
    const cancelledEvent = (cancelledRows?.[0] ?? null) as CalendarEventRow | null;
    if (!cancelledEvent) {
      return NextResponse.json(
        { error: 'The meeting changed underneath you — reload and try again.' },
        { status: 409 },
      );
    }

    let invites: { sent: number; failed: Array<{ email: string; error: string }> } | null = null;
    const everInvited = loaded.attendees.filter((a) => a.invited_sequence != null);
    if (notify && everInvited.length > 0) {
      const organizer = await resolveOrganizer(supabase, cancelledEvent, user.email ?? null);
      if (organizer) {
        invites = await sendMeetingInvites({
          event: cancelledEvent,
          attendees: everInvited,
          organizer,
          method: 'CANCEL',
          conversationId: cancelledEvent.conversation_id,
          onInvited: async () => {},
        });
      }
    }

    return NextResponse.json({ event: cancelledEvent, invites });
  } catch (error) {
    console.error('Cancel calendar event error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

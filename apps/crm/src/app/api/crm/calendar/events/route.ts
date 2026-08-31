import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, getAuthProfile, getAuthUser } from '@/lib/supabase-server';
import { sendMeetingInvites } from '@/lib/calendar/invites';
import type { CalendarAttendeeRow, CalendarEventRow } from '@/lib/calendar/types';

// Native CRM meetings (crm_calendar_events). Namespaced under /api/crm/ so it
// cannot collide with the existing /api/calendar/* provider-sync routes.
// The new tables are not yet in generated DB types; rows are typed locally.

const MAX_ATTENDEES_PER_EVENT = 50;

const attendeeSchema = z.object({
  email: z.string().email(),
  name: z.string().max(200).optional(),
  role: z.enum(['required', 'optional']).optional().default('required'),
  record_id: z.string().uuid().optional(),
  profile_id: z.string().uuid().optional(),
});

const createEventSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  location: z.string().max(500).optional(),
  meeting_url: z.string().url().optional(),
  start_at: z.string().datetime({ offset: true }),
  end_at: z.string().datetime({ offset: true }),
  all_day: z.boolean().optional().default(false),
  timezone: z.string().min(1).max(64),
  record_id: z.string().uuid().optional(),
  conversation_id: z.string().uuid().optional(),
  reminder_minutes: z.number().int().min(0).max(40320).optional(),
  attendees: z.array(attendeeSchema).max(MAX_ATTENDEES_PER_EVENT).optional().default([]),
  send_invites: z.boolean().optional().default(true),
  source: z.enum(['crm', 'inbox']).optional().default('crm'),
});

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** GET /api/crm/calendar/events?start=&end=&record_id=&conversation_id= */
export async function GET(request: NextRequest) {
  try {
    const supabase = (await createClient()) as any;
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const recordId = searchParams.get('record_id');
    const conversationId = searchParams.get('conversation_id');
    const includeCancelled = searchParams.get('include_cancelled') === 'true';

    let query = supabase
      .from('crm_calendar_events')
      .select('*, attendees:crm_calendar_event_attendees(*)')
      .eq('organization_id', profile.organization_id)
      .order('start_at', { ascending: true })
      .limit(500);

    if (start) query = query.gt('end_at', start);
    if (end) query = query.lt('start_at', end);
    if (recordId) query = query.eq('record_id', recordId);
    if (conversationId) query = query.eq('conversation_id', conversationId);
    if (!includeCancelled) query = query.neq('status', 'cancelled');

    const { data, error } = await query;
    if (error) {
      console.error('List calendar events error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ events: data ?? [] });
  } catch (error) {
    console.error('List calendar events error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST /api/crm/calendar/events — create a meeting, then fan out invites. */
export async function POST(request: NextRequest) {
  try {
    const supabase = (await createClient()) as any;
    const profile = await getAuthProfile();
    const { user } = await getAuthUser();
    if (!profile || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = createEventSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const input = parsed.data;

    if (new Date(input.end_at) < new Date(input.start_at)) {
      return NextResponse.json({ error: 'end_at must be after start_at' }, { status: 400 });
    }
    if (!isValidTimeZone(input.timezone)) {
      return NextResponse.json({ error: `Unknown timezone: ${input.timezone}` }, { status: 400 });
    }

    // Organizer email comes from the profile row (getAuthProfile omits it).
    const { data: organizerProfile } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('user_id', user.id)
      .single();
    const organizerEmail: string | null = organizerProfile?.email ?? user.email ?? null;
    if (!organizerEmail) {
      return NextResponse.json({ error: 'Your profile has no email address' }, { status: 400 });
    }

    const { data: event, error: eventError } = await supabase
      .from('crm_calendar_events')
      .insert({
        organization_id: profile.organization_id,
        owner_id: user.id,
        created_by: user.id,
        title: input.title,
        description: input.description ?? null,
        location: input.location ?? null,
        meeting_url: input.meeting_url ?? null,
        start_at: input.start_at,
        end_at: input.end_at,
        all_day: input.all_day,
        timezone: input.timezone,
        record_id: input.record_id ?? null,
        conversation_id: input.conversation_id ?? null,
        reminder_minutes: input.reminder_minutes ?? null,
        source: input.source,
      })
      .select('*')
      .single();

    if (eventError || !event) {
      console.error('Create calendar event error:', eventError);
      return NextResponse.json({ error: eventError?.message || 'Insert failed' }, { status: 500 });
    }
    const eventRow = event as CalendarEventRow;

    // Attendee rows: organizer first, then deduped invitees.
    const organizerEmailLower = organizerEmail.trim().toLowerCase();
    const seen = new Set<string>([organizerEmailLower]);
    const attendeeInserts: Array<Record<string, unknown>> = [
      {
        organization_id: profile.organization_id,
        event_id: eventRow.id,
        profile_id: organizerProfile?.id ?? null,
        email: organizerEmailLower,
        name: organizerProfile?.full_name ?? null,
        role: 'organizer',
        rsvp_status: 'accepted',
        rsvp_at: new Date().toISOString(),
        response_source: 'manual',
      },
    ];
    for (const attendee of input.attendees) {
      const email = attendee.email.trim().toLowerCase();
      if (seen.has(email)) continue;
      seen.add(email);
      attendeeInserts.push({
        organization_id: profile.organization_id,
        event_id: eventRow.id,
        profile_id: attendee.profile_id ?? null,
        record_id: attendee.record_id ?? null,
        email,
        name: attendee.name ?? null,
        role: attendee.role,
      });
    }

    const { data: attendeeRows, error: attendeeError } = await supabase
      .from('crm_calendar_event_attendees')
      .insert(attendeeInserts)
      .select('*');

    if (attendeeError) {
      console.error('Create calendar attendees error:', attendeeError);
      return NextResponse.json({ error: attendeeError.message }, { status: 500 });
    }
    const attendees = (attendeeRows ?? []) as CalendarAttendeeRow[];

    // Best-effort: link attendees to CRM records by promoted email column.
    const unmatched = attendees.filter((a) => !a.record_id && a.role !== 'organizer');
    if (unmatched.length > 0) {
      const { data: matches } = await supabase
        .from('crm_records')
        .select('id, email')
        .eq('org_id', profile.organization_id)
        .in('email', unmatched.map((a) => a.email));
      for (const match of (matches ?? []) as Array<{ id: string; email: string | null }>) {
        const attendee = unmatched.find(
          (a) => a.email === (match.email ?? '').trim().toLowerCase(),
        );
        if (attendee) {
          await supabase
            .from('crm_calendar_event_attendees')
            .update({ record_id: match.id })
            .eq('id', attendee.id);
          attendee.record_id = match.id;
        }
      }
    }

    let invites: { sent: number; failed: Array<{ email: string; error: string }> } | null = null;
    if (input.send_invites && attendees.some((a) => a.role !== 'organizer')) {
      invites = await sendMeetingInvites({
        event: eventRow,
        attendees,
        organizer: { email: organizerEmail, name: organizerProfile?.full_name || organizerEmail },
        method: 'REQUEST',
        conversationId: input.conversation_id ?? null,
        onInvited: async (attendeeId) => {
          await supabase
            .from('crm_calendar_event_attendees')
            .update({
              invited_sequence: eventRow.ical_sequence,
              invited_at: new Date().toISOString(),
            })
            .eq('id', attendeeId);
        },
      });
    }

    return NextResponse.json({ event: eventRow, attendees, invites }, { status: 201 });
  } catch (error) {
    console.error('Create calendar event error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Calendar Events API Route
 * Handles CRUD operations for calendar events
 *
 * GET /api/calendar/events - Get events for a date range
 * POST /api/calendar/events - Create a new event
 * DELETE /api/calendar/events?id=... - Delete an event
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getCalendarAdapter } from '@/lib/integrations/adapters/registry';
import { decryptCredential } from '@/lib/integrations/adapters/credentials';
import type { IntegrationConnection, CreateEventParams } from '@/lib/integrations/adapters/base';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
            );
          } catch {
            // Ignore
          }
        },
      },
    }
  );
}

// GET - Get calendar events for a date range
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');
    const source = searchParams.get('source') || 'all'; // 'synced', 'tasks', 'all'

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'start and end date parameters are required' },
        { status: 400 }
      );
    }

    const events: Array<{
      id: string;
      title: string;
      description?: string;
      location?: string;
      startTime: string;
      endTime: string;
      allDay?: boolean;
      status?: string;
      source: 'calendar' | 'task';
      provider?: string;
      meetingUrl?: string;
      attendees?: Array<{ email: string; name?: string; responseStatus?: string }>;
    }> = [];

    // Get synced calendar events
    if (source === 'all' || source === 'synced') {
      const { data: calendarEvents } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('owner_id', profile.id)
        .gte('start_time', startDate)
        .lte('end_time', endDate)
        .neq('status', 'cancelled');

      if (calendarEvents) {
        for (const event of calendarEvents) {
          events.push({
            id: event.id,
            title: event.title,
            description: event.description,
            location: event.location,
            startTime: event.start_time,
            endTime: event.end_time,
            allDay: event.is_all_day,
            status: event.status,
            source: 'calendar',
            provider: event.provider,
            meetingUrl: event.meeting_url,
            attendees: event.attendees as Array<{ email: string; name?: string; responseStatus?: string }>,
          });
        }
      }
    }

    // Get CRM tasks (meetings, calls) as calendar events
    if (source === 'all' || source === 'tasks') {
      const { data: tasks } = await supabase
        .from('crm_tasks')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .in('activity_type', ['meeting', 'call'])
        .gte('due_at', startDate)
        .lte('due_at', endDate)
        .neq('status', 'cancelled');

      if (tasks) {
        for (const task of tasks) {
          // Calculate end time (default 30 min for calls, 60 min for meetings)
          const startTime = new Date(task.due_at);
          const duration = task.activity_type === 'call' ? 30 : 60;
          const endTime = new Date(startTime.getTime() + duration * 60000);

          events.push({
            id: `task-${task.id}`,
            title: task.title,
            description: task.description,
            startTime: task.due_at,
            endTime: endTime.toISOString(),
            allDay: false,
            status: task.status === 'completed' ? 'confirmed' : 'tentative',
            source: 'task',
          });
        }
      }
    }

    // Sort by start time
    events.sort((a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Get calendar events error:', error);
    return NextResponse.json(
      { error: 'Failed to get events' },
      { status: 500 }
    );
  }
}

// POST - Create a new calendar event
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      connectionId,
      calendarId,
      title,
      description,
      location,
      startTime,
      endTime,
      allDay,
      attendees,
      addConference,
      sendNotifications,
    } = body;

    if (!title || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'title, startTime, and endTime are required' },
        { status: 400 }
      );
    }

    // If connectionId is provided, create in external calendar
    if (connectionId) {
      const { data: connection } = await supabase
        .from('integration_connections')
        .select('*')
        .eq('id', connectionId)
        .eq('org_id', profile.organization_id)
        .single();

      if (!connection) {
        return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
      }

      const adapter = getCalendarAdapter(connection.provider);
      if (!adapter) {
        return NextResponse.json({ error: 'Provider not supported' }, { status: 400 });
      }

      const accessToken = connection.access_token_enc
        ? decryptCredential(connection.access_token_enc)
        : undefined;

      adapter.initialize({
        connection: connection as IntegrationConnection,
        accessToken: accessToken || undefined,
      });

      const eventParams: CreateEventParams = {
        calendarId: calendarId || 'primary',
        title,
        description,
        location,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        allDay,
        attendees,
        addConference,
        sendNotifications,
      };

      const createdEvent = await adapter.createEvent(eventParams);

      // Also store in local cache
      await supabase.from('calendar_events').insert({
        org_id: profile.organization_id,
        connection_id: connectionId,
        owner_id: profile.id,
        external_id: createdEvent.id,
        external_calendar_id: calendarId || 'primary',
        provider: connection.provider,
        title: createdEvent.title,
        description: createdEvent.description,
        location: createdEvent.location,
        start_time: createdEvent.startTime.toISOString(),
        end_time: createdEvent.endTime.toISOString(),
        is_all_day: createdEvent.allDay || false,
        status: createdEvent.status || 'confirmed',
        attendees: createdEvent.attendees || [],
        meeting_url: createdEvent.conferenceData?.joinUrl,
        meeting_provider: createdEvent.conferenceData?.type,
        last_synced_at: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        event: createdEvent,
      });
    }

    // Create as CRM task (meeting)
    const { data: task, error: taskError } = await supabase
      .from('crm_tasks')
      .insert({
        organization_id: profile.organization_id,
        title,
        description,
        activity_type: 'meeting',
        due_at: startTime,
        status: 'open',
        created_by: profile.id,
        assigned_to: profile.id,
      })
      .select()
      .single();

    if (taskError) {
      return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      event: {
        id: `task-${task.id}`,
        title: task.title,
        description: task.description,
        startTime: task.due_at,
        endTime,
        source: 'task',
      },
    });
  } catch (error) {
    console.error('Create calendar event error:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a calendar event
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('id');

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    // Check if it's a task-based event
    if (eventId.startsWith('task-')) {
      const taskId = eventId.replace('task-', '');
      await supabase
        .from('crm_tasks')
        .update({ status: 'cancelled' })
        .eq('id', taskId)
        .eq('organization_id', profile.organization_id);

      return NextResponse.json({ success: true });
    }

    // Get the calendar event
    const { data: event } = await supabase
      .from('calendar_events')
      .select('*, integration_connections!inner(*)')
      .eq('id', eventId)
      .eq('owner_id', profile.id)
      .single();

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Delete from external calendar
    const connection = event.integration_connections;
    const adapter = getCalendarAdapter(connection.provider);

    if (adapter) {
      const accessToken = connection.access_token_enc
        ? decryptCredential(connection.access_token_enc)
        : undefined;

      adapter.initialize({
        connection: connection as IntegrationConnection,
        accessToken: accessToken || undefined,
      });

      await adapter.deleteEvent(event.external_id, event.external_calendar_id);
    }

    // Delete from local cache
    await supabase
      .from('calendar_events')
      .delete()
      .eq('id', eventId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete calendar event error:', error);
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    );
  }
}

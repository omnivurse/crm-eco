/**
 * Calendar Sync API Route
 * Handles syncing calendar events from connected providers
 *
 * POST /api/calendar/sync - Trigger a sync for a connection
 * GET /api/calendar/sync - Get sync status
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getInitializedAdapter, getCalendarAdapter } from '@/lib/integrations/adapters/registry';
import { decryptCredential } from '@/lib/integrations/adapters/credentials';
import type { CalendarAdapter, IntegrationConnection } from '@/lib/integrations/adapters/base';

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
            // Ignore errors
          }
        },
      },
    }
  );
}

// POST - Trigger calendar sync
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const { connectionId, fullSync = false } = body;

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId is required' }, { status: 400 });
    }

    // Get the calendar connection
    const { data: connection, error: connError } = await supabase
      .from('integration_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('org_id', profile.organization_id)
      .eq('connection_type', 'calendar')
      .single();

    if (connError || !connection) {
      return NextResponse.json({ error: 'Calendar connection not found' }, { status: 404 });
    }

    // Get or create sync state
    let { data: syncState } = await supabase
      .from('calendar_sync_state')
      .select('*')
      .eq('connection_id', connectionId)
      .single();

    if (!syncState) {
      const { data: newState, error: insertError } = await supabase
        .from('calendar_sync_state')
        .insert({
          connection_id: connectionId,
          sync_status: 'syncing',
        })
        .select()
        .single();

      if (insertError) {
        return NextResponse.json({ error: 'Failed to create sync state' }, { status: 500 });
      }
      syncState = newState;
    } else {
      // Update sync status
      await supabase
        .from('calendar_sync_state')
        .update({ sync_status: 'syncing', sync_error: null })
        .eq('id', syncState.id);
    }

    // Initialize the adapter
    const adapter = getCalendarAdapter(connection.provider);
    if (!adapter) {
      return NextResponse.json({ error: 'Calendar provider not supported' }, { status: 400 });
    }

    // Decrypt credentials and initialize
    const accessToken = connection.access_token_enc
      ? decryptCredential(connection.access_token_enc)
      : undefined;

    adapter.initialize({
      connection: connection as IntegrationConnection,
      accessToken: accessToken || undefined,
    });

    // Get list of calendars
    const calendars = await adapter.listCalendars();

    // Store calendars in calendar_list
    for (const calendar of calendars) {
      await supabase
        .from('calendar_list')
        .upsert({
          connection_id: connectionId,
          external_id: calendar.id,
          provider: connection.provider,
          name: calendar.name,
          color: calendar.color,
          access_role: calendar.accessRole,
          is_primary: calendar.isPrimary || false,
        }, {
          onConflict: 'connection_id,external_id',
        });
    }

    // Get selected calendars to sync
    const { data: selectedCalendars } = await supabase
      .from('calendar_list')
      .select('external_id')
      .eq('connection_id', connectionId)
      .eq('is_selected', true);

    const calendarIds = selectedCalendars?.map(c => c.external_id) ||
      [calendars.find(c => c.isPrimary)?.id || calendars[0]?.id].filter(Boolean);

    let totalSynced = 0;
    let nextSyncToken: string | undefined;

    // Sync events for each selected calendar
    for (const calendarId of calendarIds) {
      try {
        // Check if adapter supports incremental sync
        const googleAdapter = adapter as { incrementalSync?: (calendarId: string, syncToken?: string) => Promise<{ events: unknown[]; nextSyncToken?: string }> };
        const outlookAdapter = adapter as { deltaSync?: (calendarId: string, deltaLink?: string) => Promise<{ events: unknown[]; nextDeltaLink?: string }> };

        if (!fullSync && syncState?.sync_token && googleAdapter.incrementalSync) {
          // Incremental sync for Google
          const result = await googleAdapter.incrementalSync(calendarId, syncState.sync_token);

          // Upsert events
          for (const event of result.events as Array<{ id: string; title: string; description?: string; location?: string; startTime: Date; endTime: Date; allDay?: boolean; status?: string; attendees?: Array<{ email: string; name?: string; responseStatus?: string }>; conferenceData?: { type: string; joinUrl: string } }>) {
            await supabase
              .from('calendar_events')
              .upsert({
                org_id: profile.organization_id,
                connection_id: connectionId,
                owner_id: profile.id,
                external_id: event.id,
                external_calendar_id: calendarId,
                provider: connection.provider,
                title: event.title,
                description: event.description,
                location: event.location,
                start_time: event.startTime.toISOString(),
                end_time: event.endTime.toISOString(),
                is_all_day: event.allDay || false,
                status: event.status || 'confirmed',
                attendees: event.attendees || [],
                meeting_url: event.conferenceData?.joinUrl,
                meeting_provider: event.conferenceData?.type,
                last_synced_at: new Date().toISOString(),
              }, {
                onConflict: 'connection_id,external_id',
              });
          }

          totalSynced += result.events.length;
          nextSyncToken = result.nextSyncToken;
        } else if (!fullSync && syncState?.sync_token && outlookAdapter.deltaSync) {
          // Delta sync for Outlook
          const result = await outlookAdapter.deltaSync(calendarId, syncState.sync_token);

          for (const event of result.events as Array<{ id: string; title: string; description?: string; location?: string; startTime: Date; endTime: Date; allDay?: boolean; status?: string; attendees?: Array<{ email: string; name?: string; responseStatus?: string }>; conferenceData?: { type: string; joinUrl: string } }>) {
            await supabase
              .from('calendar_events')
              .upsert({
                org_id: profile.organization_id,
                connection_id: connectionId,
                owner_id: profile.id,
                external_id: event.id,
                external_calendar_id: calendarId,
                provider: connection.provider,
                title: event.title,
                description: event.description,
                location: event.location,
                start_time: event.startTime.toISOString(),
                end_time: event.endTime.toISOString(),
                is_all_day: event.allDay || false,
                status: event.status || 'confirmed',
                attendees: event.attendees || [],
                meeting_url: event.conferenceData?.joinUrl,
                meeting_provider: event.conferenceData?.type,
                last_synced_at: new Date().toISOString(),
              }, {
                onConflict: 'connection_id,external_id',
              });
          }

          totalSynced += result.events.length;
          nextSyncToken = result.nextDeltaLink;
        } else {
          // Full sync - get events for the next 6 months
          const startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);

          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + 6);

          const events = await adapter.getEvents(calendarId, startDate, endDate);

          for (const event of events) {
            await supabase
              .from('calendar_events')
              .upsert({
                org_id: profile.organization_id,
                connection_id: connectionId,
                owner_id: profile.id,
                external_id: event.id,
                external_calendar_id: calendarId,
                provider: connection.provider,
                title: event.title,
                description: event.description,
                location: event.location,
                start_time: event.startTime.toISOString(),
                end_time: event.endTime.toISOString(),
                is_all_day: event.allDay || false,
                status: event.status || 'confirmed',
                attendees: event.attendees || [],
                meeting_url: event.conferenceData?.joinUrl,
                meeting_provider: event.conferenceData?.type,
                last_synced_at: new Date().toISOString(),
              }, {
                onConflict: 'connection_id,external_id',
              });
          }

          totalSynced += events.length;
        }
      } catch (calError) {
        console.error(`Error syncing calendar ${calendarId}:`, calError);
      }
    }

    // Update sync state
    await supabase
      .from('calendar_sync_state')
      .update({
        sync_status: 'idle',
        sync_token: nextSyncToken || syncState?.sync_token,
        last_incremental_sync_at: fullSync ? syncState?.last_incremental_sync_at : new Date().toISOString(),
        last_full_sync_at: fullSync ? new Date().toISOString() : syncState?.last_full_sync_at,
        events_synced: (syncState?.events_synced || 0) + totalSynced,
        calendars_synced: calendarIds.length,
      })
      .eq('connection_id', connectionId);

    // Update connection last sync
    await supabase
      .from('integration_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'success',
      })
      .eq('id', connectionId);

    return NextResponse.json({
      success: true,
      eventsSynced: totalSynced,
      calendarsCount: calendarIds.length,
    });
  } catch (error) {
    console.error('Calendar sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

// GET - Get sync status and calendars
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
    const connectionId = searchParams.get('connectionId');

    if (connectionId) {
      // Get specific connection sync status
      const { data: syncState } = await supabase
        .from('calendar_sync_state')
        .select('*')
        .eq('connection_id', connectionId)
        .single();

      const { data: calendars } = await supabase
        .from('calendar_list')
        .select('*')
        .eq('connection_id', connectionId);

      return NextResponse.json({
        syncState,
        calendars: calendars || [],
      });
    }

    // Get all calendar connections
    const { data: connections } = await supabase
      .from('integration_connections')
      .select(`
        id,
        provider,
        status,
        external_account_email,
        last_sync_at,
        last_sync_status,
        health_status
      `)
      .eq('org_id', profile.organization_id)
      .eq('connection_type', 'calendar');

    return NextResponse.json({
      connections: connections || [],
    });
  } catch (error) {
    console.error('Calendar sync status error:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}

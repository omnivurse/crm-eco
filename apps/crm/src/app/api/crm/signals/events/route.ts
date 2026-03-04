import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/crm/signals/events?record_id=<uuid>&signal_id=<uuid>&status=active
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const recordId = request.nextUrl.searchParams.get('record_id');
    const signalId = request.nextUrl.searchParams.get('signal_id');
    const status = request.nextUrl.searchParams.get('status');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0', 10);

    let query = supabase
      .from('crm_signal_events')
      .select(`
        *,
        signal:crm_signals!inner(name, key, category, icon, color)
      `, { count: 'exact' })
      .eq('organization_id', profile.organization_id)
      .order('fired_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (recordId) query = query.eq('record_id', recordId);
    if (signalId) query = query.eq('signal_id', signalId);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) {
      console.error('[SignalEvents] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch signal events' }, { status: 500 });
    }

    return NextResponse.json({ events: data || [], total: count || 0 });
  } catch (error) {
    console.error('[SignalEvents] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/crm/signals/events — fire a signal (create event)
// ---------------------------------------------------------------------------
const fireSignalSchema = z.object({
  signal_id: z.string().uuid(),
  record_id: z.string().uuid(),
  trigger_data: z.record(z.unknown()).optional(),
  message: z.string().max(1000).optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const parsed = fireSignalSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    // Use the fn_fire_signal function for atomicity
    const { data, error } = await supabase.rpc('fn_fire_signal', {
      p_signal_id: parsed.data.signal_id,
      p_record_id: parsed.data.record_id,
      p_trigger_data: parsed.data.trigger_data || {},
      p_message: parsed.data.message || null,
    });

    if (error) {
      console.error('[SignalEvents] Fire error:', error);
      return NextResponse.json({ error: 'Failed to fire signal' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Signal not found or disabled' }, { status: 404 });
    }

    // Fetch the created event
    const { data: event } = await supabase
      .from('crm_signal_events')
      .select(`
        *,
        signal:crm_signals!inner(name, key, category, icon, color)
      `)
      .eq('id', data)
      .single();

    return NextResponse.json({ event: event || { id: data } }, { status: 201 });
  } catch (error) {
    console.error('[SignalEvents] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/crm/signals/events — resolve or dismiss a signal event
// ---------------------------------------------------------------------------
const updateEventSchema = z.object({
  id: z.string().uuid().optional(),
  // Alternatively, resolve by signal_id + record_id
  signal_id: z.string().uuid().optional(),
  record_id: z.string().uuid().optional(),
  action: z.enum(['resolve', 'dismiss']),
  resolution_note: z.string().max(1000).optional().nullable(),
});

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const parsed = updateEventSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    const newStatus = parsed.data.action === 'resolve' ? 'resolved' : 'dismissed';

    // Resolve by specific event ID
    if (parsed.data.id) {
      const { data, error } = await supabase
        .from('crm_signal_events')
        .update({
          status: newStatus,
          resolved_at: new Date().toISOString(),
          resolved_by: profile.id,
          resolution_note: parsed.data.resolution_note || null,
        })
        .eq('id', parsed.data.id)
        .eq('organization_id', profile.organization_id)
        .eq('status', 'active')
        .select()
        .single();

      if (error) {
        console.error('[SignalEvents] Update error:', error);
        return NextResponse.json({ error: 'Failed to update signal event' }, { status: 500 });
      }

      return NextResponse.json({ event: data });
    }

    // Resolve by signal_id + record_id (bulk resolve)
    if (parsed.data.signal_id && parsed.data.record_id) {
      if (parsed.data.action === 'resolve') {
        const { data, error } = await supabase.rpc('fn_resolve_signal', {
          p_signal_id: parsed.data.signal_id,
          p_record_id: parsed.data.record_id,
          p_resolved_by: profile.id,
          p_note: parsed.data.resolution_note || null,
        });

        if (error) {
          console.error('[SignalEvents] Resolve error:', error);
          return NextResponse.json({ error: 'Failed to resolve signal' }, { status: 500 });
        }

        return NextResponse.json({ resolved: data });
      }

      // Dismiss by signal_id + record_id
      const { error } = await supabase
        .from('crm_signal_events')
        .update({
          status: 'dismissed',
          resolved_at: new Date().toISOString(),
          resolved_by: profile.id,
          resolution_note: parsed.data.resolution_note || null,
        })
        .eq('signal_id', parsed.data.signal_id)
        .eq('record_id', parsed.data.record_id)
        .eq('organization_id', profile.organization_id)
        .eq('status', 'active');

      if (error) {
        console.error('[SignalEvents] Dismiss error:', error);
        return NextResponse.json({ error: 'Failed to dismiss signal' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Provide either id or signal_id + record_id' }, { status: 400 });
  } catch (error) {
    console.error('[SignalEvents] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

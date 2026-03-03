import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/executive/events
 *
 * Returns recent system events for the org.
 * Used for activity feed and audit trail.
 * Admin-only.
 *
 * Query params:
 *   event_type – filter by event type (optional)
 *   limit      – max results (default 50, max 200)
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'super_admin', 'admin'].includes(profile.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const supabase = await createClient();
    const params = request.nextUrl.searchParams;
    const eventType = params.get('event_type');
    const limit = Math.min(Number(params.get('limit') || '50'), 200);

    let query = supabase
      .from('system_events')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ events: data || [] });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/crm/security/login-history — paginated login events
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');
    const userId = searchParams.get('user_id');
    const eventType = searchParams.get('event_type');

    let query = supabase
      .from('crm_login_history')
      .select('*, profiles!crm_login_history_profile_id_fkey(full_name, email)', { count: 'exact' })
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId) query = query.eq('user_id', userId);
    if (eventType) query = query.eq('event_type', eventType);

    const { data, count, error } = await query;
    if (error) {
      console.error('[Security/LoginHistory] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch login history' }, { status: 500 });
    }

    return NextResponse.json({
      entries: data || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[Security/LoginHistory] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/crm/security/login-history — record a login event
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();

    const { error } = await supabase.from('crm_login_history').insert({
      organization_id: profile.organization_id,
      user_id: profile.user_id,
      profile_id: profile.id,
      event_type: body.event_type || 'login_success',
      ip_address: body.ip_address || null,
      user_agent: body.user_agent || null,
      device_info: body.device_info || null,
      metadata: body.metadata || {},
    });

    if (error) {
      console.error('[Security/LoginHistory] Insert error:', error);
      return NextResponse.json({ error: 'Failed to record event' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('[Security/LoginHistory] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

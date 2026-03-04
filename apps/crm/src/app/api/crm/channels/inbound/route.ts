import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/crm/channels/inbound — list inbound messages with filtering
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const channelType = searchParams.get('channel_type');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('crm_inbound_messages')
      .select('*, crm_channels(display_name, provider)', { count: 'exact' })
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (channelType) query = query.eq('channel_type', channelType);

    const { data, count, error } = await query;
    if (error) {
      console.error('[Channels/Inbound] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch inbound messages' }, { status: 500 });
    }

    return NextResponse.json({
      messages: data || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[Channels/Inbound] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/crm/channels/inbound — receive inbound message (webhook/service)
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();

    if (!body.channel_type || !body.from_address) {
      return NextResponse.json({ error: 'channel_type and from_address required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('crm_inbound_messages')
      .insert({
        organization_id: profile.organization_id,
        channel_id: body.channel_id || null,
        channel_type: body.channel_type,
        from_address: body.from_address,
        from_name: body.from_name || null,
        to_address: body.to_address || null,
        subject: body.subject || null,
        body: body.body || null,
        body_html: body.body_html || null,
        attachments: body.attachments || [],
        provider_message_id: body.provider_message_id || null,
        raw_payload: body.raw_payload || null,
        metadata: body.metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error('[Channels/Inbound] Insert error:', error);
      return NextResponse.json({ error: 'Failed to record inbound message' }, { status: 500 });
    }

    return NextResponse.json({ message: data }, { status: 201 });
  } catch (error) {
    console.error('[Channels/Inbound] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

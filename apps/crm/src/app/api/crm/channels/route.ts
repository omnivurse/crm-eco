import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const CHANNEL_TYPES = ['email', 'sms', 'telephony', 'chat', 'webform', 'social', 'portal'] as const;

// ---------------------------------------------------------------------------
// GET /api/crm/channels?type=email
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const channelType = request.nextUrl.searchParams.get('type');

    let query = supabase
      .from('crm_channels')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('channel_type')
      .order('display_name');

    if (channelType) query = query.eq('channel_type', channelType);

    const { data, error } = await query;
    if (error) {
      console.error('[Channels] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 });
    }

    return NextResponse.json({ channels: data || [] });
  } catch (error) {
    console.error('[Channels] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/crm/channels — create a channel
// ---------------------------------------------------------------------------
const createChannelSchema = z.object({
  channel_type: z.enum(CHANNEL_TYPES),
  provider: z.string().min(1).max(100),
  display_name: z.string().min(1).max(200),
  config: z.record(z.unknown()).optional(),
  is_active: z.boolean().optional(),
  is_default: z.boolean().optional(),
  inbound_enabled: z.boolean().optional(),
  inbound_address: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createChannelSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    const { data, error } = await supabase
      .from('crm_channels')
      .insert({
        organization_id: profile.organization_id,
        ...parsed.data,
        config: parsed.data.config || {},
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Channel with this type and provider already exists' }, { status: 409 });
      }
      console.error('[Channels] Insert error:', error);
      return NextResponse.json({ error: 'Failed to create channel' }, { status: 500 });
    }

    return NextResponse.json({ channel: data }, { status: 201 });
  } catch (error) {
    console.error('[Channels] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/crm/channels — update a channel
// ---------------------------------------------------------------------------
const updateChannelSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string().min(1).max(200).optional(),
  config: z.record(z.unknown()).optional(),
  is_active: z.boolean().optional(),
  is_default: z.boolean().optional(),
  inbound_enabled: z.boolean().optional(),
  inbound_address: z.string().optional().nullable(),
});

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateChannelSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    const { id, ...updates } = parsed.data;

    const { data, error } = await supabase
      .from('crm_channels')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .select()
      .single();

    if (error) {
      console.error('[Channels] Update error:', error);
      return NextResponse.json({ error: 'Failed to update channel' }, { status: 500 });
    }

    return NextResponse.json({ channel: data });
  } catch (error) {
    console.error('[Channels] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/crm/channels?id=<uuid>
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing channel id' }, { status: 400 });

    const { error } = await supabase
      .from('crm_channels')
      .delete()
      .eq('id', id)
      .eq('organization_id', profile.organization_id);

    if (error) {
      console.error('[Channels] Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete channel' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Channels] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/crm/channels/credentials?channel_id=<uuid>
// Returns credential keys with masked values (never raw secrets)
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const channelId = request.nextUrl.searchParams.get('channel_id');
    if (!channelId) return NextResponse.json({ error: 'Missing channel_id' }, { status: 400 });

    const { data, error } = await supabase
      .from('crm_channel_credentials')
      .select('id, channel_id, credential_key, is_encrypted, expires_at, created_at, updated_at')
      .eq('channel_id', channelId)
      .eq('organization_id', profile.organization_id)
      .order('credential_key');

    if (error) {
      console.error('[Channels/Credentials] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch credentials' }, { status: 500 });
    }

    // Add masked value indicator — never return actual values
    const credentials = (data || []).map((c) => ({
      ...c,
      credential_value_masked: '••••••••',
      has_value: true,
    }));

    return NextResponse.json({ credentials });
  } catch (error) {
    console.error('[Channels/Credentials] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/crm/channels/credentials — upsert a credential
// ---------------------------------------------------------------------------
const upsertCredSchema = z.object({
  channel_id: z.string().uuid(),
  credential_key: z.string().min(1).max(100),
  credential_value: z.string().min(1),
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
    const parsed = upsertCredSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    // TODO: Encrypt credential_value at application layer before storage
    // For now we store as-is with is_encrypted=false until encryption service is wired
    const { data, error } = await supabase
      .from('crm_channel_credentials')
      .upsert(
        {
          channel_id: parsed.data.channel_id,
          organization_id: profile.organization_id,
          credential_key: parsed.data.credential_key,
          credential_value: parsed.data.credential_value,
          is_encrypted: false,
        },
        { onConflict: 'channel_id,credential_key' }
      )
      .select('id, channel_id, credential_key, is_encrypted, created_at, updated_at')
      .single();

    if (error) {
      console.error('[Channels/Credentials] Upsert error:', error);
      return NextResponse.json({ error: 'Failed to save credential' }, { status: 500 });
    }

    return NextResponse.json({ credential: data });
  } catch (error) {
    console.error('[Channels/Credentials] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/crm/channels/credentials?id=<uuid>
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
    if (!id) return NextResponse.json({ error: 'Missing credential id' }, { status: 400 });

    const { error } = await supabase
      .from('crm_channel_credentials')
      .delete()
      .eq('id', id)
      .eq('organization_id', profile.organization_id);

    if (error) {
      console.error('[Channels/Credentials] Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete credential' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Channels/Credentials] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

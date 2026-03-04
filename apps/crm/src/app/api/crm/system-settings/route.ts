import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/crm/system-settings?category=general
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();

    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const category = searchParams.get('category');

    let query = supabase
      .from('crm_system_settings')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('category')
      .order('setting_key');

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[SystemSettings API] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    // Redact sensitive values for non-admins
    const isAdmin = profile.crm_role === 'crm_admin';
    const settings = (data || []).map((s) => {
      if (s.is_sensitive && !isAdmin) {
        return { ...s, setting_value: '***REDACTED***' };
      }
      return s;
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('[SystemSettings API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/crm/system-settings  (upsert one setting)
// ---------------------------------------------------------------------------
const upsertSchema = z.object({
  category: z.enum([
    'general', 'security', 'channels', 'customization',
    'automation', 'process', 'data_admin', 'experience', 'developer',
  ]),
  setting_key: z.string().min(1).max(255),
  setting_value: z.unknown(),
  description: z.string().optional(),
  is_sensitive: z.boolean().optional(),
});

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();

    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const { category, setting_key, setting_value, description, is_sensitive } = parsed.data;

    const { data, error } = await supabase
      .from('crm_system_settings')
      .upsert(
        {
          organization_id: profile.organization_id,
          category,
          setting_key,
          setting_value,
          ...(description !== undefined && { description }),
          ...(is_sensitive !== undefined && { is_sensitive }),
          updated_by: profile.id,
        },
        { onConflict: 'organization_id,category,setting_key' }
      )
      .select()
      .single();

    if (error) {
      console.error('[SystemSettings API] Upsert error:', error);
      return NextResponse.json({ error: 'Failed to save setting' }, { status: 500 });
    }

    return NextResponse.json({ setting: data });
  } catch (error) {
    console.error('[SystemSettings API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/crm/system-settings?id=<uuid>
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();

    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing setting id' }, { status: 400 });
    }

    const { error } = await supabase
      .from('crm_system_settings')
      .delete()
      .eq('id', id)
      .eq('organization_id', profile.organization_id);

    if (error) {
      console.error('[SystemSettings API] Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete setting' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[SystemSettings API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

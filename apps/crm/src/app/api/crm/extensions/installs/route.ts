import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/crm/extensions/installs?status=active
// List installed extensions for the current organization
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const status = request.nextUrl.searchParams.get('status');

    let query = supabase
      .from('crm_extension_installs')
      .select(`
        *,
        extension:crm_extensions!inner(
          name, key, slug, description, category, extension_type,
          icon, icon_url, color, version, provider_name, is_free
        )
      `)
      .eq('organization_id', profile.organization_id)
      .order('installed_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      console.error('[ExtensionInstalls] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch installed extensions' }, { status: 500 });
    }

    return NextResponse.json({ installs: data || [] });
  } catch (error) {
    console.error('[ExtensionInstalls] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/crm/extensions/installs — install an extension
// ---------------------------------------------------------------------------
const installSchema = z.object({
  extension_id: z.string().uuid(),
  config: z.record(z.unknown()).optional(),
  granted_scopes: z.array(z.string()).optional(),
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
    const parsed = installSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    const { data, error } = await supabase.rpc('fn_install_extension', {
      p_org_id: profile.organization_id,
      p_extension_id: parsed.data.extension_id,
      p_installed_by: profile.id,
      p_config: parsed.data.config || {},
      p_granted_scopes: parsed.data.granted_scopes || [],
    });

    if (error) {
      console.error('[ExtensionInstalls] Install error:', error);
      return NextResponse.json({ error: error.message || 'Failed to install extension' }, { status: 500 });
    }

    // Fetch the install record
    const { data: install } = await supabase
      .from('crm_extension_installs')
      .select(`
        *,
        extension:crm_extensions!inner(
          name, key, slug, description, category, extension_type,
          icon, icon_url, color, version, provider_name
        )
      `)
      .eq('id', data)
      .single();

    return NextResponse.json({ install: install || { id: data } }, { status: 201 });
  } catch (error) {
    console.error('[ExtensionInstalls] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/crm/extensions/installs — update install config or status
// ---------------------------------------------------------------------------
const updateInstallSchema = z.object({
  id: z.string().uuid(),
  config: z.record(z.unknown()).optional(),
  granted_scopes: z.array(z.string()).optional(),
  status: z.enum(['active', 'disabled']).optional(),
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
    const parsed = updateInstallSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    const { id, ...updates } = parsed.data;

    // Track enable/disable timestamps
    const extra: Record<string, unknown> = {};
    if (updates.status === 'active') {
      extra.enabled_at = new Date().toISOString();
      extra.disabled_at = null;
    } else if (updates.status === 'disabled') {
      extra.disabled_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('crm_extension_installs')
      .update({ ...updates, ...extra })
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .select()
      .single();

    if (error) {
      console.error('[ExtensionInstalls] Update error:', error);
      return NextResponse.json({ error: 'Failed to update extension install' }, { status: 500 });
    }

    return NextResponse.json({ install: data });
  } catch (error) {
    console.error('[ExtensionInstalls] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/crm/extensions/installs?extension_id=<uuid>
// Uninstall an extension
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const extensionId = request.nextUrl.searchParams.get('extension_id');
    if (!extensionId) return NextResponse.json({ error: 'Missing extension_id' }, { status: 400 });

    const { data, error } = await supabase.rpc('fn_uninstall_extension', {
      p_org_id: profile.organization_id,
      p_extension_id: extensionId,
    });

    if (error) {
      console.error('[ExtensionInstalls] Uninstall error:', error);
      return NextResponse.json({ error: 'Failed to uninstall extension' }, { status: 500 });
    }

    return NextResponse.json({ success: data });
  } catch (error) {
    console.error('[ExtensionInstalls] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

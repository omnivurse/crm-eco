import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { invalidateOrgChrome } from '@/lib/crm/org-chrome-cache';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.name_plural !== undefined) updates.name_plural = body.name_plural;
    if (body.icon !== undefined) updates.icon = body.icon;
    if (body.description !== undefined) updates.description = body.description;
    if (body.is_enabled !== undefined) updates.is_enabled = body.is_enabled;
    if (body.display_order !== undefined) updates.display_order = body.display_order;

    const { data: module, error } = await supabase
      .from('crm_modules')
      .update(updates)
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (profile.organization_id) {
      invalidateOrgChrome(profile.organization_id);
    }

    return NextResponse.json(module);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: existingModule } = await supabase
      .from('crm_modules')
      .select('is_system')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (existingModule?.is_system) {
      return NextResponse.json({ error: 'System modules cannot be deleted' }, { status: 400 });
    }

    const { error } = await supabase
      .from('crm_modules')
      .delete()
      .eq('id', id)
      .eq('org_id', profile.organization_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (profile.organization_id) {
      invalidateOrgChrome(profile.organization_id);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET /api/reports/filters/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('crm_report_filters')
      .select('*')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Filter not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Report Filter] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load filter' },
      { status: 500 }
    );
  }
}

// PATCH /api/reports/filters/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, filterConfig, isDefault } = body;

    const supabase = await createClient();

    // Build update payload
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description;
    if (filterConfig !== undefined) update.filter_config = filterConfig;
    if (isDefault !== undefined) update.is_default = isDefault;

    // If setting as default, un-default existing ones
    if (isDefault) {
      const { data: current } = await supabase
        .from('crm_report_filters')
        .select('filter_type')
        .eq('id', id)
        .eq('org_id', profile.organization_id)
        .single();

      if (current) {
        await supabase
          .from('crm_report_filters')
          .update({ is_default: false })
          .eq('org_id', profile.organization_id)
          .eq('filter_type', current.filter_type)
          .eq('is_default', true)
          .neq('id', id);
      }
    }

    const { data, error } = await supabase
      .from('crm_report_filters')
      .update(update)
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Filter not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Report Filter] PATCH error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update filter' },
      { status: 500 }
    );
  }
}

// DELETE /api/reports/filters/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createClient();
    const { error } = await supabase
      .from('crm_report_filters')
      .delete()
      .eq('id', id)
      .eq('org_id', profile.organization_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Report Filter] DELETE error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete filter' },
      { status: 500 }
    );
  }
}

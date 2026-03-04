import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET /api/reports/filters - List saved filter presets
export async function GET() {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('crm_report_filters')
      .select('*')
      .eq('org_id', profile.organization_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('[Report Filters] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load filters' },
      { status: 500 }
    );
  }
}

// POST /api/reports/filters - Create a new filter preset
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, filterType, filterConfig, isDefault } = body;

    if (!name || !filterType || !filterConfig) {
      return NextResponse.json(
        { error: 'name, filterType, and filterConfig are required' },
        { status: 400 }
      );
    }

    const validTypes = ['advisor', 'date_range', 'state', 'plan', 'status', 'composite'];
    if (!validTypes.includes(filterType)) {
      return NextResponse.json(
        { error: `Invalid filterType. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // If setting as default, un-default existing defaults of same type
    if (isDefault) {
      await supabase
        .from('crm_report_filters')
        .update({ is_default: false })
        .eq('org_id', profile.organization_id)
        .eq('filter_type', filterType)
        .eq('is_default', true);
    }

    const { data, error } = await supabase
      .from('crm_report_filters')
      .insert({
        org_id: profile.organization_id,
        name,
        description: description || null,
        filter_type: filterType,
        filter_config: filterConfig,
        is_default: isDefault || false,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('[Report Filters] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create filter' },
      { status: 500 }
    );
  }
}

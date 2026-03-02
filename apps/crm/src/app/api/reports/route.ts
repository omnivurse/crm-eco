import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import type { CreateReportRequest } from '@/lib/reports/types';

// GET /api/reports - List all reports
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const moduleId = searchParams.get('module_id');

    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let query = supabase
      .from('crm_reports')
      .select(`
        *,
        created_by_profile:profiles(full_name, avatar_url)
      `)
      .eq('org_id', profile.organization_id)
      .or(`created_by.eq.${profile.id},is_shared.eq.true`)
      .order('updated_at', { ascending: false });

    if (moduleId) {
      query = query.eq('module_id', moduleId);
    }

    const { data: reports, error } = await query;

    if (error) {
      console.error('Supabase reports query error:', error.message, error.code, error.details);
      throw error;
    }

    return NextResponse.json({ reports: reports || [] });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}

// POST /api/reports - Create new report
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: report, error } = await supabase
      .from('crm_reports')
      .insert({
        org_id: profile.organization_id,
        name: body.name,
        description: body.description || null,
        module_id: body.module_id || null,
        data_source: body.dataSource || body.data_source || 'members',
        report_type: body.report_type || 'tabular',
        columns: body.columns || [],
        filters: body.filters || [],
        grouping: body.grouping || [],
        aggregations: body.aggregations || [],
        sorting: body.sorting || [],
        chart_type: body.chart_type || 'none',
        chart_config: body.chart_config || {},
        is_shared: body.is_shared ?? true,
        related_modules: body.related_modules || [],
        filter_logic: body.filter_logic || null,
        template_category: body.templateCategory || body.template_category || null,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    console.error('Error creating report:', error);
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 });
  }
}

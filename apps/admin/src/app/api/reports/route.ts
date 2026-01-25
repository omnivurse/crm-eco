import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

// GET /api/reports - List all reports (admin can see all org reports)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const moduleId = searchParams.get('module_id');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Admin can see all reports in their org
    let query = supabase
      .from('crm_reports')
      .select(`
        *,
        created_by_profile:profiles!crm_reports_created_by_fkey(full_name, avatar_url)
      `)
      .eq('org_id', profile.organization_id)
      .order('updated_at', { ascending: false });

    if (moduleId) {
      query = query.eq('module_id', moduleId);
    }

    const { data: reports, error } = await query;

    if (error) throw error;

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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
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

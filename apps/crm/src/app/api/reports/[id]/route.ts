import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { UpdateReportRequest } from '@/lib/reports/types';

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

// GET /api/reports/[id] - Get single report
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

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
      .select(`
        *,
        created_by_profile:profiles!crm_reports_created_by_fkey(full_name, avatar_url)
      `)
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (error || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Check access - must be creator or report is shared
    if (report.created_by !== profile.id && !report.is_shared) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error fetching report:', error);
    return NextResponse.json({ error: 'Failed to fetch report' }, { status: 500 });
  }
}

// PATCH /api/reports/[id] - Update report
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const body: UpdateReportRequest = await request.json();

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

    // Build update data
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.module_id !== undefined) updateData.module_id = body.module_id;
    if (body.report_type !== undefined) updateData.report_type = body.report_type;
    if (body.columns !== undefined) updateData.columns = body.columns;
    if (body.filters !== undefined) updateData.filters = body.filters;
    if (body.grouping !== undefined) updateData.grouping = body.grouping;
    if (body.aggregations !== undefined) updateData.aggregations = body.aggregations;
    if (body.chart_type !== undefined) updateData.chart_type = body.chart_type;
    if (body.chart_config !== undefined) updateData.chart_config = body.chart_config;
    if (body.is_shared !== undefined) updateData.is_shared = body.is_shared;

    const { data: report, error } = await supabase
      .from('crm_reports')
      .update(updateData)
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .eq('created_by', profile.id) // Only creator can update
      .select()
      .single();

    if (error) throw error;

    if (!report) {
      return NextResponse.json({ error: 'Report not found or access denied' }, { status: 404 });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error updating report:', error);
    return NextResponse.json({ error: 'Failed to update report' }, { status: 500 });
  }
}

// DELETE /api/reports/[id] - Delete report
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

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

    const { error } = await supabase
      .from('crm_reports')
      .delete()
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .eq('created_by', profile.id); // Only creator can delete

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting report:', error);
    return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 });
  }
}

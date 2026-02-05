import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

// GET /api/reports/[id]/history - Get report run history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify report exists and user has access
    const { data: report, error: reportError } = await supabase
      .from('crm_reports')
      .select('id')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Get run history
    const { data: history, error } = await supabase
      .from('report_run_history')
      .select(`
        id,
        executed_at,
        duration_ms,
        row_count,
        status,
        error_message,
        executed_by_profile:profiles!report_run_history_executed_by_fkey(full_name)
      `)
      .eq('report_id', id)
      .eq('org_id', profile.organization_id)
      .order('executed_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({ history: history || [] });
  } catch (error) {
    console.error('Error fetching report history:', error);
    return NextResponse.json({ error: 'Failed to fetch report history' }, { status: 500 });
  }
}

// POST /api/reports/[id]/history - Log a report run
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const body = await request.json();

    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify report exists
    const { data: report, error: reportError } = await supabase
      .from('crm_reports')
      .select('id')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Log the run
    const { data: historyEntry, error: insertError } = await supabase
      .from('report_run_history')
      .insert({
        report_id: id,
        org_id: profile.organization_id,
        executed_by: profile.id,
        duration_ms: body.duration_ms || null,
        row_count: body.row_count || null,
        status: body.status || 'completed',
        error_message: body.error_message || null,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Update report run count and last_run_at
    await supabase
      .from('crm_reports')
      .update({
        run_count: supabase.rpc('increment_report_run_count', { report_id: id }),
        last_run_at: new Date().toISOString(),
      })
      .eq('id', id);

    return NextResponse.json(historyEntry, { status: 201 });
  } catch (error) {
    console.error('Error logging report run:', error);
    return NextResponse.json({ error: 'Failed to log report run' }, { status: 500 });
  }
}

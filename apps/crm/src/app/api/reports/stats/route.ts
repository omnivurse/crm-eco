import { NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const orgId = profile.organization_id;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [saved, scheduled, runs] = await Promise.all([
      supabase
        .from('crm_reports')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId),
      supabase
        .from('crm_scheduled_reports')
        .select('id', { count: 'exact', head: true })
        .or(`org_id.eq.${orgId},organization_id.eq.${orgId}`),
      supabase
        .from('report_run_history')
        .select('id, status', { count: 'exact' })
        .eq('organization_id', orgId)
        .gte('created_at', monthStart.toISOString())
        .limit(500),
    ]);

    const runsThisMonth = runs.count ?? (runs.data?.length ?? 0);
    const exportsThisMonth = (runs.data ?? []).filter((row) => row.status === 'completed').length;

    return NextResponse.json({
      totalReports: saved.count ?? 0,
      scheduledReports: scheduled.count ?? 0,
      reportsThisMonth: runsThisMonth,
      totalExports: exportsThisMonth,
    });
  } catch (error) {
    console.error('Report stats error:', error);
    return NextResponse.json({ error: 'Failed to load report stats' }, { status: 500 });
  }
}

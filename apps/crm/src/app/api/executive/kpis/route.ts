import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/executive/kpis
 *
 * Returns executive KPI dashboard data.
 * Admin-only. Uses executive_kpi_mv — never raw tables.
 *
 * Query params:
 *   month – period month (format: YYYY-MM-DD, default: current month)
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'super_admin', 'admin'].includes(profile.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const supabase = await createClient();
    const monthParam = request.nextUrl.searchParams.get('month');

    const { data, error } = await supabase.rpc('get_executive_kpis', {
      p_org_id: profile.organization_id,
      p_month: monthParam || null,
    });

    if (error) throw error;

    return NextResponse.json(data || {
      month: null,
      revenue: {},
      production: {},
      growth: {},
      top_advisor: null,
      capacity_split: {},
      agency_breakdown: [],
      franchise_breakdown: [],
    });
  } catch (error) {
    console.error('Error fetching executive KPIs:', error);
    return NextResponse.json({ error: 'Failed to fetch executive KPIs' }, { status: 500 });
  }
}

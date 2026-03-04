import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analytics/advisor-summary
 * Advisor analytics: performance rankings, commissions, enrollments, retention
 * Tables: mv_advisor_monthly_performance, advisors, members, commissions
 * RPCs: get_org_dashboard_analytics, rpc_top_advisors_widget, rpc_advisor_retention_widget
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const orgId = profile.organization_id;
    const months = parseInt(request.nextUrl.searchParams.get('months') || '6', 10);

    // 1. Org dashboard analytics via RPC
    const { data: orgAnalytics } = await supabase.rpc('get_org_dashboard_analytics', {
      p_org_id: orgId,
      p_months: months,
    });

    // 2. Top advisors by enrollments
    const { data: topByEnrollments } = await supabase.rpc('rpc_top_advisors_widget', {
      p_org_id: orgId,
      p_metric: 'enrollments',
      p_limit: 10,
    });

    // 3. Top advisors by revenue
    const { data: topByRevenue } = await supabase.rpc('rpc_top_advisors_widget', {
      p_org_id: orgId,
      p_metric: 'revenue',
      p_limit: 10,
    });

    // 4. Retention time-series
    const { data: retentionTrend } = await supabase.rpc('rpc_advisor_retention_widget', {
      p_org_id: orgId,
      p_months: months,
    });

    // 5. Advisor status breakdown
    const { data: advisorStatuses } = await supabase
      .from('advisors')
      .select('status')
      .eq('organization_id', orgId)
      .limit(10000);

    const statusCounts: Record<string, number> = {};
    for (const a of advisorStatuses || []) {
      statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
    }

    // 6. Commission tier distribution
    const { data: tierData } = await supabase
      .from('advisors')
      .select('commission_tier')
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .limit(10000);

    const tierCounts: Record<string, number> = {};
    for (const a of tierData || []) {
      const tier = a.commission_tier || 'Unassigned';
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    }
    const tierDistribution = Object.entries(tierCounts)
      .map(([tier, count]) => ({ tier, count }))
      .sort((a, b) => b.count - a.count);

    // 7. Growth metrics (current vs previous month)
    const { data: growth } = await supabase.rpc('get_growth_metrics', {
      p_org_id: orgId,
    });

    return NextResponse.json({
      orgAnalytics: orgAnalytics || {},
      topByEnrollments: topByEnrollments || [],
      topByRevenue: topByRevenue || [],
      retentionTrend: retentionTrend || [],
      advisorStatusBreakdown: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
      tierDistribution,
      growth: growth || {},
    });
  } catch (error) {
    console.error('[AdvisorSummary] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

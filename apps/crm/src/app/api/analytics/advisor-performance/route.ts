import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analytics/advisor-performance
 *
 * Returns personal + downline metrics from the mv_advisor_monthly_performance
 * materialized view via the get_advisor_analytics() RPC.
 *
 * Query params:
 *   months – lookback window (default 12)
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const months = Number(request.nextUrl.searchParams.get('months') || '12');

    // Find the advisor record for this profile
    const { data: advisor } = await supabase
      .from('advisors')
      .select('id')
      .eq('profile_id', profile.id)
      .eq('organization_id', profile.organization_id)
      .single();

    const advisorId = advisor?.id;

    // Admins get org-wide analytics via get_org_dashboard_analytics
    const isAdmin = ['owner', 'super_admin', 'admin'].includes(profile.role || '');

    // Org-wide analytics (always returned for admins)
    let orgAnalytics = null;
    if (isAdmin) {
      const { data, error } = await supabase.rpc('get_org_dashboard_analytics', {
        p_org_id: profile.organization_id,
        p_months: months,
      });
      if (!error) orgAnalytics = data;
    }

    // Advisor-specific analytics (if user has an advisor record)
    let advisorAnalytics = null;
    if (advisorId) {
      const { data, error } = await supabase.rpc('get_advisor_analytics', {
        p_advisor_id: advisorId,
        p_org_id: profile.organization_id,
        p_months: months,
      });
      if (!error) advisorAnalytics = data;
    }

    // Growth metrics
    let growth = null;
    const { data: growthData, error: growthError } = await supabase.rpc('get_growth_metrics', {
      p_org_id: profile.organization_id,
      p_advisor_id: advisorId || null,
    });
    if (!growthError) growth = growthData;

    return NextResponse.json({
      advisor: advisorAnalytics,
      org: orgAnalytics,
      growth,
      isAdmin,
      advisorId,
    });
  } catch (error) {
    console.error('Advisor performance analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}

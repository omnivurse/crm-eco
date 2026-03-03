import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analytics/rankings
 *
 * Returns the leaderboard and the current user's ranking.
 *
 * Query params:
 *   month          – period month (default: current month, format: YYYY-MM-DD)
 *   limit          – leaderboard size (default: 10)
 *   capacity_scope – 'health_insurance' | 'health_share' | omit for all
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const params = request.nextUrl.searchParams;

    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const month = params.get('month') || defaultMonth;
    const limit = Math.min(Number(params.get('limit') || '10'), 50);
    const capacityScope = params.get('capacity_scope') || null;

    // Get leaderboard with capacity filtering
    const { data: leaderboard, error: lbError } = await supabase.rpc('get_leaderboard', {
      p_org_id: profile.organization_id,
      p_month: month,
      p_limit: limit,
      p_capacity_scope: capacityScope,
    });

    if (lbError) {
      console.error('Leaderboard error:', lbError);
    }

    // Get current user's ranking
    let myRanking = null;
    const { data: advisor } = await supabase
      .from('advisors')
      .select('id')
      .eq('profile_id', profile.id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (advisor) {
      const { data, error } = await supabase.rpc('get_my_ranking', {
        p_advisor_id: advisor.id,
        p_org_id: profile.organization_id,
        p_month: month,
        p_capacity_scope: capacityScope,
      });
      if (!error) myRanking = data;
    }

    return NextResponse.json({
      leaderboard: leaderboard || { leaderboard: [], month, total_ranked: 0 },
      myRanking: myRanking || { ranked: false },
      month,
      capacityScope,
    });
  } catch (error) {
    console.error('Error fetching rankings:', error);
    return NextResponse.json({ error: 'Failed to fetch rankings' }, { status: 500 });
  }
}

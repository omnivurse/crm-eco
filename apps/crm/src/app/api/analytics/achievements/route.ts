import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analytics/achievements
 *
 * Returns achievements for the current user (advisor) or all org achievements (admin).
 *
 * Query params:
 *   limit       – max results (default 20)
 *   unacked     – 'true' to only show unacknowledged (default false)
 *   advisor_id  – admin-only: fetch for specific advisor
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const params = request.nextUrl.searchParams;
    const limit = Math.min(Number(params.get('limit') || '20'), 100);
    const unackedOnly = params.get('unacked') === 'true';

    const isAdmin = ['owner', 'super_admin', 'admin'].includes(profile.role || '');
    const targetAdvisorId = isAdmin ? params.get('advisor_id') : null;

    // Find current user's advisor ID
    const { data: advisor } = await supabase
      .from('advisors')
      .select('id')
      .eq('profile_id', profile.id)
      .eq('organization_id', profile.organization_id)
      .single();

    const advisorId = targetAdvisorId || advisor?.id;

    if (!advisorId) {
      return NextResponse.json({ achievements: [], unacknowledged_count: 0 });
    }

    const { data, error } = await supabase.rpc('get_advisor_achievements', {
      p_advisor_id: advisorId,
      p_org_id: profile.organization_id,
      p_limit: limit,
      p_unacked_only: unackedOnly,
    });

    if (error) throw error;

    return NextResponse.json(data || { achievements: [], unacknowledged_count: 0 });
  } catch (error) {
    console.error('Error fetching achievements:', error);
    return NextResponse.json({ error: 'Failed to fetch achievements' }, { status: 500 });
  }
}

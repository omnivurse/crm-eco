import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crm/lifecycle/stats
 * Org-wide lifecycle KPIs: enrollments, cancellations, churn rate, top reasons
 */
export async function GET(_request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    const { data: stats, error } = await supabase
      .from('lifecycle_org_stats')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[LifecycleStats GET]', error);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    return NextResponse.json({
      data: stats || {
        total_tracked_members: 0,
        enrolled_this_month: 0,
        cancelled_this_month: 0,
        total_returned: 0,
        churn_rate_12m: 0,
        top_cancel_reason: null,
      },
    });
  } catch (error) {
    console.error('[LifecycleStats GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

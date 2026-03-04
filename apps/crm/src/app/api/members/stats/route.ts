import { NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/members/stats
 * Returns member counts grouped by status category and plan type:
 *   active, inactive, futureActive, futureInactive, total,
 *   byPlanType: { healthshare, insurance, medicaid, short_term }
 */
export async function GET() {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const orgId = profile.organization_id;
    const today = new Date().toISOString().split('T')[0];
    const ninetyDaysOut = new Date(
      Date.now() + 90 * 24 * 60 * 60 * 1000
    ).toISOString().split('T')[0];

    const [
      totalCount,
      activeCount,
      inactiveCount,
      futureActiveCount,
      futureInactiveCount,
      healthshareCount,
      insuranceCount,
      medicaidCount,
      shortTermCount,
    ] = await Promise.all([
      // Total members
      supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId),

      // Active: status='active'
      supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'active'),

      // Inactive: status in (inactive, terminated, paused)
      supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .in('status', ['inactive', 'terminated', 'paused']),

      // Future Active: pending/prospect members with future effective_date
      supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .in('status', ['pending', 'prospect']),

      // Future Inactive: active members with a termination_date within 90 days
      supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'active')
        .gte('termination_date', today)
        .lte('termination_date', ninetyDaysOut),

      // Active Healthshare Members
      supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'active')
        .eq('active_plan_type', 'healthshare'),

      // Active Insurance Clients
      supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'active')
        .eq('active_plan_type', 'insurance'),

      // Medicaid Clients
      supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'active')
        .eq('active_plan_type', 'medicaid'),

      // Short-term Clients
      supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'active')
        .eq('active_plan_type', 'short_term'),
    ]);

    return NextResponse.json({
      total: totalCount.count ?? 0,
      active: activeCount.count ?? 0,
      inactive: inactiveCount.count ?? 0,
      futureActive: futureActiveCount.count ?? 0,
      futureInactive: futureInactiveCount.count ?? 0,
      byPlanType: {
        healthshare: healthshareCount.count ?? 0,
        insurance: insuranceCount.count ?? 0,
        medicaid: medicaidCount.count ?? 0,
        short_term: shortTermCount.count ?? 0,
      },
    });
  } catch (error) {
    console.error('[Members Stats] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

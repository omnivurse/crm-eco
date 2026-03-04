import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analytics/medicaid
 * Medicaid stats: member counts, state breakdown, transition tracking
 * Tables: crm_records (is_medicaid columns), medicaid_dashboard_stats view, medicaid_state_breakdown view
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const orgId = profile.organization_id;

    // 1. Org-level dashboard stats from medicaid_dashboard_stats view
    const { data: dashStats } = await supabase
      .from('medicaid_dashboard_stats')
      .select('*')
      .eq('organization_id', orgId)
      .single();

    // 2. State breakdown from medicaid_state_breakdown view
    const { data: stateBreakdown } = await supabase
      .from('medicaid_state_breakdown')
      .select('*')
      .eq('organization_id', orgId)
      .order('total', { ascending: false });

    // 3. Members transitioning from Medicaid (end date within 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: transitioningMembers } = await supabase
      .from('crm_records')
      .select('id, title, email, medicaid_state, medicaid_start_date, medicaid_end_date, status')
      .eq('org_id', orgId)
      .eq('is_medicaid', true)
      .not('medicaid_end_date', 'is', null)
      .gte('medicaid_end_date', ninetyDaysAgo.toISOString().split('T')[0])
      .order('medicaid_end_date', { ascending: true })
      .limit(50);

    // 4. Monthly Medicaid enrollment trend (from lifecycle events where plan_type = medicaid)
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 12);

    const { data: lifecycleEvents } = await supabase
      .from('member_lifecycle_events')
      .select('event_type, event_date')
      .eq('organization_id', orgId)
      .eq('plan_type', 'medicaid')
      .gte('event_date', cutoff.toISOString().split('T')[0])
      .order('event_date', { ascending: true })
      .limit(5000);

    const monthlyMap = new Map<string, { enrolled: number; cancelled: number }>();
    for (const e of lifecycleEvents || []) {
      const month = e.event_date.slice(0, 7);
      const entry = monthlyMap.get(month) || { enrolled: 0, cancelled: 0 };
      if (e.event_type === 'enrolled') entry.enrolled++;
      if (e.event_type === 'cancelled') entry.cancelled++;
      monthlyMap.set(month, entry);
    }
    const monthlyTrends = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, counts]) => ({ month, ...counts }));

    // 5. Medicaid members by advisor (top 10)
    const { data: byAdvisor } = await supabase
      .from('member_lifecycle_events')
      .select('advisor_id, advisor:advisors!advisor_id(first_name, last_name)')
      .eq('organization_id', orgId)
      .eq('plan_type', 'medicaid')
      .eq('event_type', 'enrolled')
      .limit(5000);

    const advisorCounts = new Map<string, { name: string; count: number }>();
    for (const e of byAdvisor || []) {
      if (!e.advisor_id) continue;
      const advRaw = e.advisor as unknown;
      const adv = Array.isArray(advRaw) ? advRaw[0] as { first_name: string; last_name: string } | undefined : advRaw as { first_name: string; last_name: string } | null;
      const name = adv ? `${adv.first_name} ${adv.last_name}` : 'Unknown';
      const entry = advisorCounts.get(e.advisor_id) || { name, count: 0 };
      entry.count++;
      advisorCounts.set(e.advisor_id, entry);
    }
    const topAdvisors = Array.from(advisorCounts.entries())
      .map(([advisor_id, { name, count }]) => ({ advisor_id, name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return NextResponse.json({
      summary: {
        totalMedicaidMembers: dashStats?.total_medicaid_members || 0,
        activeMedicaid: dashStats?.active_medicaid || 0,
        formerMedicaid: dashStats?.former_medicaid || 0,
        transitioningFromMedicaid: dashStats?.transitioning_from_medicaid || 0,
        newMedicaidThisMonth: dashStats?.new_medicaid_this_month || 0,
      },
      stateBreakdown: stateBreakdown || [],
      transitioningMembers: transitioningMembers || [],
      monthlyTrends,
      topAdvisors,
    });
  } catch (error) {
    console.error('[Medicaid] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

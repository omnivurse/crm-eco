import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analytics/churn
 * Churn analysis: rates, reasons, at-risk members, advisor retention
 * Tables: member_lifecycle_events, lifecycle_org_stats, members
 * RPCs: rpc_lowest_churn_advisors_widget, rpc_advisor_retention_widget
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const orgId = profile.organization_id;
    const months = parseInt(request.nextUrl.searchParams.get('months') || '12', 10);

    // 1. Org churn KPIs from lifecycle_org_stats view
    const { data: orgStats } = await supabase
      .from('lifecycle_org_stats')
      .select('*')
      .eq('organization_id', orgId)
      .single();

    // 2. Monthly churn trend from lifecycle events
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    const { data: events } = await supabase
      .from('member_lifecycle_events')
      .select('event_type, event_date, reason')
      .eq('organization_id', orgId)
      .in('event_type', ['enrolled', 'cancelled'])
      .gte('event_date', cutoff.toISOString().split('T')[0])
      .order('event_date', { ascending: true })
      .limit(10000);

    // Monthly churn rate calculation
    const monthlyMap = new Map<string, { enrolled: number; cancelled: number }>();
    for (const e of events || []) {
      const month = e.event_date.slice(0, 7);
      const entry = monthlyMap.get(month) || { enrolled: 0, cancelled: 0 };
      if (e.event_type === 'enrolled') entry.enrolled++;
      if (e.event_type === 'cancelled') entry.cancelled++;
      monthlyMap.set(month, entry);
    }
    const monthlyChurn = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, { enrolled, cancelled }]) => ({
        month,
        enrolled,
        cancelled,
        churn_rate: enrolled > 0 ? Math.round((cancelled / enrolled) * 1000) / 10 : 0,
      }));

    // 3. Cancellation reasons breakdown
    const reasonCounts = new Map<string, number>();
    for (const e of (events || []).filter(ev => ev.event_type === 'cancelled' && ev.reason)) {
      reasonCounts.set(e.reason!, (reasonCounts.get(e.reason!) || 0) + 1);
    }
    const cancellationReasons = Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    // 4. Best retention advisors via RPC
    const { data: bestRetentionAdvisors } = await supabase.rpc('rpc_lowest_churn_advisors_widget', {
      p_org_id: orgId,
      p_limit: 10,
    });

    // 5. Monthly retention time-series via RPC
    const { data: retentionTrend } = await supabase.rpc('rpc_advisor_retention_widget', {
      p_org_id: orgId,
      p_months: months,
    });

    // 6. At-risk members (recently cancelled or returned, could churn again)
    const { data: atRiskMembers } = await supabase
      .from('member_history_summary')
      .select('*')
      .eq('organization_id', orgId)
      .gt('cancel_count', 0)
      .eq('current_status', 'enrolled')
      .order('cancel_count', { ascending: false })
      .limit(20);

    // 7. Member status breakdown for overall churn picture
    const [activeCount, cancelledCount, totalCount] = await Promise.all([
      supabase.from('members').select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId).eq('status', 'active'),
      supabase.from('members').select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId).in('status', ['cancelled', 'inactive', 'terminated']),
      supabase.from('members').select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId),
    ]);

    const totalMembers = totalCount.count || 0;
    const activeMembers = activeCount.count || 0;
    const cancelledMembers = cancelledCount.count || 0;
    const overallChurnRate = totalMembers > 0
      ? Math.round((cancelledMembers / totalMembers) * 1000) / 10
      : 0;

    return NextResponse.json({
      summary: {
        totalMembers,
        activeMembers,
        cancelledMembers,
        overallChurnRate,
        churnRate12m: orgStats?.churn_rate_12m || 0,
        enrolledThisMonth: orgStats?.enrolled_this_month || 0,
        cancelledThisMonth: orgStats?.cancelled_this_month || 0,
        topCancelReason: orgStats?.top_cancel_reason || null,
      },
      monthlyChurn,
      cancellationReasons,
      bestRetentionAdvisors: bestRetentionAdvisors || [],
      retentionTrend: retentionTrend || [],
      atRiskMembers: atRiskMembers || [],
    });
  } catch (error) {
    console.error('[Churn] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

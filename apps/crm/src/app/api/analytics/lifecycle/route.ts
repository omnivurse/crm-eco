import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analytics/lifecycle
 * Lifecycle stats: enrollment/cancellation/return trends, reasons, and org KPIs
 * Tables: member_lifecycle_events, lifecycle_org_stats view, member_history_summary view
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const orgId = profile.organization_id;
    const months = parseInt(request.nextUrl.searchParams.get('months') || '12', 10);

    // 1. Org-level KPIs from lifecycle_org_stats view
    const { data: orgStats } = await supabase
      .from('lifecycle_org_stats')
      .select('*')
      .eq('organization_id', orgId)
      .single();

    // 2. Monthly event counts for trend chart
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    const { data: events } = await supabase
      .from('member_lifecycle_events')
      .select('event_type, event_date, reason, plan_type')
      .eq('organization_id', orgId)
      .gte('event_date', cutoff.toISOString().split('T')[0])
      .order('event_date', { ascending: true })
      .limit(10000);

    // Aggregate monthly trends
    const monthlyMap = new Map<string, { enrolled: number; cancelled: number; returned: number; paused: number }>();
    for (const e of events || []) {
      const month = e.event_date.slice(0, 7); // YYYY-MM
      const entry = monthlyMap.get(month) || { enrolled: 0, cancelled: 0, returned: 0, paused: 0 };
      if (e.event_type in entry) {
        entry[e.event_type as keyof typeof entry]++;
      }
      monthlyMap.set(month, entry);
    }
    const monthlyTrends = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, counts]) => ({ month, ...counts }));

    // 3. Cancellation reasons breakdown
    const reasonCounts = new Map<string, number>();
    for (const e of (events || []).filter(ev => ev.event_type === 'cancelled' && ev.reason)) {
      reasonCounts.set(e.reason!, (reasonCounts.get(e.reason!) || 0) + 1);
    }
    const cancellationReasons = Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    // 4. Plan type breakdown
    const planTypeCounts = new Map<string, { enrolled: number; cancelled: number }>();
    for (const e of events || []) {
      const pt = e.plan_type || 'unknown';
      const entry = planTypeCounts.get(pt) || { enrolled: 0, cancelled: 0 };
      if (e.event_type === 'enrolled') entry.enrolled++;
      if (e.event_type === 'cancelled') entry.cancelled++;
      planTypeCounts.set(pt, entry);
    }
    const byPlanType = Array.from(planTypeCounts.entries())
      .map(([plan_type, counts]) => ({ plan_type, ...counts }))
      .sort((a, b) => b.enrolled - a.enrolled);

    // 5. Recent events list
    const { data: recentEvents } = await supabase
      .from('member_lifecycle_events')
      .select(`
        id, event_type, event_date, reason, reason_detail, plan_type,
        contact:crm_records!contact_id(id, title, email),
        advisor:advisors!advisor_id(id, first_name, last_name)
      `)
      .eq('organization_id', orgId)
      .order('event_date', { ascending: false })
      .limit(20);

    return NextResponse.json({
      summary: {
        totalTrackedMembers: orgStats?.total_tracked_members || 0,
        enrolledThisMonth: orgStats?.enrolled_this_month || 0,
        cancelledThisMonth: orgStats?.cancelled_this_month || 0,
        totalReturned: orgStats?.total_returned || 0,
        churnRate12m: orgStats?.churn_rate_12m || 0,
        topCancelReason: orgStats?.top_cancel_reason || null,
      },
      monthlyTrends,
      cancellationReasons,
      byPlanType,
      recentEvents: recentEvents || [],
    });
  } catch (error) {
    console.error('[Lifecycle] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

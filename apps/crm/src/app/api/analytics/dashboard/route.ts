import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthUser, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Maximum records to fetch for analytics (prevents unbounded queries)
const MAX_ANALYTICS_RECORDS = 10000;

/**
 * GET /api/analytics/dashboard
 * Get comprehensive analytics data for the dashboard
 * 
 * OPTIMIZED: Uses count queries and limits to prevent unbounded data fetches
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();

    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = profile.organization_id;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

    // Use count queries for totals (much more efficient than fetching all records)
    const [
      // Count queries for summary stats
      totalMembersCount,
      activeMembersCount,
      totalLeadsCount,
      activeLeadsCount,
      convertedLeadsCount,
      pendingEnrollmentsCount,
      completedEnrollmentsCount,
      openNeedsCount,
      urgentNeedsCount,
      activeAdvisorsCount,
      totalAdvisorsCount,
      recentMembersCount,
      previousPeriodMembersCount,
      // Limited data queries for calculations that need actual values
      activeMembersForMRR,
      recentLeadsResult,
      leadsForPipeline,
      needsForBreakdown,
    ] = await Promise.all([
      // Count queries (head: true returns only count, no data)
      supabase.from('members').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
      supabase.from('members').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'active'),
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).not('status', 'in', '(converted,lost,inactive)'),
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'converted'),
      supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).in('status', ['draft', 'pending', 'in_progress']),
      supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'approved'),
      supabase.from('needs').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).not('status', 'in', '(paid,closed)'),
      supabase.from('needs').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('urgency_light', 'red'),
      supabase.from('advisors').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'active'),
      supabase.from('advisors').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
      supabase.from('members').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).gte('created_at', thirtyDaysAgo),
      supabase.from('members').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).gte('created_at', sixtyDaysAgo).lt('created_at', thirtyDaysAgo),
      
      // Limited data queries for MRR calculation (only active members with monthly_share)
      supabase.from('members').select('monthly_share').eq('organization_id', orgId).eq('status', 'active').limit(MAX_ANALYTICS_RECORDS),
      
      // Recent leads for daily activity chart (last 30 days only)
      supabase.from('leads').select('id, status, created_at').eq('organization_id', orgId).gte('created_at', thirtyDaysAgo).limit(MAX_ANALYTICS_RECORDS),
      
      // Pipeline stats (limited)
      supabase.from('leads').select('status').eq('organization_id', orgId).not('status', 'in', '(converted,lost,inactive)').limit(MAX_ANALYTICS_RECORDS),
      
      // Needs breakdown
      supabase.from('needs').select('urgency_light, total_amount, reimbursed_amount').eq('organization_id', orgId).not('status', 'in', '(paid,closed)').limit(MAX_ANALYTICS_RECORDS),
    ]);

    // Extract counts
    const totalMembers = totalMembersCount.count || 0;
    const activeMembers = activeMembersCount.count || 0;
    const totalLeads = totalLeadsCount.count || 0;
    const activeLeadsNum = activeLeadsCount.count || 0;
    const convertedLeadsNum = convertedLeadsCount.count || 0;
    const recentMembersNum = recentMembersCount.count || 0;
    const previousPeriodMembersNum = previousPeriodMembersCount.count || 0;
    
    // Calculate MRR from limited active members data
    const mrrData = activeMembersForMRR.data || [];
    const mrr = mrrData.reduce((sum: number, m: { monthly_share: number | null }) => sum + (Number(m.monthly_share) || 0), 0);
    
    // Calculate conversion rate
    const conversionRate = totalLeads > 0 ? (convertedLeadsNum / totalLeads * 100) : 0;
    
    // Calculate growth
    const memberGrowth = recentMembersNum - previousPeriodMembersNum;
    const memberGrowthPct = previousPeriodMembersNum > 0 
      ? ((memberGrowth / previousPeriodMembersNum) * 100).toFixed(1)
      : recentMembersNum > 0 ? 100 : 0;

    // Pipeline funnel from limited data
    const pipelineData = leadsForPipeline.data || [];
    const pipeline = {
      newLeads: pipelineData.filter((l: { status: string }) => l.status === 'new').length,
      contacted: pipelineData.filter((l: { status: string }) => l.status === 'contacted').length,
      qualified: pipelineData.filter((l: { status: string }) => l.status === 'qualified').length,
      proposal: pipelineData.filter((l: { status: string }) => l.status === 'proposal').length,
      converted: convertedLeadsNum,
    };
    
    // Needs breakdown from limited data
    const needsData = needsForBreakdown.data || [];
    const totalNeedsAmount = needsData.reduce((sum: number, n: { total_amount: number | null }) => sum + (Number(n.total_amount) || 0), 0);
    const totalReimbursed = needsData.reduce((sum: number, n: { reimbursed_amount: number | null }) => sum + (Number(n.reimbursed_amount) || 0), 0);

    // Daily activity for chart (last 30 days) - use recent leads data
    const recentLeads = recentLeadsResult.data || [];
    const dailyActivity: { date: string; members: number; leads: number; enrollments: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      dailyActivity.push({
        date: dateStr,
        members: 0, // Would need separate query - simplified for performance
        leads: recentLeads.filter((l: { created_at: string }) => l.created_at?.startsWith(dateStr)).length,
        enrollments: 0, // Would need separate query - simplified for performance
      });
    }

    return NextResponse.json({
      summary: {
        totalMembers,
        activeMembers,
        newMembersThisMonth: recentMembersNum,
        memberGrowthPct: Number(memberGrowthPct),
        mrr,
        totalLeads,
        activeLeads: activeLeadsNum,
        conversionRate: Math.round(conversionRate * 10) / 10,
        pendingEnrollments: pendingEnrollmentsCount.count || 0,
        completedEnrollments: completedEnrollmentsCount.count || 0,
        openNeeds: openNeedsCount.count || 0,
        urgentNeeds: urgentNeedsCount.count || 0,
        totalNeedsAmount,
        totalReimbursed,
        activeAdvisors: activeAdvisorsCount.count || 0,
        totalAdvisors: totalAdvisorsCount.count || 0,
      },
      pipeline,
      dailyActivity,
      needsBreakdown: {
        open: openNeedsCount.count || 0,
        urgent: urgentNeedsCount.count || 0,
        atRisk: needsData.filter((n: { urgency_light: string }) => n.urgency_light === 'orange').length,
        onTrack: needsData.filter((n: { urgency_light: string }) => n.urgency_light === 'green').length,
      },
    });
  } catch (error) {
    console.error('Analytics dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

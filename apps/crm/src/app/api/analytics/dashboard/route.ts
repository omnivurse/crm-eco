import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import {
  applyHideConvertedLeadsFilter,
  leadStatusKey,
  resolveLeadsModuleId,
} from '@crm-eco/lib';
import { ENROLLMENT_STATUS } from '@crm-eco/lib/analytics';

export const dynamic = 'force-dynamic';

const MAX_ANALYTICS_RECORDS = 10000;
const TERMINAL_STATUSES = '("Converted","Lost","Inactive")';

/**
 * GET /api/analytics/dashboard
 * Get comprehensive analytics data for the dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();

    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = profile.organization_id;
    const leadsModuleId = await resolveLeadsModuleId(supabase, orgId);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

    const emptyLeadStats = {
      totalLeadsCount: { count: 0 },
      activeLeadsCount: { count: 0 },
      convertedLeadsCount: { count: 0 },
      recentLeadsResult: { data: [] as Array<{ id: string; status: string | null; created_at: string | null }> },
      leadsForPipeline: { data: [] as Array<{ status: string | null }> },
    };

    const leadStatsPromise = leadsModuleId
      ? Promise.all([
          supabase
            .from('crm_records')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', orgId)
            .eq('module_id', leadsModuleId),
          (applyHideConvertedLeadsFilter(
            supabase
              .from('crm_records')
              .select('*', { count: 'exact', head: true })
              .eq('org_id', orgId)
              .eq('module_id', leadsModuleId) as any,
          ).not('status', 'in', TERMINAL_STATUSES) as any),
          supabase
            .from('crm_records')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', orgId)
            .eq('module_id', leadsModuleId)
            .or('status.eq.Converted,status.eq.converted'),
          supabase
            .from('crm_records')
            .select('id, status, created_at')
            .eq('org_id', orgId)
            .eq('module_id', leadsModuleId)
            .gte('created_at', thirtyDaysAgo)
            .limit(MAX_ANALYTICS_RECORDS),
          (applyHideConvertedLeadsFilter(
            supabase
              .from('crm_records')
              .select('status')
              .eq('org_id', orgId)
              .eq('module_id', leadsModuleId) as any,
          )
            .not('status', 'in', TERMINAL_STATUSES)
            .limit(MAX_ANALYTICS_RECORDS) as any),
        ]).then(([totalLeadsCount, activeLeadsCount, convertedLeadsCount, recentLeadsResult, leadsForPipeline]) => ({
          totalLeadsCount,
          activeLeadsCount,
          convertedLeadsCount,
          recentLeadsResult,
          leadsForPipeline,
        }))
      : Promise.resolve(emptyLeadStats);

    const [
      totalMembersCount,
      activeMembersCount,
      leadStats,
      pendingEnrollmentsCount,
      completedEnrollmentsCount,
      openNeedsCount,
      urgentNeedsCount,
      activeAdvisorsCount,
      totalAdvisorsCount,
      recentMembersCount,
      previousPeriodMembersCount,
      activeSchedulesForMRR,
      needsForBreakdown,
      recentMembersForChart,
      recentEnrollmentsForChart,
    ] = await Promise.all([
      supabase.from('members').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
      supabase.from('members').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'active'),
      leadStatsPromise,
      supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).in('status', [...ENROLLMENT_STATUS.pendingReview, ...ENROLLMENT_STATUS.draft]),
      supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).in('status', [...ENROLLMENT_STATUS.approvedOrActive]),
      supabase.from('needs').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).not('status', 'in', '(paid,closed)'),
      supabase.from('needs').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('urgency_light', 'red'),
      supabase.from('advisors').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'active'),
      supabase.from('advisors').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
      supabase.from('members').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).gte('created_at', thirtyDaysAgo),
      supabase.from('members').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).gte('created_at', sixtyDaysAgo).lt('created_at', thirtyDaysAgo),
      supabase.from('billing_schedules').select('amount').eq('organization_id', orgId).eq('status', 'active').limit(MAX_ANALYTICS_RECORDS),
      supabase.from('needs').select('urgency_light, total_amount, reimbursed_amount').eq('organization_id', orgId).not('status', 'in', '(paid,closed)').limit(MAX_ANALYTICS_RECORDS),
      supabase.from('members').select('created_at').eq('organization_id', orgId).gte('created_at', thirtyDaysAgo).limit(MAX_ANALYTICS_RECORDS),
      supabase.from('enrollments').select('created_at').eq('organization_id', orgId).gte('created_at', thirtyDaysAgo).limit(MAX_ANALYTICS_RECORDS),
    ]);

    const {
      totalLeadsCount,
      activeLeadsCount,
      convertedLeadsCount,
      recentLeadsResult,
      leadsForPipeline,
    } = leadStats;

    const today = now.toISOString().split('T')[0];
    const { data: snapshot } = await supabase
      .from('analytics_snapshots')
      .select('total_members, active_members, total_enrollments, pending_enrollments, approved_enrollments, total_mrr, total_advisors, active_advisors')
      .eq('organization_id', orgId)
      .eq('snapshot_date', today)
      .eq('metric_type', 'daily')
      .maybeSingle();

    const totalMembers = snapshot?.total_members ?? (totalMembersCount.count || 0);
    const activeMembers = snapshot?.active_members ?? (activeMembersCount.count || 0);
    const totalLeads = totalLeadsCount.count || 0;
    const activeLeadsNum = activeLeadsCount.count || 0;
    const convertedLeadsNum = convertedLeadsCount.count || 0;
    const recentMembersNum = recentMembersCount.count || 0;
    const previousPeriodMembersNum = previousPeriodMembersCount.count || 0;

    // MRR from active billing schedules (authoritative), not the denormalized
    // members.monthly_share cache column.
    const mrrData = activeSchedulesForMRR.data || [];
    const mrr = snapshot?.total_mrr != null
      ? Number(snapshot.total_mrr)
      : mrrData.reduce((sum: number, s: { amount: number | null }) => sum + (Number(s.amount) || 0), 0);

    const conversionRate = totalLeads > 0 ? (convertedLeadsNum / totalLeads * 100) : 0;

    const memberGrowth = recentMembersNum - previousPeriodMembersNum;
    const memberGrowthPct = previousPeriodMembersNum > 0
      ? ((memberGrowth / previousPeriodMembersNum) * 100).toFixed(1)
      : recentMembersNum > 0 ? 100 : 0;

    const pipelineData = (leadsForPipeline.data ?? []) as Array<{ status: string | null }>;
    const pipeline = {
      newLeads: pipelineData.filter((l: { status: string | null }) => leadStatusKey(l.status) === 'new').length,
      contacted: pipelineData.filter((l: { status: string | null }) => leadStatusKey(l.status) === 'contacted').length,
      qualified: pipelineData.filter((l: { status: string | null }) => leadStatusKey(l.status) === 'qualified').length,
      proposal: pipelineData.filter((l: { status: string | null }) => leadStatusKey(l.status) === 'proposal').length,
      converted: convertedLeadsNum,
    };

    const needsData = needsForBreakdown.data || [];
    const totalNeedsAmount = needsData.reduce((sum: number, n: { total_amount: number | null }) => sum + (Number(n.total_amount) || 0), 0);
    const totalReimbursed = needsData.reduce((sum: number, n: { reimbursed_amount: number | null }) => sum + (Number(n.reimbursed_amount) || 0), 0);

    const recentLeads = (recentLeadsResult.data ?? []) as Array<{ created_at: string | null }>;
    const recentMemberDays = (recentMembersForChart.data ?? []) as Array<{ created_at: string | null }>;
    const recentEnrollmentDays = (recentEnrollmentsForChart.data ?? []) as Array<{ created_at: string | null }>;
    const dailyActivity: { date: string; members: number; leads: number; enrollments: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];

      dailyActivity.push({
        date: dateStr,
        members: recentMemberDays.filter((m) => m.created_at?.startsWith(dateStr)).length,
        leads: recentLeads.filter((l) => l.created_at?.startsWith(dateStr)).length,
        enrollments: recentEnrollmentDays.filter((e) => e.created_at?.startsWith(dateStr)).length,
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
        pendingEnrollments: snapshot?.pending_enrollments ?? (pendingEnrollmentsCount.count || 0),
        completedEnrollments: snapshot?.approved_enrollments ?? (completedEnrollmentsCount.count || 0),
        openNeeds: openNeedsCount.count || 0,
        urgentNeeds: urgentNeedsCount.count || 0,
        totalNeedsAmount,
        totalReimbursed,
        activeAdvisors: snapshot?.active_advisors ?? (activeAdvisorsCount.count || 0),
        totalAdvisors: snapshot?.total_advisors ?? (totalAdvisorsCount.count || 0),
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

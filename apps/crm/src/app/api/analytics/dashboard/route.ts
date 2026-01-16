import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

/**
 * GET /api/analytics/dashboard
 * Get comprehensive analytics data for the dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 403 });
    }

    const orgId = profile.organization_id;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Parallel queries for efficiency
    const [
      membersResult,
      leadsResult,
      enrollmentsResult,
      needsResult,
      advisorsResult,
      recentMembersResult,
      recentLeadsResult,
    ] = await Promise.all([
      // Total members by status
      supabase
        .from('members')
        .select('id, status, created_at, monthly_share')
        .eq('organization_id', orgId),

      // Total leads by status
      supabase
        .from('leads')
        .select('id, status, created_at')
        .eq('organization_id', orgId),

      // Enrollments
      supabase
        .from('enrollments')
        .select('id, status, created_at')
        .eq('organization_id', orgId),

      // Needs
      supabase
        .from('needs')
        .select('id, status, urgency_light, total_amount, reimbursed_amount, created_at')
        .eq('organization_id', orgId),

      // Active advisors
      supabase
        .from('advisors')
        .select('id, status, created_at')
        .eq('organization_id', orgId),

      // Recent members (last 30 days)
      supabase
        .from('members')
        .select('id, created_at')
        .eq('organization_id', orgId)
        .gte('created_at', thirtyDaysAgo),

      // Recent leads (last 30 days)
      supabase
        .from('leads')
        .select('id, status, created_at')
        .eq('organization_id', orgId)
        .gte('created_at', thirtyDaysAgo),
    ]);

    const members = membersResult.data || [];
    const leads = leadsResult.data || [];
    const enrollments = enrollmentsResult.data || [];
    const needs = needsResult.data || [];
    const advisors = advisorsResult.data || [];
    const recentMembers = recentMembersResult.data || [];
    const recentLeads = recentLeadsResult.data || [];

    // Calculate metrics
    const activeMembers = members.filter(m => m.status === 'active');
    const mrr = activeMembers.reduce((sum, m) => sum + (Number(m.monthly_share) || 0), 0);

    const activeLeads = leads.filter(l => !['converted', 'lost', 'inactive'].includes(l.status));
    const convertedLeads = leads.filter(l => l.status === 'converted');
    const conversionRate = leads.length > 0 ? (convertedLeads.length / leads.length * 100) : 0;

    const pendingEnrollments = enrollments.filter(e => ['draft', 'pending', 'in_progress'].includes(e.status));
    const completedEnrollments = enrollments.filter(e => e.status === 'approved');

    const openNeeds = needs.filter(n => !['paid', 'closed'].includes(n.status));
    const urgentNeeds = needs.filter(n => n.urgency_light === 'red');
    const totalNeedsAmount = needs.reduce((sum, n) => sum + (Number(n.total_amount) || 0), 0);
    const totalReimbursed = needs.reduce((sum, n) => sum + (Number(n.reimbursed_amount) || 0), 0);

    const activeAdvisors = advisors.filter(a => a.status === 'active');

    // Calculate trends (compare to previous period)
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const previousPeriodMembers = members.filter(m => {
      const created = new Date(m.created_at);
      return created >= sixtyDaysAgo && created < new Date(thirtyDaysAgo);
    });
    const memberGrowth = recentMembers.length - previousPeriodMembers.length;
    const memberGrowthPct = previousPeriodMembers.length > 0 
      ? ((memberGrowth / previousPeriodMembers.length) * 100).toFixed(1)
      : recentMembers.length > 0 ? 100 : 0;

    // Pipeline funnel
    const pipeline = {
      newLeads: leads.filter(l => l.status === 'new').length,
      contacted: leads.filter(l => l.status === 'contacted').length,
      qualified: leads.filter(l => l.status === 'qualified').length,
      proposal: leads.filter(l => l.status === 'proposal').length,
      converted: convertedLeads.length,
    };

    // Daily activity for chart (last 30 days)
    const dailyActivity: { date: string; members: number; leads: number; enrollments: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      dailyActivity.push({
        date: dateStr,
        members: members.filter(m => m.created_at?.startsWith(dateStr)).length,
        leads: leads.filter(l => l.created_at?.startsWith(dateStr)).length,
        enrollments: enrollments.filter(e => e.created_at?.startsWith(dateStr)).length,
      });
    }

    return NextResponse.json({
      summary: {
        totalMembers: members.length,
        activeMembers: activeMembers.length,
        newMembersThisMonth: recentMembers.length,
        memberGrowthPct: Number(memberGrowthPct),
        mrr,
        totalLeads: leads.length,
        activeLeads: activeLeads.length,
        conversionRate: Math.round(conversionRate * 10) / 10,
        pendingEnrollments: pendingEnrollments.length,
        completedEnrollments: completedEnrollments.length,
        openNeeds: openNeeds.length,
        urgentNeeds: urgentNeeds.length,
        totalNeedsAmount,
        totalReimbursed,
        activeAdvisors: activeAdvisors.length,
        totalAdvisors: advisors.length,
      },
      pipeline,
      dailyActivity,
      needsBreakdown: {
        open: openNeeds.length,
        urgent: urgentNeeds.length,
        atRisk: needs.filter(n => n.urgency_light === 'orange').length,
        onTrack: needs.filter(n => n.urgency_light === 'green').length,
      },
    });
  } catch (error) {
    console.error('Analytics dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

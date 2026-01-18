import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@crm-eco/ui';
import {
  TrendingUp,
  Users,
  FileText,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  BarChart3,
  PieChart,
  Target,
} from 'lucide-react';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import Link from 'next/link';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

interface EnrollmentStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  byPlan: { plan_name: string; count: number }[];
  byAdvisor: { advisor_name: string; count: number }[];
  byMonth: { month: string; count: number; approved: number }[];
  conversionRate: number;
  avgProcessingDays: number;
}

interface RevenueStats {
  totalCollected: number;
  thisMonth: number;
  lastMonth: number;
  pendingPayments: number;
  avgMonthlyShare: number;
}

async function getEnrollmentStats(): Promise<EnrollmentStats | null> {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single() as { data: { organization_id: string } | null };

  if (!profile) return null;

  const orgId = profile.organization_id;

  // Get enrollment counts by status
  const [totalRes, pendingRes, approvedRes, rejectedRes, cancelledRes] = await Promise.all([
    supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
    supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'pending'),
    supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'approved'),
    supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'rejected'),
    supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'cancelled'),
  ]);

  // Get enrollments by plan (using plans table)
  const { data: byPlanData } = await (supabase as any)
    .from('enrollments')
    .select('plan_id, plans(name)')
    .eq('organization_id', orgId)
    .not('plan_id', 'is', null);

  const planCounts: Record<string, number> = {};
  (byPlanData || []).forEach((e: any) => {
    const name = e.plans?.name || 'Unknown';
    planCounts[name] = (planCounts[name] || 0) + 1;
  });
  const byPlan = Object.entries(planCounts)
    .map(([plan_name, count]) => ({ plan_name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Get enrollments by advisor
  const { data: byAdvisorData } = await (supabase as any)
    .from('enrollments')
    .select('advisor_id, advisors(first_name, last_name)')
    .eq('organization_id', orgId)
    .not('advisor_id', 'is', null);

  const advisorCounts: Record<string, number> = {};
  (byAdvisorData || []).forEach((e: any) => {
    const name = e.advisors ? `${e.advisors.first_name} ${e.advisors.last_name}` : 'Unknown';
    advisorCounts[name] = (advisorCounts[name] || 0) + 1;
  });
  const byAdvisor = Object.entries(advisorCounts)
    .map(([advisor_name, count]) => ({ advisor_name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Get enrollments by month (last 6 months)
  const sixMonthsAgo = subDays(new Date(), 180);
  const { data: monthlyData } = await supabase
    .from('enrollments')
    .select('created_at, status')
    .eq('organization_id', orgId)
    .gte('created_at', sixMonthsAgo.toISOString());

  const monthCounts: Record<string, { count: number; approved: number }> = {};
  (monthlyData || []).forEach((e: any) => {
    const month = format(new Date(e.created_at), 'yyyy-MM');
    if (!monthCounts[month]) {
      monthCounts[month] = { count: 0, approved: 0 };
    }
    monthCounts[month].count++;
    if (e.status === 'approved') {
      monthCounts[month].approved++;
    }
  });
  const byMonth = Object.entries(monthCounts)
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Calculate conversion rate
  const total = totalRes.count ?? 0;
  const approved = approvedRes.count ?? 0;
  const conversionRate = total > 0 ? (approved / total) * 100 : 0;

  // Calculate average processing days
  const { data: processedEnrollments } = await supabase
    .from('enrollments')
    .select('created_at, approved_at')
    .eq('organization_id', orgId)
    .eq('status', 'approved')
    .not('approved_at', 'is', null)
    .limit(100) as { data: { created_at: string; approved_at: string | null }[] | null };

  let avgProcessingDays = 0;
  if (processedEnrollments && processedEnrollments.length > 0) {
    const totalDays = processedEnrollments.reduce((sum, e) => {
      const created = new Date(e.created_at);
      const approved = new Date(e.approved_at!);
      const days = Math.ceil((approved.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0);
    avgProcessingDays = totalDays / processedEnrollments.length;
  }

  return {
    total,
    pending: pendingRes.count ?? 0,
    approved,
    rejected: rejectedRes.count ?? 0,
    cancelled: cancelledRes.count ?? 0,
    byPlan,
    byAdvisor,
    byMonth,
    conversionRate,
    avgProcessingDays,
  };
}

async function getRevenueStats(): Promise<RevenueStats | null> {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single() as { data: { organization_id: string } | null };

  if (!profile) return null;

  const orgId = profile.organization_id;
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(subDays(thisMonthStart, 1));
  const lastMonthEnd = endOfMonth(subDays(thisMonthStart, 1));

  const [totalRes, thisMonthRes, lastMonthRes, pendingRes] = await Promise.all([
    (supabase as any)
      .from('billing_transactions')
      .select('amount')
      .eq('organization_id', orgId)
      .eq('status', 'success')
      .eq('transaction_type', 'charge') as { data: { amount: number }[] | null },
    (supabase as any)
      .from('billing_transactions')
      .select('amount')
      .eq('organization_id', orgId)
      .eq('status', 'success')
      .eq('transaction_type', 'charge')
      .gte('created_at', thisMonthStart.toISOString()) as { data: { amount: number }[] | null },
    (supabase as any)
      .from('billing_transactions')
      .select('amount')
      .eq('organization_id', orgId)
      .eq('status', 'success')
      .eq('transaction_type', 'charge')
      .gte('created_at', lastMonthStart.toISOString())
      .lte('created_at', lastMonthEnd.toISOString()) as { data: { amount: number }[] | null },
    (supabase as any)
      .from('billing_transactions')
      .select('amount')
      .eq('organization_id', orgId)
      .in('status', ['pending', 'processing']) as { data: { amount: number }[] | null },
  ]);

  const totalCollected = (totalRes.data || []).reduce((sum, t) => sum + (t.amount || 0), 0);
  const thisMonth = (thisMonthRes.data || []).reduce((sum, t) => sum + (t.amount || 0), 0);
  const lastMonth = (lastMonthRes.data || []).reduce((sum, t) => sum + (t.amount || 0), 0);
  const pendingPayments = (pendingRes.data || []).reduce((sum, t) => sum + (t.amount || 0), 0);

  // Get avg monthly share from active schedules
  const { data: schedules } = await (supabase as any)
    .from('billing_schedules')
    .select('amount')
    .eq('organization_id', orgId)
    .eq('status', 'active');

  const avgMonthlyShare = schedules && schedules.length > 0
    ? schedules.reduce((sum: number, s: any) => sum + (s.amount || 0), 0) / schedules.length
    : 0;

  return {
    totalCollected,
    thisMonth,
    lastMonth,
    pendingPayments,
    avgMonthlyShare,
  };
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function getMonthTrend(current: number, previous: number): { trend: 'up' | 'down' | 'flat'; percent: number } {
  if (previous === 0) return { trend: 'flat', percent: 0 };
  const percent = ((current - previous) / previous) * 100;
  return {
    trend: percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat',
    percent: Math.abs(percent),
  };
}

export default async function AnalyticsPage() {
  const [enrollmentStats, revenueStats] = await Promise.all([
    getEnrollmentStats(),
    getRevenueStats(),
  ]);

  const revenueTrend = revenueStats
    ? getMonthTrend(revenueStats.thisMonth, revenueStats.lastMonth)
    : { trend: 'flat' as const, percent: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-500">Enrollment and revenue insights</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/analytics/enrollments">
            <Badge variant="outline" className="cursor-pointer hover:bg-slate-100">
              <BarChart3 className="w-3 h-3 mr-1" />
              Detailed Reports
            </Badge>
          </Link>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Enrollments</CardTitle>
            <FileText className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enrollmentStats?.total ?? 0}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                {enrollmentStats?.pending ?? 0} pending
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Conversion Rate</CardTitle>
            <Target className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {(enrollmentStats?.conversionRate ?? 0).toFixed(1)}%
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {enrollmentStats?.approved ?? 0} approved of {enrollmentStats?.total ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Revenue This Month</CardTitle>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(revenueStats?.thisMonth ?? 0)}</div>
            <div className="flex items-center gap-1 mt-1">
              {revenueTrend.trend === 'up' ? (
                <ArrowUpRight className="w-4 h-4 text-green-500" />
              ) : revenueTrend.trend === 'down' ? (
                <ArrowDownRight className="w-4 h-4 text-red-500" />
              ) : null}
              <span className={`text-xs ${revenueTrend.trend === 'up' ? 'text-green-600' : revenueTrend.trend === 'down' ? 'text-red-600' : 'text-slate-500'}`}>
                {revenueTrend.percent.toFixed(1)}% vs last month
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Avg Processing Time</CardTitle>
            <Clock className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(enrollmentStats?.avgProcessingDays ?? 0).toFixed(1)} days
            </div>
            <p className="text-xs text-slate-500 mt-1">From submission to approval</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Monthly Enrollment Trend
            </CardTitle>
            <CardDescription>Enrollments over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            {(enrollmentStats?.byMonth?.length ?? 0) > 0 ? (
              <div className="space-y-4">
                {enrollmentStats?.byMonth.map((month, idx) => {
                  const maxCount = Math.max(...(enrollmentStats?.byMonth.map(m => m.count) ?? [1]));
                  const widthPercent = (month.count / maxCount) * 100;
                  const approvedPercent = month.count > 0 ? (month.approved / month.count) * 100 : 0;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">
                          {format(new Date(month.month + '-01'), 'MMM yyyy')}
                        </span>
                        <span className="text-slate-500">
                          {month.count} total ({month.approved} approved)
                        </span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${widthPercent}%` }}
                        >
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${approvedPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center gap-4 pt-2">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 bg-blue-500 rounded" />
                    <span className="text-slate-500">Total</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 bg-green-500 rounded" />
                    <span className="text-slate-500">Approved</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-center text-slate-500 py-8">No enrollment data available</p>
            )}
          </CardContent>
        </Card>

        {/* Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Enrollment Status
            </CardTitle>
            <CardDescription>Current status breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-yellow-500" />
                  <span>Pending Review</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{enrollmentStats?.pending ?? 0}</span>
                  <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-500 rounded-full"
                      style={{ width: `${enrollmentStats?.total ? ((enrollmentStats?.pending ?? 0) / enrollmentStats.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Approved</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{enrollmentStats?.approved ?? 0}</span>
                  <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${enrollmentStats?.total ? ((enrollmentStats?.approved ?? 0) / enrollmentStats.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span>Rejected</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{enrollmentStats?.rejected ?? 0}</span>
                  <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full"
                      style={{ width: `${enrollmentStats?.total ? ((enrollmentStats?.rejected ?? 0) / enrollmentStats.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-slate-400" />
                  <span>Cancelled</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{enrollmentStats?.cancelled ?? 0}</span>
                  <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-400 rounded-full"
                      style={{ width: `${enrollmentStats?.total ? ((enrollmentStats?.cancelled ?? 0) / enrollmentStats.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Plans */}
        <Card>
          <CardHeader>
            <CardTitle>Top Plans</CardTitle>
            <CardDescription>Most enrolled products</CardDescription>
          </CardHeader>
          <CardContent>
            {(enrollmentStats?.byPlan?.length ?? 0) > 0 ? (
              <div className="space-y-3">
                {enrollmentStats?.byPlan.map((plan, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <span className="font-medium">{plan.plan_name}</span>
                    </div>
                    <Badge variant="secondary">{plan.count} enrollments</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-slate-500 py-8">No plan data available</p>
            )}
          </CardContent>
        </Card>

        {/* Top Advisors */}
        <Card>
          <CardHeader>
            <CardTitle>Top Advisors</CardTitle>
            <CardDescription>By enrollment count</CardDescription>
          </CardHeader>
          <CardContent>
            {(enrollmentStats?.byAdvisor?.length ?? 0) > 0 ? (
              <div className="space-y-3">
                {enrollmentStats?.byAdvisor.map((advisor, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <span className="font-medium">{advisor.advisor_name}</span>
                    </div>
                    <Badge variant="secondary">{advisor.count} enrollments</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-slate-500 py-8">No advisor data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Revenue Summary
          </CardTitle>
          <CardDescription>Payment collection overview</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-slate-500">Total Collected</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(revenueStats?.totalCollected ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">This Month</p>
              <p className="text-2xl font-bold">{formatCurrency(revenueStats?.thisMonth ?? 0)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Pending Payments</p>
              <p className="text-2xl font-bold text-yellow-600">
                {formatCurrency(revenueStats?.pendingPayments ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Avg Monthly Share</p>
              <p className="text-2xl font-bold">{formatCurrency(revenueStats?.avgMonthlyShare ?? 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

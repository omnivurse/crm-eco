import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@crm-eco/ui';
import {
  Users,
  UserCheck,
  FileText,
  TrendingUp,
  Clock,
  Activity,
  User,
  Package,
  Settings,
  DollarSign,
  Sparkles,
  ArrowUpRight,
  AlertCircle,
  Zap,
  Target,
  Award,
  BarChart3,
  RefreshCw,
  ChevronRight,
  Building2,
  Shield,
  CreditCard,
} from 'lucide-react';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { 
  TodoListWidget, 
  JobsWidget, 
  RecentPagesWidget,
  StatCard,
  CommissionCard,
  FutureEnrollmentsCard,
  MemberActivityAnalysis,
} from '@/components/dashboard';
import type { FutureEnrollmentsData, MemberActivityData } from '@/components/dashboard';
import { DashboardHeaderClient } from './DashboardHeaderClient';

interface ActivityLogEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_profile: {
    full_name: string;
    email: string;
  } | null;
}

async function getDashboardStats() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single() as { data: { organization_id: string } | null };

  if (!profile) return null;

  const orgId = profile.organization_id;

  // Get current month dates
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const [
    membersResult, 
    agentsResult, 
    enrollmentsResult, 
    activeEnrollmentsResult, 
    pendingEnrollmentsResult,
    // Previous month data for trends
    prevMembersResult,
    prevAgentsResult,
    prevEnrollmentsResult,
  ] = await Promise.all([
    supabase
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId),
    supabase
      .from('advisors')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId),
    supabase
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId),
    supabase
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'approved'),
    supabase
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'submitted'),
    // Previous month counts for trend calculation
    supabase
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .lte('created_at', endOfPrevMonth.toISOString()),
    supabase
      .from('advisors')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .lte('created_at', endOfPrevMonth.toISOString()),
    supabase
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .lte('created_at', endOfPrevMonth.toISOString()),
  ]);

  const [pendingCommissionsResult, paidCommissionsResult] = await Promise.all([
    supabase
      .from('commission_transactions')
      .select('commission_amount')
      .eq('organization_id', orgId)
      .eq('status', 'pending') as unknown as { data: { commission_amount: number }[] | null },
    supabase
      .from('commission_transactions')
      .select('commission_amount')
      .eq('organization_id', orgId)
      .eq('status', 'paid')
      .gte('paid_at', startOfMonth.toISOString()) as unknown as { data: { commission_amount: number }[] | null },
  ]);

  const pendingCommissions = (pendingCommissionsResult.data || []).reduce(
    (sum, t) => sum + (t.commission_amount || 0),
    0
  );
  const paidThisMonth = (paidCommissionsResult.data || []).reduce(
    (sum, t) => sum + (t.commission_amount || 0),
    0
  );

  // Get profile ID
  const { data: profileData } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .single() as { data: { id: string } | null };

  // Calculate trends
  const currentMembers = membersResult.count ?? 0;
  const prevMembers = prevMembersResult.count ?? 0;
  const currentAgents = agentsResult.count ?? 0;
  const prevAgents = prevAgentsResult.count ?? 0;
  const currentEnrollments = enrollmentsResult.count ?? 0;
  const prevEnrollments = prevEnrollmentsResult.count ?? 0;

  return {
    totalMembers: currentMembers,
    totalAgents: currentAgents,
    totalEnrollments: currentEnrollments,
    activeEnrollments: activeEnrollmentsResult.count ?? 0,
    pendingEnrollments: pendingEnrollmentsResult.count ?? 0,
    pendingCommissions,
    paidThisMonth,
    profileId: profileData?.id ?? '',
    organizationId: orgId,
    // Trend data
    membersTrend: prevMembers > 0 ? Math.round(((currentMembers - prevMembers) / prevMembers) * 100) : 0,
    agentsTrend: prevAgents > 0 ? Math.round(((currentAgents - prevAgents) / prevAgents) * 100) : 0,
    enrollmentsTrend: prevEnrollments > 0 ? Math.round(((currentEnrollments - prevEnrollments) / prevEnrollments) * 100) : 0,
  };
}

async function getFutureEnrollmentsData(orgId: string): Promise<FutureEnrollmentsData> {
  const supabase = await createServerSupabaseClient();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Get future active enrollments
  const { data: futureEnrollments, count: totalFutureActive } = await (supabase
    .from('enrollments')
    .select('id, start_date, members(first_name, last_name), products(name)', { count: 'exact' })
    .eq('organization_id', orgId)
    .gt('start_date', now.toISOString())
    .eq('status', 'approved')
    .order('start_date', { ascending: true })
    .limit(10) as any);

  // Count starting this month
  const { count: startingThisMonth } = await (supabase
    .from('enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .gte('start_date', startOfMonth.toISOString())
    .lte('start_date', endOfMonth.toISOString())
    .eq('status', 'approved') as any);

  const upcomingEnrollments = (futureEnrollments || []).map((e: any) => ({
    id: e.id,
    memberName: e.members ? `${e.members.first_name} ${e.members.last_name}` : 'Unknown',
    startDate: e.start_date,
    planName: e.products?.name || 'Unknown Plan',
  }));

  return {
    totalFutureActive: totalFutureActive ?? 0,
    startingThisMonth: startingThisMonth ?? 0,
    nextStartDate: upcomingEnrollments.length > 0 ? upcomingEnrollments[0].startDate : null,
    upcomingEnrollments,
  };
}

async function getMemberActivityData(orgId: string): Promise<MemberActivityData> {
  const supabase = await createServerSupabaseClient();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  // New enrollments this month
  const { count: newEnrollmentsThisMonth } = await (supabase
    .from('enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('status', 'approved')
    .gte('approved_at', startOfMonth.toISOString()) as any);

  // Inactive members this month
  const { count: inactiveMembersThisMonth } = await (supabase
    .from('members')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('status', 'inactive')
    .gte('updated_at', startOfMonth.toISOString()) as any);

  // Previous month data
  const { count: prevMonthEnrollments } = await (supabase
    .from('enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('status', 'approved')
    .gte('approved_at', startOfPrevMonth.toISOString())
    .lt('approved_at', startOfMonth.toISOString()) as any);

  const { count: prevMonthInactive } = await (supabase
    .from('members')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('status', 'inactive')
    .gte('updated_at', startOfPrevMonth.toISOString())
    .lt('updated_at', startOfMonth.toISOString()) as any);

  // Total members for retention calculation
  const { count: totalMembers } = await supabase
    .from('members')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId);

  const { count: activeMembers } = await supabase
    .from('members')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('status', 'active');

  const newEnrollments = newEnrollmentsThisMonth ?? 0;
  const inactive = inactiveMembersThisMonth ?? 0;
  const total = totalMembers ?? 1;
  const active = activeMembers ?? 0;

  return {
    newEnrollmentsThisMonth: newEnrollments,
    inactiveMembersThisMonth: inactive,
    netGrowth: newEnrollments - inactive,
    retentionRate: Math.round((active / total) * 100),
    previousMonthEnrollments: prevMonthEnrollments ?? 0,
    previousMonthInactive: prevMonthInactive ?? 0,
  };
}

async function getRecentActivity(): Promise<ActivityLogEntry[]> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single() as { data: { organization_id: string } | null };

  if (!profile) return [];

  const { data: activities, error } = await supabase
    .from('admin_activity_log')
    .select(`
      id,
      entity_type,
      entity_id,
      action,
      description,
      metadata,
      created_at,
      actor_profile:profiles!admin_activity_log_actor_profile_id_fkey(full_name, email)
    `)
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })
    .limit(8);

  if (error) {
    console.error('Error fetching activity log:', error);
    return [];
  }

  return (activities || []) as unknown as ActivityLogEntry[];
}

function getEntityIcon(entityType: string) {
  switch (entityType) {
    case 'member':
      return <User className="h-4 w-4" />;
    case 'advisor':
      return <UserCheck className="h-4 w-4" />;
    case 'enrollment':
      return <FileText className="h-4 w-4" />;
    case 'product':
    case 'plan':
      return <Package className="h-4 w-4" />;
    case 'settings':
      return <Settings className="h-4 w-4" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
}

function getActionColor(action: string) {
  switch (action) {
    case 'create':
      return 'text-emerald-600 bg-emerald-500/10';
    case 'update':
    case 'update_commission_tier':
      return 'text-blue-600 bg-blue-500/10';
    case 'delete':
      return 'text-red-600 bg-red-500/10';
    case 'approve':
    case 'process_enrollment':
      return 'text-emerald-600 bg-emerald-500/10';
    case 'reject':
      return 'text-orange-600 bg-orange-500/10';
    case 'cancel':
      return 'text-slate-600 bg-slate-500/10';
    case 'charge':
    case 'refund':
    case 'generate_payouts':
      return 'text-purple-600 bg-purple-500/10';
    default:
      return 'text-slate-600 bg-slate-500/10';
  }
}

function formatActivity(activity: ActivityLogEntry): string {
  const actorName = activity.actor_profile?.full_name || 'System';
  const entityType = activity.entity_type;
  const action = activity.action;

  if (activity.description) {
    return activity.description;
  }

  const actionPastTense: Record<string, string> = {
    create: 'created',
    update: 'updated',
    delete: 'deleted',
    approve: 'approved',
    reject: 'rejected',
    cancel: 'cancelled',
    activate: 'activated',
    deactivate: 'deactivated',
    import: 'imported',
    export: 'exported',
  };

  return `${actorName} ${actionPastTense[action] || action} a ${entityType}`;
}

export default async function DashboardPage() {
  const [stats, recentActivity] = await Promise.all([
    getDashboardStats(),
    getRecentActivity(),
  ]);

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';

  // Fetch additional data if we have org ID
  const [futureEnrollmentsData, memberActivityData] = stats?.organizationId 
    ? await Promise.all([
        getFutureEnrollmentsData(stats.organizationId),
        getMemberActivityData(stats.organizationId),
      ])
    : [null, null];

  return (
    <div className="space-y-8 pb-8">
      {/* Hero Header with Live Indicator */}
      <DashboardHeaderClient 
        greeting={greeting}
        stats={stats}
      />

      {/* Stats Grid with Trends */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Members"
          value={stats?.totalMembers ?? 0}
          subtitle="All registered members"
          icon={<Users className="w-5 h-5" />}
          href="/members"
          trend={stats?.membersTrend !== 0 ? {
            value: stats?.membersTrend ?? 0,
            label: 'vs last month',
            direction: (stats?.membersTrend ?? 0) > 0 ? 'up' : (stats?.membersTrend ?? 0) < 0 ? 'down' : 'neutral',
          } : undefined}
        />
        <StatCard
          title="Active Agents"
          value={stats?.totalAgents ?? 0}
          subtitle="Licensed agents"
          icon={<UserCheck className="w-5 h-5" />}
          href="/agents"
          trend={stats?.agentsTrend !== 0 ? {
            value: stats?.agentsTrend ?? 0,
            label: 'vs last month',
            direction: (stats?.agentsTrend ?? 0) > 0 ? 'up' : (stats?.agentsTrend ?? 0) < 0 ? 'down' : 'neutral',
          } : undefined}
        />
        <StatCard
          title="Total Enrollments"
          value={stats?.totalEnrollments ?? 0}
          subtitle="All enrollment applications"
          icon={<FileText className="w-5 h-5" />}
          href="/enrollments"
          trend={stats?.enrollmentsTrend !== 0 ? {
            value: stats?.enrollmentsTrend ?? 0,
            label: 'vs last month',
            direction: (stats?.enrollmentsTrend ?? 0) > 0 ? 'up' : (stats?.enrollmentsTrend ?? 0) < 0 ? 'down' : 'neutral',
          } : undefined}
        />
        <StatCard
          title="Pending Review"
          value={stats?.pendingEnrollments ?? 0}
          subtitle="Awaiting admin review"
          icon={<AlertCircle className="w-5 h-5" />}
          href="/enrollments?status=submitted"
          pulse={(stats?.pendingEnrollments ?? 0) > 0}
        />
      </div>

      {/* Commission Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <CommissionCard
          title="Pending Commissions"
          value={`$${(stats?.pendingCommissions ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          subtitle="Awaiting approval and processing"
          icon={<Clock className="w-6 h-6 text-slate-600" />}
          href="/commissions/transactions?status=pending"
        />
        <CommissionCard
          title="Commissions Paid This Month"
          value={`$${(stats?.paidThisMonth ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          subtitle="Successfully disbursed to agents"
          icon={<DollarSign className="w-6 h-6 text-slate-600" />}
          href="/commissions"
        />
      </div>

      {/* Future Enrollments and Member Activity Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {futureEnrollmentsData && (
          <FutureEnrollmentsCard data={futureEnrollmentsData} />
        )}
        {memberActivityData && (
          <MemberActivityAnalysis data={memberActivityData} />
        )}
      </div>

      {/* Dashboard Widgets: ToDo, Jobs, Recently Visited */}
      {stats?.profileId && stats?.organizationId && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <TodoListWidget
            profileId={stats.profileId}
            organizationId={stats.organizationId}
          />
          <JobsWidget
            organizationId={stats.organizationId}
          />
          <RecentPagesWidget
            profileId={stats.profileId}
            organizationId={stats.organizationId}
          />
        </div>
      )}

      {/* Activity Feed and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Recent Activity - Takes 3 columns */}
        <div className="lg:col-span-3">
          <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_20px_25px_-5px_rgba(0,0,0,0.05)]">
            <div className="absolute top-0 left-0 right-0 h-1 bg-slate-200" />

            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-700">
                    <Activity className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Recent Activity</h3>
                    <p className="text-sm text-slate-500">Latest actions in the system</p>
                  </div>
                </div>
                <Link
                  href="/settings/audit-logs"
                  className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  View all
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            <div className="p-4">
              {recentActivity.length > 0 ? (
                <div className="space-y-2">
                  {recentActivity.map((activity, index) => (
                    <div
                      key={activity.id}
                      className="group flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 transition-all duration-200"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className={`p-2.5 rounded-xl ${getActionColor(activity.action)}`}>
                        {getEntityIcon(activity.entity_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">
                          {formatActivity(activity)}
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1.5 text-xs font-semibold rounded-full capitalize ${getActionColor(activity.action)}`}
                      >
                        {activity.action}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-slate-100 to-slate-50 rounded-2xl flex items-center justify-center">
                    <Clock className="w-10 h-10 text-slate-300" />
                  </div>
                  <p className="font-semibold text-slate-700 mb-1">No recent activity</p>
                  <p className="text-sm text-slate-400">Activities will appear here as you use the system</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions - Takes 2 columns */}
        <div className="lg:col-span-2">
          <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_20px_25px_-5px_rgba(0,0,0,0.05)] h-full">
            <div className="absolute top-0 left-0 right-0 h-1 bg-slate-200" />

            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-slate-700">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Quick Actions</h3>
                  <p className="text-sm text-slate-500">Common administrative tasks</p>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-2">
              <Link
                href="/members/new"
                className="group flex items-center gap-4 p-4 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-all"
              >
                <div className="p-3 rounded-xl bg-slate-100 group-hover:bg-slate-700 transition-colors">
                  <Users className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-slate-700">Add New Member</p>
                  <p className="text-xs text-slate-400">Register a new member</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-1 transition-all" />
              </Link>

              <Link
                href="/agents/new"
                className="group flex items-center gap-4 p-4 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-all"
              >
                <div className="p-3 rounded-xl bg-slate-100 group-hover:bg-slate-700 transition-colors">
                  <UserCheck className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-slate-700">Add New Agent</p>
                  <p className="text-xs text-slate-400">Register a new agent</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-1 transition-all" />
              </Link>

              <Link
                href="/enrollments"
                className="group flex items-center gap-4 p-4 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-all"
              >
                <div className="p-3 rounded-xl bg-slate-100 group-hover:bg-slate-700 transition-colors">
                  <FileText className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-slate-700">View Enrollments</p>
                  <p className="text-xs text-slate-400">Manage applications</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-1 transition-all" />
              </Link>

              <Link
                href="/commissions"
                className="group flex items-center gap-4 p-4 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-all"
              >
                <div className="p-3 rounded-xl bg-slate-100 group-hover:bg-slate-700 transition-colors">
                  <CreditCard className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-slate-700">Process Commissions</p>
                  <p className="text-xs text-slate-400">Review payouts</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-1 transition-all" />
              </Link>

              <Link
                href="/reports"
                className="group flex items-center gap-4 p-4 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-all"
              >
                <div className="p-3 rounded-xl bg-slate-100 group-hover:bg-slate-700 transition-colors">
                  <BarChart3 className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-slate-700">View Reports</p>
                  <p className="text-xs text-slate-400">Analytics & insights</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-1 transition-all" />
              </Link>

              <Link
                href="/settings"
                className="group flex items-center gap-4 p-4 rounded-xl border border-transparent hover:border-slate-200 hover:bg-gradient-to-r hover:from-slate-500/5 hover:to-transparent transition-all"
              >
                <div className="p-3 rounded-xl bg-slate-100 group-hover:bg-slate-700 transition-colors">
                  <Settings className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-slate-700">System Settings</p>
                  <p className="text-xs text-slate-400">Configure portal</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-1 transition-all" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

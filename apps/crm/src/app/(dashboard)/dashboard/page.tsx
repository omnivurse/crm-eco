import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@crm-eco/ui';
import {
  Users,
  UserCheck,
  Ticket,
  HeartPulse,
  Activity,
  ArrowUpRight,
  ArrowRight,
  Clock,
  FileCheck,
  UserPlus,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  TrendingUp,
  TrendingDown,
  Zap,
  ClipboardList,
  RefreshCcw,
  Bell,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Database } from '@crm-eco/lib/types';
import { getRoleQueryContext, type RoleQueryContext } from '@/lib/auth';

type ActivityRow = Database['public']['Tables']['activities']['Row'];

interface ActivityWithRelations extends ActivityRow {
  profiles?: { full_name: string } | null;
  members?: { id: string; first_name: string; last_name: string } | null;
  leads?: { id: string; first_name: string; last_name: string } | null;
  advisors?: { id: string; first_name: string; last_name: string } | null;
}

interface DashboardStats {
  activeMembers: number;
  membersTrend: number;
  activeAdvisors: number;
  advisorsTrend: number;
  openTickets: number;
  ticketsTrend: number;
  openNeeds: number;
  needsTrend: number;
  pendingEnrollments: number;
  pendingApprovals: number;
  upcomingRenewals: number;
  isAdvisor: boolean;
}

async function getStats(context: RoleQueryContext): Promise<DashboardStats> {
  const supabase = await createServerSupabaseClient();

  const isAdvisor = !context.isAdmin && context.role === 'advisor' && !!context.advisorId;

  // Get date ranges
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Build queries based on role
  let membersQuery = supabase.from('members').select('id, created_at', { count: 'exact' }).eq('status', 'active');
  if (isAdvisor && context.advisorId) {
    membersQuery = membersQuery.eq('advisor_id', context.advisorId);
  }

  const advisorsQuery = context.isAdmin
    ? supabase.from('advisors').select('id, created_at', { count: 'exact' }).eq('status', 'active')
    : Promise.resolve({ data: [], count: 0 });

  let ticketsQuery = supabase.from('tickets').select('id, created_at', { count: 'exact' }).in('status', ['open', 'in_progress']);
  if (isAdvisor && context.advisorId) {
    ticketsQuery = ticketsQuery.or(
      `created_by_profile_id.eq.${context.profileId},assigned_to_profile_id.eq.${context.profileId},advisor_id.eq.${context.advisorId}`
    );
  }

  let needsQuery = supabase.from('needs').select('id, created_at', { count: 'exact' }).in('status', ['open', 'in_review']);
  if (isAdvisor && context.advisorId) {
    needsQuery = needsQuery.eq('advisor_id', context.advisorId);
  }

  // Enrollment queries
  const pendingEnrollmentsQuery = supabase
    .from('enrollments')
    .select('id', { count: 'exact', head: true })
    .in('status', ['draft', 'pending_payment', 'pending_documents']);

  const pendingApprovalsQuery = supabase
    .from('enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending_review');

  // Upcoming renewals (memberships expiring in next 30 days)
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const upcomingRenewalsQuery = supabase
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .lte('end_date', thirtyDaysFromNow)
    .gte('end_date', now.toISOString());

  const [
    membersResult,
    advisorsResult,
    ticketsResult,
    needsResult,
    pendingEnrollmentsResult,
    pendingApprovalsResult,
    upcomingRenewalsResult,
  ] = await Promise.all([
    membersQuery,
    advisorsQuery,
    ticketsQuery,
    needsQuery,
    pendingEnrollmentsQuery,
    pendingApprovalsQuery,
    upcomingRenewalsQuery,
  ]);

  // Calculate trends (simplified - in real app would compare to previous period)
  const membersData = (membersResult.data || []) as Array<{ id: string; created_at: string }>;
  const recentMembers = membersData.filter(m => new Date(m.created_at) > thirtyDaysAgo).length;

  return {
    activeMembers: membersResult.count ?? 0,
    membersTrend: recentMembers,
    activeAdvisors: (advisorsResult as { count: number | null }).count ?? 0,
    advisorsTrend: 0,
    openTickets: ticketsResult.count ?? 0,
    ticketsTrend: 0,
    openNeeds: needsResult.count ?? 0,
    needsTrend: 0,
    pendingEnrollments: pendingEnrollmentsResult.count ?? 0,
    pendingApprovals: pendingApprovalsResult.count ?? 0,
    upcomingRenewals: upcomingRenewalsResult.count ?? 0,
    isAdvisor,
  };
}

async function getRecentActivities(context: RoleQueryContext): Promise<ActivityWithRelations[]> {
  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from('activities')
    .select(`
      *,
      profiles:created_by_profile_id(full_name),
      members:member_id(id, first_name, last_name),
      leads:lead_id(id, first_name, last_name),
      advisors:advisor_id(id, first_name, last_name)
    `)
    .order('occurred_at', { ascending: false })
    .limit(10);

  if (!context.isAdmin && context.role === 'advisor') {
    const filters = [`created_by_profile_id.eq.${context.profileId}`];
    if (context.advisorId) {
      filters.push(`advisor_id.eq.${context.advisorId}`);
    }
    query = query.or(filters.join(','));
  }

  const { data } = await query;
  return (data ?? []) as ActivityWithRelations[];
}

// Stat Card Component
function EnhancedStatCard({
  title,
  value,
  trend,
  trendLabel,
  icon: Icon,
  href,
  color,
}: {
  title: string;
  value: number;
  trend?: number;
  trendLabel?: string;
  icon: React.ElementType;
  href: string;
  color: 'teal' | 'emerald' | 'amber' | 'rose' | 'violet' | 'blue';
}) {
  const colorConfig = {
    teal: {
      bg: 'bg-teal-50 dark:bg-teal-500/10',
      icon: 'text-teal-600 dark:text-teal-400',
      border: 'border-teal-100 dark:border-teal-500/20 hover:border-teal-200 dark:hover:border-teal-500/40',
      accent: 'bg-teal-500',
    },
    emerald: {
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      icon: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-100 dark:border-emerald-500/20 hover:border-emerald-200 dark:hover:border-emerald-500/40',
      accent: 'bg-emerald-500',
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-500/10',
      icon: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-100 dark:border-amber-500/20 hover:border-amber-200 dark:hover:border-amber-500/40',
      accent: 'bg-amber-500',
    },
    rose: {
      bg: 'bg-rose-50 dark:bg-rose-500/10',
      icon: 'text-rose-600 dark:text-rose-400',
      border: 'border-rose-100 dark:border-rose-500/20 hover:border-rose-200 dark:hover:border-rose-500/40',
      accent: 'bg-rose-500',
    },
    violet: {
      bg: 'bg-violet-50 dark:bg-violet-500/10',
      icon: 'text-violet-600 dark:text-violet-400',
      border: 'border-violet-100 dark:border-violet-500/20 hover:border-violet-200 dark:hover:border-violet-500/40',
      accent: 'bg-violet-500',
    },
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-500/10',
      icon: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-100 dark:border-blue-500/20 hover:border-blue-200 dark:hover:border-blue-500/40',
      accent: 'bg-blue-500',
    },
  };

  const config = colorConfig[color];

  return (
    <Link
      href={href}
      className={`group relative block p-5 rounded-2xl bg-white dark:bg-slate-900/60 border ${config.border} transition-all duration-200 hover:shadow-lg`}
    >
      {/* Top accent bar */}
      <div className={`absolute top-0 left-4 right-4 h-1 ${config.accent} rounded-b-full opacity-60`} />

      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-xl ${config.bg}`}>
          <Icon className={`w-5 h-5 ${config.icon}`} />
        </div>
        <ArrowUpRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors" />
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-3xl font-bold text-slate-900 dark:text-white">
            {value.toLocaleString()}
          </span>
          {trend !== undefined && trend > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-3 h-3" />
              +{trend}
            </span>
          )}
        </div>
        {trendLabel && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{trendLabel}</p>
        )}
      </div>
    </Link>
  );
}

// Quick Action Card
function QuickActionCard({
  title,
  description,
  icon: Icon,
  href,
  color,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/50 hover:border-slate-200 dark:hover:border-slate-600 transition-all hover:shadow-md"
    >
      <div className={`p-2.5 rounded-xl ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
          {title}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all" />
    </Link>
  );
}

// Alert Card for important items
function AlertCard({
  title,
  count,
  description,
  icon: Icon,
  href,
  variant,
}: {
  title: string;
  count: number;
  description: string;
  icon: React.ElementType;
  href: string;
  variant: 'warning' | 'info' | 'success';
}) {
  const variants = {
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-500/10',
      border: 'border-amber-200 dark:border-amber-500/30',
      icon: 'text-amber-600 dark:text-amber-400',
      badge: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-500/10',
      border: 'border-blue-200 dark:border-blue-500/30',
      icon: 'text-blue-600 dark:text-blue-400',
      badge: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
    },
    success: {
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      border: 'border-emerald-200 dark:border-emerald-500/30',
      icon: 'text-emerald-600 dark:text-emerald-400',
      badge: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
    },
  };

  const config = variants[variant];

  if (count === 0) return null;

  return (
    <Link
      href={href}
      className={`group flex items-center gap-4 p-4 rounded-xl ${config.bg} border ${config.border} transition-all hover:shadow-md`}
    >
      <Icon className={`w-5 h-5 ${config.icon}`} />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-slate-900 dark:text-white">{title}</p>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${config.badge}`}>
            {count}
          </span>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
    </Link>
  );
}

// Activity Timeline Item
function ActivityTimelineItem({ activity, isLast }: { activity: ActivityWithRelations; isLast: boolean }) {
  const typeConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
    member_created: { icon: UserPlus, color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-500/20' },
    member_updated: { icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-500/20' },
    advisor_created: { icon: UserCheck, color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-500/20' },
    advisor_updated: { icon: UserCheck, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-500/20' },
    lead_created: { icon: UserPlus, color: 'text-violet-600', bgColor: 'bg-violet-100 dark:bg-violet-500/20' },
    ticket_created: { icon: Ticket, color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-500/20' },
    ticket_updated: { icon: Ticket, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-500/20' },
    need_created: { icon: HeartPulse, color: 'text-rose-600', bgColor: 'bg-rose-100 dark:bg-rose-500/20' },
    need_updated: { icon: HeartPulse, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-500/20' },
  };

  const config = typeConfig[activity.type || ''] || { icon: Activity, color: 'text-slate-600', bgColor: 'bg-slate-100 dark:bg-slate-700' };
  const Icon = config.icon;

  const getEntityName = () => {
    if (activity.members) return `${activity.members.first_name} ${activity.members.last_name}`;
    if (activity.leads) return `${activity.leads.first_name} ${activity.leads.last_name}`;
    if (activity.advisors) return `${activity.advisors.first_name} ${activity.advisors.last_name}`;
    return null;
  };

  return (
    <div className="flex gap-4">
      {/* Timeline */}
      <div className="flex flex-col items-center">
        <div className={`p-2 rounded-lg ${config.bgColor}`}>
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>
        {!isLast && <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 my-2" />}
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <p className="text-sm text-slate-900 dark:text-white font-medium">
          {activity.subject || activity.type?.replace(/_/g, ' ')}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {getEntityName() && (
            <span className="text-sm text-teal-600 dark:text-teal-400 font-medium">
              {getEntityName()}
            </span>
          )}
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {activity.occurred_at
              ? formatDistanceToNow(new Date(activity.occurred_at), { addSuffix: true })
              : formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
          </span>
        </div>
        {activity.profiles?.full_name && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            by {activity.profiles.full_name}
          </p>
        )}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const context = await getRoleQueryContext();

  if (!context) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>Unable to load dashboard. Please try logging in again.</p>
      </div>
    );
  }

  const stats = await getStats(context);
  const activities = await getRecentActivities(context);

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {greeting}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {stats.isAdvisor
              ? "Here's an overview of your assigned members and tasks"
              : "Here's what's happening across your platform today"}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <RefreshCcw className="w-4 h-4" />
          Updated just now
        </div>
      </div>

      {/* Alert Cards - Important items needing attention */}
      {(stats.pendingApprovals > 0 || stats.upcomingRenewals > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AlertCard
            title="Pending Approvals"
            count={stats.pendingApprovals}
            description="Enrollments awaiting your review"
            icon={FileCheck}
            href="/enrollments?status=pending_review"
            variant="warning"
          />
          <AlertCard
            title="Upcoming Renewals"
            count={stats.upcomingRenewals}
            description="Memberships expiring within 30 days"
            icon={RefreshCcw}
            href="/members?filter=expiring"
            variant="info"
          />
        </div>
      )}

      {/* Main Stats Grid */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${stats.isAdvisor ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-4`}>
        <EnhancedStatCard
          title={stats.isAdvisor ? 'My Active Members' : 'Active Members'}
          value={stats.activeMembers}
          trend={stats.membersTrend}
          trendLabel="new this month"
          icon={Users}
          href="/members"
          color="teal"
        />

        {!stats.isAdvisor && (
          <EnhancedStatCard
            title="Active Advisors"
            value={stats.activeAdvisors}
            icon={UserCheck}
            href="/advisors"
            color="emerald"
          />
        )}

        <EnhancedStatCard
          title={stats.isAdvisor ? 'My Open Tickets' : 'Open Tickets'}
          value={stats.openTickets}
          icon={Ticket}
          href="/tickets?status=open"
          color="amber"
        />

        <EnhancedStatCard
          title={stats.isAdvisor ? 'My Open Needs' : 'Open Needs'}
          value={stats.openNeeds}
          icon={HeartPulse}
          href="/needs?status=open"
          color="rose"
        />
      </div>

      {/* Secondary Stats Row - Enrollments */}
      {!stats.isAdvisor && stats.pendingEnrollments > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/enrollments?status=draft"
            className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 hover:border-slate-200 dark:hover:border-slate-600 transition-all group"
          >
            <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-500/20">
              <ClipboardList className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.pendingEnrollments}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">In-Progress Enrollments</p>
            </div>
          </Link>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Quick Actions
          </h2>
          <div className="space-y-3">
            <QuickActionCard
              title="New Enrollment"
              description="Start a new member enrollment"
              icon={UserPlus}
              href="/enrollments/new"
              color="bg-gradient-to-br from-teal-500 to-emerald-600"
            />
            <QuickActionCard
              title="Create Ticket"
              description="Log a support request"
              icon={Ticket}
              href="/tickets/new"
              color="bg-gradient-to-br from-amber-500 to-orange-600"
            />
            <QuickActionCard
              title="Submit Need"
              description="Request medical need sharing"
              icon={HeartPulse}
              href="/needs/new"
              color="bg-gradient-to-br from-rose-500 to-pink-600"
            />
            {!stats.isAdvisor && (
              <QuickActionCard
                title="Add Advisor"
                description="Onboard a new team member"
                icon={UserCheck}
                href="/advisors/new"
                color="bg-gradient-to-br from-violet-500 to-purple-600"
              />
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <Card className="border-slate-100 dark:border-slate-700/50 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
                    <Activity className="w-4 h-4 text-white" />
                  </div>
                  <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
                    Recent Activity
                  </CardTitle>
                </div>
                <Link
                  href="/activities"
                  className="text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
                >
                  View all
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-14 h-14 mx-auto mb-4 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
                    <Activity className="w-7 h-7 text-slate-300 dark:text-slate-600" />
                  </div>
                  <p className="font-medium text-slate-700 dark:text-slate-200">No recent activity</p>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                    Activities will appear here as you use the platform
                  </p>
                </div>
              ) : (
                <div className="space-y-0">
                  {activities.map((activity, index) => (
                    <ActivityTimelineItem
                      key={activity.id}
                      activity={activity}
                      isLast={index === activities.length - 1}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

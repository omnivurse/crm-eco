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
  DollarSign,
  CreditCard,
  BarChart3,
  ShoppingCart,
  CalendarDays,
} from 'lucide-react';
import { formatDistanceToNow, startOfMonth, startOfDay } from 'date-fns';
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
  // Core counts
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
  // Totals
  totalMembers: number;
  totalAdvisors: number;
  // Billing stats
  billingThisMonth: number;
  billingToday: number;
  // Today's metrics
  membersToday: number;
  plansSoldToday: number;
  advisorsToday: number;
  // Role flag
  isAdvisor: boolean;
}

async function getStats(context: RoleQueryContext): Promise<DashboardStats> {
  const supabase = await createServerSupabaseClient();

  const isAdvisor = !context.isAdmin && context.role === 'advisor' && !!context.advisorId;

  // Get date ranges
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const todayStart = startOfDay(now).toISOString();
  const monthStart = startOfMonth(now).toISOString();

  // Build queries based on role
  let activeMembersQuery = supabase.from('members').select('id, created_at', { count: 'exact' }).eq('status', 'active');
  if (isAdvisor && context.advisorId) {
    activeMembersQuery = activeMembersQuery.eq('advisor_id', context.advisorId);
  }

  // Total members (all statuses)
  let totalMembersQuery = supabase.from('members').select('id', { count: 'exact', head: true });
  if (isAdvisor && context.advisorId) {
    totalMembersQuery = totalMembersQuery.eq('advisor_id', context.advisorId);
  }

  // Members created today
  let membersTodayQuery = supabase.from('members').select('id', { count: 'exact', head: true }).gte('created_at', todayStart);
  if (isAdvisor && context.advisorId) {
    membersTodayQuery = membersTodayQuery.eq('advisor_id', context.advisorId);
  }

  // Advisors queries (admin only)
  const activeAdvisorsQuery = context.isAdmin
    ? supabase.from('advisors').select('id, created_at', { count: 'exact' }).eq('status', 'active')
    : Promise.resolve({ data: [], count: 0 });

  const totalAdvisorsQuery = context.isAdmin
    ? supabase.from('advisors').select('id', { count: 'exact', head: true })
    : Promise.resolve({ count: 0 });

  const advisorsTodayQuery = context.isAdmin
    ? supabase.from('advisors').select('id', { count: 'exact', head: true }).gte('created_at', todayStart)
    : Promise.resolve({ count: 0 });

  // Tickets query
  let ticketsQuery = supabase.from('tickets').select('id, created_at', { count: 'exact' }).in('status', ['open', 'in_progress']);
  if (isAdvisor && context.advisorId) {
    ticketsQuery = ticketsQuery.or(
      `created_by_profile_id.eq.${context.profileId},assigned_to_profile_id.eq.${context.profileId},advisor_id.eq.${context.advisorId}`
    );
  }

  // Needs query
  let needsQuery = supabase.from('needs').select('id, created_at', { count: 'exact' }).in('status', ['open', 'in_review']);
  if (isAdvisor && context.advisorId) {
    needsQuery = needsQuery.eq('advisor_id', context.advisorId);
  }

  // Enrollment queries
  const pendingEnrollmentsQuery = supabase
    .from('enrollments')
    .select('id', { count: 'exact', head: true })
    .in('status', ['draft', 'in_progress']);

  const pendingApprovalsQuery = supabase
    .from('enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'submitted');

  // Plans sold today (enrollments approved today)
  let plansSoldTodayQuery = supabase
    .from('enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'approved')
    .gte('updated_at', todayStart);
  if (isAdvisor && context.advisorId) {
    plansSoldTodayQuery = plansSoldTodayQuery.eq('advisor_id', context.advisorId);
  }

  // Upcoming renewals (memberships expiring in next 30 days)
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const upcomingRenewalsQuery = supabase
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .lte('end_date', thirtyDaysFromNow)
    .gte('end_date', now.toISOString());

  // Billing queries - sum billing_amount from active memberships
  // Billing this month = sum of all active membership billing amounts (monthly revenue)
  const billingThisMonthQuery = supabase
    .from('memberships')
    .select('billing_amount')
    .eq('status', 'active')
    .eq('billing_status', 'ok');

  // Run all queries in parallel
  const [
    activeMembersResult,
    totalMembersResult,
    membersTodayResult,
    activeAdvisorsResult,
    totalAdvisorsResult,
    advisorsTodayResult,
    ticketsResult,
    needsResult,
    pendingEnrollmentsResult,
    pendingApprovalsResult,
    plansSoldTodayResult,
    upcomingRenewalsResult,
    billingResult,
  ] = await Promise.all([
    activeMembersQuery,
    totalMembersQuery,
    membersTodayQuery,
    activeAdvisorsQuery,
    totalAdvisorsQuery,
    advisorsTodayQuery,
    ticketsQuery,
    needsQuery,
    pendingEnrollmentsQuery,
    pendingApprovalsQuery,
    plansSoldTodayQuery,
    upcomingRenewalsQuery,
    billingThisMonthQuery,
  ]);

  // Calculate trends (simplified - in real app would compare to previous period)
  const membersData = (activeMembersResult.data || []) as Array<{ id: string; created_at: string }>;
  const recentMembers = membersData.filter(m => new Date(m.created_at) > thirtyDaysAgo).length;

  // Calculate billing amounts
  const billingData = (billingResult.data || []) as Array<{ billing_amount: number | null }>;
  const billingThisMonth = billingData.reduce((sum, m) => sum + (m.billing_amount || 0), 0);
  // For "today" billing, we'll show the daily average based on monthly total / days in month
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const billingToday = Math.round((billingThisMonth / daysInMonth) * 100) / 100;

  return {
    activeMembers: activeMembersResult.count ?? 0,
    membersTrend: recentMembers,
    activeAdvisors: (activeAdvisorsResult as { count: number | null }).count ?? 0,
    advisorsTrend: 0,
    openTickets: ticketsResult.count ?? 0,
    ticketsTrend: 0,
    openNeeds: needsResult.count ?? 0,
    needsTrend: 0,
    pendingEnrollments: pendingEnrollmentsResult.count ?? 0,
    pendingApprovals: pendingApprovalsResult.count ?? 0,
    upcomingRenewals: upcomingRenewalsResult.count ?? 0,
    // Totals
    totalMembers: totalMembersResult.count ?? 0,
    totalAdvisors: (totalAdvisorsResult as { count: number | null }).count ?? 0,
    // Billing
    billingThisMonth,
    billingToday,
    // Today's metrics
    membersToday: membersTodayResult.count ?? 0,
    plansSoldToday: plansSoldTodayResult.count ?? 0,
    advisorsToday: (advisorsTodayResult as { count: number | null }).count ?? 0,
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
  isCurrency = false,
  size = 'default',
}: {
  title: string;
  value: number;
  trend?: number;
  trendLabel?: string;
  icon: React.ElementType;
  href: string;
  color: 'teal' | 'emerald' | 'amber' | 'rose' | 'violet' | 'blue' | 'cyan' | 'indigo' | 'green' | 'orange' | 'slate';
  isCurrency?: boolean;
  size?: 'default' | 'compact';
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
    cyan: {
      bg: 'bg-cyan-50 dark:bg-cyan-500/10',
      icon: 'text-cyan-600 dark:text-cyan-400',
      border: 'border-cyan-100 dark:border-cyan-500/20 hover:border-cyan-200 dark:hover:border-cyan-500/40',
      accent: 'bg-cyan-500',
    },
    indigo: {
      bg: 'bg-indigo-50 dark:bg-indigo-500/10',
      icon: 'text-indigo-600 dark:text-indigo-400',
      border: 'border-indigo-100 dark:border-indigo-500/20 hover:border-indigo-200 dark:hover:border-indigo-500/40',
      accent: 'bg-indigo-500',
    },
    green: {
      bg: 'bg-green-50 dark:bg-green-500/10',
      icon: 'text-green-600 dark:text-green-400',
      border: 'border-green-100 dark:border-green-500/20 hover:border-green-200 dark:hover:border-green-500/40',
      accent: 'bg-green-500',
    },
    orange: {
      bg: 'bg-orange-50 dark:bg-orange-500/10',
      icon: 'text-orange-600 dark:text-orange-400',
      border: 'border-orange-100 dark:border-orange-500/20 hover:border-orange-200 dark:hover:border-orange-500/40',
      accent: 'bg-orange-500',
    },
    slate: {
      bg: 'bg-slate-50 dark:bg-slate-500/10',
      icon: 'text-slate-600 dark:text-slate-400',
      border: 'border-slate-100 dark:border-slate-500/20 hover:border-slate-200 dark:hover:border-slate-500/40',
      accent: 'bg-slate-500',
    },
  };

  const config = colorConfig[color];
  const isCompact = size === 'compact';

  const formatValue = (val: number) => {
    if (isCurrency) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(val);
    }
    return val.toLocaleString();
  };

  return (
    <Link
      href={href}
      className={`group relative block ${isCompact ? 'p-4' : 'p-5'} rounded-2xl bg-white dark:bg-slate-900/60 border ${config.border} transition-all duration-200 hover:shadow-lg`}
    >
      {/* Top accent bar */}
      <div className={`absolute top-0 left-4 right-4 h-1 ${config.accent} rounded-b-full opacity-60`} />

      <div className="flex items-start justify-between">
        <div className={`${isCompact ? 'p-2' : 'p-2.5'} rounded-xl ${config.bg}`}>
          <Icon className={`${isCompact ? 'w-4 h-4' : 'w-5 h-5'} ${config.icon}`} />
        </div>
        <ArrowUpRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors" />
      </div>

      <div className={isCompact ? 'mt-3' : 'mt-4'}>
        <p className={`${isCompact ? 'text-xs' : 'text-sm'} font-medium text-slate-500 dark:text-slate-400`}>{title}</p>
        <div className="flex items-baseline gap-2 mt-1">
          <span className={`${isCompact ? 'text-2xl' : 'text-3xl'} font-bold text-slate-900 dark:text-white`}>
            {formatValue(value)}
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

// Mini stat for today's metrics
function MiniStatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/50">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div>
        <p className="text-lg font-bold text-slate-900 dark:text-white">{value}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{title}</p>
      </div>
    </div>
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
            href="/enrollments?status=submitted"
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

      {/* Today's Snapshot - Admin Only */}
      {!stats.isAdvisor && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-cyan-500/10 border border-teal-200/50 dark:border-teal-500/20">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <h2 className="font-semibold text-slate-900 dark:text-white">Today&apos;s Snapshot</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniStatCard
              title="Members Today"
              value={stats.membersToday}
              icon={UserPlus}
              color="bg-teal-500"
            />
            <MiniStatCard
              title="Plans Sold Today"
              value={stats.plansSoldToday}
              icon={ShoppingCart}
              color="bg-emerald-500"
            />
            <MiniStatCard
              title="New Advisors Today"
              value={stats.advisorsToday}
              icon={UserCheck}
              color="bg-cyan-500"
            />
            <MiniStatCard
              title="Billing Today"
              value={stats.billingToday}
              icon={DollarSign}
              color="bg-green-500"
            />
          </div>
        </div>
      )}

      {/* Billing Stats Row - Admin Only */}
      {!stats.isAdvisor && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <EnhancedStatCard
            title="Billing This Month"
            value={stats.billingThisMonth}
            icon={CreditCard}
            href="/billing"
            color="green"
            isCurrency
          />
          <EnhancedStatCard
            title="Total Members"
            value={stats.totalMembers}
            icon={Users}
            href="/members"
            color="indigo"
          />
          <EnhancedStatCard
            title="Total Advisors"
            value={stats.totalAdvisors}
            icon={UserCheck}
            href="/advisors"
            color="cyan"
          />
          <EnhancedStatCard
            title="In-Progress Enrollments"
            value={stats.pendingEnrollments}
            icon={ClipboardList}
            href="/enrollments?status=draft"
            color="violet"
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
          href="/members?status=active"
          color="teal"
        />

        {!stats.isAdvisor && (
          <EnhancedStatCard
            title="Active Advisors"
            value={stats.activeAdvisors}
            icon={UserCheck}
            href="/advisors?status=active"
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

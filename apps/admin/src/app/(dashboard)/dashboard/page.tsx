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

  const [membersResult, agentsResult, enrollmentsResult, activeEnrollmentsResult, pendingEnrollmentsResult] =
    await Promise.all([
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
      .gte('paid_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()) as unknown as { data: { commission_amount: number }[] | null },
  ]);

  const pendingCommissions = (pendingCommissionsResult.data || []).reduce(
    (sum, t) => sum + (t.commission_amount || 0),
    0
  );
  const paidThisMonth = (paidCommissionsResult.data || []).reduce(
    (sum, t) => sum + (t.commission_amount || 0),
    0
  );

  return {
    totalMembers: membersResult.count ?? 0,
    totalAgents: agentsResult.count ?? 0,
    totalEnrollments: enrollmentsResult.count ?? 0,
    activeEnrollments: activeEnrollmentsResult.count ?? 0,
    pendingEnrollments: pendingEnrollmentsResult.count ?? 0,
    pendingCommissions,
    paidThisMonth,
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

// Premium stat card component
function PremiumStatCard({
  title,
  value,
  subtitle,
  icon,
  gradient,
  href,
  pulse = false,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: React.ReactNode;
  gradient: string;
  href?: string;
  pulse?: boolean;
}) {
  const content = (
    <div className={`group relative overflow-hidden rounded-2xl bg-white border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_20px_25px_-5px_rgba(0,0,0,0.05)] hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] transition-all duration-500 hover:-translate-y-1 ${pulse ? 'ring-2 ring-amber-400/50 animate-pulse' : ''}`}>
      {/* Gradient accent */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${gradient}`} />

      {/* Glow effect on hover */}
      <div className={`absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${gradient} blur-xl`} />

      <div className="relative p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
            <p className="text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
          </div>
          <div className={`p-3 rounded-xl ${gradient.replace('bg-gradient-to-r', 'bg-gradient-to-br')} bg-opacity-10 backdrop-blur-sm`}>
            <div className="text-white">{icon}</div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">{subtitle}</p>
          {href && (
            <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          )}
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

// Commission card component
function CommissionCard({
  title,
  value,
  subtitle,
  icon,
  gradient,
  href,
  iconBg,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  gradient: string;
  href: string;
  iconBg: string;
}) {
  return (
    <Link href={href}>
      <div className="group relative overflow-hidden rounded-2xl bg-white border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_20px_25px_-5px_rgba(0,0,0,0.05)] hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] transition-all duration-500 hover:-translate-y-1">
        {/* Gradient accent */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 ${gradient}`} />

        {/* Background pattern */}
        <div className="absolute inset-0 opacity-[0.02]">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative p-6">
          <div className="flex items-start justify-between mb-4">
            <p className="text-sm font-semibold text-slate-600 tracking-wide">{title}</p>
            <div className={`p-3 rounded-xl ${iconBg}`}>
              {icon}
            </div>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className={`text-4xl font-bold tracking-tight bg-clip-text text-transparent ${gradient}`}>
                {value}
              </p>
              <p className="text-xs text-slate-400 mt-2">{subtitle}</p>
            </div>
            <div className="p-2 rounded-full bg-slate-100 group-hover:bg-slate-200 transition-colors">
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default async function DashboardPage() {
  const [stats, recentActivity] = await Promise.all([
    getDashboardStats(),
    getRecentActivity(),
  ]);

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-8 pb-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#003560] via-[#004a7c] to-[#047474] p-8 shadow-[0_20px_50px_-12px_rgba(0,53,96,0.4)]">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-gradient-to-br from-[#047474]/30 to-transparent rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-gradient-to-tr from-[#E9B61F]/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-white/5 to-transparent rounded-full" />
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="heroGrid" width="5" height="5" patternUnits="userSpaceOnUse">
                <path d="M 5 0 L 0 0 0 5" fill="none" stroke="white" strokeWidth="0.3" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#heroGrid)" />
          </svg>
        </div>

        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-medium text-white/80">System Online</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E9B61F]/20 backdrop-blur-sm border border-[#E9B61F]/30">
                  <Shield className="w-3.5 h-3.5 text-[#E9B61F]" />
                  <span className="text-xs font-medium text-[#E9B61F]">Admin Access</span>
                </div>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">{greeting}!</h1>
              <p className="text-white/60 text-lg">Welcome to your Admin Dashboard</p>
            </div>

            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 text-white text-sm font-medium transition-all">
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
                <Clock className="w-4 h-4 text-white/60" />
                <span className="text-sm text-white/60">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          {/* Quick stats in header */}
          <div className="flex items-center gap-6 mt-8 pt-6 border-t border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats?.activeEnrollments ?? 0}</p>
                <p className="text-xs text-white/50">Active Enrollments</p>
              </div>
            </div>
            <div className="w-px h-12 bg-white/10" />
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <AlertCircle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats?.pendingEnrollments ?? 0}</p>
                <p className="text-xs text-white/50">Pending Review</p>
              </div>
            </div>
            <div className="w-px h-12 bg-white/10" />
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#047474]/30">
                <Users className="w-5 h-5 text-[#069B9A]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats?.totalMembers ?? 0}</p>
                <p className="text-xs text-white/50">Total Members</p>
              </div>
            </div>
            <div className="w-px h-12 bg-white/10" />
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <UserCheck className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats?.totalAgents ?? 0}</p>
                <p className="text-xs text-white/50">Active Agents</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <PremiumStatCard
          title="Total Members"
          value={stats?.totalMembers ?? 0}
          subtitle="All registered members"
          icon={<Users className="w-5 h-5" />}
          gradient="bg-gradient-to-r from-[#047474] to-[#069B9A]"
          href="/members"
        />
        <PremiumStatCard
          title="Active Agents"
          value={stats?.totalAgents ?? 0}
          subtitle="Licensed agents"
          icon={<UserCheck className="w-5 h-5" />}
          gradient="bg-gradient-to-r from-[#027343] to-[#34d399]"
          href="/agents"
        />
        <PremiumStatCard
          title="Total Enrollments"
          value={stats?.totalEnrollments ?? 0}
          subtitle="All enrollment applications"
          icon={<FileText className="w-5 h-5" />}
          gradient="bg-gradient-to-r from-purple-600 to-purple-400"
          href="/enrollments"
        />
        <PremiumStatCard
          title="Pending Review"
          value={stats?.pendingEnrollments ?? 0}
          subtitle="Awaiting admin review"
          icon={<AlertCircle className="w-5 h-5" />}
          gradient="bg-gradient-to-r from-amber-500 to-amber-400"
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
          icon={<Clock className="w-6 h-6 text-amber-600" />}
          gradient="bg-gradient-to-r from-amber-500 to-orange-400"
          href="/commissions/transactions?status=pending"
          iconBg="bg-amber-100"
        />
        <CommissionCard
          title="Commissions Paid This Month"
          value={`$${(stats?.paidThisMonth ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          subtitle="Successfully disbursed to agents"
          icon={<DollarSign className="w-6 h-6 text-emerald-600" />}
          gradient="bg-gradient-to-r from-emerald-500 to-teal-400"
          href="/commissions"
          iconBg="bg-emerald-100"
        />
      </div>

      {/* Activity Feed and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Recent Activity - Takes 3 columns */}
        <div className="lg:col-span-3">
          <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_20px_25px_-5px_rgba(0,0,0,0.05)]">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#047474] via-[#069B9A] to-[#027343]" />

            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#047474] to-[#069B9A]">
                    <Activity className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Recent Activity</h3>
                    <p className="text-sm text-slate-500">Latest actions in the system</p>
                  </div>
                </div>
                <Link
                  href="/activity"
                  className="flex items-center gap-1 text-sm font-medium text-[#047474] hover:text-[#069B9A] transition-colors"
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
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#003560] via-[#047474] to-[#E9B61F]" />

            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#003560] to-[#047474]">
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
                className="group flex items-center gap-4 p-4 rounded-xl border border-transparent hover:border-[#047474]/20 hover:bg-gradient-to-r hover:from-[#047474]/5 hover:to-transparent transition-all"
              >
                <div className="p-3 rounded-xl bg-[#047474]/10 group-hover:bg-[#047474] transition-colors">
                  <Users className="w-5 h-5 text-[#047474] group-hover:text-white transition-colors" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-slate-700">Add New Member</p>
                  <p className="text-xs text-slate-400">Register a new member</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-[#047474] group-hover:translate-x-1 transition-all" />
              </Link>

              <Link
                href="/agents/new"
                className="group flex items-center gap-4 p-4 rounded-xl border border-transparent hover:border-[#027343]/20 hover:bg-gradient-to-r hover:from-[#027343]/5 hover:to-transparent transition-all"
              >
                <div className="p-3 rounded-xl bg-[#027343]/10 group-hover:bg-[#027343] transition-colors">
                  <UserCheck className="w-5 h-5 text-[#027343] group-hover:text-white transition-colors" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-slate-700">Add New Agent</p>
                  <p className="text-xs text-slate-400">Register a new agent</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-[#027343] group-hover:translate-x-1 transition-all" />
              </Link>

              <Link
                href="/enrollments"
                className="group flex items-center gap-4 p-4 rounded-xl border border-transparent hover:border-purple-200 hover:bg-gradient-to-r hover:from-purple-500/5 hover:to-transparent transition-all"
              >
                <div className="p-3 rounded-xl bg-purple-100 group-hover:bg-purple-600 transition-colors">
                  <FileText className="w-5 h-5 text-purple-600 group-hover:text-white transition-colors" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-slate-700">View Enrollments</p>
                  <p className="text-xs text-slate-400">Manage applications</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
              </Link>

              <Link
                href="/commissions"
                className="group flex items-center gap-4 p-4 rounded-xl border border-transparent hover:border-amber-200 hover:bg-gradient-to-r hover:from-amber-500/5 hover:to-transparent transition-all"
              >
                <div className="p-3 rounded-xl bg-amber-100 group-hover:bg-amber-500 transition-colors">
                  <CreditCard className="w-5 h-5 text-amber-600 group-hover:text-white transition-colors" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-slate-700">Process Commissions</p>
                  <p className="text-xs text-slate-400">Review payouts</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
              </Link>

              <Link
                href="/reports"
                className="group flex items-center gap-4 p-4 rounded-xl border border-transparent hover:border-indigo-200 hover:bg-gradient-to-r hover:from-indigo-500/5 hover:to-transparent transition-all"
              >
                <div className="p-3 rounded-xl bg-indigo-100 group-hover:bg-indigo-600 transition-colors">
                  <BarChart3 className="w-5 h-5 text-indigo-600 group-hover:text-white transition-colors" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-slate-700">View Reports</p>
                  <p className="text-xs text-slate-400">Analytics & insights</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
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

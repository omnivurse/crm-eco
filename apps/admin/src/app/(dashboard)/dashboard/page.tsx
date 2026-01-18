import { Card, CardContent, CardDescription, CardHeader, CardTitle, StatCard } from '@crm-eco/ui';
import { Users, UserCheck, FileText, TrendingUp, Clock, Activity, User, Package, Settings, DollarSign, Sparkles, ArrowUpRight, AlertCircle } from 'lucide-react';
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

  // Get profile to check organization
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

  // Get counts
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

  // Get commission stats
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
    .limit(10);

  if (error) {
    console.error('Error fetching activity log:', error);
    return [];
  }

  return (activities || []) as unknown as ActivityLogEntry[];
}

// Get icon for entity type
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

// Get action color
function getActionColor(action: string) {
  switch (action) {
    case 'create':
      return 'text-[#027343] bg-[#e0f1ea]';
    case 'update':
    case 'update_commission_tier':
      return 'text-[#047474] bg-[#e1f3f3]';
    case 'delete':
      return 'text-red-600 bg-red-100';
    case 'approve':
    case 'process_enrollment':
      return 'text-[#027343] bg-[#e0f1ea]';
    case 'reject':
      return 'text-orange-600 bg-orange-100';
    case 'cancel':
      return 'text-slate-600 bg-slate-100';
    case 'charge':
    case 'refund':
    case 'generate_payouts':
      return 'text-purple-600 bg-purple-100';
    default:
      return 'text-slate-600 bg-slate-100';
  }
}

// Format activity description
function formatActivity(activity: ActivityLogEntry): string {
  const actorName = activity.actor_profile?.full_name || 'System';
  const entityType = activity.entity_type;
  const action = activity.action;

  if (activity.description) {
    return activity.description;
  }

  // Generate description from action and entity
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-[#E9B61F]" />
            <span className="text-sm font-medium text-[#047474]">Admin Dashboard</span>
          </div>
          <h1 className="text-2xl font-bold text-[#003560]">Welcome to Admin Portal</h1>
          <p className="text-slate-500">Manage your health insurance enrollment platform</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm">
          <TrendingUp className="w-4 h-4 text-[#027343]" />
          <span className="text-sm text-slate-600">Last updated just now</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
        <StatCard
          title="Total Members"
          value={stats?.totalMembers ?? 0}
          subtitle="All registered members"
          icon={<Users className="w-5 h-5" />}
          accent="teal"
        />
        <StatCard
          title="Active Agents"
          value={stats?.totalAgents ?? 0}
          subtitle="Licensed agents"
          icon={<UserCheck className="w-5 h-5" />}
          accent="emerald"
        />
        <StatCard
          title="Total Enrollments"
          value={stats?.totalEnrollments ?? 0}
          subtitle="All enrollment applications"
          icon={<FileText className="w-5 h-5" />}
          accent="purple"
        />
        <Link href="/enrollments?status=submitted">
          <StatCard
            title="Pending Review"
            value={stats?.pendingEnrollments ?? 0}
            subtitle="Awaiting admin review"
            icon={<AlertCircle className="w-5 h-5" />}
            accent="amber"
            className={(stats?.pendingEnrollments ?? 0) > 0 ? 'ring-2 ring-amber-400/50 animate-pulse' : ''}
          />
        </Link>
        <StatCard
          title="Active Enrollments"
          value={stats?.activeEnrollments ?? 0}
          subtitle="Approved and active"
          icon={<TrendingUp className="w-5 h-5" />}
          accent="gold"
        />
      </div>

      {/* Commission Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Link href="/commissions/transactions?status=pending">
          <div className="relative bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-[0_1px_2px_rgba(2,6,23,0.06),0_8px_24px_rgba(2,6,23,0.08)] hover:shadow-[0_4px_12px_rgba(2,6,23,0.08),0_12px_32px_rgba(2,6,23,0.12)] transition-all duration-300 hover:-translate-y-0.5 cursor-pointer border-l-4 border-l-amber-500">
            <div className="h-1 bg-gradient-to-r from-amber-500 to-amber-400" />
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm font-medium text-slate-500 tracking-wide">Pending Commissions</p>
                <div className="p-2.5 rounded-xl bg-amber-50">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-bold text-amber-600 tracking-tight">
                    ${(stats?.pendingCommissions ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Awaiting approval</p>
                </div>
                <ArrowUpRight className="w-5 h-5 text-amber-400" />
              </div>
            </div>
          </div>
        </Link>
        
        <Link href="/commissions">
          <div className="relative bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-[0_1px_2px_rgba(2,6,23,0.06),0_8px_24px_rgba(2,6,23,0.08)] hover:shadow-[0_4px_12px_rgba(2,6,23,0.08),0_12px_32px_rgba(2,6,23,0.12)] transition-all duration-300 hover:-translate-y-0.5 cursor-pointer border-l-4 border-l-[#027343]">
            <div className="h-1 bg-gradient-to-r from-[#027343] to-[#358f69]" />
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm font-medium text-slate-500 tracking-wide">Commissions Paid This Month</p>
                <div className="p-2.5 rounded-xl bg-[#e0f1ea]">
                  <DollarSign className="w-5 h-5 text-[#027343]" />
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-bold text-[#027343] tracking-tight">
                    ${(stats?.paidThisMonth ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Disbursed to agents</p>
                </div>
                <ArrowUpRight className="w-5 h-5 text-[#358f69]" />
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Activity Feed and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-[0_1px_2px_rgba(2,6,23,0.06),0_8px_24px_rgba(2,6,23,0.08)] rounded-2xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-[#047474] via-[#069B9A] to-[#027343]" />
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#e1f3f3] rounded-xl">
                <Activity className="w-5 h-5 text-[#047474]" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-[#003560]">Recent Activity</CardTitle>
                <CardDescription className="text-slate-500">Latest actions in the system</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 py-3 px-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-all"
                  >
                    <div className={`p-2 rounded-lg ${getActionColor(activity.action)}`}>
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
                      className={`px-2.5 py-1 text-xs font-semibold rounded-full capitalize ${getActionColor(activity.action)}`}
                    >
                      {activity.action}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
                  <Clock className="w-8 h-8 text-slate-300" />
                </div>
                <p className="font-semibold text-slate-700 mb-1">No recent activity</p>
                <p className="text-sm text-slate-400">Activities will appear here as you use the system</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-[0_1px_2px_rgba(2,6,23,0.06),0_8px_24px_rgba(2,6,23,0.08)] rounded-2xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-[#003560] to-[#047474]" />
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#e0e7ec] rounded-xl">
                <Sparkles className="w-5 h-5 text-[#003560]" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-[#003560]">Quick Actions</CardTitle>
                <CardDescription className="text-slate-500">Common tasks</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/members/new"
              className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-[#047474]/30 hover:bg-[#e1f3f3]/30 transition-all group"
            >
              <div className="p-2.5 rounded-xl bg-[#e1f3f3] group-hover:bg-[#047474] transition-colors">
                <Users className="w-5 h-5 text-[#047474] group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-slate-700">Add New Member</p>
                <p className="text-xs text-slate-400">Register a new member</p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-[#047474] transition-colors" />
            </Link>
            
            <Link
              href="/agents/new"
              className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-[#027343]/30 hover:bg-[#e0f1ea]/30 transition-all group"
            >
              <div className="p-2.5 rounded-xl bg-[#e0f1ea] group-hover:bg-[#027343] transition-colors">
                <UserCheck className="w-5 h-5 text-[#027343] group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-slate-700">Add New Agent</p>
                <p className="text-xs text-slate-400">Register a new agent</p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-[#027343] transition-colors" />
            </Link>
            
            <Link
              href="/enrollments"
              className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-purple-300 hover:bg-purple-50/50 transition-all group"
            >
              <div className="p-2.5 rounded-xl bg-purple-50 group-hover:bg-purple-600 transition-colors">
                <FileText className="w-5 h-5 text-purple-600 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-slate-700">View Enrollments</p>
                <p className="text-xs text-slate-400">Manage enrollment applications</p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-purple-600 transition-colors" />
            </Link>
            
            <Link
              href="/settings"
              className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-[#003560]/30 hover:bg-[#e0e7ec]/30 transition-all group"
            >
              <div className="p-2.5 rounded-xl bg-[#e0e7ec] group-hover:bg-[#003560] transition-colors">
                <Settings className="w-5 h-5 text-[#003560] group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-slate-700">System Settings</p>
                <p className="text-xs text-slate-400">Configure portal settings</p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-[#003560] transition-colors" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

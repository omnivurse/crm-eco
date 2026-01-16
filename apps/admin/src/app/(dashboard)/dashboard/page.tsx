import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@crm-eco/ui';
import { Users, UserCheck, FileText, TrendingUp, Clock, Activity, User, Package, Settings, DollarSign, Layers } from 'lucide-react';
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
  const [membersResult, agentsResult, enrollmentsResult, activeEnrollmentsResult] =
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
      return 'text-green-600 bg-green-100';
    case 'update':
    case 'update_commission_tier':
      return 'text-blue-600 bg-blue-100';
    case 'delete':
      return 'text-red-600 bg-red-100';
    case 'approve':
    case 'process_enrollment':
      return 'text-emerald-600 bg-emerald-100';
    case 'reject':
      return 'text-orange-600 bg-orange-100';
    case 'cancel':
      return 'text-gray-600 bg-gray-100';
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

  const cards = [
    {
      title: 'Total Members',
      value: stats?.totalMembers ?? 0,
      description: 'All registered members',
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
    },
    {
      title: 'Active Agents',
      value: stats?.totalAgents ?? 0,
      description: 'Licensed agents',
      icon: UserCheck,
      color: 'text-green-600',
      bg: 'bg-green-100',
    },
    {
      title: 'Total Enrollments',
      value: stats?.totalEnrollments ?? 0,
      description: 'All enrollment applications',
      icon: FileText,
      color: 'text-purple-600',
      bg: 'bg-purple-100',
    },
    {
      title: 'Active Enrollments',
      value: stats?.activeEnrollments ?? 0,
      description: 'Approved and active',
      icon: TrendingUp,
      color: 'text-orange-600',
      bg: 'bg-orange-100',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500">Welcome to the Admin Portal</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value.toLocaleString()}</div>
              <p className="text-xs text-slate-500 mt-1">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Commission Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/commissions/transactions?status=pending">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Pending Commissions
              </CardTitle>
              <div className="p-2 rounded-lg bg-yellow-100">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                ${(stats?.pendingCommissions ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-slate-500 mt-1">Awaiting approval</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/commissions">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Commissions Paid This Month
              </CardTitle>
              <div className="p-2 rounded-lg bg-green-100">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ${(stats?.paidThisMonth ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-slate-500 mt-1">Disbursed to agents</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Activity Feed and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest actions in the system</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 py-2 border-b last:border-b-0"
                  >
                    <div className={`p-2 rounded-lg ${getActionColor(activity.action)}`}>
                      {getEntityIcon(activity.entity_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {formatActivity(activity)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded capitalize ${getActionColor(activity.action)}`}
                    >
                      {activity.action}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500 py-8 text-center">
                <Clock className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                No recent activity to display
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/members/new"
              className="block p-3 rounded-lg border hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-sm">Add New Member</p>
                  <p className="text-xs text-slate-500">Register a new member</p>
                </div>
              </div>
            </Link>
            <Link
              href="/agents/new"
              className="block p-3 rounded-lg border hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <UserCheck className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-sm">Add New Agent</p>
                  <p className="text-xs text-slate-500">Register a new agent</p>
                </div>
              </div>
            </Link>
            <Link
              href="/enrollments"
              className="block p-3 rounded-lg border hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="font-medium text-sm">View Enrollments</p>
                  <p className="text-xs text-slate-500">Manage enrollment applications</p>
                </div>
              </div>
            </Link>
            <Link
              href="/settings"
              className="block p-3 rounded-lg border hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-slate-600" />
                <div>
                  <p className="font-medium text-sm">System Settings</p>
                  <p className="text-xs text-slate-500">Configure portal settings</p>
                </div>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

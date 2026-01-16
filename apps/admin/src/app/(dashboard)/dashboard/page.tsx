import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@crm-eco/ui';
import { Users, UserCheck, FileText, DollarSign, TrendingUp, Clock } from 'lucide-react';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';

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

  return {
    totalMembers: membersResult.count ?? 0,
    totalAgents: agentsResult.count ?? 0,
    totalEnrollments: enrollmentsResult.count ?? 0,
    activeEnrollments: activeEnrollmentsResult.count ?? 0,
  };
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();

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

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest actions in the system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-slate-500 py-8 text-center">
              <Clock className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              No recent activity to display
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
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
            </a>
            <a
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
            </a>
            <a
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
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

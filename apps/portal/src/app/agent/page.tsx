import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { 
  Users, 
  FileText, 
  DollarSign, 
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';

async function getAgentDashboardData(supabase: any, agentId: string, organizationId: string) {
  // Get member count
  const { count: totalMembers } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('advisor_id', agentId)
    .eq('organization_id', organizationId);

  // Get new members this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  
  const { count: newMembersThisMonth } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('advisor_id', agentId)
    .eq('organization_id', organizationId)
    .gte('created_at', startOfMonth.toISOString());

  // Get enrollment counts by status
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('status')
    .eq('advisor_id', agentId)
    .eq('organization_id', organizationId);

  const enrollmentCounts = {
    total: enrollments?.length || 0,
    active: enrollments?.filter((e: any) => e.status === 'active').length || 0,
    pending: enrollments?.filter((e: any) => e.status === 'pending').length || 0,
  };

  // Get recent enrollments
  const { data: recentEnrollments } = await supabase
    .from('enrollments')
    .select(`
      id,
      status,
      created_at,
      members (
        id,
        first_name,
        last_name
      ),
      plans (
        name
      )
    `)
    .eq('advisor_id', agentId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(5);

  // Get commission stats (if commission tables exist)
  let commissionStats = { totalEarned: 0, pendingPayout: 0 };
  try {
    const { data: transactions } = await (supabase as any)
      .from('commission_transactions')
      .select('commission_amount, status')
      .eq('advisor_id', agentId);
    
    if (transactions) {
      commissionStats = {
        totalEarned: transactions.reduce((sum: number, t: any) => sum + (t.commission_amount || 0), 0),
        pendingPayout: transactions
          .filter((t: any) => t.status === 'approved')
          .reduce((sum: number, t: any) => sum + (t.commission_amount || 0), 0),
      };
    }
  } catch {
    // Commission tables may not exist
  }

  return {
    totalMembers: totalMembers || 0,
    newMembersThisMonth: newMembersThisMonth || 0,
    enrollmentCounts,
    recentEnrollments: recentEnrollments || [],
    commissionStats,
  };
}

async function getAgentInfo(supabase: any, userId: string) {
  // First get the profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!profile) return null;

  // Then get the advisor by profile_id
  const { data: advisor } = await supabase
    .from('advisors')
    .select('id, first_name, last_name, enrollment_code, organization_id')
    .eq('profile_id', profile.id)
    .single();
  return advisor;
}

export default async function AgentDashboardPage() {
  const supabase = await createServerSupabaseClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/signin');

  const agent = await getAgentInfo(supabase, user.id);
  if (!agent) redirect('/access-denied');

  const data = await getAgentDashboardData(supabase, agent.id, agent.organization_id);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome back, {agent.first_name}!
          </h1>
          <p className="text-slate-600">
            Here's what's happening with your enrollments today.
          </p>
        </div>
        <Link href={`/enroll/${agent.enrollment_code}`} target="_blank">
          <Button className="gap-2">
            <FileText className="h-4 w-4" />
            New Enrollment
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Total Members
            </CardTitle>
            <Users className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalMembers}</div>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-green-600">+{data.newMembersThisMonth}</span> this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Active Enrollments
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.enrollmentCounts.active}</div>
            <p className="text-xs text-slate-500 mt-1">
              {data.enrollmentCounts.total} total enrollments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Pending Enrollments
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.enrollmentCounts.pending}</div>
            <p className="text-xs text-slate-500 mt-1">
              Awaiting approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Total Commissions
            </CardTitle>
            <DollarSign className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${data.commissionStats.totalEarned.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              ${data.commissionStats.pendingPayout.toLocaleString(undefined, { minimumFractionDigits: 2 })} pending payout
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Enrollments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Enrollments</CardTitle>
          <Link href="/agent/enrollments">
            <Button variant="ghost" size="sm">
              View All
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {data.recentEnrollments.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p>No enrollments yet</p>
              <p className="text-sm mt-1">Share your enrollment link to get started!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.recentEnrollments.map((enrollment: any) => (
                <div 
                  key={enrollment.id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">
                        {enrollment.members?.first_name} {enrollment.members?.last_name}
                      </p>
                      <p className="text-sm text-slate-500">
                        {enrollment.plans?.name || 'No plan selected'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      enrollment.status === 'active' 
                        ? 'bg-green-100 text-green-700'
                        : enrollment.status === 'pending'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {enrollment.status}
                    </span>
                    <span className="text-sm text-slate-500">
                      {new Date(enrollment.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/agent/members">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">View Members</h3>
                <p className="text-sm text-slate-500">Manage your member base</p>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/agent/commissions">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Commissions</h3>
                <p className="text-sm text-slate-500">Track your earnings</p>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <Link href="/agent/links">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Enrollment Links</h3>
                <p className="text-sm text-slate-500">Track your marketing</p>
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>
    </div>
  );
}

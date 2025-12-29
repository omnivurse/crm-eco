import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@crm-eco/ui';
import { Users, UserCheck, Ticket, HeartPulse } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Database } from '@crm-eco/lib/types';

type Activity = Database['public']['Tables']['activities']['Row'];

interface ActivityWithProfile extends Activity {
  profiles?: { full_name: string } | null;
}

async function getStats() {
  const supabase = await createServerSupabaseClient();
  
  const [membersResult, advisorsResult, ticketsResult, needsResult] = await Promise.all([
    supabase.from('members').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('advisors').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('tickets').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
    supabase.from('needs').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_review']),
  ]);

  return {
    activeMembers: membersResult.count ?? 0,
    activeAdvisors: advisorsResult.count ?? 0,
    openTickets: ticketsResult.count ?? 0,
    openNeeds: needsResult.count ?? 0,
  };
}

async function getRecentActivities(): Promise<ActivityWithProfile[]> {
  const supabase = await createServerSupabaseClient();
  
  const { data } = await supabase
    .from('activities')
    .select('*, profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(10);

  return (data ?? []) as ActivityWithProfile[];
}

export default async function DashboardPage() {
  const stats = await getStats();
  const activities = await getRecentActivities();

  const statCards = [
    {
      title: 'Active Members',
      value: stats.activeMembers,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Active Advisors',
      value: stats.activeAdvisors,
      icon: UserCheck,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Open Tickets',
      value: stats.openTickets,
      icon: Ticket,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
    {
      title: 'Open Needs',
      value: stats.openNeeds,
      icon: HeartPulse,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600">Welcome to your healthshare management platform</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No recent activity to display
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell className="font-medium">
                      {activity.profiles?.full_name ?? 'System'}
                    </TableCell>
                    <TableCell className="capitalize">{activity.action}</TableCell>
                    <TableCell className="capitalize">{activity.entity_type}</TableCell>
                    <TableCell>{activity.description}</TableCell>
                    <TableCell className="text-slate-500">
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

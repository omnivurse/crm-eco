import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from '@crm-eco/ui';
import { Users, UserCheck, Ticket, HeartPulse, TrendingUp, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Database } from '@crm-eco/lib/types';
import { getRoleQueryContext, type RoleQueryContext } from '@/lib/auth';

type ActivityRow = Database['public']['Tables']['activities']['Row'];

interface ActivityWithRelations extends ActivityRow {
  profiles?: { full_name: string } | null;
  members?: { first_name: string; last_name: string } | null;
  leads?: { first_name: string; last_name: string } | null;
}

async function getStats(context: RoleQueryContext) {
  const supabase = await createServerSupabaseClient();
  
  // Build queries based on role
  const isAdvisor = !context.isAdmin && context.role === 'advisor' && context.advisorId;
  
  // Members query
  let membersQuery = supabase.from('members').select('id', { count: 'exact', head: true }).eq('status', 'active');
  if (isAdvisor) {
    membersQuery = membersQuery.eq('advisor_id', context.advisorId!);
  }
  
  // Advisors query (only for admin/owner)
  const advisorsQuery = context.isAdmin 
    ? supabase.from('advisors').select('id', { count: 'exact', head: true }).eq('status', 'active')
    : Promise.resolve({ count: 0 });
  
  // Tickets query
  let ticketsQuery = supabase.from('tickets').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress']);
  if (isAdvisor) {
    // For advisors, count tickets they created, are assigned to, or are linked to them
    ticketsQuery = ticketsQuery.or(
      `created_by_profile_id.eq.${context.profileId},assigned_to_profile_id.eq.${context.profileId},advisor_id.eq.${context.advisorId}`
    );
  }
  
  // Needs query
  let needsQuery = supabase.from('needs').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_review']);
  if (isAdvisor) {
    needsQuery = needsQuery.eq('advisor_id', context.advisorId!);
  }
  
  const [membersResult, advisorsResult, ticketsResult, needsResult] = await Promise.all([
    membersQuery,
    advisorsQuery,
    ticketsQuery,
    needsQuery,
  ]);

  return {
    activeMembers: membersResult.count ?? 0,
    activeAdvisors: (advisorsResult as { count: number | null }).count ?? 0,
    openTickets: ticketsResult.count ?? 0,
    openNeeds: needsResult.count ?? 0,
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
      members:member_id(first_name, last_name),
      leads:lead_id(first_name, last_name)
    `)
    .order('created_at', { ascending: false })
    .limit(10);

  // For advisors, only show activities they created or related to their entities
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

const actionColors: Record<string, string> = {
  created: 'bg-green-100 text-green-700',
  updated: 'bg-blue-100 text-blue-700',
  deleted: 'bg-red-100 text-red-700',
  note: 'bg-yellow-100 text-yellow-700',
  call: 'bg-purple-100 text-purple-700',
  email: 'bg-indigo-100 text-indigo-700',
  meeting: 'bg-cyan-100 text-cyan-700',
};

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

  // Build stat cards based on role
  const statCards = [
    {
      title: stats.isAdvisor ? 'My Active Members' : 'Active Members',
      value: stats.activeMembers,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-l-blue-500',
    },
    // Only show advisors count for admin/owner
    ...(!stats.isAdvisor ? [{
      title: 'Active Advisors',
      value: stats.activeAdvisors,
      icon: UserCheck,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-l-emerald-500',
    }] : []),
    {
      title: stats.isAdvisor ? 'My Open Tickets' : 'Open Tickets',
      value: stats.openTickets,
      icon: Ticket,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-l-amber-500',
    },
    {
      title: stats.isAdvisor ? 'My Open Needs' : 'Open Needs',
      value: stats.openNeeds,
      icon: HeartPulse,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
      borderColor: 'border-l-rose-500',
    },
  ];

  const getEntityName = (activity: ActivityWithRelations) => {
    if (activity.members) {
      return `${activity.members.first_name} ${activity.members.last_name}`;
    }
    if (activity.leads) {
      return `${activity.leads.first_name} ${activity.leads.last_name}`;
    }
    return activity.entity_type;
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-500">
            {stats.isAdvisor 
              ? 'Overview of your assigned members and tasks' 
              : 'Overview of your healthshare management platform'
            }
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <TrendingUp className="w-4 h-4" />
          <span>Last updated just now</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${stats.isAdvisor ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-4`}>
        {statCards.map((stat) => (
          <Card key={stat.title} className={`border-l-4 ${stat.borderColor} hover:shadow-md transition-shadow`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                {stat.title}
              </CardTitle>
              <div className={`p-2.5 rounded-xl ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{stat.value.toLocaleString()}</div>
              <p className="text-xs text-slate-400 mt-1">Total count</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Activity className="w-5 h-5 text-slate-400" />
          <CardTitle>{stats.isAdvisor ? 'My Recent Activity' : 'Recent Activity'}</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Activity className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="font-medium">No recent activity</p>
              <p className="text-sm text-slate-400 mt-1">Activities will appear here as you use the system</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell className="font-medium">
                      {activity.profiles?.full_name ?? 'System'}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className={actionColors[activity.action] || 'bg-slate-100 text-slate-700'}
                      >
                        {activity.type || activity.action}
                      </Badge>
                    </TableCell>
                    <TableCell>{activity.subject || activity.description || '—'}</TableCell>
                    <TableCell className="text-slate-500">
                      <span className="capitalize">{activity.entity_type}</span>
                      {(activity.members || activity.leads) && (
                        <span className="text-slate-400"> · {getEntityName(activity)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm">
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

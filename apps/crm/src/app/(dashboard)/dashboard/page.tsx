import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from '@crm-eco/ui';
import { Users, UserCheck, Ticket, HeartPulse, TrendingUp, Activity } from 'lucide-react';
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
      members:member_id(id, first_name, last_name),
      leads:lead_id(id, first_name, last_name),
      advisors:advisor_id(id, first_name, last_name)
    `)
    .order('occurred_at', { ascending: false })
    .limit(15);

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

const typeColors: Record<string, string> = {
  member_created: 'bg-green-100 text-green-700',
  member_updated: 'bg-blue-100 text-blue-700',
  advisor_created: 'bg-emerald-100 text-emerald-700',
  advisor_updated: 'bg-blue-100 text-blue-700',
  lead_created: 'bg-cyan-100 text-cyan-700',
  lead_updated: 'bg-blue-100 text-blue-700',
  ticket_created: 'bg-amber-100 text-amber-700',
  ticket_updated: 'bg-blue-100 text-blue-700',
  ticket_comment_added: 'bg-purple-100 text-purple-700',
  need_created: 'bg-rose-100 text-rose-700',
  need_updated: 'bg-blue-100 text-blue-700',
  need_status_changed: 'bg-indigo-100 text-indigo-700',
  note_added: 'bg-yellow-100 text-yellow-700',
  call_logged: 'bg-purple-100 text-purple-700',
  email_sent: 'bg-indigo-100 text-indigo-700',
};

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    member_created: 'New Member',
    member_updated: 'Updated',
    advisor_created: 'New Advisor',
    advisor_updated: 'Updated',
    lead_created: 'New Lead',
    lead_updated: 'Updated',
    ticket_created: 'Ticket Created',
    ticket_updated: 'Updated',
    ticket_comment_added: 'Comment',
    need_created: 'Need Created',
    need_updated: 'Updated',
    need_status_changed: 'Status Change',
    note_added: 'Note',
    call_logged: 'Call',
    email_sent: 'Email',
  };
  return labels[type] || type.replace(/_/g, ' ');
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

  const getEntityLink = (activity: ActivityWithRelations) => {
    // Get entity type from the activity type
    const type = activity.type || '';
    
    if (type.startsWith('member') && activity.member_id) {
      return { href: `/members/${activity.member_id}`, label: activity.members ? `${activity.members.first_name} ${activity.members.last_name}` : 'Member' };
    }
    if (type.startsWith('advisor') && activity.advisor_id) {
      return { href: `/advisors/${activity.advisor_id}`, label: activity.advisors ? `${activity.advisors.first_name} ${activity.advisors.last_name}` : 'Advisor' };
    }
    if (type.startsWith('lead') && activity.lead_id) {
      return { href: `/leads`, label: activity.leads ? `${activity.leads.first_name} ${activity.leads.last_name}` : 'Lead' };
    }
    if (type.startsWith('ticket') && (activity as any).ticket_id) {
      return { href: `/tickets/${(activity as any).ticket_id}`, label: 'Ticket' };
    }
    if (type.startsWith('need') && (activity as any).need_id) {
      return { href: `/needs/${(activity as any).need_id}`, label: 'Need' };
    }
    
    // Fallback to members/leads if present
    if (activity.members) {
      return { href: `/members/${activity.members.id}`, label: `${activity.members.first_name} ${activity.members.last_name}` };
    }
    if (activity.leads) {
      return { href: `/leads`, label: `${activity.leads.first_name} ${activity.leads.last_name}` };
    }
    
    return null;
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
                  <TableHead>Type</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((activity) => {
                  const entityLink = getEntityLink(activity);
                  return (
                    <TableRow key={activity.id}>
                      <TableCell>
                        <Badge 
                          variant="secondary" 
                          className={typeColors[activity.type || ''] || 'bg-slate-100 text-slate-700'}
                        >
                          {getTypeLabel(activity.type || '')}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium max-w-[250px] truncate">
                        {activity.subject || '—'}
                      </TableCell>
                      <TableCell>
                        {entityLink ? (
                          <Link 
                            href={entityLink.href}
                            className="text-blue-600 hover:underline"
                          >
                            {entityLink.label}
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {activity.profiles?.full_name ?? 'System'}
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {activity.occurred_at 
                          ? formatDistanceToNow(new Date(activity.occurred_at), { addSuffix: true })
                          : formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })
                        }
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

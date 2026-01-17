import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, StatCard } from '@crm-eco/ui';
import { Users, UserCheck, Ticket, HeartPulse, TrendingUp, Activity, Sparkles, ArrowUpRight } from 'lucide-react';
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
  member_created: 'bg-[#e0f1ea] text-[#027343]',
  member_updated: 'bg-[#e1f3f3] text-[#047474]',
  advisor_created: 'bg-[#e0f1ea] text-[#027343]',
  advisor_updated: 'bg-[#e1f3f3] text-[#047474]',
  lead_created: 'bg-cyan-100 text-cyan-700',
  lead_updated: 'bg-[#e1f3f3] text-[#047474]',
  ticket_created: 'bg-amber-100 text-amber-700',
  ticket_updated: 'bg-[#e1f3f3] text-[#047474]',
  ticket_comment_added: 'bg-purple-100 text-purple-700',
  need_created: 'bg-rose-100 text-rose-700',
  need_updated: 'bg-[#e1f3f3] text-[#047474]',
  need_status_changed: 'bg-[#e0e7ec] text-[#003560]',
  note_added: 'bg-[#fcf6e4] text-[#907113]',
  call_logged: 'bg-purple-100 text-purple-700',
  email_sent: 'bg-[#e0e7ec] text-[#003560]',
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
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-[#E9B61F]" />
            <span className="text-sm font-medium text-[#047474]">Dashboard</span>
          </div>
          <h1 className="text-2xl font-bold text-[#003560] mb-1">
            {stats.isAdvisor ? 'Your Overview' : 'Platform Overview'}
          </h1>
          <p className="text-slate-500">
            {stats.isAdvisor 
              ? 'Overview of your assigned members and tasks' 
              : 'Overview of your healthshare management platform'
            }
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm">
          <TrendingUp className="w-4 h-4 text-[#027343]" />
          <span className="text-sm text-slate-600">Last updated just now</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${stats.isAdvisor ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-5`}>
        <StatCard
          title={stats.isAdvisor ? 'My Active Members' : 'Active Members'}
          value={stats.activeMembers}
          subtitle="Total count"
          icon={<Users className="w-5 h-5" />}
          accent="teal"
        />
        
        {!stats.isAdvisor && (
          <StatCard
            title="Active Advisors"
            value={stats.activeAdvisors}
            subtitle="Total count"
            icon={<UserCheck className="w-5 h-5" />}
            accent="emerald"
          />
        )}
        
        <StatCard
          title={stats.isAdvisor ? 'My Open Tickets' : 'Open Tickets'}
          value={stats.openTickets}
          subtitle="Total count"
          icon={<Ticket className="w-5 h-5" />}
          accent="amber"
        />
        
        <StatCard
          title={stats.isAdvisor ? 'My Open Needs' : 'Open Needs'}
          value={stats.openNeeds}
          subtitle="Total count"
          icon={<HeartPulse className="w-5 h-5" />}
          accent="rose"
        />
      </div>

      {/* Recent Activity */}
      <Card className="border-0 shadow-[0_1px_2px_rgba(2,6,23,0.06),0_8px_24px_rgba(2,6,23,0.08)] rounded-2xl overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-[#047474] via-[#069B9A] to-[#027343]" />
        <CardHeader className="flex flex-row items-center gap-3 pb-4">
          <div className="p-2 bg-[#e1f3f3] rounded-xl">
            <Activity className="w-5 h-5 text-[#047474]" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold text-[#003560]">
              {stats.isAdvisor ? 'My Recent Activity' : 'Recent Activity'}
            </CardTitle>
            <p className="text-sm text-slate-500">Latest actions across the platform</p>
          </div>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
                <Activity className="w-8 h-8 text-slate-300" />
              </div>
              <p className="font-semibold text-slate-700 mb-1">No recent activity</p>
              <p className="text-sm text-slate-400">Activities will appear here as you use the system</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-100">
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Subject</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Entity</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider">By</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((activity) => {
                  const entityLink = getEntityLink(activity);
                  return (
                    <TableRow key={activity.id} className="border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <TableCell>
                        <Badge 
                          variant="secondary" 
                          className={`${typeColors[activity.type || ''] || 'bg-slate-100 text-slate-700'} font-medium`}
                        >
                          {getTypeLabel(activity.type || '')}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-slate-700 max-w-[250px] truncate">
                        {activity.subject || '—'}
                      </TableCell>
                      <TableCell>
                        {entityLink ? (
                          <Link 
                            href={entityLink.href}
                            className="inline-flex items-center gap-1 text-[#047474] hover:text-[#069B9A] font-medium transition-colors"
                          >
                            {entityLink.label}
                            <ArrowUpRight className="w-3 h-3" />
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

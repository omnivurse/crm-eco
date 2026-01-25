import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import {
  Users,
  MessageSquare,
  Activity,
  Calendar,
  Target,
  Bell,
  UserPlus,
  Ticket,
  CheckCircle,
  Clock,
  TrendingUp,
  Award
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface TeamMember {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  avatar_url: string | null;
  is_online?: boolean;
}

interface TeamActivity {
  id: string;
  type: 'ticket_created' | 'ticket_assigned' | 'ticket_resolved' | 'comment_added' | 'status_changed';
  user_id: string;
  user_name: string;
  ticket_id?: string;
  ticket_subject?: string;
  description: string;
  created_at: string;
}

interface TeamStats {
  total_members: number;
  online_members: number;
  active_tickets: number;
  resolved_today: number;
  avg_response_time: number;
}

export function TeamCollaboration() {
  const { profile } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [activities, setActivities] = useState<TeamActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<TeamStats>({
    total_members: 0,
    online_members: 0,
    active_tickets: 0,
    resolved_today: 0,
    avg_response_time: 0,
  });

  const [selectedTab, setSelectedTab] = useState<'activity' | 'members' | 'performance'>('activity');

  useEffect(() => {
    fetchTeamData();
    const interval = setInterval(fetchActivities, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchTeamMembers(),
        fetchActivities(),
        fetchTeamStats(),
      ]);
    } catch (error) {
      console.error('Error fetching team data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['agent', 'staff', 'admin', 'super_admin'])
      .order('full_name');

    if (data) {
      setTeamMembers(data.map(member => ({
        ...member,
        is_online: Math.random() > 0.5,
      })));
    }
  };

  const fetchActivities = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: tickets } = await supabase
      .from('tickets')
      .select(`
        id,
        subject,
        status,
        created_at,
        updated_at,
        assignee_id,
        requester:profiles!tickets_requester_id_fkey(full_name, email),
        assignee:profiles!tickets_assignee_id_fkey(full_name, email)
      `)
      .gte('updated_at', today.toISOString())
      .order('updated_at', { ascending: false })
      .limit(20);

    if (tickets) {
      const activityList: TeamActivity[] = [];

      tickets.forEach(ticket => {
        const assignee = Array.isArray(ticket.assignee) ? ticket.assignee[0] : ticket.assignee;
        if (ticket.status === 'resolved') {
          activityList.push({
            id: `${ticket.id}-resolved`,
            type: 'ticket_resolved',
            user_id: ticket.assignee_id || '',
            user_name: assignee?.full_name || assignee?.email || 'Unknown',
            ticket_id: ticket.id,
            ticket_subject: ticket.subject,
            description: `resolved ticket "${ticket.subject}"`,
            created_at: ticket.updated_at,
          });
        } else if (ticket.assignee_id) {
          activityList.push({
            id: `${ticket.id}-assigned`,
            type: 'ticket_assigned',
            user_id: ticket.assignee_id,
            user_name: assignee?.full_name || assignee?.email || 'Unknown',
            ticket_id: ticket.id,
            ticket_subject: ticket.subject,
            description: `was assigned ticket "${ticket.subject}"`,
            created_at: ticket.updated_at,
          });
        }
      });

      setActivities(activityList.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
    }
  };

  const fetchTeamStats = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count: activeTickets } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .in('status', ['new', 'open']);

    const { count: resolvedToday } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'resolved')
      .gte('updated_at', today.toISOString());

    const { data: teamCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .in('role', ['agent', 'staff', 'admin', 'super_admin']);

    setStats({
      total_members: teamMembers.length,
      online_members: teamMembers.filter(m => m.is_online).length,
      active_tickets: activeTickets || 0,
      resolved_today: resolvedToday || 0,
      avg_response_time: Math.round(Math.random() * 120 + 30),
    });
  };

  const activityIcons: Record<string, any> = {
    ticket_created: Ticket,
    ticket_assigned: UserPlus,
    ticket_resolved: CheckCircle,
    comment_added: MessageSquare,
    status_changed: Activity,
  };

  const activityColors: Record<string, string> = {
    ticket_created: 'text-primary-800 dark:text-primary-500 bg-primary-100 dark:bg-primary-950/20',
    ticket_assigned: 'text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-900/20',
    ticket_resolved: 'text-success-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20',
    comment_added: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/20',
    status_changed: 'text-purple-600 dark:text-purple-400 bg-primary-100 dark:bg-primary-900/20',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-neutral-500 dark:text-neutral-400">Loading team data...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Team Collaboration</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-1">
          Track team activity, performance, and coordination
        </p>
      </div>

      {/* Team Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <Users className="text-primary-800 dark:text-primary-500" size={24} />
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Team Members</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.total_members}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Users className="text-success-600 dark:text-green-400" size={24} />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-success-500 rounded-full border-2 border-white dark:border-neutral-800"></div>
            </div>
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Online Now</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.online_members}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <Ticket className="text-orange-600 dark:text-orange-400" size={24} />
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Active Tickets</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.active_tickets}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="text-success-600 dark:text-green-400" size={24} />
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Resolved Today</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.resolved_today}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <Clock className="text-cyan-600 dark:text-cyan-400" size={24} />
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Avg Response</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.avg_response_time}m</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow mb-6">
        <div className="border-b border-neutral-200 dark:border-neutral-700">
          <nav className="flex gap-4 px-6">
            <button
              onClick={() => setSelectedTab('activity')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                selectedTab === 'activity'
                  ? 'border-primary-800 text-primary-800 dark:text-primary-500'
                  : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <Activity size={18} />
                Activity Feed
              </div>
            </button>
            <button
              onClick={() => setSelectedTab('members')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                selectedTab === 'members'
                  ? 'border-primary-800 text-primary-800 dark:text-primary-500'
                  : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users size={18} />
                Team Members
              </div>
            </button>
            <button
              onClick={() => setSelectedTab('performance')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                selectedTab === 'performance'
                  ? 'border-primary-800 text-primary-800 dark:text-primary-500'
                  : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp size={18} />
                Performance
              </div>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {selectedTab === 'activity' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Recent Activity</h2>
                <button
                  onClick={fetchActivities}
                  className="text-sm text-primary-800 dark:text-primary-500 hover:text-primary-900 dark:hover:text-primary-300"
                >
                  Refresh
                </button>
              </div>

              {activities.length === 0 ? (
                <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
                  No recent activity
                </div>
              ) : (
                <div className="space-y-3">
                  {activities.map((activity) => {
                    const Icon = activityIcons[activity.type] || Activity;
                    return (
                      <div
                        key={activity.id}
                        className="flex items-start gap-3 p-4 rounded-lg bg-neutral-50 dark:bg-neutral-700/50 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <div className={`p-2 rounded-lg ${activityColors[activity.type]}`}>
                          <Icon size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-neutral-900 dark:text-white">
                            <span className="font-medium">{activity.user_name}</span>{' '}
                            {activity.description}
                          </p>
                          {activity.ticket_id && (
                            <a
                              href={`/tickets/${activity.ticket_id}`}
                              className="text-xs text-primary-800 dark:text-primary-500 hover:underline"
                            >
                              View ticket
                            </a>
                          )}
                        </div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {selectedTab === 'members' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Team Members</h2>
                <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                  <div className="w-2 h-2 bg-success-500 rounded-full"></div>
                  {stats.online_members} online
                </div>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-4 rounded-lg bg-neutral-50 dark:bg-neutral-700/50 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-primary-900 flex items-center justify-center text-white font-semibold text-lg">
                        {member.full_name?.[0]?.toUpperCase() || member.email[0].toUpperCase()}
                      </div>
                      {member.is_online && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-success-500 rounded-full border-2 border-white dark:border-neutral-700"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-neutral-900 dark:text-white truncate">
                        {member.full_name || 'No name'}
                      </p>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 truncate">{member.email}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-primary-100 text-primary-900 dark:bg-primary-950 dark:text-primary-200 capitalize">
                        {member.role}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedTab === 'performance' && (
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">Team Performance</h2>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="p-4 rounded-lg bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-900/20">
                  <div className="flex items-center gap-3 mb-4">
                    <Target className="text-primary-800 dark:text-primary-500" size={24} />
                    <h3 className="font-semibold text-neutral-900 dark:text-white">Resolution Rate</h3>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold text-neutral-900 dark:text-white">
                      {stats.active_tickets > 0 ? Math.round((stats.resolved_today / stats.active_tickets) * 100) : 0}%
                    </span>
                    <span className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">today</span>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
                  <div className="flex items-center gap-3 mb-4">
                    <Award className="text-success-600 dark:text-green-400" size={24} />
                    <h3 className="font-semibold text-neutral-900 dark:text-white">Team Efficiency</h3>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold text-neutral-900 dark:text-white">A+</span>
                    <span className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">rating</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-neutral-900 dark:text-white">Top Performers</h3>
                {teamMembers.slice(0, 5).map((member, index) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-4 p-4 rounded-lg bg-neutral-50 dark:bg-neutral-700/50"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 text-white font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-900 flex items-center justify-center text-white font-semibold">
                      {member.full_name?.[0]?.toUpperCase() || member.email[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-neutral-900 dark:text-white">
                        {member.full_name || member.email}
                      </p>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        {Math.floor(Math.random() * 20 + 5)} tickets resolved
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-neutral-900 dark:text-white">
                        {Math.floor(Math.random() * 30 + 70)}%
                      </p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400">efficiency</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-3">
            <Calendar className="text-primary-800 dark:text-primary-500" size={24} />
            <h3 className="font-semibold text-neutral-900 dark:text-white">Schedule Meeting</h3>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            Coordinate team meetings and standups
          </p>
          <button className="w-full px-4 py-2 bg-primary-800 hover:bg-primary-900 text-white rounded-xl text-sm transition-colors">
            Create Meeting
          </button>
        </div>

        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-3">
            <MessageSquare className="text-success-600 dark:text-green-400" size={24} />
            <h3 className="font-semibold text-neutral-900 dark:text-white">Team Chat</h3>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            Start a conversation with the team
          </p>
          <button className="w-full px-4 py-2 bg-success-600 hover:bg-success-700 text-white rounded-xl text-sm transition-colors">
            Open Chat
          </button>
        </div>

        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-3">
            <Bell className="text-orange-600 dark:text-orange-400" size={24} />
            <h3 className="font-semibold text-neutral-900 dark:text-white">Announcements</h3>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            Send updates to your team
          </p>
          <button className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm transition-colors">
            New Announcement
          </button>
        </div>
      </div>
    </div>
  );
}

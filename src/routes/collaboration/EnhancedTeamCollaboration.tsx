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
  Award,
  RefreshCw,
  Hash,
  Pin,
  AlertCircle,
} from 'lucide-react';
import { format, formatDistanceToNow, isToday, parseISO } from 'date-fns';
import { MeetingScheduler } from '../../components/collaboration/MeetingScheduler';
import { AnnouncementModal } from '../../components/collaboration/AnnouncementModal';
import { TeamChatModal } from '../../components/collaboration/TeamChatModal';

interface TeamMember {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  avatar_url: string | null;
  presence?: {
    status: 'online' | 'away' | 'offline';
    last_seen_at: string;
  };
  ticket_count?: number;
}

interface TeamActivity {
  id: string;
  action_type: string;
  user_id: string;
  user_name: string;
  entity_type: string;
  entity_id: string | null;
  metadata: any;
  created_at: string;
}

interface TeamStats {
  total_members: number;
  online_members: number;
  active_tickets: number;
  resolved_today: number;
  avg_response_time: number;
}

interface Meeting {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  creator: {
    full_name: string | null;
    email: string;
  };
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string;
  is_pinned: boolean;
  created_at: string;
  creator: {
    full_name: string | null;
    email: string;
  };
  is_read: boolean;
}

export function EnhancedTeamCollaboration() {
  const { profile } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [activities, setActivities] = useState<TeamActivity[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<TeamStats>({
    total_members: 0,
    online_members: 0,
    active_tickets: 0,
    resolved_today: 0,
    avg_response_time: 0,
  });

  const [selectedTab, setSelectedTab] = useState<'activity' | 'members' | 'performance'>('activity');
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);

  useEffect(() => {
    fetchAllData();
    updatePresence();

    const presenceInterval = setInterval(updatePresence, 60000);
    const activityInterval = setInterval(fetchActivities, 30000);

    subscribeToPresence();
    subscribeToActivities();

    return () => {
      clearInterval(presenceInterval);
      clearInterval(activityInterval);
    };
  }, []);

  const updatePresence = async () => {
    if (!profile) return;

    await supabase.from('team_activities').insert({
      user_id: profile.id,
      action_type: 'presence_update',
      entity_type: 'presence',
      entity_id: null,
      metadata: {},
    });
  };

  const fetchAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchTeamMembers(),
        fetchActivities(),
        fetchTeamStats(),
        fetchUpcomingMeetings(),
        fetchAnnouncements(),
      ]);
    } catch (error) {
      console.error('Error fetching team data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  };

  const fetchTeamMembers = async () => {
    const { data: members } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['agent', 'staff', 'admin', 'super_admin'])
      .order('full_name');

    if (members) {
      const { data: presenceData } = await supabase
        .from('team_presence')
        .select('user_id, status, last_seen_at')
        .in('user_id', members.map(m => m.id));

      const { data: ticketCounts } = await supabase
        .from('tickets')
        .select('assignee_id')
        .in('status', ['new', 'open'])
        .in('assignee_id', members.map(m => m.id));

      const presenceMap = new Map(presenceData?.map(p => [p.user_id, p]) || []);
      const ticketCountMap = new Map<string, number>();
      ticketCounts?.forEach(t => {
        if (t.assignee_id) {
          ticketCountMap.set(t.assignee_id, (ticketCountMap.get(t.assignee_id) || 0) + 1);
        }
      });

      const enrichedMembers = members.map(member => ({
        ...member,
        presence: presenceMap.get(member.id),
        ticket_count: ticketCountMap.get(member.id) || 0,
      }));

      setTeamMembers(enrichedMembers);
    }
  };

  const fetchActivities = async () => {
    const { data } = await supabase
      .from('team_activities')
      .select(`
        id,
        action_type,
        user_id,
        entity_type,
        entity_id,
        metadata,
        created_at,
        user:profiles!team_activities_user_id_fkey(full_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) {
      const formattedActivities = data.map(activity => {
        const user = Array.isArray(activity.user) ? activity.user[0] : activity.user;
        return {
          ...activity,
          user,
          user_name: user?.full_name || user?.email || 'Unknown',
        };
      });
      setActivities(formattedActivities);
    }
  };

  const fetchTeamStats = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [activeTicketsResult, resolvedTodayResult, responseTimeResult] = await Promise.all([
      supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .in('status', ['new', 'open']),
      supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'resolved')
        .gte('updated_at', today.toISOString()),
      supabase
        .from('tickets')
        .select('created_at, updated_at, status')
        .eq('status', 'resolved')
        .gte('updated_at', today.toISOString())
        .limit(50),
    ]);

    let avgResponseTime = 0;
    if (responseTimeResult.data && responseTimeResult.data.length > 0) {
      const times = responseTimeResult.data.map(ticket => {
        const created = new Date(ticket.created_at).getTime();
        const resolved = new Date(ticket.updated_at).getTime();
        return (resolved - created) / 1000 / 60;
      });
      avgResponseTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    }

    const onlineCount = teamMembers.filter(m => m.presence?.status === 'online').length;

    setStats({
      total_members: teamMembers.length,
      online_members: onlineCount,
      active_tickets: activeTicketsResult.count || 0,
      resolved_today: resolvedTodayResult.count || 0,
      avg_response_time: avgResponseTime,
    });
  };

  const fetchUpcomingMeetings = async () => {
    const { data } = await supabase
      .from('team_meetings')
      .select(`
        id,
        title,
        scheduled_at,
        duration_minutes,
        status,
        creator:profiles!team_meetings_created_by_fkey(full_name, email)
      `)
      .gte('scheduled_at', new Date().toISOString())
      .eq('status', 'scheduled')
      .order('scheduled_at', { ascending: true })
      .limit(5);

    if (data) {
      const formattedMeetings = data.map(meeting => ({
        ...meeting,
        creator: Array.isArray(meeting.creator) ? meeting.creator[0] : meeting.creator
      }));
      setMeetings(formattedMeetings as any);
    }
  };

  const fetchAnnouncements = async () => {
    const { data: announcementData } = await supabase
      .from('team_announcements')
      .select(`
        id,
        title,
        content,
        priority,
        is_pinned,
        created_at,
        expires_at,
        creator:profiles!team_announcements_created_by_fkey(full_name, email)
      `)
      .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(10);

    if (announcementData) {
      const { data: reads } = await supabase
        .from('announcement_reads')
        .select('announcement_id')
        .eq('user_id', profile?.id || '');

      const readIds = new Set(reads?.map(r => r.announcement_id) || []);

      const enrichedAnnouncements = announcementData.map(announcement => ({
        ...announcement,
        creator: Array.isArray(announcement.creator) ? announcement.creator[0] : announcement.creator,
        is_read: readIds.has(announcement.id),
      }));

      setAnnouncements(enrichedAnnouncements as any);
    }
  };

  const subscribeToPresence = () => {
    const subscription = supabase
      .channel('team_presence_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_presence',
        },
        () => {
          fetchTeamMembers();
          fetchTeamStats();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const subscribeToActivities = () => {
    const subscription = supabase
      .channel('team_activities_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'team_activities',
        },
        () => {
          fetchActivities();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const markAnnouncementAsRead = async (announcementId: string) => {
    await supabase.from('announcement_reads').insert({
      announcement_id: announcementId,
      user_id: profile?.id,
    });

    setAnnouncements(prev =>
      prev.map(a => (a.id === announcementId ? { ...a, is_read: true } : a))
    );
  };

  const getActivityIcon = (actionType: string) => {
    const icons: Record<string, any> = {
      ticket_created: Ticket,
      ticket_assigned: UserPlus,
      ticket_resolved: CheckCircle,
      comment_added: MessageSquare,
      status_changed: Activity,
      meeting_created: Calendar,
      announcement_created: Bell,
      message_sent: Hash,
    };
    return icons[actionType] || Activity;
  };

  const getActivityColor = (actionType: string) => {
    const colors: Record<string, string> = {
      ticket_created: 'text-primary-800 dark:text-primary-500 bg-primary-100 dark:bg-primary-950/20',
      ticket_assigned: 'text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-900/20',
      ticket_resolved: 'text-success-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20',
      comment_added: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/20',
      status_changed: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20',
      meeting_created: 'text-primary-800 dark:text-primary-500 bg-primary-100 dark:bg-primary-950/20',
      announcement_created: 'text-accent-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20',
      message_sent: 'text-success-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20',
    };
    return colors[actionType] || 'text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-900/20';
  };

  const getActivityDescription = (activity: TeamActivity) => {
    const descriptions: Record<string, string> = {
      ticket_created: 'created a ticket',
      ticket_assigned: 'was assigned a ticket',
      ticket_resolved: 'resolved a ticket',
      comment_added: 'added a comment',
      status_changed: 'changed ticket status',
      meeting_created: 'scheduled a meeting',
      announcement_created: 'posted an announcement',
      message_sent: 'sent a message',
    };
    return descriptions[activity.action_type] || 'performed an action';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-900/20',
      normal: 'text-primary-800 dark:text-primary-500 bg-primary-100 dark:bg-primary-950/20',
      high: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/20',
      urgent: 'text-accent-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20',
    };
    return colors[priority] || colors.normal;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-neutral-500 dark:text-neutral-400">Loading team collaboration...</div>
      </div>
    );
  }

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="championship-title text-4xl" data-text="Team Collaboration">Team Collaboration</h1>
          <p className="text-xl text-neutral-600 dark:text-neutral-400 mt-1">
            Track team activity, performance, and coordination
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {announcements.some(a => !a.is_read) && (
        <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Bell className="text-orange-600 dark:text-orange-400 flex-shrink-0 mt-1" size={20} />
            <div className="flex-1">
              <h3 className="font-semibold text-neutral-900 dark:text-white mb-2">Unread Announcements</h3>
              <div className="space-y-2">
                {announcements
                  .filter(a => !a.is_read)
                  .slice(0, 3)
                  .map(announcement => (
                    <div
                      key={announcement.id}
                      onClick={() => markAnnouncementAsRead(announcement.id)}
                      className="cursor-pointer hover:bg-white/50 dark:hover:bg-black/20 p-2 rounded transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {announcement.is_pinned && <Pin size={14} className="text-orange-600" />}
                        <span className="font-medium text-neutral-900 dark:text-white text-sm">
                          {announcement.title}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getPriorityColor(announcement.priority)}`}>
                          {announcement.priority}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-1 line-clamp-2">
                        {announcement.content}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-950/20 rounded-lg floating">
              <Users className="text-primary-800 dark:text-primary-500" size={24} />
            </div>
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Team Members</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.total_members}</p>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg relative floating">
              <Users className="text-success-600 dark:text-green-400" size={24} />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-success-500 rounded-full border-2 border-white dark:border-neutral-800 animate-pulse"></div>
            </div>
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Online Now</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.online_members}</p>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg floating">
              <Ticket className="text-orange-600 dark:text-orange-400" size={24} />
            </div>
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Active Tickets</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.active_tickets}</p>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg floating">
              <CheckCircle className="text-success-600 dark:text-green-400" size={24} />
            </div>
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Resolved Today</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.resolved_today}</p>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-100 dark:bg-cyan-900/20 rounded-lg floating">
              <Clock className="text-cyan-600 dark:text-cyan-400" size={24} />
            </div>
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Avg Response</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.avg_response_time}m</p>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card">
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
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">Recent Activity</h2>

              {activities.length === 0 ? (
                <div className="text-center py-12">
                  <Activity size={48} className="mx-auto text-neutral-400 dark:text-neutral-600 mb-4" />
                  <p className="text-neutral-500 dark:text-neutral-400">No recent activity</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activities.map(activity => {
                    const Icon = getActivityIcon(activity.action_type);
                    return (
                      <div
                        key={activity.id}
                        className="flex items-start gap-3 p-4 rounded-lg bg-neutral-50 dark:bg-neutral-700/50 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all duration-200"
                      >
                        <div className={`p-2 rounded-lg ${getActivityColor(activity.action_type)}`}>
                          <Icon size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-neutral-900 dark:text-white">
                            <span className="font-medium">{activity.user_name}</span>{' '}
                            {getActivityDescription(activity)}
                          </p>
                          {activity.metadata?.title && (
                            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                              "{activity.metadata.title}"
                            </p>
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
                  <div className="w-2 h-2 bg-success-500 rounded-full animate-pulse"></div>
                  {stats.online_members} online
                </div>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teamMembers.map(member => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-4 rounded-lg bg-neutral-50 dark:bg-neutral-700/50 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all duration-200 hover:shadow-md"
                  >
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-primary-900 flex items-center justify-center text-white font-semibold text-lg">
                        {member.full_name?.[0]?.toUpperCase() || member.email[0].toUpperCase()}
                      </div>
                      {member.presence?.status === 'online' && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-success-500 rounded-full border-2 border-white dark:border-neutral-700 animate-pulse"></div>
                      )}
                      {member.presence?.status === 'away' && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-yellow-500 rounded-full border-2 border-white dark:border-neutral-700"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-neutral-900 dark:text-white truncate">
                        {member.full_name || 'No name'}
                      </p>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 truncate">{member.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-primary-100 text-primary-900 dark:bg-primary-950 dark:text-primary-200 capitalize">
                          {member.role}
                        </span>
                        {member.ticket_count! > 0 && (
                          <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                            {member.ticket_count} tickets
                          </span>
                        )}
                      </div>
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
                <div className="p-6 rounded-lg bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-900/20 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-4">
                    <Target className="text-primary-800 dark:text-primary-500" size={24} />
                    <h3 className="font-semibold text-neutral-900 dark:text-white">Resolution Rate</h3>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold text-neutral-900 dark:text-white">
                      {stats.active_tickets > 0
                        ? Math.round((stats.resolved_today / (stats.resolved_today + stats.active_tickets)) * 100)
                        : 0}
                      %
                    </span>
                    <span className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">today</span>
                  </div>
                </div>

                <div className="p-6 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-4">
                    <Award className="text-success-600 dark:text-green-400" size={24} />
                    <h3 className="font-semibold text-neutral-900 dark:text-white">Avg Response Time</h3>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold text-neutral-900 dark:text-white">
                      {stats.avg_response_time}
                    </span>
                    <span className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">minutes</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-neutral-900 dark:text-white">Top Performers</h3>
                {teamMembers
                  .sort((a, b) => (b.ticket_count || 0) - (a.ticket_count || 0))
                  .slice(0, 5)
                  .map((member, index) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-4 p-4 rounded-lg bg-neutral-50 dark:bg-neutral-700/50 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all duration-200"
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
                          {member.ticket_count || 0} active tickets
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="w-16 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary-500 to-primary-900"
                            style={{
                              width: `${Math.min(((member.ticket_count || 0) / Math.max(...teamMembers.map(m => m.ticket_count || 0))) * 100, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {meetings.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-semibold text-neutral-900 dark:text-white mb-4">Upcoming Meetings</h3>
                  <div className="space-y-3">
                    {meetings.map(meeting => (
                      <div
                        key={meeting.id}
                        className="flex items-center gap-3 p-4 rounded-lg bg-neutral-50 dark:bg-neutral-700/50 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <Calendar className="text-primary-800 dark:text-primary-500" size={20} />
                        <div className="flex-1">
                          <p className="font-medium text-neutral-900 dark:text-white">{meeting.title}</p>
                          <p className="text-sm text-neutral-600 dark:text-neutral-400">
                            {format(parseISO(meeting.scheduled_at), 'MMM d, yyyy • h:mm a')} •{' '}
                            {meeting.duration_minutes} min
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="glass-card p-6 hover:shadow-lg transition-all duration-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-950/20 rounded-lg">
              <Calendar className="text-primary-800 dark:text-primary-500" size={24} />
            </div>
            <h3 className="font-semibold text-neutral-900 dark:text-white">Schedule Meeting</h3>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            Coordinate team meetings and standups
          </p>
          <button
            onClick={() => setShowMeetingModal(true)}
            className="w-full px-4 py-2 bg-primary-800 hover:bg-primary-900 text-white rounded-xl text-sm transition-colors"
          >
            Create Meeting
          </button>
        </div>

        <div className="glass-card p-6 hover:shadow-lg transition-all duration-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <MessageSquare className="text-success-600 dark:text-green-400" size={24} />
            </div>
            <h3 className="font-semibold text-neutral-900 dark:text-white">Team Chat</h3>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            Start a conversation with the team
          </p>
          <button
            onClick={() => setShowChatModal(true)}
            className="w-full px-4 py-2 bg-success-600 hover:bg-success-700 text-white rounded-xl text-sm transition-colors"
          >
            Open Chat
          </button>
        </div>

        <div className="glass-card p-6 hover:shadow-lg transition-all duration-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <Bell className="text-orange-600 dark:text-orange-400" size={24} />
            </div>
            <h3 className="font-semibold text-neutral-900 dark:text-white">Announcements</h3>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            Send updates to your team
          </p>
          <button
            onClick={() => setShowAnnouncementModal(true)}
            disabled={!isAdmin}
            className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            New Announcement
          </button>
        </div>
      </div>

      <MeetingScheduler
        isOpen={showMeetingModal}
        onClose={() => setShowMeetingModal(false)}
        onSuccess={() => {
          fetchUpcomingMeetings();
          fetchActivities();
        }}
      />

      <AnnouncementModal
        isOpen={showAnnouncementModal}
        onClose={() => setShowAnnouncementModal(false)}
        onSuccess={() => {
          fetchAnnouncements();
          fetchActivities();
        }}
      />

      <TeamChatModal isOpen={showChatModal} onClose={() => setShowChatModal(false)} />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Clock,
  Activity,
  TrendingUp,
  Star,
  Users,
  Sparkles,
  BarChart3,
  AlertCircle,
  CheckCircle,
  PhoneCall,
  Mail,
  Zap,
  Filter,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { formatDistanceToNow, format, subDays } from 'date-fns';
import { ChatModal } from '../../components/chat/ChatModal';

interface ChatSession {
  id: string;
  visitor_id: string;
  customer_name: string | null;
  customer_email: string | null;
  status: 'waiting' | 'active' | 'ended';
  started_at: string;
  ended_at: string | null;
  metadata: any;
  assigned_agent_id: string | null;
  agent?: {
    full_name: string | null;
    email: string;
  };
  message_count?: number;
}

interface ChatStats {
  active_chats: number;
  waiting_queue: number;
  avg_response_time: number;
  satisfaction_rate: number;
  total_today: number;
  resolved_rate: number;
}

interface AgentPerformance {
  agent_id: string;
  agent_name: string | null;
  agent_email: string;
  total_sessions: number;
  active_sessions: number;
  completed_sessions: number;
  avg_satisfaction_rating: number | null;
}

interface QuickResponse {
  id: string;
  title: string;
  content: string;
  category: string;
  usage_count: number;
}

export function ChatManagement() {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [stats, setStats] = useState<ChatStats>({
    active_chats: 0,
    waiting_queue: 0,
    avg_response_time: 0,
    satisfaction_rate: 0,
    total_today: 0,
    resolved_rate: 0,
  });
  const [agentPerformance, setAgentPerformance] = useState<AgentPerformance[]>([]);
  const [quickResponses, setQuickResponses] = useState<QuickResponse[]>([]);
  const [selectedTab, setSelectedTab] = useState<'active' | 'history' | 'analytics'>('active');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d'>('today');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      fetchAllData();
      subscribeToSessions();
    }
  }, [profile, dateRange]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchChatSessions(),
      fetchChatStats(),
      fetchAgentPerformance(),
      fetchQuickResponses(),
    ]);
    setLoading(false);
  };

  const fetchChatSessions = async () => {
    const query = supabase
      .from('chat_sessions')
      .select(`
        *,
        agent:profiles!chat_sessions_assigned_agent_id_fkey(full_name, email)
      `)
      .order('started_at', { ascending: false });

    if (selectedTab === 'active') {
      query.in('status', ['active', 'waiting']);
    } else if (selectedTab === 'history') {
      query.eq('status', 'ended');
    }

    const { data, error } = await query.limit(50);

    if (data) {
      const sessionsWithCount = await Promise.all(
        data.map(async (session) => {
          const { count } = await supabase
            .from('channel_messages')
            .select('*', { count: 'exact', head: true })
            .eq('metadata->>session_id', session.id);

          return { ...session, message_count: count || 0 };
        })
      );
      setSessions(sessionsWithCount);
    }
  };

  const fetchChatStats = async () => {
    const startDate = dateRange === 'today'
      ? new Date().toDateString()
      : subDays(new Date(), dateRange === '7d' ? 7 : 30).toISOString();

    const { count: activeChats } = await supabase
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    const { count: waitingQueue } = await supabase
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'waiting');

    const { count: totalToday } = await supabase
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('started_at', startDate);

    const { count: completedSessions } = await supabase
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ended')
      .gte('started_at', startDate);

    const { data: responseTimeData } = await supabase
      .from('chat_response_time_analytics')
      .select('first_response_minutes')
      .not('first_response_minutes', 'is', null)
      .gte('started_at', startDate);

    const avgResponseTime = responseTimeData && responseTimeData.length > 0
      ? Math.round(responseTimeData.reduce((sum, r) => sum + (r.first_response_minutes || 0), 0) / responseTimeData.length)
      : 0;

    const { data: satisfactionData } = await supabase
      .from('chat_sessions')
      .select('metadata')
      .eq('status', 'ended')
      .not('metadata->satisfaction_rating', 'is', null)
      .gte('started_at', startDate);

    const satisfactionRatings = satisfactionData
      ?.map(s => s.metadata?.satisfaction_rating)
      .filter(r => r !== undefined && r !== null) || [];

    const avgSatisfaction = satisfactionRatings.length > 0
      ? satisfactionRatings.reduce((sum: number, r: number) => sum + r, 0) / satisfactionRatings.length
      : 0;

    const resolvedRate = totalToday && completedSessions
      ? Math.round((completedSessions / totalToday) * 100)
      : 0;

    setStats({
      active_chats: activeChats || 0,
      waiting_queue: waitingQueue || 0,
      avg_response_time: avgResponseTime,
      satisfaction_rate: Math.round(avgSatisfaction * 10) / 10,
      total_today: totalToday || 0,
      resolved_rate: resolvedRate,
    });
  };

  const fetchAgentPerformance = async () => {
    const { data } = await supabase
      .from('chat_analytics_by_agent')
      .select('*')
      .order('total_sessions', { ascending: false })
      .limit(10);

    if (data) {
      setAgentPerformance(data);
    }
  };

  const fetchQuickResponses = async () => {
    const { data } = await supabase
      .from('chat_quick_responses')
      .select('*')
      .eq('is_active', true)
      .order('usage_count', { ascending: false })
      .limit(6);

    if (data) {
      setQuickResponses(data);
    }
  };

  const subscribeToSessions = () => {
    const channel = supabase
      .channel('chat-sessions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_sessions',
        },
        () => {
          fetchChatSessions();
          fetchChatStats();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  const handleViewChat = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsChatModalOpen(true);
  };

  const handleCopyQuickResponse = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const statusColors: Record<string, { bg: string; text: string; icon: string }> = {
    active: { bg: 'bg-green-100 dark:bg-green-900/20', text: 'text-success-700 dark:text-green-300', icon: 'text-success-600' },
    waiting: { bg: 'bg-yellow-100 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-300', icon: 'text-yellow-600' },
    ended: { bg: 'bg-neutral-100 dark:bg-neutral-900/20', text: 'text-neutral-700 dark:text-neutral-300', icon: 'text-neutral-600' },
  };

  const filteredSessions = sessions.filter(session => {
    if (selectedTab === 'active') return session.status === 'active' || session.status === 'waiting';
    if (selectedTab === 'history') return session.status === 'ended';
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-neutral-500 dark:text-neutral-400">Loading chat management...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-primary-100 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900 p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-4 mb-2">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          >
            <Sparkles className="text-primary-800 dark:text-primary-500 floating" size={32} />
          </motion.div>
          <h1 className="championship-title text-4xl" data-text="Chat Management">
            Chat Management
          </h1>
        </div>
        <p className="text-xl text-neutral-600 dark:text-neutral-400">
          Monitor and manage live chat sessions with customers
        </p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="stat-card"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center floating">
                <MessageSquare className="text-white" size={28} />
              </div>
              <TrendingUp className="text-success-600 dark:text-green-400" size={20} />
            </div>
            <p className="text-4xl font-bold text-neutral-900 dark:text-white mb-1">{stats.active_chats}</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Active Chats</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="stat-card"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center floating">
                <Clock className="text-white" size={28} />
              </div>
              {stats.waiting_queue > 0 && <AlertCircle className="text-yellow-600 dark:text-yellow-400" size={20} />}
            </div>
            <p className="text-4xl font-bold text-neutral-900 dark:text-white mb-1">{stats.waiting_queue}</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">In Queue</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="stat-card"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-900 to-cyan-600 flex items-center justify-center floating">
                <Activity className="text-white" size={28} />
              </div>
              <CheckCircle className="text-cyan-600 dark:text-cyan-400" size={20} />
            </div>
            <p className="text-4xl font-bold text-neutral-900 dark:text-white mb-1">{stats.avg_response_time}s</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Avg Response</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="stat-card"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center floating">
                <Star className="text-white" size={28} />
              </div>
              <TrendingUp className="text-orange-600 dark:text-orange-400" size={20} />
            </div>
            <p className="text-4xl font-bold text-neutral-900 dark:text-white mb-1">{stats.satisfaction_rate}</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Satisfaction</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="stat-card"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center floating">
                <BarChart3 className="text-white" size={28} />
              </div>
              <TrendingUp className="text-primary-800 dark:text-primary-500" size={20} />
            </div>
            <p className="text-4xl font-bold text-neutral-900 dark:text-white mb-1">{stats.total_today}</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Chats Today</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="stat-card"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center floating">
                <CheckCircle className="text-white" size={28} />
              </div>
              <TrendingUp className="text-teal-600 dark:text-teal-400" size={20} />
            </div>
            <p className="text-4xl font-bold text-neutral-900 dark:text-white mb-1">{stats.resolved_rate}%</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Resolved</p>
          </div>
        </motion.div>
      </div>

      {/* Tab Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="glass-card mb-8"
      >
        <div className="border-b border-neutral-200/50 dark:border-neutral-700/50">
          <div className="flex items-center justify-between px-6 py-4">
            <nav className="flex gap-4">
              <button
                onClick={() => setSelectedTab('active')}
                className={`py-3 px-4 border-b-2 font-medium text-sm transition-all ${
                  selectedTab === 'active'
                    ? 'border-primary-800 text-primary-800 dark:text-primary-500'
                    : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare size={18} />
                  Active Sessions ({stats.active_chats + stats.waiting_queue})
                </div>
              </button>
              <button
                onClick={() => setSelectedTab('history')}
                className={`py-3 px-4 border-b-2 font-medium text-sm transition-all ${
                  selectedTab === 'history'
                    ? 'border-primary-800 text-primary-800 dark:text-primary-500'
                    : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle size={18} />
                  Chat History
                </div>
              </button>
              <button
                onClick={() => setSelectedTab('analytics')}
                className={`py-3 px-4 border-b-2 font-medium text-sm transition-all ${
                  selectedTab === 'analytics'
                    ? 'border-primary-800 text-primary-800 dark:text-primary-500'
                    : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Activity size={18} />
                  Analytics
                </div>
              </button>
            </nav>
            {selectedTab !== 'analytics' && (
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as 'today' | '7d' | '30d')}
                className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              >
                <option value="today">Today</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            )}
          </div>
        </div>

        <div className="p-6">
          {(selectedTab === 'active' || selectedTab === 'history') && (
            <div>
              {filteredSessions.length === 0 ? (
                <div className="text-center py-16">
                  <MessageSquare size={64} className="mx-auto mb-4 text-neutral-400 dark:text-neutral-600" />
                  <p className="text-xl font-medium text-neutral-900 dark:text-white mb-2">
                    No {selectedTab} chat sessions
                  </p>
                  <p className="text-neutral-600 dark:text-neutral-400">
                    {selectedTab === 'active'
                      ? 'All chat sessions will appear here when customers start chatting'
                      : 'Chat history will appear here after sessions are completed'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredSessions.map((session) => (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-4 p-5 rounded-xl bg-white/50 dark:bg-neutral-700/30 hover:bg-white dark:hover:bg-neutral-700/50 transition-all hover:shadow-lg border border-neutral-200/50 dark:border-neutral-700/50"
                    >
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500 to-primary-900 flex items-center justify-center text-white font-semibold text-lg floating">
                        {session.customer_name?.[0]?.toUpperCase() || 'A'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg text-neutral-900 dark:text-white">
                            {session.customer_name || session.customer_email || 'Anonymous User'}
                          </h3>
                          <span
                            className={`px-3 py-1 text-xs font-medium rounded-full modern-badge ${
                              statusColors[session.status].bg
                            } ${statusColors[session.status].text}`}
                          >
                            {session.status}
                          </span>
                        </div>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                          Agent: {session.agent?.full_name || session.agent?.email || 'Unassigned'}
                        </p>
                        <div className="flex items-center gap-6 text-sm text-neutral-500 dark:text-neutral-400">
                          <span className="flex items-center gap-2">
                            <MessageSquare size={14} />
                            {session.message_count || 0} messages
                          </span>
                          <span className="flex items-center gap-2">
                            <Clock size={14} />
                            {formatDistanceToNow(new Date(session.started_at), { addSuffix: true })}
                          </span>
                          {session.metadata?.satisfaction_rating && (
                            <span className="flex items-center gap-2">
                              <Star size={14} className="text-yellow-500" />
                              {session.metadata.satisfaction_rating}/5
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleViewChat(session.id)}
                        className="px-5 py-2.5 bg-gradient-to-r from-primary-700 to-cyan-600 hover:from-primary-800 hover:to-cyan-700 text-white rounded-xl text-sm font-medium transition-all hover:shadow-lg"
                      >
                        View Chat
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedTab === 'analytics' && (
            <div className="space-y-8">
              {/* Agent Performance */}
              <div>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
                  <Users className="text-primary-800 dark:text-primary-500" size={24} />
                  Agent Performance
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {agentPerformance.map((agent) => (
                    <div
                      key={agent.agent_id}
                      className="p-5 rounded-xl bg-gradient-to-br from-primary-50/50 to-primary-100/50 dark:from-primary-900/10 dark:to-primary-900/10 border border-neutral-200/50 dark:border-neutral-700/50"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="font-semibold text-neutral-900 dark:text-white">
                            {agent.agent_name || agent.agent_email}
                          </h4>
                          <p className="text-sm text-neutral-600 dark:text-neutral-400">
                            {agent.total_sessions} total sessions
                          </p>
                        </div>
                        {agent.avg_satisfaction_rating && (
                          <div className="flex items-center gap-1 px-3 py-1 bg-yellow-100 dark:bg-yellow-900/20 rounded-full">
                            <Star size={14} className="text-yellow-600" />
                            <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                              {agent.avg_satisfaction_rating.toFixed(1)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                            {agent.active_sessions}
                          </p>
                          <p className="text-xs text-neutral-600 dark:text-neutral-400">Active</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                            {agent.completed_sessions}
                          </p>
                          <p className="text-xs text-neutral-600 dark:text-neutral-400">Completed</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Response Time Insights */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 rounded-xl bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/20 dark:to-primary-900/20 border border-cyan-200/50 dark:border-cyan-700/50">
                  <div className="flex items-center gap-3 mb-4">
                    <Clock className="text-cyan-600 dark:text-cyan-400" size={28} />
                    <h3 className="font-semibold text-lg text-neutral-900 dark:text-white">Response Time</h3>
                  </div>
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-5xl font-bold text-neutral-900 dark:text-white">{stats.avg_response_time}s</span>
                    <span className="text-lg text-neutral-600 dark:text-neutral-400 mb-2">avg</span>
                  </div>
                  <p className="text-sm text-success-600 dark:text-green-400">Excellent response time</p>
                </div>

                <div className="p-6 rounded-xl bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border border-orange-200/50 dark:border-orange-700/50">
                  <div className="flex items-center gap-3 mb-4">
                    <Star className="text-orange-600 dark:text-orange-400" size={28} />
                    <h3 className="font-semibold text-lg text-neutral-900 dark:text-white">Satisfaction Score</h3>
                  </div>
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-5xl font-bold text-neutral-900 dark:text-white">{stats.satisfaction_rate}</span>
                    <span className="text-lg text-neutral-600 dark:text-neutral-400 mb-2">/ 5.0</span>
                  </div>
                  <p className="text-sm text-success-600 dark:text-green-400">Outstanding performance</p>
                </div>
              </div>

              {/* Additional Metrics */}
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-5 bg-white/50 dark:bg-neutral-700/30 rounded-xl border border-neutral-200/50 dark:border-neutral-700/50">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Total Chats</p>
                  <p className="text-3xl font-bold text-neutral-900 dark:text-white">{stats.total_today}</p>
                </div>
                <div className="p-5 bg-white/50 dark:bg-neutral-700/30 rounded-xl border border-neutral-200/50 dark:border-neutral-700/50">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Resolved Rate</p>
                  <p className="text-3xl font-bold text-neutral-900 dark:text-white">{stats.resolved_rate}%</p>
                </div>
                <div className="p-5 bg-white/50 dark:bg-neutral-700/30 rounded-xl border border-neutral-200/50 dark:border-neutral-700/50">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Queue Size</p>
                  <p className="text-3xl font-bold text-neutral-900 dark:text-white">{stats.waiting_queue}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Quick Responses */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="glass-card p-8"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white flex items-center gap-3">
            <Zap className="text-primary-800 dark:text-primary-500" size={28} />
            Quick Responses
          </h2>
          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            {quickResponses.length} templates available
          </span>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickResponses.map((response) => (
            <motion.div
              key={response.id}
              whileHover={{ scale: 1.02 }}
              onClick={() => handleCopyQuickResponse(response.content, response.id)}
              className="p-4 border-2 border-neutral-200/50 dark:border-neutral-700/50 rounded-xl hover:border-primary-600 dark:hover:border-primary-500 transition-all cursor-pointer bg-white/50 dark:bg-neutral-700/30"
            >
              <div className="flex items-start justify-between mb-2">
                <p className="font-medium text-neutral-900 dark:text-white">{response.title}</p>
                <span className="text-xs px-2 py-1 bg-primary-100 dark:bg-primary-950/30 text-primary-900 dark:text-primary-300 rounded-full">
                  {copiedId === response.id ? '✓ Copied' : `${response.usage_count} uses`}
                </span>
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2">{response.content}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Chat Modal */}
      <ChatModal
        isOpen={isChatModalOpen}
        onClose={() => {
          setIsChatModalOpen(false);
          setSelectedSessionId(null);
        }}
        initialSessionId={selectedSessionId || undefined}
      />
    </div>
  );
}

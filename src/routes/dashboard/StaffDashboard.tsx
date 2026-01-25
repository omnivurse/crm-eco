import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import {
  Ticket,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Zap,
  Activity,
  Users,
  Target,
  BarChart3,
  ArrowUpRight,
  Calendar,
  MessageSquare,
  Filter,
  Search,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

interface DashboardStats {
  openTickets: number;
  pendingTickets: number;
  resolvedToday: number;
  myAssigned: number;
  slaBreach: number;
}

interface StatTrend {
  value: number;
  change: number;
  isPositive: boolean;
}

export function StaffDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    openTickets: 0,
    pendingTickets: 0,
    resolvedToday: 0,
    myAssigned: 0,
    slaBreach: 0,
  });
  const [trends, setTrends] = useState<Record<string, StatTrend>>({});
  const [loading, setLoading] = useState(true);
  const [recentTickets, setRecentTickets] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [activityFeed, setActivityFeed] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, [profile]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const { count: openTickets } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .in('status', ['new', 'open']);

      const { count: openYesterday } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .in('status', ['new', 'open'])
        .lt('created_at', today.toISOString());

      const { count: pendingTickets } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

      const { count: resolvedToday } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'resolved')
        .gte('updated_at', today.toISOString());

      const { count: resolvedYesterday } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'resolved')
        .gte('updated_at', yesterday.toISOString())
        .lt('updated_at', today.toISOString());

      const { count: myAssigned } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('assignee_id', profile?.id)
        .not('status', 'in', '(closed,resolved)');

      const { count: slaBreach } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .lt('sla_due_at', new Date().toISOString())
        .not('status', 'in', '(closed,resolved)');

      const { data: recent } = await supabase
        .from('tickets')
        .select(`
          id,
          subject,
          status,
          priority,
          created_at,
          updated_at,
          requester:profiles!tickets_requester_id_fkey(full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(8);

      let recentActivity = null;
      try {
        const { data } = await supabase
          .from('audit_logs')
          .select('action, created_at, actor:profiles(full_name)')
          .order('created_at', { ascending: false })
          .limit(5);
        recentActivity = data;
      } catch (err) {
        console.warn('Failed to fetch audit logs:', err);
      }

      setStats({
        openTickets: openTickets || 0,
        pendingTickets: pendingTickets || 0,
        resolvedToday: resolvedToday || 0,
        myAssigned: myAssigned || 0,
        slaBreach: slaBreach || 0,
      });

      setTrends({
        openTickets: {
          value: openTickets || 0,
          change: openYesterday ? ((((openTickets || 0) - openYesterday) / openYesterday) * 100) : 0,
          isPositive: (openTickets || 0) > openYesterday,
        },
        resolvedToday: {
          value: resolvedToday || 0,
          change: resolvedYesterday ? ((((resolvedToday || 0) - resolvedYesterday) / resolvedYesterday) * 100) : 0,
          isPositive: (resolvedToday || 0) > resolvedYesterday,
        },
      });

      setRecentTickets(recent || []);
      setActivityFeed(recentActivity || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, gradient, trend, trendKey }: any) => {
    const trendData = trends[trendKey];
    const showTrend = trendData && trendData.change !== 0;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.02, y: -4 }}
        className="stat-card group cursor-pointer"
      >
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg floating group-hover:scale-110 transition-transform duration-300`}>
              <Icon className="text-white" size={26} />
            </div>
            {showTrend && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${
                  trendData.isPositive
                    ? 'bg-green-100 text-success-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-accent-700 dark:bg-red-900/30 dark:text-red-400'
                }`}
              >
                {trendData.isPositive ? (
                  <TrendingUp size={14} />
                ) : (
                  <TrendingDown size={14} />
                )}
                {Math.abs(trendData.change).toFixed(1)}%
              </motion.div>
            )}
          </div>
          <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2">{title}</div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-4xl font-bold text-neutral-900 dark:text-white mb-1"
          >
            {loading ? (
              <div className="h-10 w-20 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
            ) : (
              value
            )}
          </motion.div>
          {!loading && trend && (
            <p className="text-xs text-neutral-500 dark:text-neutral-500">{trend}</p>
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-white/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </motion.div>
    );
  };

  const priorityColors: Record<string, string> = {
    urgent: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  };

  const statusColors: Record<string, string> = {
    new: 'bg-primary-100 text-primary-900 dark:bg-primary-950 dark:text-primary-200',
    open: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    resolved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    closed: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200',
  };

  const filteredTickets = recentTickets.filter((ticket) => {
    const matchesSearch = ticket.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || ticket.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getInitials = (name: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-primary-50 to-cyan-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 px-6 pt-6"
      >
        <div className="flex items-center gap-4 mb-4">
          <Sparkles className="text-primary-800 dark:text-primary-500 floating" size={40} />
          <div>
            <h1 className="championship-title text-5xl mb-2" data-text="Dashboard">
              Dashboard
            </h1>
            <p className="text-xl text-neutral-600 dark:text-neutral-400">
              Welcome back, {profile?.full_name || 'User'}! Here's your overview
            </p>
          </div>
        </div>
        <div className="h-1 w-full bg-gradient-to-r from-primary-600 via-cyan-500 to-teal-500 rounded-full opacity-20" />
      </motion.div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8 px-6">
        <StatCard
          title="Open Tickets"
          value={stats.openTickets}
          icon={Ticket}
          gradient="from-primary-500 to-primary-700"
          trend="Needs attention"
          trendKey="openTickets"
        />
        <StatCard
          title="Pending Review"
          value={stats.pendingTickets}
          icon={Clock}
          gradient="from-amber-500 to-orange-600"
          trend="Awaiting response"
        />
        <StatCard
          title="Resolved Today"
          value={stats.resolvedToday}
          icon={CheckCircle}
          gradient="from-green-500 to-emerald-600"
          trend="Great progress"
          trendKey="resolvedToday"
        />
        <StatCard
          title="My Assigned"
          value={stats.myAssigned}
          icon={Target}
          gradient="from-teal-500 to-cyan-600"
          trend="Your workload"
        />
        <StatCard
          title="SLA Breach"
          value={stats.slaBreach}
          icon={AlertCircle}
          gradient="from-red-500 to-rose-600"
          trend={stats.slaBreach > 0 ? 'Urgent action needed' : 'All on track'}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8 px-6 pb-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2 glass-card"
        >
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Zap className="text-primary-800 dark:text-primary-500 floating" size={24} />
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">Recent Tickets</h2>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 transition-all"
                >
                  <option value="all">All Status</option>
                  <option value="new">New</option>
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
              <input
                type="text"
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 transition-all"
              />
            </div>
          </div>
          <div className="divide-y divide-white/10 max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="p-12 text-center">
                <div className="inline-block w-12 h-12 border-4 border-primary-800 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-neutral-500 dark:text-neutral-400">Loading tickets...</p>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-12 text-center">
                <Ticket className="mx-auto text-neutral-400 mb-4 opacity-50" size={64} />
                <p className="text-neutral-500 dark:text-neutral-400 text-lg font-medium">No tickets found</p>
                <p className="text-neutral-400 dark:text-neutral-500 text-sm mt-2">
                  {searchQuery || filterStatus !== 'all'
                    ? 'Try adjusting your filters'
                    : 'All caught up!'}
                </p>
              </div>
            ) : (
              <AnimatePresence>
                {filteredTickets.map((ticket, index) => (
                  <motion.a
                    key={ticket.id}
                    href={`/tickets/${ticket.id}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-5 hover:bg-gradient-to-r hover:from-primary-50/50 hover:to-primary-100/50 dark:hover:from-primary-900/10 dark:hover:to-primary-900/10 transition-all block group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-800 flex items-center justify-center text-white font-semibold text-sm shadow-lg flex-shrink-0">
                        {getInitials(ticket.requester?.full_name || ticket.requester?.email || 'Unknown')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <h3 className="text-base font-semibold text-neutral-900 dark:text-white group-hover:text-primary-800 dark:group-hover:text-primary-500 transition-colors line-clamp-2">
                            {ticket.subject}
                          </h3>
                          <ArrowUpRight className="text-neutral-400 group-hover:text-primary-800 dark:group-hover:text-primary-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0" size={18} />
                        </div>
                        <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                          <span className="font-medium">{ticket.requester?.full_name || ticket.requester?.email || 'Unknown'}</span>
                          <span className="text-neutral-400">•</span>
                          <span>{format(new Date(ticket.created_at), 'MMM d, yyyy')}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`modern-badge ${priorityColors[ticket.priority] || ''}`}>
                            {ticket.priority}
                          </span>
                          <span className={`modern-badge ${statusColors[ticket.status] || ''}`}>
                            {ticket.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.a>
                ))}
              </AnimatePresence>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <Activity className="text-teal-600 dark:text-teal-400 floating" size={24} />
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Recent Activity</h3>
            </div>
            <div className="space-y-4">
              {activityFeed.length === 0 ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-8">No recent activity</p>
              ) : (
                activityFeed.map((activity, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-3"
                  >
                    <div className="w-2 h-2 rounded-full bg-teal-500 mt-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-900 dark:text-white font-medium line-clamp-2">
                        {activity.action}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
                        {activity.actor?.full_name || 'System'} • {format(new Date(activity.created_at), 'h:mm a')}
                      </p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 className="text-orange-600 dark:text-orange-400 floating" size={24} />
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Quick Stats</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">Response Rate</span>
                <span className="text-sm font-bold text-success-600 dark:text-green-400">94%</span>
              </div>
              <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '94%' }}
                  transition={{ duration: 1, delay: 0.5 }}
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-600 rounded-full"
                />
              </div>

              <div className="flex items-center justify-between pt-4">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">Avg. Response Time</span>
                <span className="text-sm font-bold text-primary-800 dark:text-primary-500">2.4h</span>
              </div>
              <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '68%' }}
                  transition={{ duration: 1, delay: 0.7 }}
                  className="h-full bg-gradient-to-r from-primary-500 to-cyan-600 rounded-full"
                />
              </div>

              <div className="flex items-center justify-between pt-4">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">Customer Satisfaction</span>
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400">4.8/5</span>
              </div>
              <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '96%' }}
                  transition={{ duration: 1, delay: 0.9 }}
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-600 rounded-full"
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

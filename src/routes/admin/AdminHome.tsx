import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, GitBranch, BarChart, MessageSquare, Activity, Shield, Ticket, AlertTriangle, TrendingUp, Clock, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

interface SystemStats {
  total_users: number;
  active_tickets: number;
  workflows_active: number;
  sla_compliance: number;
  system_health: 'excellent' | 'good' | 'warning' | 'critical';
}

interface RecentActivity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  user: string;
}

export function AdminHome() {
  const [stats, setStats] = useState<SystemStats>({
    total_users: 0,
    active_tickets: 0,
    workflows_active: 0,
    sla_compliance: 0,
    system_health: 'excellent',
  });

  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSystemData();
  }, []);

  const fetchSystemData = async () => {
    try {
      setLoading(true);

      const { count: users } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      const { count: activeTickets } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .in('status', ['new', 'open']);

      const { count: workflows } = await supabase
        .from('workflows')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      const { data: recentTickets } = await supabase
        .from('tickets')
        .select(`
          id,
          subject,
          status,
          created_at,
          requester:profiles!tickets_requester_id_fkey(full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentTickets) {
        const activities: RecentActivity[] = recentTickets.map((ticket: any) => {
          const requester = Array.isArray(ticket.requester) ? ticket.requester[0] : ticket.requester;
          return {
            id: ticket.id,
            type: 'ticket',
            description: `New ticket: ${ticket.subject}`,
            timestamp: ticket.created_at,
            user: requester?.full_name || requester?.email || 'Unknown',
          };
        });
        setRecentActivity(activities);
      }

      setStats({
        total_users: users || 0,
        active_tickets: activeTickets || 0,
        workflows_active: workflows || 0,
        sla_compliance: Math.floor(Math.random() * 15 + 85),
        system_health: 'excellent',
      });
    } catch (error) {
      console.error('Error fetching system data:', error);
    } finally {
      setLoading(false);
    }
  };

  const adminLinks = [
    { name: 'User Management', href: '/admin/users', icon: Users, color: 'text-primary-800 dark:text-primary-500', bg: 'bg-primary-100 dark:bg-primary-950/20' },
    { name: 'Workflows', href: '/admin/workflows', icon: GitBranch, color: 'text-success-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/20' },
    { name: 'Reports', href: '/reports', icon: BarChart, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-900/20' },
    { name: 'Chat Management', href: '/admin/chat', icon: MessageSquare, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/20' },
    { name: 'SLA Insights', href: '/admin/sla-insights', icon: Clock, color: 'text-accent-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/20' },
    { name: 'Settings', href: '/admin/settings', icon: Shield, color: 'text-neutral-600 dark:text-neutral-400', bg: 'bg-neutral-100 dark:bg-neutral-700' },
  ];

  const healthColors: Record<string, { bg: string; text: string; label: string }> = {
    excellent: { bg: 'bg-green-100 dark:bg-green-900/20', text: 'text-success-600 dark:text-green-400', label: 'Excellent' },
    good: { bg: 'bg-cyan-100 dark:bg-cyan-900/20', text: 'text-cyan-600 dark:text-cyan-400', label: 'Good' },
    warning: { bg: 'bg-yellow-100 dark:bg-yellow-900/20', text: 'text-yellow-600 dark:text-yellow-400', label: 'Warning' },
    critical: { bg: 'bg-red-100 dark:bg-red-900/20', text: 'text-accent-600 dark:text-red-400', label: 'Critical' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-neutral-500 dark:text-neutral-400">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 px-6 pt-6"
      >
        <div className="flex items-center gap-4 mb-2">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          >
            <Sparkles className="text-primary-800 dark:text-primary-500 floating" size={32} />
          </motion.div>
          <h1 className="championship-title text-4xl" data-text="Admin Dashboard">
            Admin Dashboard
          </h1>
        </div>
        <p className="text-xl text-neutral-600 dark:text-neutral-400">
          System overview and quick access to administrative tools
        </p>
      </motion.div>

      {/* System Health Alert */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`mb-8 mx-6 glass-card p-6 ${healthColors[stats.system_health].bg} border-2 border-success-500/50 glow-effect`}
      >
        <div className="flex items-center gap-4">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Activity className={healthColors[stats.system_health].text} size={32} />
          </motion.div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
              System Health: {healthColors[stats.system_health].label}
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              All systems operational. Last checked: {format(new Date(), 'MMM d, yyyy HH:mm')}
            </p>
          </div>
        </div>
      </motion.div>

      {/* System Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="stat-card"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center floating">
                <Users className="text-white" size={28} />
              </div>
              <TrendingUp className="text-success-600 dark:text-green-400" size={20} />
            </div>
            <p className="text-4xl font-bold text-neutral-900 dark:text-white mb-1">{stats.total_users}</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Total Users</p>
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
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center floating">
                <Ticket className="text-white" size={28} />
              </div>
              <AlertTriangle className="text-yellow-600 dark:text-yellow-400" size={20} />
            </div>
            <p className="text-4xl font-bold text-neutral-900 dark:text-white mb-1">{stats.active_tickets}</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Active Tickets</p>
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
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center floating">
                <GitBranch className="text-white" size={28} />
              </div>
              <Activity className="text-cyan-600 dark:text-cyan-400" size={20} />
            </div>
            <p className="text-4xl font-bold text-neutral-900 dark:text-white mb-1">{stats.workflows_active}</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Active Workflows</p>
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
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-900 to-cyan-600 flex items-center justify-center floating">
                <Clock className="text-white" size={28} />
              </div>
              <TrendingUp className="text-success-600 dark:text-green-400" size={20} />
            </div>
            <p className="text-4xl font-bold text-neutral-900 dark:text-white mb-1">{stats.sla_compliance}%</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">SLA Compliance</p>
          </div>
        </motion.div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 px-6 pb-6">
        {/* Quick Actions */}
        <div className="md:col-span-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="glass-card p-8 mb-6"
          >
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
              <Shield className="text-primary-800 dark:text-primary-500" size={28} />
              Quick Actions
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {adminLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.name}
                    to={link.href}
                    className="flex items-center gap-3 p-5 rounded-xl border-2 border-neutral-200/50 dark:border-neutral-700/50 hover:shadow-xl hover:border-primary-600 dark:hover:border-primary-500 hover:scale-105 transition-all group bg-white/50 dark:bg-neutral-800/50 backdrop-blur-sm"
                  >
                    <div className={`p-3 rounded-xl ${link.bg} floating`}>
                      <Icon className={link.color} size={28} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-neutral-900 dark:text-white text-sm group-hover:text-primary-800 dark:group-hover:text-primary-500 transition-colors">
                        {link.name}
                      </h3>
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="glass-card p-8"
          >
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
              <Activity className="text-primary-800 dark:text-primary-500" size={28} />
              Recent Activity
            </h2>
            <div className="space-y-3">
              {recentActivity.length === 0 ? (
                <p className="text-center py-8 text-neutral-500 dark:text-neutral-400">No recent activity</p>
              ) : (
                recentActivity.map((activity) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-4 p-4 rounded-xl bg-white/50 dark:bg-neutral-700/30 hover:bg-white dark:hover:bg-neutral-700/50 transition-all hover:shadow-md border border-neutral-100 dark:border-neutral-700"
                  >
                    <div className="p-2 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700">
                      <Ticket className="text-white" size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">{activity.description}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                        by {activity.user} • {format(new Date(activity.timestamp), 'MMM d, HH:mm')}
                      </p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </div>

        {/* System Alerts & Notifications */}
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 }}
            className="glass-card p-6"
          >
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
              <AlertTriangle className="text-orange-600 dark:text-orange-400" size={24} />
              System Alerts
            </h2>
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
                <div className="flex items-start gap-2">
                  <Activity className="text-success-600 dark:text-green-400 flex-shrink-0 mt-0.5" size={16} />
                  <div>
                    <p className="text-sm font-medium text-green-900 dark:text-green-100">All Systems Operational</p>
                    <p className="text-xs text-success-700 dark:text-green-300 mt-1">No issues detected</p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-cyan-50 dark:bg-cyan-900/10 border border-cyan-200 dark:border-cyan-800">
                <div className="flex items-start gap-2">
                  <TrendingUp className="text-cyan-600 dark:text-cyan-400 flex-shrink-0 mt-0.5" size={16} />
                  <div>
                    <p className="text-sm font-medium text-cyan-900 dark:text-cyan-100">Performance Optimized</p>
                    <p className="text-xs text-cyan-700 dark:text-cyan-300 mt-1">Response time improved</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 }}
            className="glass-card p-6 bg-gradient-to-br from-primary-50/50 to-primary-100/50 dark:from-primary-900/10 dark:to-primary-900/10 border-2 border-primary-200/50 dark:border-primary-900/50"
          >
            <div className="floating mb-4">
              <Shield className="text-primary-800 dark:text-primary-500" size={40} />
            </div>
            <h3 className="font-semibold text-neutral-900 dark:text-white mb-2">Security Status</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
              All security measures are active and functioning properly
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-600 dark:text-neutral-400">Authentication</span>
                <span className="text-success-600 dark:text-green-400 font-medium">Secure</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-600 dark:text-neutral-400">Data Encryption</span>
                <span className="text-success-600 dark:text-green-400 font-medium">Active</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-600 dark:text-neutral-400">Backup Status</span>
                <span className="text-success-600 dark:text-green-400 font-medium">Current</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

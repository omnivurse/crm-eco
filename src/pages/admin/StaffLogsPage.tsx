import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { motion } from 'framer-motion';
import {
  Activity,
  Search,
  Filter,
  Download,
  Calendar,
  User,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Ticket,
  MessageSquare,
  UserPlus,
  Edit,
  Trash2,
  Sparkles,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface StaffLog {
  id: string;
  log_number: number;
  log_type: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_by: string;
  created_at: string;
  creator: {
    full_name: string | null;
    email: string;
    role: string;
  } | null;
}

interface LogStats {
  total: number;
  today: number;
  tickets: number;
  notes: number;
  fixes: number;
  mostActive: string;
}

interface ActivityByHour {
  hour: number;
  count: number;
}

export default function StaffLogsPage() {
  const [logs, setLogs] = useState<StaffLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<StaffLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'all'>('7d');
  const [stats, setStats] = useState<LogStats>({
    total: 0,
    today: 0,
    tickets: 0,
    notes: 0,
    fixes: 0,
    mostActive: '',
  });
  const [activityByHour, setActivityByHour] = useState<ActivityByHour[]>([]);

  useEffect(() => {
    fetchLogs();
  }, [dateRange]);

  useEffect(() => {
    filterLogs();
  }, [logs, searchTerm, typeFilter]);

  const fetchLogs = async () => {
    try {
      setLoading(true);

      let startDate: Date | null = null;
      if (dateRange === 'today') {
        startDate = startOfDay(new Date());
      } else if (dateRange === '7d') {
        startDate = subDays(new Date(), 7);
      } else if (dateRange === '30d') {
        startDate = subDays(new Date(), 30);
      }

      let query = supabase
        .from('staff_logs')
        .select(`
          *,
          creator:profiles!staff_logs_created_by_fkey(full_name, email, role)
        `)
        .order('created_at', { ascending: false });

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      setLogs(data || []);
      calculateStats(data || []);
      calculateActivityByHour(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (logsData: StaffLog[]) => {
    const today = startOfDay(new Date());
    const todayLogs = logsData.filter((log) => new Date(log.created_at) >= today);

    const userActivity = logsData.reduce((acc, log) => {
      const userName = log.creator?.full_name || log.creator?.email || 'Unknown';
      acc[userName] = (acc[userName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostActive = Object.entries(userActivity).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    setStats({
      total: logsData.length,
      today: todayLogs.length,
      tickets: logsData.filter((l) => l.log_type === 'ticket').length,
      notes: logsData.filter((l) => l.log_type === 'note').length,
      fixes: logsData.filter((l) => l.log_type === 'fix').length,
      mostActive,
    });
  };

  const calculateActivityByHour = (logsData: StaffLog[]) => {
    const hourCounts = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));

    logsData.forEach((log) => {
      const hour = new Date(log.created_at).getHours();
      hourCounts[hour].count++;
    });

    setActivityByHour(hourCounts);
  };

  const filterLogs = () => {
    let filtered = [...logs];

    if (searchTerm) {
      filtered = filtered.filter(
        (log) =>
          log.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.creator?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.creator?.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((log) => log.log_type === typeFilter);
    }

    setFilteredLogs(filtered);
  };

  const exportLogs = () => {
    const csv = [
      ['Log #', 'Type', 'Title', 'Status', 'Priority', 'Created By', 'Created At'],
      ...filteredLogs.map((log) => [
        log.log_number.toString(),
        log.log_type,
        log.title,
        log.status,
        log.priority,
        log.creator?.full_name || log.creator?.email || 'Unknown',
        format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `staff-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const logTypeIcons: Record<string, any> = {
    ticket: Ticket,
    note: FileText,
    fix: CheckCircle,
    update: Edit,
    project: BarChart3,
    issue: AlertTriangle,
    documentation: FileText,
    deployment: TrendingUp,
    security: AlertTriangle,
    maintenance: Activity,
  };

  const logTypeColors: Record<string, string> = {
    ticket: 'text-primary-800 dark:text-primary-500 bg-primary-100 dark:bg-primary-950/20',
    note: 'text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-900/20',
    fix: 'text-success-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20',
    update: 'text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-900/20',
    project: 'text-purple-600 dark:text-purple-400 bg-primary-100 dark:bg-primary-900/20',
    issue: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/20',
    documentation: 'text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/20',
    deployment: 'text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/20',
    security: 'text-accent-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20',
    maintenance: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20',
  };

  const statusColors: Record<string, string> = {
    new: 'bg-primary-100 text-primary-900 dark:bg-primary-950 dark:text-primary-200',
    in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    blocked: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    review: 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200',
    resolved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    closed: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200',
    archived: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200',
  };

  const priorityColors: Record<string, string> = {
    low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    normal: 'bg-primary-100 text-primary-900 dark:bg-primary-950 dark:text-primary-200',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    urgent: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    critical: 'bg-accent-600 text-white dark:bg-accent-700 dark:text-white',
  };

  const maxActivityCount = Math.max(...activityByHour.map((h) => h.count), 1);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Staff Logs</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            Comprehensive tracking of all staff activities and actions
          </p>
        </div>
        <button
          onClick={exportLogs}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-800 hover:bg-primary-900 text-white rounded-xl transition-colors"
        >
          <Download size={20} />
          Export CSV
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4"
        >
          <div className="flex items-center gap-3">
            <Activity className="text-primary-800 dark:text-primary-500" size={24} />
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Total Logs</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.total}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-4"
        >
          <div className="flex items-center gap-3">
            <Clock className="text-success-600 dark:text-green-400" size={24} />
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Today</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.today}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-4"
        >
          <div className="flex items-center gap-3">
            <Ticket className="text-cyan-600 dark:text-cyan-400" size={24} />
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Tickets</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.tickets}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-4"
        >
          <div className="flex items-center gap-3">
            <FileText className="text-purple-600 dark:text-purple-400" size={24} />
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Notes</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.notes}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-4"
        >
          <div className="flex items-center gap-3">
            <CheckCircle className="text-orange-600 dark:text-orange-400" size={24} />
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Fixes</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.fixes}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card p-4"
        >
          <div className="flex items-center gap-3">
            <User className="text-teal-600 dark:text-teal-400" size={24} />
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Most Active</p>
              <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                {stats.mostActive}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Activity by Hour Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="glass-card p-6 mb-6"
      >
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
          <BarChart3 size={20} />
          Activity by Hour
        </h3>
        <div className="h-32 flex items-end justify-between gap-1">
          {activityByHour.map((data) => {
            const height = maxActivityCount > 0 ? (data.count / maxActivityCount) * 100 : 0;
            return (
              <div key={data.hour} className="flex-1 flex flex-col items-center group">
                <div
                  className="w-full bg-gradient-to-t from-primary-700 to-primary-900 dark:from-primary-500 dark:to-cyan-400 rounded-t transition-all hover:from-primary-800 hover:to-cyan-600 cursor-pointer"
                  style={{ height: `${height}%`, minHeight: data.count > 0 ? '4px' : '0' }}
                  title={`${data.hour}:00 - ${data.count} activities`}
                ></div>
                <span className="text-xs text-neutral-600 dark:text-neutral-400 mt-2">
                  {data.hour === 0 || data.hour === 6 || data.hour === 12 || data.hour === 18
                    ? `${data.hour}h`
                    : ''}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="glass-card p-4 mb-6"
      >
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" size={20} />
            <input
              type="text"
              placeholder="Search logs by title, description, or user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Types</option>
            <option value="ticket">Tickets</option>
            <option value="note">Notes</option>
            <option value="fix">Fixes</option>
            <option value="update">Updates</option>
            <option value="project">Projects</option>
            <option value="issue">Issues</option>
            <option value="documentation">Documentation</option>
            <option value="deployment">Deployments</option>
            <option value="security">Security</option>
            <option value="maintenance">Maintenance</option>
          </select>

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500"
          >
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </motion.div>

      {/* Logs List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="glass-card overflow-hidden"
      >
        {loading ? (
          <div className="p-12 text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="inline-block mb-4"
            >
              <Sparkles className="text-primary-800 dark:text-primary-500" size={48} />
            </motion.div>
            <p className="text-neutral-500 dark:text-neutral-400 text-lg">Loading staff logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <Activity className="mx-auto text-neutral-400 mb-4" size={64} />
            <p className="text-neutral-500 dark:text-neutral-400 text-lg">No logs found</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {filteredLogs.map((log, index) => {
              const Icon = logTypeIcons[log.log_type] || Activity;
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="p-6 hover:bg-primary-50/30 dark:hover:bg-neutral-700/30 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${logTypeColors[log.log_type] || logTypeColors.note}`}>
                      <Icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-mono text-neutral-500 dark:text-neutral-400">
                          #{log.log_number}
                        </span>
                        <h3 className="text-lg font-bold text-neutral-900 dark:text-white truncate">
                          {log.title}
                        </h3>
                        <span className={`modern-badge ${statusColors[log.status]}`}>
                          {log.status.replace('_', ' ')}
                        </span>
                        <span className={`modern-badge ${priorityColors[log.priority]}`}>
                          {log.priority}
                        </span>
                      </div>
                      {log.description && (
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3 line-clamp-2">
                          {log.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
                        <span className="flex items-center gap-1">
                          <User size={14} />
                          {log.creator?.full_name || log.creator?.email || 'Unknown'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}
                        </span>
                        {log.creator?.role && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary-100 text-primary-900 dark:bg-primary-950 dark:text-primary-200 capitalize">
                            {log.creator.role}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Download,
  Search,
  Filter,
  User,
  Clock,
  List,
  ChevronDown,
  ChevronUp,
  BookOpen,
  TrendingUp,
  Activity,
  Users
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { exportToCSV } from '../../utils/exportData';

interface DailyLogWithUser {
  id: string;
  user_id: string;
  work_date: string;
  started_at: string | null;
  ended_at: string | null;
  highlights: string | null;
  blockers: string | null;
  summary: string | null;
  created_at: string;
  user: {
    full_name: string | null;
    email: string;
    role: string;
  };
}

interface DailyLogEntry {
  id: string;
  entry_type: string;
  description: string;
  duration_minutes: number | null;
  created_at: string;
}

interface DailyLogStats {
  totalLogs: number;
  todayLogs: number;
  activeUsers: number;
  avgEntriesPerLog: number;
}

export default function AllDailyLogsPage() {
  const [logs, setLogs] = useState<DailyLogWithUser[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<DailyLogWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'all'>('7d');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [logEntries, setLogEntries] = useState<Record<string, DailyLogEntry[]>>({});
  const [stats, setStats] = useState<DailyLogStats>({
    totalLogs: 0,
    todayLogs: 0,
    activeUsers: 0,
    avgEntriesPerLog: 0
  });

  useEffect(() => {
    fetchLogs();
  }, [dateRange]);

  useEffect(() => {
    filterLogs();
  }, [logs, searchTerm, statusFilter]);

  async function fetchLogs() {
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
        .from('daily_logs')
        .select(`
          *,
          user:profiles!daily_logs_user_id_fkey(full_name, email, role)
        `)
        .order('work_date', { ascending: false });

      if (startDate) {
        query = query.gte('work_date', startDate.toISOString().split('T')[0]);
      }

      const { data, error } = await query;

      if (error) throw error;

      setLogs(data || []);
      calculateStats(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  }

  function calculateStats(logsData: DailyLogWithUser[]) {
    const today = startOfDay(new Date());
    const todayLogs = logsData.filter((log) => new Date(log.work_date) >= today);
    const uniqueUsers = new Set(logsData.map((log) => log.user_id));

    setStats({
      totalLogs: logsData.length,
      todayLogs: todayLogs.length,
      activeUsers: uniqueUsers.size,
      avgEntriesPerLog: 0
    });
  }

  function filterLogs() {
    let filtered = [...logs];

    if (searchTerm) {
      filtered = filtered.filter(
        (log) =>
          log.user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.highlights?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.blockers?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter === 'active') {
      filtered = filtered.filter((log) => log.started_at && !log.ended_at);
    } else if (statusFilter === 'completed') {
      filtered = filtered.filter((log) => log.ended_at);
    }

    setFilteredLogs(filtered);
  }

  async function loadEntriesForLog(logId: string) {
    if (logEntries[logId]) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('daily_log_entries')
        .select('*')
        .eq('daily_log_id', logId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setLogEntries((prev) => ({
        ...prev,
        [logId]: data || []
      }));
    } catch (error) {
      console.error('Error loading entries:', error);
    }
  }

  function toggleExpanded(logId: string) {
    if (expandedLog === logId) {
      setExpandedLog(null);
    } else {
      setExpandedLog(logId);
      loadEntriesForLog(logId);
    }
  }

  function exportAllLogs() {
    const exportData = filteredLogs.map((log) => ({
      Date: format(new Date(log.work_date), 'yyyy-MM-dd'),
      User: log.user.full_name || log.user.email,
      Email: log.user.email,
      Role: log.user.role,
      Started: log.started_at ? format(new Date(log.started_at), 'HH:mm:ss') : 'N/A',
      Ended: log.ended_at ? format(new Date(log.ended_at), 'HH:mm:ss') : 'In Progress',
      Status: log.ended_at ? 'Completed' : log.started_at ? 'Active' : 'Not Started',
      Highlights: log.highlights || '',
      Blockers: log.blockers || '',
      Entries: logEntries[log.id]?.length || 0
    }));

    exportToCSV(exportData, `all-daily-logs-${format(new Date(), 'yyyy-MM-dd')}`);
  }

  function calculateDuration(startedAt: string | null, endedAt: string | null): string {
    if (!startedAt) return 'N/A';

    const start = new Date(startedAt);
    const end = endedAt ? new Date(endedAt) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-primary-800 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-neutral-600 dark:text-neutral-400 font-medium">Loading all daily logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">All Daily Logs</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            Organization-wide view of daily work logs and activity
          </p>
        </div>
        <button
          onClick={exportAllLogs}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-800 hover:bg-primary-900 text-white rounded-xl transition-colors"
        >
          <Download size={20} />
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4"
        >
          <div className="flex items-center gap-3">
            <BookOpen className="text-primary-800 dark:text-primary-500" size={24} />
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Total Logs</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.totalLogs}</p>
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
            <Activity className="text-success-600 dark:text-green-400" size={24} />
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Today</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.todayLogs}</p>
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
            <Users className="text-cyan-600 dark:text-cyan-400" size={24} />
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Active Users</p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.activeUsers}</p>
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
            <TrendingUp className="text-purple-600 dark:text-purple-400" size={24} />
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Period</p>
              <p className="text-lg font-bold text-neutral-900 dark:text-white capitalize">{dateRange === '7d' ? 'Last 7 Days' : dateRange === '30d' ? 'Last 30 Days' : dateRange === 'today' ? 'Today' : 'All Time'}</p>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card p-4 mb-6"
      >
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" size={20} />
            <input
              type="text"
              placeholder="Search by user, highlights, or blockers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
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

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass-card overflow-hidden"
      >
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="mx-auto text-neutral-400 mb-4" size={64} />
            <p className="text-neutral-500 dark:text-neutral-400 text-lg">No daily logs found</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {filteredLogs.map((log, index) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.02 }}
                className="hover:bg-primary-50/30 dark:hover:bg-neutral-700/30 transition-all"
              >
                <div
                  className="p-6 cursor-pointer"
                  onClick={() => toggleExpanded(log.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-950/20">
                          <User size={20} className="text-primary-800 dark:text-primary-500" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                            {log.user.full_name || log.user.email}
                          </h3>
                          <div className="flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
                            <span>{log.user.email}</span>
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-200 capitalize">
                              {log.user.role}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-neutral-600 dark:text-neutral-400">
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {format(new Date(log.work_date), 'EEE, MMM d, yyyy')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {calculateDuration(log.started_at, log.ended_at)}
                        </span>
                        {logEntries[log.id] && (
                          <span className="flex items-center gap-1">
                            <List size={14} />
                            {logEntries[log.id].length} entries
                          </span>
                        )}
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          log.ended_at
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : log.started_at
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            : 'bg-neutral-100 text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200'
                        }`}>
                          {log.ended_at ? 'Completed' : log.started_at ? 'In Progress' : 'Not Started'}
                        </span>
                      </div>
                    </div>

                    <button
                      className="ml-4 p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(log.id);
                      }}
                    >
                      {expandedLog === log.id ? (
                        <ChevronUp size={20} className="text-neutral-600 dark:text-neutral-400" />
                      ) : (
                        <ChevronDown size={20} className="text-neutral-600 dark:text-neutral-400" />
                      )}
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedLog === log.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50"
                    >
                      <div className="p-6 space-y-4">
                        {log.highlights && (
                          <div>
                            <h4 className="text-sm font-bold text-neutral-900 dark:text-white mb-2">Highlights</h4>
                            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                              {log.highlights}
                            </div>
                          </div>
                        )}

                        {log.blockers && (
                          <div>
                            <h4 className="text-sm font-bold text-neutral-900 dark:text-white mb-2">Blockers</h4>
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                              {log.blockers}
                            </div>
                          </div>
                        )}

                        {logEntries[log.id] && logEntries[log.id].length > 0 && (
                          <div>
                            <h4 className="text-sm font-bold text-neutral-900 dark:text-white mb-2">
                              Activity Timeline ({logEntries[log.id].length} entries)
                            </h4>
                            <div className="space-y-2">
                              {logEntries[log.id].map((entry) => (
                                <div
                                  key={entry.id}
                                  className="p-3 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700"
                                >
                                  <div className="flex items-start gap-2">
                                    <span className="text-neutral-500 dark:text-neutral-400 text-xs whitespace-nowrap">
                                      {format(new Date(entry.created_at), 'HH:mm')}
                                    </span>
                                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full flex-shrink-0 font-medium ${
                                      entry.entry_type === 'task' ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200' :
                                      entry.entry_type === 'meeting' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                                      entry.entry_type === 'blocker' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                      entry.entry_type === 'achievement' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                      entry.entry_type === 'break' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                                      'bg-neutral-100 text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200'
                                    }`}>
                                      {entry.entry_type}
                                    </span>
                                    <span className="text-neutral-700 dark:text-neutral-300 text-sm flex-1">
                                      {entry.description}
                                    </span>
                                    {entry.duration_minutes && (
                                      <span className="text-neutral-500 dark:text-neutral-400 text-xs whitespace-nowrap">
                                        {entry.duration_minutes} min
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

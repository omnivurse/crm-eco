import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Plus, Search, AlertTriangle, TrendingUp, Loader2, Clock, CheckCircle, XCircle, Users, Ticket } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface Problem {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  root_cause: string;
  workaround_md: string;
  resolution_md: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  owner: {
    full_name: string;
    email: string;
  } | null;
  assigned_team: {
    name: string;
  } | null;
  ticket_count?: number;
}

export function ProblemsList() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [stats, setStats] = useState({
    investigating: 0,
    known_error: 0,
    resolved: 0,
    total: 0,
  });

  useEffect(() => {
    fetchProblems();
    fetchStats();
  }, [statusFilter, priorityFilter]);

  const fetchProblems = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('problems')
        .select(`
          *,
          owner:profiles!problems_owner_id_fkey(full_name, email),
          assigned_team:teams!problems_assigned_team_id_fkey(name)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      const problemsWithCounts = await Promise.all(
        (data || []).map(async (problem) => {
          const { count } = await supabase
            .from('problem_tickets')
            .select('*', { count: 'exact', head: true })
            .eq('problem_id', problem.id);

          return {
            ...problem,
            ticket_count: count || 0,
          };
        })
      );

      setProblems(problemsWithCounts);
    } catch (error) {
      console.error('Error fetching problems:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const [investigating, knownError, resolved, total] = await Promise.all([
        supabase.from('problems').select('*', { count: 'exact', head: true }).eq('status', 'investigating'),
        supabase.from('problems').select('*', { count: 'exact', head: true }).eq('status', 'known_error'),
        supabase.from('problems').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
        supabase.from('problems').select('*', { count: 'exact', head: true }),
      ]);

      setStats({
        investigating: investigating.count || 0,
        known_error: knownError.count || 0,
        resolved: resolved.count || 0,
        total: total.count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const filteredProblems = problems.filter((problem) =>
    problem.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    problem.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    investigating: {
      label: 'Investigating',
      color: 'bg-primary-100 text-primary-900 dark:bg-primary-950/30 dark:text-primary-300 border border-primary-200 dark:border-primary-800',
      icon: Search,
    },
    root_cause_found: {
      label: 'Root Cause Found',
      color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300 border border-teal-200 dark:border-teal-800',
      icon: AlertTriangle,
    },
    known_error: {
      label: 'Known Error',
      color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800',
      icon: AlertTriangle,
    },
    resolved: {
      label: 'Resolved',
      color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800',
      icon: CheckCircle,
    },
    closed: {
      label: 'Closed',
      color: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800',
      icon: XCircle,
    },
  };

  const priorityConfig: Record<string, { label: string; color: string }> = {
    urgent: { label: 'Urgent', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800' },
    high: { label: 'High', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-200 dark:border-orange-800' },
    medium: { label: 'Medium', color: 'bg-primary-100 text-primary-900 dark:bg-primary-950/30 dark:text-primary-300 border border-primary-200 dark:border-primary-800' },
    low: { label: 'Low', color: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800' },
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="championship-title text-4xl" data-text="Problem Management">Problem Management</h1>
          <p className="text-xl text-neutral-600 dark:text-neutral-400 mt-1">
            Track and resolve recurring issues and their root causes
          </p>
        </div>
        <Link
          to="/problems/new"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-700 to-primary-800 hover:from-primary-800 hover:to-primary-900 text-white font-medium rounded-xl shadow-lg shadow-primary-800/30 transition-all duration-200 hover:shadow-xl hover:shadow-primary-800/40 hover:-translate-y-0.5"
        >
          <Plus size={20} />
          New Problem
        </Link>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="stat-card"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Total Problems</p>
              <p className="text-3xl font-bold text-neutral-900 dark:text-white mt-2">{stats.total}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-900/50 flex items-center justify-center">
              <AlertTriangle className="text-neutral-600 dark:text-neutral-400" size={24} />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="stat-card"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Investigating</p>
              <p className="text-3xl font-bold text-primary-800 dark:text-primary-500 mt-2">{stats.investigating}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-950/30 flex items-center justify-center">
              <Search className="text-primary-800 dark:text-primary-500" size={24} />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="stat-card"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Known Errors</p>
              <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mt-2">{stats.known_error}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <AlertTriangle className="text-yellow-600 dark:text-yellow-400" size={24} />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="stat-card"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Resolved</p>
              <p className="text-3xl font-bold text-success-600 dark:text-green-400 mt-2">{stats.resolved}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="text-success-600 dark:text-green-400" size={24} />
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass-card p-4"
      >
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" size={20} />
            <input
              type="text"
              placeholder="Search problems by title or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          >
            <option value="all">All Statuses</option>
            <option value="investigating">Investigating</option>
            <option value="root_cause_found">Root Cause Found</option>
            <option value="known_error">Known Error</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </motion.div>

      {loading ? (
        <div className="glass-card p-12">
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="text-primary-800 dark:text-primary-500 animate-spin mb-4" size={48} />
            <p className="text-neutral-600 dark:text-neutral-400 text-lg">Loading problems...</p>
          </div>
        </div>
      ) : filteredProblems.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-12"
        >
          <div className="flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-neutral-100 dark:bg-neutral-900/50 flex items-center justify-center mb-4">
              <AlertTriangle className="text-neutral-400" size={40} />
            </div>
            <p className="text-neutral-600 dark:text-neutral-400 text-lg font-medium mb-2">No problems found</p>
            <p className="text-neutral-500 dark:text-neutral-500 text-sm">Try adjusting your filters or create a new problem</p>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredProblems.map((problem, index) => {
              const StatusIcon = statusConfig[problem.status]?.icon || AlertTriangle;

              return (
                <motion.div
                  key={problem.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.05 }}
                  layout
                >
                  <Link
                    to={`/problems/${problem.id}`}
                    className="block glass-card p-6 hover:shadow-lg hover:border-primary-300 dark:hover:border-primary-900 transition-all duration-200 group"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="flex-shrink-0 mt-1">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${statusConfig[problem.status]?.color || 'bg-neutral-100'}`}>
                              <StatusIcon size={20} />
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white group-hover:text-primary-800 dark:group-hover:text-primary-500 transition-colors mb-2 line-clamp-1">
                              {problem.title}
                            </h3>

                            <div className="flex flex-wrap items-center gap-2 mb-3">
                              <span className={`modern-badge ${statusConfig[problem.status]?.color || 'bg-neutral-100'}`}>
                                {statusConfig[problem.status]?.label || problem.status}
                              </span>

                              <span className={`modern-badge ${priorityConfig[problem.priority]?.color || 'bg-neutral-100'}`}>
                                {priorityConfig[problem.priority]?.label || problem.priority}
                              </span>

                              {problem.workaround_md && (
                                <span className="modern-badge bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  <CheckCircle size={12} />
                                  Workaround Available
                                </span>
                              )}

                              {problem.ticket_count && problem.ticket_count > 0 && (
                                <span className="modern-badge bg-neutral-100 text-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800">
                                  <Ticket size={12} />
                                  {problem.ticket_count} {problem.ticket_count === 1 ? 'ticket' : 'tickets'}
                                </span>
                              )}
                            </div>

                            {problem.description && (
                              <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-3">
                                {problem.description}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500 dark:text-neutral-500">
                              {problem.owner && (
                                <div className="flex items-center gap-1.5">
                                  <Users size={14} />
                                  <span>Owner: {problem.owner.full_name}</span>
                                </div>
                              )}

                              {problem.assigned_team && (
                                <div className="flex items-center gap-1.5">
                                  <Users size={14} />
                                  <span>Team: {problem.assigned_team.name}</span>
                                </div>
                              )}

                              <div className="flex items-center gap-1.5">
                                <Clock size={14} />
                                <span>Created {formatDistanceToNow(new Date(problem.created_at), { addSuffix: true })}</span>
                              </div>

                              {problem.resolved_at && (
                                <div className="flex items-center gap-1.5 text-success-600 dark:text-green-400">
                                  <CheckCircle size={14} />
                                  <span>Resolved {formatDistanceToNow(new Date(problem.resolved_at), { addSuffix: true })}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {problem.root_cause && (
                          <div className="ml-13 mt-3 p-3 bg-primary-50 dark:bg-primary-950/20 border border-primary-200 dark:border-primary-800 rounded-lg">
                            <p className="text-xs font-medium text-primary-900 dark:text-primary-300 mb-1">Root Cause:</p>
                            <p className="text-sm text-primary-900 dark:text-primary-500 line-clamp-2">{problem.root_cause}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {!loading && filteredProblems.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="glass-card flex items-center justify-between px-4 py-3"
        >
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Showing <span className="font-medium text-neutral-900 dark:text-white">{filteredProblems.length}</span> of{' '}
            <span className="font-medium text-neutral-900 dark:text-white">{problems.length}</span> problems
          </p>
        </motion.div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import {
  CheckCircle2,
  Clock,
  FileText,
  Folder,
  AlertCircle,
  Plus,
  ChevronRight,
  Calendar,
  Briefcase,
  TrendingUp,
  Zap,
  ArrowRight
} from 'lucide-react';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
  project_id: string | null;
}

interface Assignment {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
  assigned_by: string;
}

interface Note {
  id: string;
  title: string;
  updated_at: string;
}

interface DailyLog {
  id: string;
  work_date: string;
  started_at: string | null;
  ended_at: string | null;
}

export function MyWorkDashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  async function loadDashboardData() {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];

      const [tasksRes, assignmentsRes, notesRes, logRes] = await Promise.allSettled([
        supabase
          .from('tasks')
          .select('id, title, status, priority, due_at, project_id')
          .or(`assignee_id.eq.${user.id},created_by_id.eq.${user.id}`)
          .neq('status', 'done')
          .order('due_at', { ascending: true, nullsFirst: false })
          .limit(5),

        supabase
          .from('assignments')
          .select('id, title, status, priority, due_at, assigned_by')
          .eq('assigned_to', user.id)
          .in('status', ['new', 'accepted', 'in_progress'])
          .order('due_at', { ascending: true, nullsFirst: false })
          .limit(5),

        supabase
          .from('notes')
          .select('id, title, updated_at')
          .eq('owner_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(5),

        supabase
          .from('daily_logs')
          .select('*')
          .eq('user_id', user.id)
          .eq('work_date', today)
          .maybeSingle()
      ]);

      if (tasksRes.status === 'fulfilled' && tasksRes.value.data) setTasks(tasksRes.value.data);
      if (assignmentsRes.status === 'fulfilled' && assignmentsRes.value.data) setAssignments(assignmentsRes.value.data);
      if (notesRes.status === 'fulfilled' && notesRes.value.data) setNotes(notesRes.value.data);
      if (logRes.status === 'fulfilled' && logRes.value.data) setTodayLog(logRes.value.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  function getPriorityColor(priority: string) {
    switch (priority) {
      case 'urgent': return 'bg-gradient-to-r from-red-500 to-red-600 text-white';
      case 'high': return 'bg-gradient-to-r from-orange-500 to-orange-600 text-white';
      case 'med': return 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white';
      default: return 'bg-gradient-to-r from-neutral-500 to-neutral-600 text-white';
    }
  }

  function getPriorityBorderColor(priority: string) {
    switch (priority) {
      case 'urgent': return 'border-l-4 border-accent-500';
      case 'high': return 'border-l-4 border-orange-500';
      case 'med': return 'border-l-4 border-yellow-500';
      default: return 'border-l-4 border-neutral-500';
    }
  }

  function formatDate(date: string | null) {
    if (!date) return 'No due date';
    const d = new Date(date);
    const today = new Date();
    const diff = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diff < 0) return `${Math.abs(diff)}d overdue`;
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return `${diff}d`;
  }

  function getTimeRemaining(date: string | null) {
    if (!date) return null;
    const d = new Date(date);
    const today = new Date();
    const diff = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diff < 0) return { color: 'text-accent-600', urgent: true };
    if (diff === 0) return { color: 'text-orange-600', urgent: true };
    if (diff <= 2) return { color: 'text-yellow-600', urgent: false };
    return { color: 'text-success-600', urgent: false };
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-primary-800 border-t-transparent rounded-full animate-spin glow-effect"></div>
          <p className="mt-4 text-neutral-600 dark:text-neutral-400 font-medium">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  const totalActive = tasks.length + assignments.length;
  const completionRate = totalActive > 0 ? Math.round((tasks.filter(t => t.status === 'done').length / totalActive) * 100) : 0;

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="hero-dashboard text-white py-20 px-6"
      >
        <div className="w-full relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-5 mb-4"
          >
            <motion.div
              animate={{
                rotateY: [0, 360]
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "linear"
              }}
              className="p-5 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20"
            >
              <Briefcase size={52} className="text-white" />
            </motion.div>
            <div>
              <h1 className="text-6xl font-black mb-2 tracking-tight text-white">My Work</h1>
              <p className="text-2xl text-white/90 font-medium">
                Your personal productivity command center
              </p>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="stat-card"
            >
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Active Items</div>
                  <div className="text-3xl font-bold text-neutral-900 dark:text-white">{totalActive}</div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-yellow-100 dark:bg-yellow-500/20 flex items-center justify-center">
                  <Zap className="text-yellow-600 dark:text-yellow-300" size={24} />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="stat-card"
            >
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Recent Notes</div>
                  <div className="text-3xl font-bold text-neutral-900 dark:text-white">{notes.length}</div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                  <FileText className="text-green-600 dark:text-green-300" size={24} />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="stat-card"
            >
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Daily Status</div>
                  <div className="text-3xl font-bold text-neutral-900 dark:text-white">{todayLog ? 'Active' : 'Not Started'}</div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                  <Calendar className={todayLog ? "text-green-600 dark:text-green-300" : "text-neutral-400 dark:text-neutral-500"} size={24} />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                  <CheckCircle2 className="text-white" size={20} />
                </div>
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">My Tasks</h2>
              </div>
              <Link
                to="/desk/tasks"
                className="text-sm text-primary-800 dark:text-primary-500 hover:text-primary-900 dark:hover:text-primary-300 flex items-center gap-1 font-medium transition-colors"
              >
                View all
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {tasks.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-900/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="text-primary-800 dark:text-primary-500 floating" size={40} />
                </div>
                <p className="text-neutral-600 dark:text-neutral-400 mb-4 font-medium">No active tasks</p>
                <Link
                  to="/desk/tasks"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-700 to-primary-800 hover:from-primary-800 hover:to-primary-900 text-white rounded-xl transition-all transform hover:scale-105 font-medium shadow-lg hover:shadow-xl"
                >
                  <Plus className="h-5 w-5" />
                  Create a task
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task, index) => {
                  const timeInfo = getTimeRemaining(task.due_at);
                  return (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Link
                        to={`/desk/tasks/${task.id}`}
                        className={`block p-4 rounded-xl hover:shadow-lg transition-all group bg-white dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 ${getPriorityBorderColor(task.priority)}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-neutral-900 dark:text-white truncate group-hover:text-primary-800 dark:group-hover:text-primary-500 transition-colors">
                              {task.title}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`modern-badge text-xs px-3 py-1 rounded-full ${getPriorityColor(task.priority)}`}>
                                {task.priority}
                              </span>
                              <span className={`text-xs font-medium flex items-center gap-1 ${timeInfo?.color || 'text-neutral-500'}`}>
                                <Clock className="h-3.5 w-3.5" />
                                {formatDate(task.due_at)}
                              </span>
                            </div>
                          </div>
                          <ArrowRight className="text-neutral-400 group-hover:text-primary-800 group-hover:translate-x-1 transition-all flex-shrink-0" size={20} />
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                  <AlertCircle className="text-white" size={20} />
                </div>
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Assignments</h2>
              </div>
              <Link
                to="/desk/assignments"
                className="text-sm text-primary-800 dark:text-primary-500 hover:text-primary-900 dark:hover:text-primary-300 flex items-center gap-1 font-medium transition-colors"
              >
                View all
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {assignments.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/30 dark:to-orange-800/30 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="text-orange-600 dark:text-orange-400 floating" size={40} />
                </div>
                <p className="text-neutral-600 dark:text-neutral-400 font-medium">No open assignments</p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignments.map((assignment, index) => {
                  const timeInfo = getTimeRemaining(assignment.due_at);
                  return (
                    <motion.div
                      key={assignment.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Link
                        to={`/desk/assignments/${assignment.id}`}
                        className={`block p-4 rounded-xl hover:shadow-lg transition-all group bg-white dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 ${getPriorityBorderColor(assignment.priority)}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-neutral-900 dark:text-white truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                              {assignment.title}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`modern-badge text-xs px-3 py-1 rounded-full ${getPriorityColor(assignment.priority)}`}>
                                {assignment.priority}
                              </span>
                              <span className={`text-xs font-medium flex items-center gap-1 ${timeInfo?.color || 'text-neutral-500'}`}>
                                <Clock className="h-3.5 w-3.5" />
                                {formatDate(assignment.due_at)}
                              </span>
                            </div>
                          </div>
                          <ArrowRight className="text-neutral-400 group-hover:text-orange-600 group-hover:translate-x-1 transition-all flex-shrink-0" size={20} />
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                  <FileText className="text-white" size={20} />
                </div>
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Recent Notes</h2>
              </div>
              <Link
                to="/desk/notes"
                className="text-sm text-primary-800 dark:text-primary-500 hover:text-primary-900 dark:hover:text-primary-300 flex items-center gap-1 font-medium transition-colors"
              >
                View all
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {notes.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 flex items-center justify-center mx-auto mb-4">
                  <FileText className="text-success-600 dark:text-green-400 floating" size={40} />
                </div>
                <p className="text-neutral-600 dark:text-neutral-400 mb-4 font-medium">No notes yet</p>
                <Link
                  to="/desk/notes"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl transition-all transform hover:scale-105 font-medium shadow-lg hover:shadow-xl"
                >
                  <Plus className="h-5 w-5" />
                  Create a note
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {notes.map((note, index) => (
                  <motion.div
                    key={note.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link
                      to={`/desk/notes/${note.id}`}
                      className="block p-4 rounded-xl hover:shadow-lg transition-all group bg-white dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 border-l-4 border-l-green-500"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-neutral-900 dark:text-white truncate group-hover:text-success-600 dark:group-hover:text-green-400 transition-colors">
                            {note.title}
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                            Updated {new Date(note.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                        <ArrowRight className="text-neutral-400 group-hover:text-success-600 group-hover:translate-x-1 transition-all flex-shrink-0" size={20} />
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-card p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                  <Calendar className="text-white" size={20} />
                </div>
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Daily Log</h2>
              </div>
              <Link
                to="/desk/logs"
                className="text-sm text-primary-800 dark:text-primary-500 hover:text-primary-900 dark:hover:text-primary-300 flex items-center gap-1 font-medium transition-colors"
              >
                View all
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {!todayLog ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-100 to-teal-200 dark:from-teal-900/30 dark:to-teal-800/30 flex items-center justify-center mx-auto mb-4">
                  <Calendar className="text-teal-600 dark:text-teal-400 floating" size={40} />
                </div>
                <p className="text-neutral-600 dark:text-neutral-400 mb-4 font-medium">No log for today</p>
                <Link
                  to="/desk/logs"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white rounded-xl transition-all transform hover:scale-105 font-medium shadow-lg hover:shadow-xl"
                >
                  <Plus className="h-5 w-5" />
                  Start Daily Log
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-gradient-to-r from-teal-50 to-primary-100 dark:from-teal-900/20 dark:to-primary-900/20 border border-teal-200 dark:border-teal-800">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-teal-900 dark:text-teal-100">Today's Status</span>
                    <span className={`modern-badge text-xs px-3 py-1 rounded-full ${
                      todayLog.ended_at
                        ? 'bg-gradient-to-r from-neutral-500 to-neutral-600 text-white'
                        : 'bg-gradient-to-r from-green-500 to-green-600 text-white'
                    }`}>
                      {todayLog.ended_at ? 'Completed' : 'Active'}
                    </span>
                  </div>

                  {todayLog.started_at && (
                    <div className="text-sm text-teal-800 dark:text-teal-200 mb-2 flex items-center gap-2">
                      <Clock size={14} />
                      <span>Started: {new Date(todayLog.started_at).toLocaleTimeString()}</span>
                    </div>
                  )}

                  {todayLog.ended_at && (
                    <div className="text-sm text-teal-800 dark:text-teal-200 flex items-center gap-2">
                      <CheckCircle2 size={14} />
                      <span>Ended: {new Date(todayLog.ended_at).toLocaleTimeString()}</span>
                    </div>
                  )}
                </div>

                <Link
                  to="/desk/logs"
                  className="block text-center px-4 py-3 bg-gradient-to-r from-teal-100 to-cyan-100 dark:from-teal-900/30 dark:to-primary-900/30 text-teal-900 dark:text-teal-100 font-medium rounded-xl hover:from-teal-200 hover:to-cyan-200 dark:hover:from-teal-900/50 dark:hover:to-primary-900/50 transition-all"
                >
                  View Details
                </Link>
              </div>
            )}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 glass-card p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-700 to-teal-600 flex items-center justify-center">
              <Zap className="text-white" size={24} />
            </div>
            <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">Quick Actions</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              to="/desk/tasks"
              className="group relative overflow-hidden p-6 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white transition-all transform hover:scale-105 hover:shadow-xl"
            >
              <div className="relative z-10">
                <Plus className="h-8 w-8 mb-3" />
                <span className="text-sm font-bold block">New Task</span>
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity transform -skew-x-12 group-hover:translate-x-full duration-1000"></div>
            </Link>
            <Link
              to="/desk/notes"
              className="group relative overflow-hidden p-6 rounded-xl bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white transition-all transform hover:scale-105 hover:shadow-xl"
            >
              <div className="relative z-10">
                <Plus className="h-8 w-8 mb-3" />
                <span className="text-sm font-bold block">New Note</span>
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity transform -skew-x-12 group-hover:translate-x-full duration-1000"></div>
            </Link>
            <Link
              to="/desk/projects"
              className="group relative overflow-hidden p-6 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white transition-all transform hover:scale-105 hover:shadow-xl"
            >
              <div className="relative z-10">
                <Folder className="h-8 w-8 mb-3" />
                <span className="text-sm font-bold block">Projects</span>
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity transform -skew-x-12 group-hover:translate-x-full duration-1000"></div>
            </Link>
            <Link
              to="/desk/files"
              className="group relative overflow-hidden p-6 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white transition-all transform hover:scale-105 hover:shadow-xl"
            >
              <div className="relative z-10">
                <FileText className="h-8 w-8 mb-3" />
                <span className="text-sm font-bold block">Files</span>
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity transform -skew-x-12 group-hover:translate-x-full duration-1000"></div>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

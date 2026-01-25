import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { AlertCircle, Check, X, Clock, ArrowRight, Briefcase, Zap, CheckCircle2 } from 'lucide-react';

interface Assignment {
  id: string;
  title: string;
  details: string | null;
  status: string;
  priority: string;
  due_at: string | null;
  progress_percent: number;
  assigned_by: string;
  created_at: string;
}

export function AssignmentsPage() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  useEffect(() => {
    if (user) {
      loadAssignments();
    }
  }, [user]);

  async function loadAssignments() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('assigned_to', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setAssignments(data);
    } catch (error) {
      console.error('Error loading assignments:', error);
    } finally {
      setLoading(false);
    }
  }

  async function acceptAssignment(id: string) {
    try {
      const { error } = await supabase
        .from('assignments')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      await loadAssignments();
    } catch (error) {
      console.error('Error accepting assignment:', error);
    }
  }

  async function declineAssignment(id: string, reason: string) {
    try {
      const { error } = await supabase
        .from('assignments')
        .update({
          status: 'declined',
          decline_reason: reason
        })
        .eq('id', id);

      if (error) throw error;
      await loadAssignments();
    } catch (error) {
      console.error('Error declining assignment:', error);
    }
  }

  async function updateProgress(id: string, progress: number) {
    try {
      const { error } = await supabase
        .from('assignments')
        .update({ progress_percent: progress })
        .eq('id', id);

      if (error) throw error;
      await loadAssignments();
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'new': return 'bg-gradient-to-r from-primary-500 to-primary-700 text-white';
      case 'accepted': return 'bg-gradient-to-r from-green-500 to-green-600 text-white';
      case 'in_progress': return 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white';
      case 'done': return 'bg-gradient-to-r from-neutral-500 to-neutral-600 text-white';
      case 'blocked': return 'bg-gradient-to-r from-red-500 to-red-600 text-white';
      case 'declined': return 'bg-gradient-to-r from-neutral-400 to-neutral-500 text-white';
      default: return 'bg-gradient-to-r from-neutral-500 to-neutral-600 text-white';
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
    if (diff === 0) return 'Due today';
    if (diff === 1) return 'Due tomorrow';
    return `Due in ${diff}d`;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-primary-800 border-t-transparent rounded-full animate-spin glow-effect"></div>
          <p className="mt-4 text-neutral-600 dark:text-neutral-400 font-medium">Loading assignments...</p>
        </div>
      </div>
    );
  }

  const newAssignments = assignments.filter(a => a.status === 'new');
  const activeAssignments = assignments.filter(a => ['accepted', 'in_progress', 'blocked'].includes(a.status));
  const completedAssignments = assignments.filter(a => ['done', 'declined'].includes(a.status));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="hero-work text-white py-20 px-6"
      >
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-5 mb-8"
          >
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="p-5 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20"
            >
              <AlertCircle size={52} className="text-white" />
            </motion.div>
            <div>
              <h1 className="text-6xl font-black mb-2 tracking-tight">Assignments</h1>
              <p className="text-2xl text-cyan-100 font-medium">Tasks and assignments from leadership</p>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="stat-card"
            >
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">New</div>
                  <div className="text-3xl font-bold text-neutral-900 dark:text-white">{newAssignments.length}</div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                  <AlertCircle className="text-blue-600 dark:text-blue-300" size={24} />
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
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Active</div>
                  <div className="text-3xl font-bold text-neutral-900 dark:text-white">{activeAssignments.length}</div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-yellow-100 dark:bg-yellow-500/20 flex items-center justify-center">
                  <Zap className="text-yellow-600 dark:text-yellow-300" size={24} />
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
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Completed</div>
                  <div className="text-3xl font-bold text-neutral-900 dark:text-white">{completedAssignments.length}</div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="text-green-600 dark:text-green-300" size={24} />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-6">
          {newAssignments.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card p-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                  <AlertCircle className="text-white" size={20} />
                </div>
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                  New Assignments ({newAssignments.length})
                </h2>
              </div>
              <div className="space-y-4">
                {newAssignments.map((assignment, index) => (
                  <motion.div
                    key={assignment.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`p-6 rounded-xl bg-white dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 ${getPriorityBorderColor(assignment.priority)}`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">{assignment.title}</h3>
                        {assignment.details && (
                          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">{assignment.details}</p>
                        )}
                        <div className="flex items-center gap-2">
                          <span className={`modern-badge text-xs px-3 py-1 rounded-full ${getPriorityColor(assignment.priority)}`}>
                            {assignment.priority}
                          </span>
                          {assignment.due_at && (
                            <span className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1 font-medium">
                              <Clock className="h-3.5 w-3.5" />
                              {formatDate(assignment.due_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => acceptAssignment(assignment.id)}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl transition-all transform hover:scale-105 font-medium shadow-lg hover:shadow-xl"
                      >
                        <Check className="h-4 w-4" />
                        Accept
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt('Reason for declining (optional):');
                          if (reason !== null) {
                            declineAssignment(assignment.id, reason);
                          }
                        }}
                        className="flex items-center gap-2 px-6 py-3 bg-white/50 dark:bg-neutral-700/50 hover:bg-white dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl transition-all font-medium border border-neutral-300 dark:border-neutral-600"
                      >
                        <X className="h-4 w-4" />
                        Decline
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center">
                <Zap className="text-white" size={20} />
              </div>
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                Active Assignments ({activeAssignments.length})
              </h2>
            </div>
            {activeAssignments.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-100 to-yellow-200 dark:from-yellow-900/30 dark:to-yellow-800/30 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="text-yellow-600 dark:text-yellow-400 floating" size={40} />
                </div>
                <p className="text-neutral-600 dark:text-neutral-400 font-medium">No active assignments</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeAssignments.map((assignment, index) => (
                  <motion.div
                    key={assignment.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`p-6 rounded-xl bg-white dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 ${getPriorityBorderColor(assignment.priority)}`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">{assignment.title}</h3>
                          <span className={`modern-badge text-xs px-3 py-1 rounded-full ${getStatusColor(assignment.status)}`}>
                            {assignment.status.replace('_', ' ')}
                          </span>
                        </div>
                        {assignment.details && (
                          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">{assignment.details}</p>
                        )}
                        <div className="flex items-center gap-2">
                          <span className={`modern-badge text-xs px-3 py-1 rounded-full ${getPriorityColor(assignment.priority)}`}>
                            {assignment.priority}
                          </span>
                          {assignment.due_at && (
                            <span className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1 font-medium">
                              <Clock className="h-3.5 w-3.5" />
                              {formatDate(assignment.due_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Progress</span>
                        <span className="text-sm text-neutral-600 dark:text-neutral-400 font-bold">{assignment.progress_percent}%</span>
                      </div>
                      <div className="progress-modern">
                        <div
                          className="progress-modern-fill"
                          style={{ width: `${assignment.progress_percent}%` }}
                        ></div>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={assignment.progress_percent}
                        onChange={(e) => updateProgress(assignment.id, parseInt(e.target.value))}
                        className="w-full mt-2"
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {completedAssignments.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-card p-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neutral-500 to-neutral-600 flex items-center justify-center">
                  <CheckCircle2 className="text-white" size={20} />
                </div>
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                  Completed ({completedAssignments.length})
                </h2>
              </div>
              <div className="space-y-3">
                {completedAssignments.map((assignment, index) => (
                  <motion.div
                    key={assignment.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 rounded-xl bg-white dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">{assignment.title}</h3>
                          <span className={`modern-badge text-xs px-3 py-1 rounded-full ${getStatusColor(assignment.status)}`}>
                            {assignment.status}
                          </span>
                        </div>
                        {assignment.details && (
                          <p className="text-sm text-neutral-600 dark:text-neutral-400">{assignment.details}</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

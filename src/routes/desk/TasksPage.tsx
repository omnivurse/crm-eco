import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import {
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  LayoutGrid,
  List,
  ArrowRight,
  Briefcase,
  Zap,
  X
} from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_at: string | null;
  project_id: string | null;
  assignee_id: string | null;
  created_at: string;
}

type ViewMode = 'list' | 'kanban';

export function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('med');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (user) {
      loadTasks();
    }
  }, [user, statusFilter, priorityFilter]);

  async function loadTasks() {
    if (!user) return;

    try {
      let query = supabase
        .from('tasks')
        .select('*')
        .or(`assignee_id.eq.${user.id},created_by_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      if (data) setTasks(data);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !newTaskTitle.trim()) return;

    setIsCreating(true);
    try {
      const taskData = {
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim() || null,
        priority: newTaskPriority,
        status: 'todo',
        due_at: newTaskDueDate || null,
        assignee_id: user.id,
        created_by_id: user.id
      };

      // Removed console.log

      const { data, error } = await supabase
        .from('tasks')
        .insert(taskData)
        .select();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      // Removed console.log

      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskPriority('med');
      setNewTaskDueDate('');
      setShowNewTaskModal(false);
      loadTasks();
    } catch (error: any) {
      console.error('Error creating task:', error);
      const errorMessage = error?.message || 'Failed to create task. Please try again.';
      alert(`Error: ${errorMessage}`);
    } finally {
      setIsCreating(false);
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'done':
        return <CheckCircle2 className="h-4 w-4 text-success-600" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-primary-800" />;
      case 'review':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-neutral-400" />;
    }
  }

  function getPriorityColor(priority: string) {
    switch (priority) {
      case 'urgent':
        return 'bg-gradient-to-r from-red-500 to-red-600 text-white';
      case 'high':
        return 'bg-gradient-to-r from-orange-500 to-orange-600 text-white';
      case 'med':
        return 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white';
      default:
        return 'bg-gradient-to-r from-neutral-500 to-neutral-600 text-white';
    }
  }

  function getPriorityBorderColor(priority: string) {
    switch (priority) {
      case 'urgent':
        return 'border-l-4 border-accent-500';
      case 'high':
        return 'border-l-4 border-orange-500';
      case 'med':
        return 'border-l-4 border-yellow-500';
      default:
        return 'border-l-4 border-neutral-500';
    }
  }

  function formatDueDate(date: string | null) {
    if (!date) return null;
    const d = new Date(date);
    const today = new Date();
    const diff = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diff < 0) {
      return { text: `${Math.abs(diff)}d overdue`, color: 'text-accent-600' };
    }
    if (diff === 0) {
      return { text: 'Due today', color: 'text-orange-600' };
    }
    if (diff === 1) {
      return { text: 'Due tomorrow', color: 'text-yellow-600' };
    }
    return { text: `Due in ${diff}d`, color: 'text-neutral-600' };
  }

  const filteredTasks = tasks.filter(task =>
    task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const tasksByStatus = {
    todo: filteredTasks.filter(t => t.status === 'todo'),
    in_progress: filteredTasks.filter(t => t.status === 'in_progress'),
    review: filteredTasks.filter(t => t.status === 'review'),
    done: filteredTasks.filter(t => t.status === 'done')
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-primary-800 border-t-transparent rounded-full animate-spin glow-effect"></div>
          <p className="mt-4 text-neutral-600 dark:text-neutral-400 font-medium">Loading tasks...</p>
        </div>
      </div>
    );
  }

  const activeTasksCount = filteredTasks.filter(t => ['todo', 'in_progress'].includes(t.status)).length;
  const completedCount = filteredTasks.filter(t => t.status === 'done').length;
  const overdueCount = filteredTasks.filter(t => {
    if (!t.due_at) return false;
    const dueDate = new Date(t.due_at);
    const today = new Date();
    return dueDate < today && t.status !== 'done';
  }).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="hero-work text-white py-20 px-6"
      >
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex items-center justify-between mb-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-5"
            >
              <motion.div
                animate={{
                  y: [0, -8, 0],
                  rotate: [-5, 5, -5]
                }}
                transition={{
                  duration: 3.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="p-5 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20"
              >
                <Briefcase size={52} className="text-white" />
              </motion.div>
              <div>
                <h1 className="text-6xl font-black mb-2 tracking-tight">Tasks</h1>
                <p className="text-2xl text-cyan-100 font-medium">Manage your tasks and track progress</p>
              </div>
            </motion.div>
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              onClick={() => setShowNewTaskModal(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-8 py-4 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-xl transition-all font-semibold border-2 border-white/30 shadow-2xl hover:shadow-white/20 text-lg"
            >
              <Plus className="h-6 w-6" />
              New Task
            </motion.button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="stat-card"
            >
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Active Tasks</div>
                  <div className="text-3xl font-bold text-neutral-900 dark:text-white">{activeTasksCount}</div>
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
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Completed</div>
                  <div className="text-3xl font-bold text-neutral-900 dark:text-white">{completedCount}</div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="text-green-600 dark:text-green-300" size={24} />
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
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Overdue</div>
                  <div className="text-3xl font-bold text-neutral-900 dark:text-white">{overdueCount}</div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
                  <AlertCircle className="text-red-600 dark:text-red-300" size={24} />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6 mb-6"
        >
          <div className="mb-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400 dark:text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/50 dark:bg-neutral-800/50 backdrop-blur-sm border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-neutral-900 dark:text-white"
                />
              </div>

              <div className="flex gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-3 bg-white/50 dark:bg-neutral-800/50 backdrop-blur-sm border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-neutral-900 dark:text-white font-medium"
                >
                  <option value="all">All Status</option>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="done">Done</option>
                </select>

                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="px-4 py-3 bg-white/50 dark:bg-neutral-800/50 backdrop-blur-sm border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-neutral-900 dark:text-white font-medium"
                >
                  <option value="all">All Priority</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="med">Medium</option>
                  <option value="low">Low</option>
                </select>

                <div className="flex bg-white/50 dark:bg-neutral-800/50 backdrop-blur-sm border border-neutral-300 dark:border-neutral-600 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-4 py-3 transition-all ${
                      viewMode === 'list'
                        ? 'bg-primary-800 text-white'
                        : 'hover:bg-white/70 dark:hover:bg-neutral-700/50 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <List className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setViewMode('kanban')}
                    className={`px-4 py-3 transition-all ${
                      viewMode === 'kanban'
                        ? 'bg-primary-800 text-white'
                        : 'hover:bg-white/70 dark:hover:bg-neutral-700/50 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <LayoutGrid className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {viewMode === 'list' ? (
            <div className="space-y-3 mt-4">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-900/30 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="text-primary-800 dark:text-primary-500 floating" size={40} />
                  </div>
                  <p className="text-neutral-600 dark:text-neutral-400 font-medium">No tasks found</p>
                </div>
              ) : (
                filteredTasks.map((task, index) => {
                  const dueInfo = formatDueDate(task.due_at);
                  return (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <Link
                        to={`/desk/tasks/${task.id}`}
                        className={`block p-4 rounded-xl hover:shadow-lg transition-all group bg-white dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 ${getPriorityBorderColor(task.priority)}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="mt-1">
                              {getStatusIcon(task.status)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-neutral-900 dark:text-white mb-2 group-hover:text-primary-800 dark:group-hover:text-primary-500 transition-colors">{task.title}</h3>
                              {task.description && (
                                <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-3">
                                  {task.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`modern-badge text-xs px-3 py-1 rounded-full ${getPriorityColor(task.priority)}`}>
                                  {task.priority}
                                </span>
                                {dueInfo && (
                                  <span className={`text-xs font-medium flex items-center gap-1 ${dueInfo.color}`}>
                                    <Clock className="h-3.5 w-3.5" />
                                    {dueInfo.text}
                                  </span>
                                )}
                                <span className="text-xs text-neutral-500 dark:text-neutral-400 capitalize">
                                  {task.status.replace('_', ' ')}
                                </span>
                              </div>
                            </div>
                          </div>
                          <ArrowRight className="text-neutral-400 group-hover:text-primary-800 group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" size={20} />
                        </div>
                      </Link>
                    </motion.div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {(['todo', 'in_progress', 'review', 'done'] as const).map((status, colIndex) => (
                  <motion.div
                    key={status}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: colIndex * 0.1 }}
                    className="glass-card p-4"
                  >
                    <h3 className="font-semibold text-neutral-900 dark:text-white mb-4 capitalize flex items-center gap-2">
                      {getStatusIcon(status)}
                      {status.replace('_', ' ')}
                      <span className="text-sm font-normal text-neutral-500 dark:text-neutral-400">
                        ({tasksByStatus[status].length})
                      </span>
                    </h3>
                    <div className="space-y-3">
                      {tasksByStatus[status].map((task, taskIndex) => {
                        const dueInfo = formatDueDate(task.due_at);
                        return (
                          <motion.div
                            key={task.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: taskIndex * 0.05 }}
                          >
                            <Link
                              to={`/desk/tasks/${task.id}`}
                              className={`block bg-white dark:bg-neutral-800/50 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:shadow-lg transition-all group ${getPriorityBorderColor(task.priority)}`}
                            >
                              <h4 className="font-medium text-neutral-900 dark:text-white text-sm mb-2 group-hover:text-primary-800 dark:group-hover:text-primary-500 transition-colors">{task.title}</h4>
                              <div className="flex items-center justify-between gap-2">
                                <span className={`modern-badge text-xs px-2 py-1 rounded-full ${getPriorityColor(task.priority)}`}>
                                  {task.priority}
                                </span>
                                {dueInfo && (
                                  <span className={`text-xs font-medium ${dueInfo.color}`}>
                                    {dueInfo.text}
                                  </span>
                                )}
                              </div>
                            </Link>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* New Task Modal */}
      <AnimatePresence>
        {showNewTaskModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowNewTaskModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 px-6 py-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Create New Task</h2>
                <button
                  onClick={() => setShowNewTaskModal(false)}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
                </button>
              </div>

              <form onSubmit={handleCreateTask} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                    Task Title *
                  </label>
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Enter task title..."
                    required
                    className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-neutral-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    placeholder="Add task description..."
                    rows={4}
                    className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-neutral-900 dark:text-white resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                      Priority
                    </label>
                    <select
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value)}
                      className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-neutral-900 dark:text-white"
                    >
                      <option value="low">Low</option>
                      <option value="med">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                      className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-neutral-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowNewTaskModal(false)}
                    className="flex-1 px-6 py-3 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl font-semibold hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || !newTaskTitle.trim()}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-primary-700 to-primary-800 hover:from-primary-800 hover:to-primary-900 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isCreating ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="h-5 w-5" />
                        Create Task
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { ArrowLeft, Calendar, User, Tag, Clock, Save, Trash2 } from 'lucide-react';

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
  updated_at: string;
}

export function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && id) {
      loadTask();
    }
  }, [user, id]);

  async function loadTask() {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      setTask(data);
    } catch (error) {
      console.error('Error loading task:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateTask(updates: Partial<Task>) {
    if (!task || !id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setTask({ ...task, ...updates });
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task');
    } finally {
      setSaving(false);
    }
  }

  async function deleteTask() {
    if (!confirm('Are you sure you want to delete this task?')) return;
    if (!id) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;

      navigate('/desk/tasks');
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-primary-800 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-neutral-600 dark:text-neutral-400">Loading task...</p>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-4">Task not found</h2>
          <Link to="/desk/tasks" className="text-primary-800 hover:underline">
            Back to Tasks
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900 p-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Link
            to="/desk/tasks"
            className="inline-flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-primary-800 dark:hover:text-primary-500 mb-4"
          >
            <ArrowLeft size={20} />
            Back to Tasks
          </Link>

          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">Task Details</h1>
            <button
              onClick={deleteTask}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
            >
              <Trash2 size={18} />
              Delete
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-8 space-y-6"
        >
          <div>
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Title
            </label>
            <input
              type="text"
              value={task.title}
              onChange={(e) => setTask({ ...task, title: e.target.value })}
              onBlur={() => updateTask({ title: task.title })}
              className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-primary-500 text-neutral-900 dark:text-white text-lg font-semibold"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Description
            </label>
            <textarea
              value={task.description || ''}
              onChange={(e) => setTask({ ...task, description: e.target.value })}
              onBlur={() => updateTask({ description: task.description })}
              rows={6}
              className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-primary-500 text-neutral-900 dark:text-white resize-none"
              placeholder="Add a description..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                Status
              </label>
              <select
                value={task.status}
                onChange={(e) => {
                  setTask({ ...task, status: e.target.value });
                  updateTask({ status: e.target.value });
                }}
                className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-primary-500 text-neutral-900 dark:text-white"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                Priority
              </label>
              <select
                value={task.priority}
                onChange={(e) => {
                  setTask({ ...task, priority: e.target.value });
                  updateTask({ priority: e.target.value });
                }}
                className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-primary-500 text-neutral-900 dark:text-white"
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
                value={task.due_at ? new Date(task.due_at).toISOString().split('T')[0] : ''}
                onChange={(e) => {
                  setTask({ ...task, due_at: e.target.value });
                  updateTask({ due_at: e.target.value });
                }}
                className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-primary-500 text-neutral-900 dark:text-white"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
            <div className="text-sm text-neutral-500 dark:text-neutral-400 space-y-2">
              <p>Created: {new Date(task.created_at).toLocaleString()}</p>
              <p>Updated: {new Date(task.updated_at).toLocaleString()}</p>
            </div>
          </div>

          {saving && (
            <div className="text-sm text-primary-800 dark:text-primary-500 flex items-center gap-2">
              <Save size={16} className="animate-pulse" />
              Saving...
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

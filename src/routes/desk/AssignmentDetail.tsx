import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { ArrowLeft, AlertCircle, Save } from 'lucide-react';

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

export function AssignmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && id) {
      loadAssignment();
    }
  }, [user, id]);

  async function loadAssignment() {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      setAssignment(data);
    } catch (error) {
      console.error('Error loading assignment:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateProgress(progress: number) {
    if (!assignment || !id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('assignments')
        .update({ progress_percent: progress })
        .eq('id', id);

      if (error) throw error;

      setAssignment({ ...assignment, progress_percent: progress });
    } catch (error) {
      console.error('Error updating progress:', error);
      alert('Failed to update progress');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-primary-800 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-neutral-600 dark:text-neutral-400">Loading assignment...</p>
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-4">Assignment not found</h2>
          <Link to="/desk/assignments" className="text-primary-800 hover:underline">
            Back to Assignments
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
            to="/desk/assignments"
            className="inline-flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-primary-800 dark:hover:text-primary-500 mb-4"
          >
            <ArrowLeft size={20} />
            Back to Assignments
          </Link>

          <div className="flex items-center gap-3">
            <AlertCircle size={32} className="text-orange-600" />
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">Assignment Details</h1>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-8 space-y-6"
        >
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
              {assignment.title}
            </h2>
            {assignment.details && (
              <p className="text-neutral-600 dark:text-neutral-400">{assignment.details}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-700">
              <div className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Status</div>
              <div className="text-lg font-semibold text-neutral-900 dark:text-white capitalize">
                {assignment.status.replace('_', ' ')}
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-700">
              <div className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Priority</div>
              <div className="text-lg font-semibold text-neutral-900 dark:text-white capitalize">
                {assignment.priority}
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-700">
              <div className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Due Date</div>
              <div className="text-lg font-semibold text-neutral-900 dark:text-white">
                {assignment.due_at ? new Date(assignment.due_at).toLocaleDateString() : 'No due date'}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                Progress
              </label>
              <span className="text-2xl font-bold text-primary-800 dark:text-primary-500">
                {assignment.progress_percent}%
              </span>
            </div>
            <div className="progress-modern mb-3">
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
              onChange={(e) => updateProgress(parseInt(e.target.value))}
              className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
            <div className="text-sm text-neutral-500 dark:text-neutral-400">
              <p>Created: {new Date(assignment.created_at).toLocaleString()}</p>
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

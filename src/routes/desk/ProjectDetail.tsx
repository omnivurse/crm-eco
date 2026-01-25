import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { ArrowLeft, Folder, Save, Trash2 } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  start_date: string | null;
  target_date: string | null;
  created_at: string;
}

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && id) {
      loadProject();
    }
  }, [user, id]);

  async function loadProject() {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      setProject(data);
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateProject(updates: Partial<Project>) {
    if (!project || !id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setProject({ ...project, ...updates });
    } catch (error) {
      console.error('Error updating project:', error);
      alert('Failed to update project');
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject() {
    if (!confirm('Are you sure you want to delete this project?')) return;
    if (!id) return;

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;

      navigate('/desk/projects');
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-primary-800 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-neutral-600 dark:text-neutral-400">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-4">Project not found</h2>
          <Link to="/desk/projects" className="text-primary-800 hover:underline">
            Back to Projects
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
            to="/desk/projects"
            className="inline-flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-primary-800 dark:hover:text-primary-500 mb-4"
          >
            <ArrowLeft size={20} />
            Back to Projects
          </Link>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Folder size={32} className="text-primary-800" />
              <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">Project Details</h1>
            </div>
            <button
              onClick={deleteProject}
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
              Project Name
            </label>
            <input
              type="text"
              value={project.name}
              onChange={(e) => setProject({ ...project, name: e.target.value })}
              onBlur={() => updateProject({ name: project.name })}
              className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-primary-500 text-neutral-900 dark:text-white text-lg font-semibold"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Description
            </label>
            <textarea
              value={project.description || ''}
              onChange={(e) => setProject({ ...project, description: e.target.value })}
              onBlur={() => updateProject({ description: project.description })}
              rows={6}
              className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-primary-500 text-neutral-900 dark:text-white resize-none"
              placeholder="Add a description..."
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                Status
              </label>
              <select
                value={project.status}
                onChange={(e) => {
                  setProject({ ...project, status: e.target.value });
                  updateProject({ status: e.target.value });
                }}
                className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-primary-500 text-neutral-900 dark:text-white"
              >
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={project.start_date ? new Date(project.start_date).toISOString().split('T')[0] : ''}
                onChange={(e) => {
                  setProject({ ...project, start_date: e.target.value });
                  updateProject({ start_date: e.target.value });
                }}
                className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-primary-500 text-neutral-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                Target Date
              </label>
              <input
                type="date"
                value={project.target_date ? new Date(project.target_date).toISOString().split('T')[0] : ''}
                onChange={(e) => {
                  setProject({ ...project, target_date: e.target.value });
                  updateProject({ target_date: e.target.value });
                }}
                className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-primary-500 text-neutral-900 dark:text-white"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
            <div className="text-sm text-neutral-500 dark:text-neutral-400">
              <p>Created: {new Date(project.created_at).toLocaleString()}</p>
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

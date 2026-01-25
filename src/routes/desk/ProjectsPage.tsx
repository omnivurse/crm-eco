import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { Plus, Folder, Clock, ArrowRight, Zap, CheckCircle2, Pause, X } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  start_date: string | null;
  target_date: string | null;
  created_at: string;
}

export function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectStatus, setNewProjectStatus] = useState('active');
  const [newProjectStartDate, setNewProjectStartDate] = useState('');
  const [newProjectTargetDate, setNewProjectTargetDate] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user]);

  async function loadProjects() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setProjects(data);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !newProjectName.trim()) return;

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          name: newProjectName.trim(),
          description: newProjectDescription.trim() || null,
          status: newProjectStatus,
          start_date: newProjectStartDate || null,
          target_date: newProjectTargetDate || null,
          owner_id: user.id
        })
        .select();

      if (error) throw error;

      setNewProjectName('');
      setNewProjectDescription('');
      setNewProjectStatus('active');
      setNewProjectStartDate('');
      setNewProjectTargetDate('');
      setShowCreateModal(false);
      loadProjects();
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Failed to create project. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'active': return 'bg-gradient-to-r from-green-500 to-green-600 text-white';
      case 'on_hold': return 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white';
      case 'completed': return 'bg-gradient-to-r from-primary-500 to-primary-700 text-white';
      case 'archived': return 'bg-gradient-to-r from-neutral-500 to-neutral-600 text-white';
      default: return 'bg-gradient-to-r from-neutral-500 to-neutral-600 text-white';
    }
  }

  function getStatusBorderColor(status: string) {
    switch (status) {
      case 'active': return 'border-l-4 border-success-500';
      case 'on_hold': return 'border-l-4 border-yellow-500';
      case 'completed': return 'border-l-4 border-primary-600';
      case 'archived': return 'border-l-4 border-neutral-500';
      default: return 'border-l-4 border-neutral-500';
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-primary-800 border-t-transparent rounded-full animate-spin glow-effect"></div>
          <p className="mt-4 text-neutral-600 dark:text-neutral-400 font-medium">Loading projects...</p>
        </div>
      </div>
    );
  }

  const activeProjects = projects.filter(p => p.status === 'active');
  const onHoldProjects = projects.filter(p => p.status === 'on_hold');
  const completedProjects = projects.filter(p => p.status === 'completed');

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
                  rotateY: [0, 180, 360]
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="p-5 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20"
              >
                <Folder size={52} className="text-white" />
              </motion.div>
              <div>
                <h1 className="text-6xl font-black mb-2 tracking-tight">Projects</h1>
                <p className="text-2xl text-cyan-100 font-medium">Organize tasks into projects and track progress</p>
              </div>
            </motion.div>
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              onClick={() => setShowCreateModal(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-8 py-4 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-xl transition-all font-semibold border-2 border-white/30 shadow-2xl hover:shadow-white/20 text-lg"
            >
              <Plus className="h-6 w-6" />
              New Project
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
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Active</div>
                  <div className="text-3xl font-bold text-neutral-900 dark:text-white">{activeProjects.length}</div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                  <Zap className="text-green-600 dark:text-green-300" size={24} />
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
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">On Hold</div>
                  <div className="text-3xl font-bold text-neutral-900 dark:text-white">{onHoldProjects.length}</div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-yellow-100 dark:bg-yellow-500/20 flex items-center justify-center">
                  <Pause className="text-yellow-600 dark:text-yellow-300" size={24} />
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
                  <div className="text-3xl font-bold text-neutral-900 dark:text-white">{completedProjects.length}</div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                  <CheckCircle2 className="text-blue-600 dark:text-blue-300" size={24} />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {projects.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-16 text-center"
          >
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-900/30 flex items-center justify-center mx-auto mb-6">
              <Folder className="text-primary-800 dark:text-primary-500 floating" size={48} />
            </div>
            <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">No projects yet</h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">Create your first project to get started</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-700 to-primary-800 hover:from-primary-800 hover:to-primary-900 text-white rounded-xl transition-all transform hover:scale-105 font-medium shadow-lg hover:shadow-xl"
            >
              <Plus className="h-5 w-5" />
              Create Project
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link
                  to={`/desk/projects/${project.id}`}
                  className={`block glass-card p-6 hover:shadow-lg transition-all group ${getStatusBorderColor(project.status)}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl">
                        <Folder className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-neutral-900 dark:text-white group-hover:text-primary-800 dark:group-hover:text-primary-500 transition-colors">{project.name}</h3>
                        <span className={`modern-badge text-xs px-3 py-1 rounded-full mt-1 inline-block ${getStatusColor(project.status)}`}>
                          {project.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {project.description && (
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4 line-clamp-2">{project.description}</p>
                  )}

                  <div className="flex items-center justify-between">
                    {project.target_date && (
                      <div className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                        <Clock className="h-4 w-4" />
                        Target: {new Date(project.target_date).toLocaleDateString()}
                      </div>
                    )}
                    <ArrowRight className="h-4 w-4 text-neutral-400 group-hover:text-primary-800 group-hover:translate-x-1 transition-all ml-auto" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 px-6 py-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Create New Project</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
                </button>
              </div>

              <form onSubmit={handleCreateProject} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Enter project name..."
                    required
                    className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-neutral-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    placeholder="Add project description..."
                    rows={4}
                    className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-neutral-900 dark:text-white resize-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                      Status
                    </label>
                    <select
                      value={newProjectStatus}
                      onChange={(e) => setNewProjectStatus(e.target.value)}
                      className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-neutral-900 dark:text-white"
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
                      value={newProjectStartDate}
                      onChange={(e) => setNewProjectStartDate(e.target.value)}
                      className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-neutral-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                      Target Date
                    </label>
                    <input
                      type="date"
                      value={newProjectTargetDate}
                      onChange={(e) => setNewProjectTargetDate(e.target.value)}
                      className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-neutral-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-6 py-3 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl font-semibold hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || !newProjectName.trim()}
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
                        Create Project
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

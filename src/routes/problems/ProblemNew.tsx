import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { ArrowLeft, Save, Loader2, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

interface Team {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

export function ProblemNew() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'investigating',
    priority: 'medium',
    root_cause: '',
    workaround_md: '',
    resolution_md: '',
    owner_id: profile?.id || '',
    assigned_team_id: '',
  });

  useEffect(() => {
    fetchTeams();
    fetchProfiles();
  }, []);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name');

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      const problemData: any = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        status: formData.status,
        priority: formData.priority,
        root_cause: formData.root_cause.trim() || null,
        workaround_md: formData.workaround_md.trim() || null,
        resolution_md: formData.resolution_md.trim() || null,
        owner_id: formData.owner_id || null,
        assigned_team_id: formData.assigned_team_id || null,
      };

      const { data, error } = await supabase
        .from('problems')
        .insert([problemData])
        .select()
        .single();

      if (error) throw error;

      navigate(`/problems/${data.id}`);
    } catch (error) {
      console.error('Error creating problem:', error);
      setErrors({ submit: 'Failed to create problem. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <button
          onClick={() => navigate('/problems')}
          className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-neutral-600 dark:text-neutral-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Create New Problem</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            Document a new problem for investigation and tracking
          </p>
        </div>
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onSubmit={handleSubmit}
        className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 overflow-hidden"
      >
        <div className="p-6 space-y-6">
          {errors.submit && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
              <AlertTriangle className="text-accent-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
              <p className="text-sm text-red-800 dark:text-red-400">{errors.submit}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Problem Title <span className="text-accent-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="Brief description of the problem..."
                className={`w-full px-4 py-2.5 border rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all ${
                  errors.title ? 'border-red-300 dark:border-red-700' : 'border-neutral-300 dark:border-neutral-600'
                }`}
              />
              {errors.title && <p className="mt-1 text-sm text-accent-600 dark:text-red-400">{errors.title}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Description <span className="text-accent-500">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={4}
                placeholder="Detailed description of the problem and its impact..."
                className={`w-full px-4 py-2.5 border rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none ${
                  errors.description ? 'border-red-300 dark:border-red-700' : 'border-neutral-300 dark:border-neutral-600'
                }`}
              />
              {errors.description && <p className="mt-1 text-sm text-accent-600 dark:text-red-400">{errors.description}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              >
                <option value="investigating">Investigating</option>
                <option value="root_cause_found">Root Cause Found</option>
                <option value="known_error">Known Error</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => handleChange('priority', e.target.value)}
                className="w-full px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Owner
              </label>
              <select
                value={formData.owner_id}
                onChange={(e) => handleChange('owner_id', e.target.value)}
                className="w-full px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              >
                <option value="">Unassigned</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Assigned Team
              </label>
              <select
                value={formData.assigned_team_id}
                onChange={(e) => handleChange('assigned_team_id', e.target.value)}
                className="w-full px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              >
                <option value="">Unassigned</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Root Cause Analysis
              </label>
              <textarea
                value={formData.root_cause}
                onChange={(e) => handleChange('root_cause', e.target.value)}
                rows={4}
                placeholder="Detailed root cause analysis (optional)..."
                className="w-full px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
              />
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
                Explain the underlying cause of this problem
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Workaround
              </label>
              <textarea
                value={formData.workaround_md}
                onChange={(e) => handleChange('workaround_md', e.target.value)}
                rows={4}
                placeholder="Temporary workaround steps (optional)..."
                className="w-full px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
              />
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
                Document any temporary fixes or workarounds
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Resolution
              </label>
              <textarea
                value={formData.resolution_md}
                onChange={(e) => handleChange('resolution_md', e.target.value)}
                rows={4}
                placeholder="Permanent resolution steps (optional)..."
                className="w-full px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
              />
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
                Document the permanent fix or solution
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-900/50 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/problems')}
            className="px-6 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary-700 to-primary-800 hover:from-primary-800 hover:to-primary-900 text-white font-medium rounded-xl shadow-lg shadow-primary-800/30 transition-all duration-200 hover:shadow-xl hover:shadow-primary-800/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save size={20} />
                Create Problem
              </>
            )}
          </button>
        </div>
      </motion.form>
    </div>
  );
}

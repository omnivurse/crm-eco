import { useState } from 'react';
import { X, AlertCircle, Calendar, Pin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';

interface AnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AnnouncementModal({ isOpen, onClose, onSuccess }: AnnouncementModalProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    priority: 'medium',
    target_roles: ['staff', 'agent', 'admin', 'super_admin'],
    expires_at: '',
    is_pinned: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload: any = {
        ...formData,
        created_by: profile?.id,
        expires_at: formData.expires_at || null,
      };

      const { data: announcement, error: announcementError } = await supabase
        .from('team_announcements')
        .insert(payload)
        .select()
        .single();

      if (announcementError) throw announcementError;

      await supabase.from('team_activities').insert({
        user_id: profile?.id,
        action_type: 'announcement_created',
        entity_type: 'announcement',
        entity_id: announcement.id,
        metadata: {
          title: formData.title,
          priority: formData.priority,
        },
      });

      onSuccess();
      onClose();
      setFormData({
        title: '',
        content: '',
        priority: 'medium',
        target_roles: ['staff', 'agent', 'admin', 'super_admin'],
        expires_at: '',
        is_pinned: false,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create announcement');
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = (role: string) => {
    setFormData(prev => ({
      ...prev,
      target_roles: prev.target_roles.includes(role)
        ? prev.target_roles.filter(r => r !== role)
        : [...prev.target_roles, role],
    }));
  };

  if (!isOpen) return null;

  const priorityOptions = [
    { value: 'low', label: 'Low', color: 'text-neutral-600 dark:text-neutral-400' },
    { value: 'normal', label: 'Normal', color: 'text-primary-800 dark:text-primary-500' },
    { value: 'high', label: 'High', color: 'text-orange-600 dark:text-orange-400' },
    { value: 'urgent', label: 'Urgent', color: 'text-accent-600 dark:text-red-400' },
  ];

  const roleOptions = [
    { value: 'staff', label: 'Staff' },
    { value: 'agent', label: 'Agents' },
    { value: 'admin', label: 'Admins' },
    { value: 'super_admin', label: 'Super Admins' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">New Announcement</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Announcement title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Content *
            </label>
            <textarea
              required
              value={formData.content}
              onChange={e => setFormData({ ...formData, content: e.target.value })}
              rows={6}
              className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Write your announcement here..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              <AlertCircle className="inline mr-2" size={16} />
              Priority
            </label>
            <div className="grid grid-cols-4 gap-2">
              {priorityOptions.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, priority: option.value })}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    formData.priority === option.value
                      ? 'border-primary-600 bg-primary-50 dark:bg-primary-950/20 text-primary-900 dark:text-primary-300'
                      : 'border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Target Roles
            </label>
            <div className="space-y-2">
              {roleOptions.map(role => (
                <label
                  key={role.value}
                  className="flex items-center gap-3 p-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formData.target_roles.includes(role.value)}
                    onChange={() => toggleRole(role.value)}
                    className="w-4 h-4 text-primary-800 rounded focus:ring-2 focus:ring-primary-500"
                  />
                  <span className="text-sm text-neutral-900 dark:text-white">{role.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              <Calendar className="inline mr-2" size={16} />
              Expiration Date (Optional)
            </label>
            <input
              type="datetime-local"
              value={formData.expires_at}
              onChange={e => setFormData({ ...formData, expires_at: e.target.value })}
              className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Leave empty for permanent announcement
            </p>
          </div>

          <div>
            <label className="flex items-center gap-3 p-3 hover:bg-neutral-50 dark:hover:bg-neutral-700 rounded cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_pinned}
                onChange={e => setFormData({ ...formData, is_pinned: e.target.checked })}
                className="w-4 h-4 text-primary-800 rounded focus:ring-2 focus:ring-primary-500"
              />
              <div className="flex items-center gap-2">
                <Pin size={16} className="text-neutral-600 dark:text-neutral-400" />
                <span className="text-sm font-medium text-neutral-900 dark:text-white">
                  Pin this announcement
                </span>
              </div>
            </label>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 ml-7 mt-1">
              Pinned announcements appear at the top
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Publishing...' : 'Publish Announcement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

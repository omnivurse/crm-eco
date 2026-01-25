import { useState, useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { supabase } from '../../lib/supabase';
import { SupportContact } from '../../components/ui/SupportContact';
import { OneDriveSettings } from '../../components/integrations/OneDriveSettings';
import { Save, User, Bell, Shield, Mail, HelpCircle } from 'lucide-react';

export function Settings() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    notifications_enabled: true,
    email_notifications: true,
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        email: profile.email || '',
        notifications_enabled: true,
        email_notifications: true,
      });
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
        })
        .eq('id', profile?.id);

      if (error) throw error;

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-6">Settings</h1>

      <div className="space-y-6">
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow">
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center gap-2">
              <User size={20} className="text-neutral-600 dark:text-neutral-400" />
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Profile Settings</h2>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                disabled
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 cursor-not-allowed"
              />
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                Email cannot be changed
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Role
              </label>
              <input
                type="text"
                value={profile?.role || 'N/A'}
                disabled
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 cursor-not-allowed capitalize"
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow">
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center gap-2">
              <Bell size={20} className="text-neutral-600 dark:text-neutral-400" />
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                Notification Preferences
              </h2>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-neutral-900 dark:text-white">Push Notifications</p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Receive notifications in your browser
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.notifications_enabled}
                  onChange={(e) =>
                    setFormData({ ...formData, notifications_enabled: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-primary-800"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-neutral-900 dark:text-white">Email Notifications</p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Receive notifications via email
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.email_notifications}
                  onChange={(e) =>
                    setFormData({ ...formData, email_notifications: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-primary-800"></div>
              </label>
            </div>
          </div>
        </div>

        <OneDriveSettings />

        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow">
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center gap-2">
              <HelpCircle size={20} className="text-neutral-600 dark:text-neutral-400" />
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                Support & Help
              </h2>
            </div>
          </div>
          <div className="p-6">
            <SupportContact />
          </div>
        </div>

        {(profile?.role === 'admin' || profile?.role === 'super_admin') && (
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center gap-2">
                <Shield size={20} className="text-neutral-600 dark:text-neutral-400" />
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                  System Settings
                </h2>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                System-wide settings and configurations will be available here for administrators.
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={handleSave}
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-2 bg-primary-800 hover:bg-primary-900 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
          >
            <Save size={20} />
            {loading ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

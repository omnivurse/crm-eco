import { useState, useEffect } from 'react';
import { X, UserPlus, Trash2, Bell, BellOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';

interface Watcher {
  id: string;
  user_id: string;
  notify_on_update: boolean;
  notify_on_comment: boolean;
  notify_on_status_change: boolean;
  user: {
    full_name: string;
    email: string;
  };
}

interface StaffMember {
  id: string;
  full_name: string;
  email: string;
}

interface ManageWatchersModalProps {
  ticketId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ManageWatchersModal({ ticketId, isOpen, onClose }: ManageWatchersModalProps) {
  const { profile } = useAuth();
  const [watchers, setWatchers] = useState<Watcher[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (isOpen && ticketId) {
      fetchWatchers();
      fetchStaffMembers();
    }
  }, [isOpen, ticketId]);

  const fetchWatchers = async () => {
    try {
      const { data, error } = await supabase
        .from('ticket_watchers')
        .select(`
          id,
          user_id,
          notify_on_update,
          notify_on_comment,
          notify_on_status_change,
          user:profiles!ticket_watchers_user_id_fkey(full_name, email)
        `)
        .eq('ticket_id', ticketId);

      if (error) throw error;
      setWatchers(data as any || []);
    } catch (err) {
      console.error('Error fetching watchers:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('role', ['staff', 'agent', 'admin', 'super_admin'])
        .order('full_name');

      if (error) throw error;
      setStaffMembers(data || []);
    } catch (err) {
      console.error('Error fetching staff members:', err);
    }
  };

  const handleAddWatcher = async () => {
    if (!selectedUserId) return;

    setAdding(true);
    try {
      const { error } = await supabase
        .from('ticket_watchers')
        .insert({
          ticket_id: ticketId,
          user_id: selectedUserId,
          added_by: profile?.id,
          notify_on_update: true,
          notify_on_comment: true,
          notify_on_status_change: true,
        });

      if (error) throw error;

      setSelectedUserId('');
      await fetchWatchers();
    } catch (err: any) {
      console.error('Error adding watcher:', err);
      alert('Failed to add watcher: ' + (err.message || 'Unknown error'));
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveWatcher = async (watcherId: string) => {
    try {
      const { error } = await supabase
        .from('ticket_watchers')
        .delete()
        .eq('id', watcherId);

      if (error) throw error;

      await fetchWatchers();
    } catch (err: any) {
      console.error('Error removing watcher:', err);
      alert('Failed to remove watcher: ' + (err.message || 'Unknown error'));
    }
  };

  const handleToggleNotification = async (watcherId: string, field: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('ticket_watchers')
        .update({ [field]: !currentValue })
        .eq('id', watcherId);

      if (error) throw error;

      await fetchWatchers();
    } catch (err: any) {
      console.error('Error updating notification:', err);
    }
  };

  const availableStaff = staffMembers.filter(
    (staff) => !watchers.some((w) => w.user_id === staff.id)
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
            Manage Watchers
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Add Watcher
            </label>
            <div className="flex gap-2">
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Select a staff member...</option>
                {availableStaff.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.full_name || staff.email}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddWatcher}
                disabled={!selectedUserId || adding}
                className="flex items-center gap-2 px-4 py-2 bg-primary-800 hover:bg-primary-900 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <UserPlus size={18} />
                Add
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block w-8 h-8 border-4 border-primary-800 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : watchers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-neutral-600 dark:text-neutral-400">
                No watchers yet. Add staff members to receive notifications.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {watchers.map((watcher) => (
                <div
                  key={watcher.id}
                  className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-neutral-900 dark:text-white">
                      {watcher.user.full_name || watcher.user.email}
                    </p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      {watcher.user.email}
                    </p>
                    <div className="flex gap-3 mt-2">
                      <button
                        onClick={() =>
                          handleToggleNotification(watcher.id, 'notify_on_update', watcher.notify_on_update)
                        }
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                          watcher.notify_on_update
                            ? 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200'
                            : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400'
                        }`}
                      >
                        {watcher.notify_on_update ? <Bell size={12} /> : <BellOff size={12} />}
                        Updates
                      </button>
                      <button
                        onClick={() =>
                          handleToggleNotification(watcher.id, 'notify_on_comment', watcher.notify_on_comment)
                        }
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                          watcher.notify_on_comment
                            ? 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200'
                            : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400'
                        }`}
                      >
                        {watcher.notify_on_comment ? <Bell size={12} /> : <BellOff size={12} />}
                        Comments
                      </button>
                      <button
                        onClick={() =>
                          handleToggleNotification(
                            watcher.id,
                            'notify_on_status_change',
                            watcher.notify_on_status_change
                          )
                        }
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                          watcher.notify_on_status_change
                            ? 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200'
                            : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400'
                        }`}
                      >
                        {watcher.notify_on_status_change ? <Bell size={12} /> : <BellOff size={12} />}
                        Status
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveWatcher(watcher.id)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Remove watcher"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50">
          <button
            onClick={onClose}
            className="px-5 py-2 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-xl font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

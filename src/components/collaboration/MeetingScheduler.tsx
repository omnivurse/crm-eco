import { useState } from 'react';
import { X, Calendar, Clock, Users, Link, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';

interface MeetingSchedulerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface TeamMember {
  id: string;
  full_name: string | null;
  email: string;
}

export function MeetingScheduler({ isOpen, onClose, onSuccess }: MeetingSchedulerProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [showParticipants, setShowParticipants] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    scheduled_at: '',
    duration_minutes: 60,
    meeting_link: '',
    location: '',
  });

  const fetchTeamMembers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('role', ['staff', 'agent', 'admin', 'super_admin'])
      .order('full_name');

    if (data) {
      setTeamMembers(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: meeting, error: meetingError } = await supabase
        .from('team_meetings')
        .insert({
          ...formData,
          created_by: profile?.id,
        })
        .select()
        .single();

      if (meetingError) throw meetingError;

      if (meeting && selectedParticipants.length > 0) {
        const participants = selectedParticipants.map(userId => ({
          meeting_id: meeting.id,
          user_id: userId,
          status: 'invited',
        }));

        const { error: participantsError } = await supabase
          .from('meeting_participants')
          .insert(participants);

        if (participantsError) throw participantsError;
      }

      await supabase.from('team_activities').insert({
        user_id: profile?.id,
        action_type: 'meeting_created',
        entity_type: 'meeting',
        entity_id: meeting.id,
        metadata: {
          title: formData.title,
          scheduled_at: formData.scheduled_at,
        },
      });

      onSuccess();
      onClose();
      setFormData({
        title: '',
        description: '',
        scheduled_at: '',
        duration_minutes: 60,
        meeting_link: '',
        location: '',
      });
      setSelectedParticipants([]);
    } catch (err: any) {
      setError(err.message || 'Failed to create meeting');
    } finally {
      setLoading(false);
    }
  };

  const toggleParticipant = (userId: string) => {
    setSelectedParticipants(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">Schedule Meeting</h2>
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
              Meeting Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Team standup, Sprint planning, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Meeting agenda and details..."
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                <Calendar className="inline mr-2" size={16} />
                Date & Time *
              </label>
              <input
                type="datetime-local"
                required
                value={formData.scheduled_at}
                onChange={e => setFormData({ ...formData, scheduled_at: e.target.value })}
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                <Clock className="inline mr-2" size={16} />
                Duration (minutes)
              </label>
              <input
                type="number"
                min="15"
                max="480"
                step="15"
                value={formData.duration_minutes}
                onChange={e => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              <Link className="inline mr-2" size={16} />
              Meeting Link
            </label>
            <input
              type="url"
              value={formData.meeting_link}
              onChange={e => setFormData({ ...formData, meeting_link: e.target.value })}
              className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="https://zoom.us/j/..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              <MapPin className="inline mr-2" size={16} />
              Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={e => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Conference Room A, Virtual, etc."
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => {
                setShowParticipants(!showParticipants);
                if (!showParticipants && teamMembers.length === 0) {
                  fetchTeamMembers();
                }
              }}
              className="flex items-center gap-2 text-sm font-medium text-primary-800 dark:text-primary-500 hover:text-primary-900 dark:hover:text-primary-300"
            >
              <Users size={16} />
              Add Participants ({selectedParticipants.length} selected)
            </button>

            {showParticipants && (
              <div className="mt-3 p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg max-h-48 overflow-y-auto">
                {teamMembers.map(member => (
                  <label
                    key={member.id}
                    className="flex items-center gap-3 p-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedParticipants.includes(member.id)}
                      onChange={() => toggleParticipant(member.id)}
                      className="w-4 h-4 text-primary-800 rounded focus:ring-2 focus:ring-primary-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                        {member.full_name || member.email}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{member.email}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
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
              className="flex-1 px-4 py-2 bg-primary-800 hover:bg-primary-900 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

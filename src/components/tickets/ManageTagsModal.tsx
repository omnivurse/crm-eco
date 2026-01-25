import { useState, useEffect } from 'react';
import { X, Plus, Tag as TagIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';

interface Tag {
  id: string;
  name: string;
  color: string;
  description?: string;
}

interface TicketTag {
  id: string;
  tag_id: string;
  tag: Tag;
}

interface ManageTagsModalProps {
  ticketId: string;
  isOpen: boolean;
  onClose: () => void;
  onTagsUpdated?: () => void;
}

export function ManageTagsModal({ ticketId, isOpen, onClose, onTagsUpdated }: ManageTagsModalProps) {
  const { profile } = useAuth();
  const [ticketTags, setTicketTags] = useState<TicketTag[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTagId, setSelectedTagId] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (isOpen && ticketId) {
      fetchTicketTags();
      fetchAvailableTags();
    }
  }, [isOpen, ticketId]);

  const fetchTicketTags = async () => {
    try {
      const { data, error } = await supabase
        .from('ticket_tags')
        .select(`
          id,
          tag_id,
          tag:tag_definitions(id, name, color, description)
        `)
        .eq('ticket_id', ticketId);

      if (error) throw error;
      setTicketTags(data as any || []);
    } catch (err) {
      console.error('Error fetching ticket tags:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableTags = async () => {
    try {
      const { data, error } = await supabase
        .from('tag_definitions')
        .select('id, name, color, description')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setAvailableTags(data || []);
    } catch (err) {
      console.error('Error fetching available tags:', err);
    }
  };

  const handleAddTag = async () => {
    if (!selectedTagId) return;

    setAdding(true);
    try {
      const { error } = await supabase
        .from('ticket_tags')
        .insert({
          ticket_id: ticketId,
          tag_id: selectedTagId,
          added_by: profile?.id,
        });

      if (error) throw error;

      setSelectedTagId('');
      await fetchTicketTags();
      if (onTagsUpdated) onTagsUpdated();
    } catch (err: any) {
      console.error('Error adding tag:', err);
      if (err.code === '23505') {
        alert('This tag is already added to the ticket');
      } else {
        alert('Failed to add tag: ' + (err.message || 'Unknown error'));
      }
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveTag = async (ticketTagId: string) => {
    try {
      const { error } = await supabase
        .from('ticket_tags')
        .delete()
        .eq('id', ticketTagId);

      if (error) throw error;

      await fetchTicketTags();
      if (onTagsUpdated) onTagsUpdated();
    } catch (err: any) {
      console.error('Error removing tag:', err);
      alert('Failed to remove tag: ' + (err.message || 'Unknown error'));
    }
  };

  const untaggedOptions = availableTags.filter(
    (tag) => !ticketTags.some((tt) => tt.tag_id === tag.id)
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-xl w-full max-h-[70vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <TagIcon size={24} className="text-primary-800 dark:text-primary-500" />
            Manage Tags
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
              Add Tag
            </label>
            <div className="flex gap-2">
              <select
                value={selectedTagId}
                onChange={(e) => setSelectedTagId(e.target.value)}
                className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Select a tag...</option>
                {untaggedOptions.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddTag}
                disabled={!selectedTagId || adding}
                className="flex items-center gap-2 px-4 py-2 bg-primary-800 hover:bg-primary-900 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={18} />
                Add
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block w-8 h-8 border-4 border-primary-800 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : ticketTags.length === 0 ? (
            <div className="text-center py-8">
              <TagIcon size={48} className="mx-auto text-neutral-300 dark:text-neutral-600 mb-3" />
              <p className="text-neutral-600 dark:text-neutral-400">
                No tags yet. Add tags to organize and categorize this ticket.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                Current Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {ticketTags.map((ticketTag) => (
                  <div
                    key={ticketTag.id}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all group"
                    style={{
                      backgroundColor: `${ticketTag.tag.color}15`,
                      borderColor: ticketTag.tag.color,
                      color: ticketTag.tag.color,
                    }}
                  >
                    <TagIcon size={14} />
                    <span className="font-semibold text-sm">{ticketTag.tag.name}</span>
                    {ticketTag.tag.description && (
                      <span className="text-xs opacity-75">
                        — {ticketTag.tag.description}
                      </span>
                    )}
                    <button
                      onClick={() => handleRemoveTag(ticketTag.id)}
                      className="ml-2 p-1 hover:bg-black/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Remove tag"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50">
          <button
            onClick={onClose}
            className="px-5 py-2 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-xl font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

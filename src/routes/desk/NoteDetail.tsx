import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { ArrowLeft, FileText, Save, Trash2, Lock, Users } from 'lucide-react';

interface Note {
  id: string;
  title: string;
  content_rich: string | null;
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

export function NoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && id) {
      loadNote();
    }
  }, [user, id]);

  async function loadNote() {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      setNote(data);
    } catch (error) {
      console.error('Error loading note:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateNote(updates: Partial<Note>) {
    if (!note || !id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('notes')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setNote({ ...note, ...updates });
    } catch (error) {
      console.error('Error updating note:', error);
      alert('Failed to update note');
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote() {
    if (!confirm('Are you sure you want to delete this note?')) return;
    if (!id) return;

    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      navigate('/desk/notes');
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Failed to delete note');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-primary-800 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-neutral-600 dark:text-neutral-400">Loading note...</p>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-4">Note not found</h2>
          <Link to="/desk/notes" className="text-primary-800 hover:underline">
            Back to Notes
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
            to="/desk/notes"
            className="inline-flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-primary-800 dark:hover:text-primary-500 mb-4"
          >
            <ArrowLeft size={20} />
            Back to Notes
          </Link>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText size={32} className="text-success-600" />
              <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">Note Details</h1>
            </div>
            <button
              onClick={deleteNote}
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
              value={note.title}
              onChange={(e) => setNote({ ...note, title: e.target.value })}
              onBlur={() => updateNote({ title: note.title })}
              className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-success-500 text-neutral-900 dark:text-white text-lg font-semibold"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Content
            </label>
            <textarea
              value={note.content_rich || ''}
              onChange={(e) => setNote({ ...note, content_rich: e.target.value })}
              onBlur={() => updateNote({ content_rich: note.content_rich })}
              rows={12}
              className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-success-500 text-neutral-900 dark:text-white resize-none"
              placeholder="Write your note content..."
            />
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={note.is_private}
                onChange={(e) => {
                  setNote({ ...note, is_private: e.target.checked });
                  updateNote({ is_private: e.target.checked });
                }}
                className="w-5 h-5 text-success-600 border-neutral-300 rounded focus:ring-success-500"
              />
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                {note.is_private ? (
                  <>
                    <Lock size={16} className="text-yellow-500" />
                    Private Note
                  </>
                ) : (
                  <>
                    <Users size={16} className="text-success-600" />
                    Shared Note
                  </>
                )}
              </span>
            </label>
          </div>

          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
            <div className="text-sm text-neutral-500 dark:text-neutral-400 space-y-2">
              <p>Created: {new Date(note.created_at).toLocaleString()}</p>
              <p>Updated: {new Date(note.updated_at).toLocaleString()}</p>
            </div>
          </div>

          {saving && (
            <div className="text-sm text-success-600 dark:text-green-400 flex items-center gap-2">
              <Save size={16} className="animate-pulse" />
              Saving...
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

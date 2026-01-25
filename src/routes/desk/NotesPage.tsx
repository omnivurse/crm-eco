import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { Plus, FileText, Lock, Users, ArrowRight, X } from 'lucide-react';

interface Note {
  id: string;
  title: string;
  content_rich: string | null;
  is_private: boolean;
  updated_at: string;
  created_at: string;
}

export function NotesPage() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (user) {
      loadNotes();
    }
  }, [user]);

  async function loadNotes() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      if (data) setNotes(data);
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateNote(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !newNoteTitle.trim()) return;

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from('notes')
        .insert({
          title: newNoteTitle.trim(),
          content_rich: newNoteContent.trim() || null,
          is_private: isPrivate,
          owner_id: user.id
        })
        .select();

      if (error) throw error;

      setNewNoteTitle('');
      setNewNoteContent('');
      setIsPrivate(false);
      setShowCreateModal(false);
      loadNotes();
    } catch (error) {
      console.error('Error creating note:', error);
      alert('Failed to create note. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }

  function getPreview(content: string | null) {
    if (!content) return 'No content';
    const text = content.replace(/<[^>]*>/g, '');
    return text.length > 100 ? text.substring(0, 100) + '...' : text;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-primary-800 border-t-transparent rounded-full animate-spin glow-effect"></div>
          <p className="mt-4 text-neutral-600 dark:text-neutral-400 font-medium">Loading notes...</p>
        </div>
      </div>
    );
  }

  const privateNotes = notes.filter(n => n.is_private);
  const sharedNotes = notes.filter(n => !n.is_private);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="hero-content text-white py-20 px-6"
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
                  rotate: [0, 10, -10, 0],
                  scale: [1, 1.05, 1]
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="p-5 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20"
              >
                <FileText size={52} className="text-white" />
              </motion.div>
              <div>
                <h1 className="text-6xl font-black mb-2 tracking-tight">Notes</h1>
                <p className="text-2xl text-cyan-100 font-medium">Capture ideas, meeting notes, and documentation</p>
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
              New Note
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
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Total Notes</div>
                  <div className="text-3xl font-bold text-neutral-900 dark:text-white">{notes.length}</div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                  <FileText className="text-blue-600 dark:text-blue-300" size={24} />
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
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Private</div>
                  <div className="text-3xl font-bold text-neutral-900 dark:text-white">{privateNotes.length}</div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-yellow-100 dark:bg-yellow-500/20 flex items-center justify-center">
                  <Lock className="text-yellow-600 dark:text-yellow-300" size={24} />
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
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Shared</div>
                  <div className="text-3xl font-bold text-neutral-900 dark:text-white">{sharedNotes.length}</div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                  <Users className="text-green-600 dark:text-green-300" size={24} />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {notes.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-16 text-center"
          >
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 flex items-center justify-center mx-auto mb-6">
              <FileText className="text-success-600 dark:text-green-400 floating" size={48} />
            </div>
            <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">No notes yet</h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">Create your first note to start documenting</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl transition-all transform hover:scale-105 font-medium shadow-lg hover:shadow-xl"
            >
              <Plus className="h-5 w-5" />
              Create Note
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {notes.map((note, index) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link
                  to={`/desk/notes/${note.id}`}
                  className="block glass-card p-6 hover:shadow-lg transition-all group border-l-4 border-l-green-500"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-neutral-900 dark:text-white line-clamp-2 group-hover:text-success-600 dark:group-hover:text-green-400 transition-colors">{note.title}</h3>
                    {note.is_private ? (
                      <Lock className="h-5 w-5 text-yellow-500 flex-shrink-0 ml-2" />
                    ) : (
                      <Users className="h-5 w-5 text-success-500 flex-shrink-0 ml-2" />
                    )}
                  </div>

                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4 line-clamp-3">
                    {getPreview(note.content_rich)}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                      Updated {new Date(note.updated_at).toLocaleDateString()}
                    </div>
                    <ArrowRight className="h-4 w-4 text-neutral-400 group-hover:text-success-600 group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create Note Modal */}
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
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Create New Note</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
                </button>
              </div>

              <form onSubmit={handleCreateNote} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                    Note Title *
                  </label>
                  <input
                    type="text"
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    placeholder="Enter note title..."
                    required
                    className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-success-500 focus:border-transparent transition-all text-neutral-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                    Content
                  </label>
                  <textarea
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder="Add note content..."
                    rows={8}
                    className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-success-500 focus:border-transparent transition-all text-neutral-900 dark:text-white resize-none"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_private"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                    className="w-4 h-4 text-success-600 border-neutral-300 rounded focus:ring-success-500"
                  />
                  <label htmlFor="is_private" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Make this note private
                  </label>
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
                    disabled={isCreating || !newNoteTitle.trim()}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isCreating ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="h-5 w-5" />
                        Create Note
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

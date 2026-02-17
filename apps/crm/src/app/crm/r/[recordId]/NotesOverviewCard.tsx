'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  StickyNote,
  Plus,
  Pin,
  Search,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  User,
  Loader2,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Textarea } from '@crm-eco/ui/components/textarea';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import type { CrmNoteWithAuthor } from '@/lib/crm/types';

interface NotesOverviewCardProps {
  notes: CrmNoteWithAuthor[];
  recordId: string;
  onViewAll?: () => void;
}

const PREVIEW_LIMIT = 5;
const TRUNCATE_LENGTH = 200;

function NotePreviewItem({ note }: { note: CrmNoteWithAuthor }) {
  const [expanded, setExpanded] = useState(false);
  const isTruncated = note.body.length > TRUNCATE_LENGTH;
  const displayBody = expanded || !isTruncated ? note.body : note.body.slice(0, TRUNCATE_LENGTH) + '...';

  return (
    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 transition-colors">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
          {note.author?.avatar_url ? (
            <img src={note.author.avatar_url} alt="" className="w-6 h-6 rounded-full" />
          ) : (
            <User className="w-3 h-3 text-slate-400" />
          )}
        </div>
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
          {note.author?.full_name || 'Unknown'}
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">
          {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
        </span>
        {note.is_pinned && (
          <Pin className="w-3 h-3 text-amber-500 fill-amber-500 flex-shrink-0" />
        )}
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
        {displayBody}
      </p>
      {isTruncated && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium flex items-center gap-0.5"
        >
          {expanded ? (
            <>Show less <ChevronUp className="w-3 h-3" /></>
          ) : (
            <>Show more <ChevronDown className="w-3 h-3" /></>
          )}
        </button>
      )}
    </div>
  );
}

export function NotesOverviewCard({ notes, recordId, onViewAll }: NotesOverviewCardProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [notes]);

  const filteredNotes = useMemo(() => {
    if (!search.trim()) return sortedNotes;
    const q = search.toLowerCase();
    return sortedNotes.filter(
      (n) =>
        n.body.toLowerCase().includes(q) ||
        (n.author?.full_name || '').toLowerCase().includes(q)
    );
  }, [sortedNotes, search]);

  const previewNotes = filteredNotes.slice(0, PREVIEW_LIMIT);
  const hasMore = filteredNotes.length > PREVIEW_LIMIT;
  const pinnedCount = notes.filter((n) => n.is_pinned).length;

  const handleSubmit = async () => {
    if (!newNote.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/crm/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_id: recordId,
          body: newNote.trim(),
        }),
      });

      if (!response.ok) throw new Error('Failed to create note');

      toast.success('Note added');
      setNewNote('');
      setIsAdding(false);
      router.refresh();
    } catch (error) {
      console.error('Failed to create note:', error);
      toast.error('Failed to add note');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-white/10 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <StickyNote className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Notes
          </h3>
          <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300">
            {notes.length}
          </span>
          {pinnedCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400">
              <Pin className="w-3 h-3 fill-current" />
              {pinnedCount} pinned
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAdding(true)}
          className="border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Note
        </Button>
      </div>

      {/* Search */}
      {notes.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="pl-9 h-9 text-sm bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-white/10"
          />
        </div>
      )}

      {/* Add Note Form */}
      {isAdding && (
        <div className="mb-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-teal-200 dark:border-teal-500/30">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Write a note..."
            rows={3}
            className="mb-2 bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none text-sm"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setIsAdding(false); setNewNote(''); }}
              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting || !newNote.trim()}
              className="bg-teal-500 hover:bg-teal-600 text-white h-8 text-xs"
            >
              {isSubmitting ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Saving...</>
              ) : (
                'Add Note'
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Notes List */}
      {previewNotes.length > 0 ? (
        <div className="space-y-2">
          {previewNotes.map((note) => (
            <NotePreviewItem key={note.id} note={note} />
          ))}
        </div>
      ) : notes.length > 0 && search ? (
        <p className="text-center text-sm text-slate-400 py-6">
          No notes matching &ldquo;{search}&rdquo;
        </p>
      ) : !isAdding ? (
        <div className="text-center py-8">
          <StickyNote className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            No notes yet. Add a note to track important information.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAdding(true)}
            className="border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add First Note
          </Button>
        </div>
      ) : null}

      {/* View All Footer */}
      {(hasMore || (notes.length > 0 && !search)) && (
        <button
          onClick={onViewAll}
          className="mt-3 w-full flex items-center justify-center gap-1 py-2 text-sm font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
        >
          View all {notes.length} notes
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

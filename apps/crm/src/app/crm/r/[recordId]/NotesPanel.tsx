'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StickyNote, Plus, Pin, Trash2, Loader2, User } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Textarea } from '@crm-eco/ui/components/textarea';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import type { CrmNote, CrmNoteWithAuthor } from '@/lib/crm/types';

interface NotesPanelProps {
  recordId: string;
  notes: CrmNoteWithAuthor[];
  orgId: string;
}

function NoteCard({ note, onDelete }: { note: CrmNoteWithAuthor; onDelete: (id: string) => void }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/crm/notes/${note.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete note');
      }

      toast.success('Note deleted successfully');
      onDelete(note.id);
    } catch (error) {
      console.error('Failed to delete note:', error);
      toast.error('Failed to delete note');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-4 rounded-xl bg-slate-900/30 border border-white/5 hover:border-white/10 transition-colors group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
            {note.author?.avatar_url ? (
              <img 
                src={note.author.avatar_url} 
                alt="" 
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <User className="w-4 h-4 text-slate-400" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              {note.author?.full_name || 'Unknown'}
            </p>
            <p className="text-xs text-slate-500">
              {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {note.is_pinned && (
            <Pin className="w-4 h-4 text-amber-400 fill-amber-400" />
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
            disabled={isDeleting}
            onClick={handleDelete}
          >
            {isDeleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>
      
      <p className="text-sm text-slate-300 whitespace-pre-wrap">
        {note.body}
      </p>
    </div>
  );
}

export function NotesPanel({ recordId, notes, orgId }: NotesPanelProps) {
  const router = useRouter();
  const [isAdding, setIsAdding] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      
      if (!response.ok) {
        throw new Error('Failed to create note');
      }

      toast.success('Note added successfully');
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

  // Sort notes: pinned first, then by date
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="space-y-4">
      {/* Add Note Button/Form */}
      {isAdding ? (
        <div className="p-4 rounded-xl bg-slate-900/50 border border-teal-500/30">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Write a note..."
            rows={4}
            className="mb-3 bg-slate-900/50 border-white/10 text-white placeholder:text-slate-500 resize-none"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsAdding(false);
                setNewNote('');
              }}
              className="text-slate-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting || !newNote.trim()}
              className="bg-teal-500 hover:bg-teal-400 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Add Note'
              )}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          onClick={() => setIsAdding(true)}
          className="w-full glass border-white/10 text-slate-300 hover:text-white hover:border-white/20"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Note
        </Button>
      )}

      {/* Notes List */}
      {sortedNotes.length > 0 ? (
        <div className="space-y-3">
          {sortedNotes.map((note) => (
            <NoteCard key={note.id} note={note} onDelete={() => router.refresh()} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <StickyNote className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-1">No notes yet</h3>
          <p className="text-slate-400">
            Add a note to keep track of important information
          </p>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { StickyNote, Plus, Pin, Trash2, Loader2, User } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import DOMPurify from 'dompurify';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import type { CrmNoteWithAuthor } from '@/lib/crm/types';

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
    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 transition-colors group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
            {note.author?.avatar_url ? (
              <img
                src={note.author.avatar_url}
                alt=""
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
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
            className="h-7 w-7 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
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

      <div
        className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed prose prose-sm max-w-none dark:prose-invert [&_b]:font-semibold [&_b]:text-slate-800 dark:[&_b]:text-slate-100 [&_strong]:font-semibold [&_strong]:text-slate-800 dark:[&_strong]:text-slate-100 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-slate-200 dark:[&_td]:border-slate-700 [&_td]:px-2 [&_td]:py-1 [&_td]:text-sm [&_th]:border [&_th]:border-slate-200 dark:[&_th]:border-slate-700 [&_th]:px-2 [&_th]:py-1 [&_th]:text-sm [&_th]:font-semibold [&_th]:bg-slate-100 dark:[&_th]:bg-slate-800 [&_br]:block [&_p]:mb-1"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(note.body) }}
      />
    </div>
  );
}

/**
 * Rich text note editor using contentEditable.
 * Preserves HTML formatting when pasting from external sources (emails, enrollment forms, etc.)
 */
function RichNoteEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (editorRef.current && !isInitialized.current) {
      editorRef.current.innerHTML = value;
      isInitialized.current = true;
    }
  }, [value]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const clipboardData = e.clipboardData;

    // Try HTML first (preserves formatting from emails, docs, enrollment forms)
    const html = clipboardData.getData('text/html');
    if (html) {
      const sanitized = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'br', 'p', 'div', 'span', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'a', 'blockquote', 'pre', 'code', 'hr', 'sub', 'sup'],
        ALLOWED_ATTR: ['href', 'target', 'style'],
        ALLOW_DATA_ATTR: false,
      });
      document.execCommand('insertHTML', false, sanitized);
    } else {
      // Fall back to plain text
      const text = clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
    }

    handleInput();
  }, [handleInput]);

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onPaste={handlePaste}
      data-placeholder="Write a note... Paste formatted text from emails or enrollment forms — formatting will be preserved."
      className="min-h-[400px] max-h-[60vh] overflow-y-auto p-4 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 text-sm text-slate-900 dark:text-white leading-relaxed focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 prose prose-sm max-w-none dark:prose-invert empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 dark:empty:before:text-slate-500 empty:before:pointer-events-none [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-slate-200 dark:[&_td]:border-slate-700 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-slate-200 dark:[&_th]:border-slate-700 [&_th]:px-2 [&_th]:py-1 [&_th]:font-semibold [&_th]:bg-slate-100 dark:[&_th]:bg-slate-800"
    />
  );
}

export function NotesPanel({ recordId, notes, orgId }: NotesPanelProps) {
  const router = useRouter();
  const [isAdding, setIsAdding] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    // Strip tags to check if there's actual content
    const textContent = newNote.replace(/<[^>]*>/g, '').trim();
    if (!textContent) return;

    setIsSubmitting(true);
    try {
      const sanitizedBody = DOMPurify.sanitize(newNote.trim());
      const response = await fetch('/api/crm/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_id: recordId,
          body: sanitizedBody,
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
      {/* Add Note Button */}
      <Button
        variant="outline"
        onClick={() => setIsAdding(true)}
        className="w-full border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-50 dark:hover:bg-white/5"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Note
      </Button>

      {/* Add Note Dialog — large overlay */}
      <Dialog open={isAdding} onOpenChange={setIsAdding}>
        <DialogContent className="max-w-3xl w-[calc(100%-2rem)] sm:w-[calc(100%-4rem)] sm:max-w-[900px] max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/10">
            <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-white">
              Add Note
            </DialogTitle>
          </div>

          <div className="flex-1 overflow-hidden py-4">
            <RichNoteEditor value={newNote} onChange={setNewNote} />
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
              Paste formatted text from emails, documents, or enrollment forms — formatting will be preserved.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-white/10">
            <Button
              variant="ghost"
              onClick={() => {
                setIsAdding(false);
                setNewNote('');
              }}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !newNote.replace(/<[^>]*>/g, '').trim()}
              className="bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white"
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
        </DialogContent>
      </Dialog>

      {/* Notes List */}
      {sortedNotes.length > 0 ? (
        <div className="space-y-3">
          {sortedNotes.map((note) => (
            <NoteCard key={note.id} note={note} onDelete={() => router.refresh()} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <StickyNote className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">No notes yet</h3>
          <p className="text-slate-500 dark:text-slate-400">
            Add a note to keep track of important information
          </p>
        </div>
      )}
    </div>
  );
}

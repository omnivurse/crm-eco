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
  Pencil,
  Trash2,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { sanitizeNoteHtml, getNoteAuthorDisplay, getNoteAuthorName, stripLegacyAuthorAttribution } from '@/lib/crm/note-sanitize';
import { NoteRichArea } from '@/components/crm/notes/NoteRichArea';
import { Dialog, DialogContent, DialogTitle } from '@crm-eco/ui/components/dialog';
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

function stripNotePlain(s: string) {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function NotePreviewItem({
  note,
  onEdit,
  onDelete,
}: {
  note: CrmNoteWithAuthor;
  onEdit: (note: CrmNoteWithAuthor) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const plainPreview = stripLegacyAuthorAttribution(stripNotePlain(note.body));
  const isTruncated = plainPreview.length > TRUNCATE_LENGTH;

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this note?')) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/crm/notes/${note.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete note');
      toast.success('Note deleted');
      onDelete(note.id);
    } catch {
      toast.error('Failed to delete note');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 transition-colors group">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
          {note.author?.avatar_url ? (
            <img src={note.author.avatar_url} alt="" className="w-6 h-6 rounded-full" />
          ) : (
            <User className="w-3 h-3 text-slate-400" />
          )}
        </div>
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate flex items-center gap-1">
          {(() => {
            const display = getNoteAuthorDisplay(note, { showHistorical: true });
            const isHist = display.startsWith('Historical • ');
            const name = isHist ? display.slice('Historical • '.length) : display;
            return isHist ? (
              <>
                <span className="inline-flex items-center rounded bg-amber-100 dark:bg-amber-500/20 px-1 py-px text-[9px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  Hist
                </span>
                <span className="truncate">{name}</span>
              </>
            ) : (
              display
            );
          })()}
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">
          {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
        </span>
        {note.is_pinned && <Pin className="w-3 h-3 text-amber-500 fill-amber-500 flex-shrink-0" />}
        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-slate-400 hover:text-teal-500 dark:hover:text-teal-400"
            onClick={() => onEdit(note)}
          >
            <Pencil className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-slate-400 hover:text-red-500 dark:hover:text-red-400"
            disabled={isDeleting}
            onClick={handleDelete}
          >
            {isDeleting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Trash2 className="w-3 h-3" />
            )}
          </Button>
        </div>
      </div>
      {expanded || !isTruncated ? (
        <div
          className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed prose prose-sm dark:prose-invert max-w-none [&_b]:font-semibold [&_strong]:font-semibold [&_i]:italic [&_em]:italic [&_u]:underline [&_font]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded"
          dangerouslySetInnerHTML={{ __html: sanitizeNoteHtml(note.body) }}
        />
      ) : (
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {plainPreview.slice(0, TRUNCATE_LENGTH)}…
        </p>
      )}
      {isTruncated && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium flex items-center gap-0.5"
        >
          {expanded ? (
            <>
              Show less <ChevronUp className="w-3 h-3" />
            </>
          ) : (
            <>
              Show more <ChevronDown className="w-3 h-3" />
            </>
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
  const [editingNote, setEditingNote] = useState<CrmNoteWithAuthor | null>(null);
  const [editNoteBody, setEditNoteBody] = useState('');
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [composeEpoch, setComposeEpoch] = useState(0);

  const handleEditSubmit = async () => {
    if (!editingNote) return;
    const sanitizedBody = sanitizeNoteHtml(editNoteBody);
    if (!stripNotePlain(sanitizedBody)) return;
    setIsEditSubmitting(true);
    try {
      const res = await fetch(`/api/crm/notes/${editingNote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: sanitizedBody }),
      });
      if (!res.ok) throw new Error('Failed to update note');
      toast.success('Note updated');
      setEditingNote(null);
      setEditNoteBody('');
      router.refresh();
    } catch {
      toast.error('Failed to update note');
    } finally {
      setIsEditSubmitting(false);
    }
  };

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
        stripNotePlain(n.body).toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        getNoteAuthorName(n).toLowerCase().includes(q)
    );
  }, [sortedNotes, search]);

  const previewNotes = filteredNotes.slice(0, PREVIEW_LIMIT);
  const hasMore = filteredNotes.length > PREVIEW_LIMIT;
  const pinnedCount = notes.filter((n) => n.is_pinned).length;

  const handleSubmit = async () => {
    const sanitizedBody = sanitizeNoteHtml(newNote);
    if (!stripNotePlain(sanitizedBody)) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/crm/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_id: recordId,
          body: sanitizedBody,
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
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Notes</h3>
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
          onClick={() => {
            setNewNote('');
            setComposeEpoch((e) => e + 1);
            setIsAdding(true);
          }}
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
          <NoteRichArea key={`overview-${composeEpoch}`} value={newNote} onChange={setNewNote} />
          <div className="flex justify-end gap-2 mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsAdding(false);
                setNewNote('');
              }}
              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting || !stripNotePlain(newNote)}
              className="bg-teal-500 hover:bg-teal-600 text-white h-8 text-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Saving...
                </>
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
            <NotePreviewItem
              key={note.id}
              note={note}
              onEdit={(n) => {
                setEditingNote(n);
                setEditNoteBody(n.body);
              }}
              onDelete={() => router.refresh()}
            />
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
            onClick={() => {
              setNewNote('');
              setComposeEpoch((e) => e + 1);
              setIsAdding(true);
            }}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add First Note
          </Button>
        </div>
      ) : null}

      {/* View All Footer */}
      {(hasMore || (notes.length > 0 && !search)) && (
        <button
          onClick={
            onViewAll ??
            (() => window.dispatchEvent(new CustomEvent('crm:switch-tab', { detail: 'notes' })))
          }
          className="mt-3 w-full flex items-center justify-center gap-1 py-2 text-sm font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
        >
          View all {notes.length} notes
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Edit Note Dialog */}
      <Dialog
        open={!!editingNote}
        onOpenChange={(open) => {
          if (!open) {
            setEditingNote(null);
            setEditNoteBody('');
          }
        }}
      >
        <DialogContent className="max-w-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
          <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-white">
            Edit Note
          </DialogTitle>
          {editingNote ? (
            <NoteRichArea key={editingNote.id} value={editNoteBody} onChange={setEditNoteBody} />
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingNote(null);
                setEditNoteBody('');
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleEditSubmit}
              disabled={isEditSubmitting || !stripNotePlain(editNoteBody)}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {isEditSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

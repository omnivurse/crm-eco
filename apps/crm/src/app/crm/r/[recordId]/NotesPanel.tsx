'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { StickyNote, Plus, Pin, Pencil, Trash2, Loader2, User, CalendarDays, ArrowUpDown } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';
import { confirmDialog } from '@crm-eco/ui/components/confirm-dialog';
import { Dialog, DialogContent, DialogTitle } from '@crm-eco/ui/components/dialog';
import { sanitizeNoteHtml, getNoteAuthorDisplay } from '@/lib/crm/note-sanitize';
import { NoteRichArea } from '@/components/crm/notes/NoteRichArea';
import {
  formatNoteTimestamp,
  formatNoteRelative,
  isNoteEdited,
  localDateInputValue,
  formatNoteDateOnly,
  noteDateDiffersFromCreated,
  backdatedNoteDateOrNull,
} from '@/lib/crm/note-timestamp';
import { sortNotesForDisplay } from '@/lib/crm/note-sort';
import {
  countNotesByOrigin,
  defaultNoteOriginFilter,
  filterNotesByOrigin,
  noteOriginFilterOptions,
  originFilterHidesCurrent,
  type NoteOriginFilter,
} from '@/lib/crm/note-filter';
import { dedupeNotesForDisplay } from '@/lib/crm/note-dedupe';
import { openNoteComposer } from '@/lib/crm/note-composer';
import { toast } from 'sonner';
import { toastItemDeletedWithUndo } from '@/lib/crm/undo-delete';
import { toastCopy } from '@/lib/crm/toast-copy';
import { useNoteCompose } from '@/components/crm/notes/NoteComposeContext';
import type { CrmNote, CrmNoteWithAuthor } from '@/lib/crm/types';

function noteFromCreateResponse(
  payload: unknown,
  fallback: { recordId: string; orgId: string; body: string; noteDate: string | null },
): CrmNoteWithAuthor {
  const row = payload && typeof payload === 'object' ? (payload as Partial<CrmNote>) : {};
  const now = new Date().toISOString();
  return {
    id: typeof row.id === 'string' ? row.id : `optimistic-${now}`,
    org_id: typeof row.org_id === 'string' ? row.org_id : fallback.orgId,
    record_id: typeof row.record_id === 'string' ? row.record_id : fallback.recordId,
    body: typeof row.body === 'string' ? row.body : fallback.body,
    is_pinned: row.is_pinned === true,
    note_date: row.note_date ?? fallback.noteDate,
    created_by: typeof row.created_by === 'string' ? row.created_by : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : now,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : now,
    author: { id: 'me', full_name: 'You', avatar_url: null },
  };
}

interface NotesPanelProps {
  recordId: string;
  notes: CrmNoteWithAuthor[];
  orgId: string;
  /**
   * When structured `crm_notes` are empty but imported `notes_history` HTML
   * still renders below this panel, suppress the false "No notes yet" empty
   * state so the tab doesn't contradict the badge / LegacyNotesCard.
   */
  hasLegacyNotes?: boolean;
}

function NoteCard({
  note,
  onDelete,
  onEdit,
}: {
  note: CrmNoteWithAuthor;
  onDelete: (id: string) => void;
  onEdit: (note: CrmNoteWithAuthor) => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!(await confirmDialog({ title: 'Delete this note?', confirmLabel: 'Delete', destructive: true }))) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/crm/notes/${note.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete note');
      }

      onDelete(note.id);
      toastItemDeletedWithUndo({ entity: 'note', id: note.id, label: 'Note', onUndo: () => router.refresh() });
    } catch (error) {
      console.error('Failed to delete note:', error);
      toast.error(toastCopy.failed('delete the note', undefined, 'Try again'));
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
              <img src={note.author.avatar_url} alt="" className="w-8 h-8 rounded-full" />
            ) : (
              <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
              {(() => {
                const display = getNoteAuthorDisplay(note, { showHistorical: true });
                const isHist = display.startsWith('Historical • ');
                const name = isHist ? display.slice('Historical • '.length) : display;
                return isHist ? (
                  <>
                    <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-500/20 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                      Historical
                    </span>
                    <span>{name}</span>
                  </>
                ) : (
                  display
                );
              })()}
            </p>
            <div className="text-xs text-slate-500" suppressHydrationWarning>
              {note.note_date && noteDateDiffersFromCreated(note.note_date, note.created_at) && (
                <p className="flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
                  <CalendarDays className="w-3 h-3" />
                  {formatNoteDateOnly(note.note_date)}
                </p>
              )}
              <p title={formatNoteRelative(note.created_at)}>
                Created {formatNoteTimestamp(note.created_at)}
                <span className="text-slate-400 dark:text-slate-500"> · {formatNoteRelative(note.created_at)}</span>
              </p>
              {isNoteEdited(note.created_at, note.updated_at) && (
                <p
                  className="mt-0.5 flex items-center gap-1 text-slate-400 dark:text-slate-500"
                  title={`Edited ${formatNoteTimestamp(note.updated_at)}`}
                >
                  <Pencil className="w-3 h-3" />
                  Edited {formatNoteRelative(note.updated_at)}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {note.is_pinned && <Pin className="w-4 h-4 text-amber-400 fill-amber-400" />}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-teal-500 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10"
            onClick={() => onEdit(note)}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
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
        className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed prose prose-sm max-w-none dark:prose-invert [&_b]:font-semibold [&_b]:text-slate-800 dark:[&_b]:text-slate-100 [&_strong]:font-semibold [&_strong]:text-slate-800 dark:[&_strong]:text-slate-100 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-slate-200 dark:[&_td]:border-slate-700 [&_td]:px-2 [&_td]:py-1 [&_td]:text-sm [&_th]:border [&_th]:border-slate-200 dark:[&_th]:border-slate-700 [&_th]:px-2 [&_th]:py-1 [&_th]:text-sm [&_th]:font-semibold [&_th]:bg-slate-100 dark:[&_th]:bg-slate-800 [&_br]:block [&_p]:mb-1 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md [&_img]:my-2"
        dangerouslySetInnerHTML={{ __html: sanitizeNoteHtml(note.body) }}
      />
    </div>
  );
}

export function NotesPanel({ recordId, notes, orgId, hasLegacyNotes = false }: NotesPanelProps) {
  const router = useRouter();
  const compose = useNoteCompose();
  const [isAdding, setIsAdding] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingNote, setEditingNote] = useState<CrmNoteWithAuthor | null>(null);
  const [editNoteBody, setEditNoteBody] = useState('');
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  /** Bumps keyed remount so the rich editor resets on each FRESH Add Note open */
  const [composeEpoch, setComposeEpoch] = useState(0);
  /** Bumps to re-focus the mounted editor when compose fires mid-draft */
  const [composeFocusSignal, setComposeFocusSignal] = useState(0);
  const [sortDir, setSortDir] = useState<'newest' | 'oldest'>('newest');
  const [newNoteDate, setNewNoteDate] = useState<string>(() => localDateInputValue());
  const [editNoteDate, setEditNoteDate] = useState<string>('');
  const [optimisticNotes, setOptimisticNotes] = useState<CrmNoteWithAuthor[]>([]);

  // One rule for every entry point (pane button, header button, `n`, deep
  // link): never wipe a draft — a repeat compose while already composing only
  // re-focuses the editor; a fresh open resets + remounts (autoFocus).
  const openComposer = () => {
    const next = openNoteComposer(
      {
        isAdding,
        draft: newNote,
        noteDate: newNoteDate,
        epoch: composeEpoch,
        focusSignal: composeFocusSignal,
      },
      localDateInputValue(),
    );
    setNewNote(next.draft);
    setNewNoteDate(next.noteDate);
    setComposeEpoch(next.epoch);
    setComposeFocusSignal(next.focusSignal);
    setIsAdding(next.isAdding);
  };

  useEffect(() => {
    if (!compose || compose.composeNonce === 0) return;
    openComposer();
    // Only react to new compose requests (nonce), not to the helper identity;
    // openComposer is re-created per render so it always sees current state.
  }, [compose?.composeNonce]);

  const handleEditSubmit = async () => {
    if (!editingNote) return;
    const textContent = editNoteBody.replace(/<[^>]*>/g, '').trim();
    if (!textContent) return;

    setIsEditSubmitting(true);
    try {
      const sanitizedBody = sanitizeNoteHtml(editNoteBody.trim());
      const response = await fetch(`/api/crm/notes/${editingNote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: sanitizedBody, note_date: backdatedNoteDateOrNull(editNoteDate, localDateInputValue(editingNote.created_at)) }),
      });

      if (!response.ok) {
        throw new Error('Failed to update note');
      }

      toast.success(toastCopy.updated('Note'));
      const edited: CrmNoteWithAuthor = {
        ...editingNote,
        body: sanitizedBody,
        note_date: backdatedNoteDateOrNull(editNoteDate, localDateInputValue(editingNote.created_at)),
        updated_at: new Date().toISOString(),
      };
      setOptimisticNotes((prev) => [edited, ...prev.filter((n) => n.id !== editingNote.id)]);
      setEditingNote(null);
      setEditNoteBody('');
      setEditNoteDate('');
    } catch (error) {
      console.error('Failed to update note:', error);
      toast.error(toastCopy.failed('update the note', error, 'Try again'));
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    // Strip tags to check if there's actual content
    const textContent = newNote.replace(/<[^>]*>/g, '').trim();
    if (!textContent) return;

    setIsSubmitting(true);
    try {
      const sanitizedBody = sanitizeNoteHtml(newNote.trim());
      const response = await fetch('/api/crm/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_id: recordId,
          body: sanitizedBody,
          note_date: backdatedNoteDateOrNull(newNoteDate, localDateInputValue()),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create note');
      }

      const created = await response.json().catch(() => null);
      const optimistic = noteFromCreateResponse(created, {
        recordId,
        orgId,
        body: sanitizedBody,
        noteDate: backdatedNoteDateOrNull(newNoteDate, localDateInputValue()),
      });
      setOptimisticNotes((prev) => [optimistic, ...prev.filter((n) => n.id !== optimistic.id)]);
      toast.success(toastCopy.added('Note'));
      setNewNote('');
      setIsAdding(false);
    } catch (error) {
      console.error('Failed to create note:', error);
      toast.error(toastCopy.failed('add the note', error, 'Try again'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // This CRM vs imported (Zoho) vs all. Default All so yesterday's work
  // cannot hide behind the Imported chip. Dedupe first so UTC/local twins
  // don't bury new notes under a wall of 2025 copies.
  const displayNotes = useMemo(() => {
    const byId = new Map(notes.map((n) => [n.id, n]));
    for (const row of optimisticNotes) {
      const existing = byId.get(row.id);
      byId.set(row.id, existing ? { ...existing, ...row } : row);
    }
    return dedupeNotesForDisplay([...byId.values()]);
  }, [notes, optimisticNotes]);
  const originCounts = useMemo(() => countNotesByOrigin(displayNotes), [displayNotes]);
  const [originFilter, setOriginFilter] = useState<NoteOriginFilter>(() =>
    defaultNoteOriginFilter(originCounts),
  );
  const filterOptions = noteOriginFilterOptions(originCounts);
  const sortedNotes = sortNotesForDisplay(
    filterNotesByOrigin(displayNotes, originFilter),
    sortDir,
  );
  const hidingCurrent = originFilterHidesCurrent(originFilter, originCounts);

  return (
    <div className="space-y-4">
      {/* Utility row: sort-order toggle + one-click access to restore deleted notes */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setSortDir((d) => (d === 'newest' ? 'oldest' : 'newest'))}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
          title="Toggle note order"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          {sortDir === 'newest' ? 'Newest first' : 'Oldest first'}
        </button>
        <Link
          href="/crm/trash"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          View Trash
        </Link>
      </div>

      {!isAdding ? (
        <Button
          variant="outline"
          onClick={openComposer}
          className="w-full border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-50 dark:hover:bg-white/5"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Note
        </Button>
      ) : (
        <div
          data-testid="crm-notes-composer"
          className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 p-3 space-y-3"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              void handleSubmit();
            }
          }}
        >
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Add Note</p>
          <NoteRichArea
            key={`compose-${composeEpoch}`}
            value={newNote}
            onChange={setNewNote}
            autoFocus
            focusSignal={composeFocusSignal}
          />
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Cmd+Enter to save. Paste from email or Docs keeps formatting when safe.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="new-note-date" className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Note date
            </label>
            <input
              id="new-note-date"
              type="date"
              value={newNoteDate}
              onChange={(e) => setNewNoteDate(e.target.value)}
              className="h-8 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 text-sm text-slate-700 dark:text-slate-200"
            />
          </div>
          <div className="flex justify-end gap-2">
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
              data-testid="crm-notes-save"
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
        </div>
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
        <DialogContent className="max-w-3xl w-[calc(100%-2rem)] sm:w-[calc(100%-4rem)] sm:max-w-[900px] max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/10">
            <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-white">
              Edit Note
            </DialogTitle>
          </div>

          <div className="flex-1 overflow-hidden py-4">
            {editingNote ? (
              <NoteRichArea key={editingNote.id} value={editNoteBody} onChange={setEditNoteBody} />
            ) : null}
            {editingNote ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label htmlFor="edit-note-date" className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Note date
                </label>
                <input
                  id="edit-note-date"
                  type="date"
                  value={editNoteDate}
                  onChange={(e) => setEditNoteDate(e.target.value)}
                  className="h-8 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 text-sm text-slate-700 dark:text-slate-200"
                />
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-white/10">
            <Button
              variant="ghost"
              onClick={() => {
                setEditingNote(null);
                setEditNoteBody('');
              }}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditSubmit}
              disabled={isEditSubmitting || !editNoteBody.replace(/<[^>]*>/g, '').trim()}
              className="bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white"
            >
              {isEditSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Origin filter: All | This CRM | Imported */}
      {originCounts.all > 0 && (
        <div className="space-y-2">
        <div
          role="group"
          aria-label="Filter notes by origin"
          className="inline-flex items-center rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 p-0.5"
        >
          {filterOptions.map((opt) => {
            const active = originFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={active}
                onClick={() => setOriginFilter(opt.id)}
                title={
                  opt.id === 'current'
                    ? 'Notes written in this CRM'
                    : opt.id === 'legacy'
                      ? 'Notes imported from the legacy system'
                      : 'All notes, newest first'
                }
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                )}
              >
                {opt.label}
                <span className={cn('tabular-nums', active ? 'opacity-80' : 'text-slate-400 dark:text-slate-500')}>
                  ({opt.count})
                </span>
              </button>
            );
          })}
        </div>
        {hidingCurrent && (
          <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/20 rounded-md px-2.5 py-1.5">
            {originCounts.current} {originCounts.current === 1 ? 'note' : 'notes'} written in this CRM{' '}
            {originCounts.current === 1 ? 'is' : 'are'} hidden.{' '}
            <button
              type="button"
              onClick={() => setOriginFilter('all')}
              className="font-semibold underline underline-offset-2 hover:text-amber-950 dark:hover:text-amber-50"
            >
              Show all
            </button>
          </p>
        )}
        </div>
      )}

      {/* Notes List */}
      {sortedNotes.length > 0 ? (
        <div className="space-y-3">
          {sortedNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onDelete={() => router.refresh()}
              onEdit={(n) => {
                setEditingNote(n);
                setEditNoteBody(n.body);
                setEditNoteDate(n.note_date ?? localDateInputValue(n.created_at));
              }}
            />
          ))}
        </div>
      ) : originFilter === 'current' && originCounts.legacy > 0 ? (
        <div className="text-center py-12">
          <StickyNote className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">No notes written in this CRM yet</h3>
          <p className="text-slate-500 dark:text-slate-400">
            {originCounts.legacy} imported {originCounts.legacy === 1 ? 'note is' : 'notes are'} under{' '}
            <button
              type="button"
              onClick={() => setOriginFilter('legacy')}
              className="font-medium text-primary hover:underline"
            >
              Imported
            </button>
            .
          </p>
        </div>
      ) : originFilter === 'legacy' && originCounts.all > 0 ? (
        <div className="text-center py-12">
          <StickyNote className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">No imported notes</h3>
          <p className="text-slate-500 dark:text-slate-400">
            All {originCounts.all} {originCounts.all === 1 ? 'note was' : 'notes were'} written in this CRM.{' '}
            <button
              type="button"
              onClick={() => setOriginFilter('all')}
              className="font-medium text-primary hover:underline"
            >
              Show all
            </button>
          </p>
        </div>
      ) : hasLegacyNotes || isAdding ? null : (
        <div className="text-center py-12">
          <StickyNote className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">No notes yet</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            Add a note to keep track of important information
          </p>
          <Button type="button" onClick={openComposer}>
            <Plus className="w-4 h-4 mr-2" />
            Add first note
          </Button>
        </div>
      )}
    </div>
  );
}

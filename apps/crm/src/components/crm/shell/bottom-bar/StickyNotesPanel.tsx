'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  Pin,
  PinOff,
  Trash2,
  X,
  Search,
  User,
  Users,
  StickyNote,
  ChevronDown,
  Loader2,
  Check,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { toast } from 'sonner';
import type { CrmProfile } from '@/lib/crm/types';

interface StickyNoteData {
  id: string;
  title: string;
  content: string | null;
  color: string | null;
  is_pinned: boolean | null;
  is_private: boolean;
  record_id: string | null;
  record_type: string | null;
  folder: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  module: string;
  moduleKey: string;
}

const NOTE_COLORS = [
  { name: 'Yellow', value: 'yellow', bg: 'bg-yellow-100 dark:bg-yellow-500/20', border: 'border-l-yellow-400', text: 'text-yellow-700 dark:text-yellow-300' },
  { name: 'Blue', value: 'blue', bg: 'bg-blue-100 dark:bg-blue-500/20', border: 'border-l-blue-400', text: 'text-blue-700 dark:text-blue-300' },
  { name: 'Green', value: 'green', bg: 'bg-green-100 dark:bg-green-500/20', border: 'border-l-green-400', text: 'text-green-700 dark:text-green-300' },
  { name: 'Pink', value: 'pink', bg: 'bg-pink-100 dark:bg-pink-500/20', border: 'border-l-pink-400', text: 'text-pink-700 dark:text-pink-300' },
  { name: 'Purple', value: 'purple', bg: 'bg-purple-100 dark:bg-purple-500/20', border: 'border-l-purple-400', text: 'text-purple-700 dark:text-purple-300' },
];

const colorDotClass: Record<string, string> = {
  yellow: 'bg-yellow-400',
  blue: 'bg-blue-400',
  green: 'bg-green-400',
  pink: 'bg-pink-400',
  purple: 'bg-purple-400',
};

const colorBorderClass: Record<string, string> = {
  yellow: 'border-l-yellow-400',
  blue: 'border-l-blue-400',
  green: 'border-l-green-400',
  pink: 'border-l-pink-400',
  purple: 'border-l-purple-400',
};

type DestinationType = 'personal' | 'contact' | 'lead';

interface StickyNotesPanelProps {
  profile: CrmProfile;
  onClose: () => void;
}

export function StickyNotesPanel({ profile, onClose }: StickyNotesPanelProps) {
  const [notes, setNotes] = useState<StickyNoteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Create/Edit form state
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formColor, setFormColor] = useState('yellow');
  const [formDest, setFormDest] = useState<DestinationType>('personal');
  const [formRecordId, setFormRecordId] = useState<string | null>(null);
  const [formRecordLabel, setFormRecordLabel] = useState('');
  const [showDestPicker, setShowDestPicker] = useState(false);
  const [recordSearch, setRecordSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Fetch notes
  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch('/api/crm/sticky-notes?limit=50');
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || []);
      }
    } catch {
      toast.error('Failed to load notes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Search records for destination picker
  const searchRecords = useCallback(async (q: string, moduleKey: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/crm/search?q=${encodeURIComponent(q)}&module=${moduleKey}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch {
      toast.error('Failed to search records');
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (recordSearch.trim() && (formDest === 'contact' || formDest === 'lead')) {
      clearTimeout(searchTimeout.current);
      searchTimeout.current = setTimeout(() => {
        searchRecords(recordSearch, formDest === 'contact' ? 'contacts' : 'leads');
      }, 300);
    } else {
      setSearchResults([]);
    }
    return () => clearTimeout(searchTimeout.current);
  }, [recordSearch, formDest, searchRecords]);

  const resetForm = () => {
    setFormTitle('');
    setFormContent('');
    setFormColor('yellow');
    setFormDest('personal');
    setFormRecordId(null);
    setFormRecordLabel('');
    setRecordSearch('');
    setSearchResults([]);
    setShowDestPicker(false);
    setShowCreate(false);
    setEditingId(null);
  };

  const handleCreate = async () => {
    if (!formTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/crm/sticky-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle,
          content: formContent,
          color: formColor,
          record_id: formRecordId,
          record_type: formDest === 'personal' ? null : formDest,
          is_pinned: false,
          is_private: true,
        }),
      });
      if (res.ok) {
        resetForm();
        fetchNotes();
      }
    } catch {
      toast.error('Failed to create note');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!formTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/crm/sticky-notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle,
          content: formContent,
          color: formColor,
          record_id: formRecordId,
          record_type: formDest === 'personal' ? null : formDest,
        }),
      });
      if (res.ok) {
        resetForm();
        fetchNotes();
      }
    } catch {
      toast.error('Failed to update note');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePin = async (note: StickyNoteData) => {
    try {
      await fetch(`/api/crm/sticky-notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: !note.is_pinned }),
      });
      fetchNotes();
    } catch {
      toast.error('Failed to update note');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/crm/sticky-notes/${id}`, { method: 'DELETE' });
      fetchNotes();
    } catch {
      toast.error('Failed to delete note');
    }
  };

  const startEdit = (note: StickyNoteData) => {
    setEditingId(note.id);
    setFormTitle(note.title);
    setFormContent(note.content || '');
    setFormColor(note.color || 'yellow');
    setFormDest(note.record_type === 'contact' ? 'contact' : note.record_type === 'lead' ? 'lead' : 'personal');
    setFormRecordId(note.record_id);
    setFormRecordLabel(note.record_type ? `${note.record_type} record` : '');
    setShowCreate(true);
  };

  const destLabel = formDest === 'personal' ? 'My Notes' : formDest === 'contact' ? 'Contact' : 'Lead';

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col max-h-[520px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Sticky Notes</h3>
          {notes.length > 0 && (
            <span className="text-[10px] bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-medium">
              {notes.length}
            </span>
          )}
        </div>
        <button
          onClick={() => {
            if (showCreate) { resetForm(); } else { setShowCreate(true); }
          }}
          className={cn(
            'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition-colors',
            showCreate
              ? 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              : 'text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 bg-teal-50 dark:bg-teal-500/10'
          )}
        >
          {showCreate ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showCreate ? 'Cancel' : 'New'}
        </button>
      </div>

      {/* Create / Edit Form */}
      {showCreate && (
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 space-y-2.5 bg-slate-50/50 dark:bg-slate-800/30">
          <input
            type="text"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="Note title..."
            className="w-full text-sm px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500/50"
            autoFocus
          />
          <textarea
            value={formContent}
            onChange={(e) => setFormContent(e.target.value)}
            placeholder="Write your note..."
            rows={3}
            className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500/50 resize-none"
          />

          {/* Color Picker + Destination */}
          <div className="flex items-center justify-between gap-2">
            {/* Color Picker */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 mr-0.5">Color:</span>
              {NOTE_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setFormColor(c.value)}
                  className={cn(
                    'w-5 h-5 rounded-full border-2 transition-all',
                    colorDotClass[c.value],
                    formColor === c.value ? 'border-slate-600 dark:border-white scale-110' : 'border-transparent hover:scale-105'
                  )}
                  title={c.name}
                />
              ))}
            </div>

            {/* Destination Picker */}
            <div className="relative">
              <button
                onClick={() => setShowDestPicker(!showDestPicker)}
                className="flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 transition-colors"
              >
                {formDest === 'personal' && <StickyNote className="w-3 h-3" />}
                {formDest === 'contact' && <User className="w-3 h-3" />}
                {formDest === 'lead' && <Users className="w-3 h-3" />}
                {destLabel}
                {formRecordLabel && <span className="text-teal-600 dark:text-teal-400 truncate max-w-[60px]">: {formRecordLabel}</span>}
                <ChevronDown className="w-3 h-3" />
              </button>

              {showDestPicker && (
                <div className="absolute bottom-full right-0 mb-1 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 overflow-hidden">
                  <div className="p-1">
                    <button
                      onClick={() => { setFormDest('personal'); setFormRecordId(null); setFormRecordLabel(''); setShowDestPicker(false); setRecordSearch(''); }}
                      className={cn(
                        'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs transition-colors text-left',
                        formDest === 'personal' ? 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                      )}
                    >
                      <StickyNote className="w-3.5 h-3.5" />
                      My Notes
                      {formDest === 'personal' && <Check className="w-3 h-3 ml-auto" />}
                    </button>
                    <button
                      onClick={() => { setFormDest('contact'); setFormRecordId(null); setFormRecordLabel(''); setRecordSearch(''); }}
                      className={cn(
                        'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs transition-colors text-left',
                        formDest === 'contact' ? 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                      )}
                    >
                      <User className="w-3.5 h-3.5" />
                      Contact
                      {formDest === 'contact' && <Check className="w-3 h-3 ml-auto" />}
                    </button>
                    <button
                      onClick={() => { setFormDest('lead'); setFormRecordId(null); setFormRecordLabel(''); setRecordSearch(''); }}
                      className={cn(
                        'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs transition-colors text-left',
                        formDest === 'lead' ? 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                      )}
                    >
                      <Users className="w-3.5 h-3.5" />
                      Lead
                      {formDest === 'lead' && <Check className="w-3 h-3 ml-auto" />}
                    </button>
                  </div>

                  {/* Record Search */}
                  {(formDest === 'contact' || formDest === 'lead') && (
                    <div className="border-t border-slate-200 dark:border-slate-700 p-2">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                        <input
                          type="text"
                          value={recordSearch}
                          onChange={(e) => setRecordSearch(e.target.value)}
                          placeholder={`Search ${formDest}s...`}
                          className="w-full text-[11px] pl-6 pr-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-500/50"
                          autoFocus
                        />
                      </div>
                      {searching && (
                        <div className="flex items-center justify-center py-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                        </div>
                      )}
                      {searchResults.length > 0 && (
                        <div className="mt-1 max-h-32 overflow-y-auto">
                          {searchResults.map((r) => (
                            <button
                              key={r.id}
                              onClick={() => {
                                setFormRecordId(r.id);
                                setFormRecordLabel(r.title);
                                setShowDestPicker(false);
                                setRecordSearch('');
                                setSearchResults([]);
                              }}
                              className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-[11px] hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-colors"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-slate-700 dark:text-slate-200 truncate">{r.title}</p>
                                {r.subtitle && <p className="text-[10px] text-slate-400 truncate">{r.subtitle}</p>}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {!searching && recordSearch.trim() && searchResults.length === 0 && (
                        <p className="text-[10px] text-slate-400 text-center py-2">No results</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={() => editingId ? handleUpdate(editingId) : handleCreate()}
            disabled={!formTitle.trim() || saving || ((formDest === 'contact' || formDest === 'lead') && !formRecordId)}
            className={cn(
              'w-full flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-md transition-colors',
              'bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {editingId ? 'Update Note' : 'Create Note'}
          </button>
        </div>
      )}

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <StickyNote className="w-8 h-8 text-slate-300 dark:text-slate-600" />
            <p className="text-xs text-slate-400 dark:text-slate-500">No notes yet</p>
            <button
              onClick={() => setShowCreate(true)}
              className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-medium"
            >
              Create your first note
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {notes.map((note) => (
              <div
                key={note.id}
                className={cn(
                  'group px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer border-l-[3px]',
                  colorBorderClass[note.color || 'yellow'] || 'border-l-yellow-400'
                )}
                onClick={() => startEdit(note)}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {note.is_pinned && <Pin className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                      <p className="text-xs font-medium text-slate-800 dark:text-white truncate">
                        {note.title}
                      </p>
                    </div>
                    {note.content && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                        {note.content}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500" suppressHydrationWarning>
                        {formatDate(note.updated_at)}
                      </span>
                      {note.record_type && (
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1 py-0.5 rounded capitalize">
                          {note.record_type}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleTogglePin(note); }}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      title={note.is_pinned ? 'Unpin' : 'Pin'}
                    >
                      {note.is_pinned ? (
                        <PinOff className="w-3 h-3 text-amber-500" />
                      ) : (
                        <Pin className="w-3 h-3 text-slate-400" />
                      )}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(note.id); }}
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

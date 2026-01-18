'use client';

import Link from 'next/link';
import { StickyNote, ArrowRight, Pin } from 'lucide-react';
import { WidgetCard } from '../WidgetCard';
import { EmptyState } from './shared';
import type { WidgetSize } from '@/lib/dashboard/types';

interface Note {
  id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

interface NotesMemosWidgetProps {
  data: Note[] | null;
  size: WidgetSize;
}

const sizeToDisplayCount: Record<WidgetSize, number> = {
  small: 3,
  medium: 5,
  large: 7,
  full: 10,
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

export default function NotesMemosWidget({
  data: notes,
  size,
}: NotesMemosWidgetProps) {
  const allNotes = notes || [];
  const displayCount = sizeToDisplayCount[size] || 5;

  // Sort: pinned first, then by updated_at
  const sortedNotes = [...allNotes].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  return (
    <WidgetCard
      title="Notes & Memos"
      subtitle="Quick notes"
      icon={<StickyNote className="w-5 h-5 text-white" />}
      gradient="bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500"
      badge={
        allNotes.length > 0
          ? `${allNotes.length} note${allNotes.length !== 1 ? 's' : ''}`
          : undefined
      }
      badgeColor="bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"
      footer={
        allNotes.length > displayCount ? (
          <Link
            href="/crm/notes"
            className="inline-flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
          >
            View all notes
            <ArrowRight className="w-4 h-4" />
          </Link>
        ) : undefined
      }
    >
      {allNotes.length === 0 ? (
        <EmptyState
          icon={<StickyNote className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />}
          title="No notes yet"
          subtitle="Create notes to keep track of ideas"
        />
      ) : (
        <div className="space-y-2">
          {sortedNotes.slice(0, displayCount).map((note) => (
            <div
              key={note.id}
              className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
            >
              <div className="flex items-start gap-2">
                {note.is_pinned && (
                  <Pin className="w-3 h-3 text-amber-500 flex-shrink-0 mt-1" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {note.title || 'Untitled'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                    {note.content}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    {formatDate(note.updated_at)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

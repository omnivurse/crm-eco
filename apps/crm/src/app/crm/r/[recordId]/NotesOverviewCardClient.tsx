'use client';

import dynamic from 'next/dynamic';
import { StickyNote } from 'lucide-react';
import type { CrmNoteWithAuthor } from '@/lib/crm/types';

/**
 * Client-only wrapper for {@link NotesOverviewCard}.
 *
 * The card renders note bodies via `sanitizeNoteHtml`, which relies on the
 * browser `dompurify` build and therefore cannot run during server rendering.
 * Every other notes surface in the app (the Notes tab, the V2 notes drawer)
 * only mounts after user interaction, so it never hits SSR. The record
 * *overview* pane renders on first paint, so we defer this card to the client
 * with `ssr: false` to keep note HTML sanitization strictly browser-side.
 */
const NotesOverviewCard = dynamic(
  () => import('./NotesOverviewCard').then((m) => m.NotesOverviewCard),
  {
    ssr: false,
    loading: () => (
      <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-white/10 p-6">
        <div className="flex items-center gap-2 mb-4">
          <StickyNote className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Notes</h3>
        </div>
        <div className="h-16 rounded-lg bg-slate-50 dark:bg-slate-800/40 animate-pulse" />
      </div>
    ),
  },
);

export function NotesOverviewCardClient(props: {
  notes: CrmNoteWithAuthor[];
  recordId: string;
}) {
  return <NotesOverviewCard {...props} />;
}

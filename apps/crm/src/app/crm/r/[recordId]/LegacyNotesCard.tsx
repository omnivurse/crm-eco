'use client';

import { useState, useMemo } from 'react';
import {
  History,
  Search,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Input } from '@crm-eco/ui/components/input';
import DOMPurify from 'isomorphic-dompurify';

function sanitize(dirty: string): string {
  return DOMPurify.sanitize(dirty);
}

interface LegacyNotesCardProps {
  notesHtml: string;
}

interface ParsedEntry {
  id: number;
  timestamp: string | null;
  bodyHtml: string;
  bodyText: string;
}

const PREVIEW_LIMIT = 5;
const TRUNCATE_LENGTH = 250;

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function parseNotesHtml(raw: string): ParsedEntry[] {
  const entries = raw
    .split(/<hr\s*\/?>/gi)
    .map((chunk) => chunk.replace(/^(\s*<br\s*\/?>\s*)+/gi, '').replace(/(\s*<br\s*\/?>\s*)+$/gi, '').trim())
    .filter((chunk) => chunk.length > 0);

  return entries.map((html, idx) => {
    let timestamp: string | null = null;

    const tsMatch = html.match(/^<b>(.*?)<\/b>\s*:\s*/i);
    if (tsMatch) {
      timestamp = tsMatch[1].trim();
    }

    return {
      id: idx,
      timestamp,
      bodyHtml: sanitize(html),
      bodyText: stripHtml(html),
    };
  });
}

function LegacyNoteEntry({ entry }: { entry: ParsedEntry }) {
  const [expanded, setExpanded] = useState(false);
  const isTruncated = entry.bodyText.length > TRUNCATE_LENGTH;

  const displayHtml = useMemo(() => {
    if (expanded || !isTruncated) return entry.bodyHtml;
    const truncatedText = entry.bodyText.slice(0, TRUNCATE_LENGTH);
    return sanitize(truncatedText) + '&hellip;';
  }, [expanded, isTruncated, entry]);

  return (
    <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-500/10 hover:border-amber-300 dark:hover:border-amber-500/20 transition-colors">
      {entry.timestamp && (
        <div className="flex items-center gap-2 mb-1.5">
          <History className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
            {entry.timestamp}
          </span>
        </div>
      )}
      <div
        className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed legacy-note-content [&_b]:font-semibold [&_b]:text-slate-800 dark:[&_b]:text-slate-100"
        dangerouslySetInnerHTML={{ __html: displayHtml }}
      />
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

export function LegacyNotesCard({ notesHtml }: LegacyNotesCardProps) {
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  const entries = useMemo(() => parseNotesHtml(notesHtml), [notesHtml]);

  const filteredEntries = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter((e) => e.bodyText.toLowerCase().includes(q));
  }, [entries, search]);

  const visibleEntries = showAll ? filteredEntries : filteredEntries.slice(0, PREVIEW_LIMIT);
  const hasMore = filteredEntries.length > PREVIEW_LIMIT;

  if (entries.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-white/10 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Notes History
          </h3>
          <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-xs font-medium text-amber-700 dark:text-amber-300">
            {entries.length}
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            (imported)
          </span>
        </div>
      </div>

      {/* Search */}
      {entries.length > 1 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes history..."
            className="pl-9 h-9 text-sm bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-white/10"
          />
        </div>
      )}

      {/* Entries */}
      {visibleEntries.length > 0 ? (
        <div className="space-y-2">
          {visibleEntries.map((entry) => (
            <LegacyNoteEntry key={entry.id} entry={entry} />
          ))}
        </div>
      ) : search ? (
        <p className="text-center text-sm text-slate-400 py-6">
          No entries matching &ldquo;{search}&rdquo;
        </p>
      ) : null}

      {/* Show More / Show Less */}
      {hasMore && !search && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-3 w-full flex items-center justify-center gap-1 py-2 text-sm font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
        >
          {showAll ? (
            <>Show fewer <ChevronUp className="w-4 h-4" /></>
          ) : (
            <>View all {filteredEntries.length} entries <ChevronDown className="w-4 h-4" /></>
          )}
        </button>
      )}
    </div>
  );
}

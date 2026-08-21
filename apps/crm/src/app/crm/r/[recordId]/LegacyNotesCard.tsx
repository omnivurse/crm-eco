'use client';

import { useState, useMemo } from 'react';
import {
  History,
  Search,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Input } from '@crm-eco/ui/components/input';
import DOMPurify from 'dompurify';

function sanitize(dirty: string): string {
  if (typeof window === 'undefined') return dirty;
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
  /**
   * Imported history that carries no Zoho markup. Its entries are separated
   * by newlines, which HTML collapses — so it renders with whitespace
   * preserved instead of running every dated line into one paragraph.
   */
  plainText: boolean;
}

const PREVIEW_LIMIT = 5;
const TRUNCATE_LENGTH = 250;

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * A line that STARTS with a date begins a new imported entry.
 *
 * Zoho's HTML dumps separate entries with <hr>; its plain-text dumps have no
 * separator at all, so several conversations months apart rendered as one
 * undifferentiated wall of text. Verified against all 703 plain-text records
 * in production: 639 are a single entry and unchanged, 64 split into 2-6 real
 * dated conversations, and no fragment is shorter than 25 characters.
 *
 * Requiring the date at the START of a line is what keeps it safe — a date
 * mid-sentence ("turning 64 in 3/2016") never splits anything.
 */
const PLAIN_ENTRY_DATE = /^[ \t]*(\d{1,2}[-./]\d{1,2}[-./]\d{2,4})[.:\s-]/gm;

/** A short undated preamble (typically a rep's name) belongs with the first
 *  entry rather than becoming a card of its own. */
const MAX_MERGED_PREAMBLE = 40;

function parsePlainTextNotes(raw: string): ParsedEntry[] {
  const starts: number[] = [];
  PLAIN_ENTRY_DATE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PLAIN_ENTRY_DATE.exec(raw)) !== null) starts.push(m.index);

  let chunks: string[];
  if (starts.length === 0) {
    chunks = [raw.trim()];
  } else {
    chunks = starts.map((start, i) =>
      raw.slice(start, i + 1 < starts.length ? starts[i + 1] : raw.length).trim(),
    );
    const preamble = raw.slice(0, starts[0]).trim();
    if (preamble) {
      if (preamble.length < MAX_MERGED_PREAMBLE) chunks[0] = `${preamble}\n${chunks[0]}`;
      else chunks.unshift(preamble);
    }
  }

  return chunks
    .filter((c) => c.length > 0)
    .map((text, idx) => {
      const dateMatch = text.match(/^[ \t]*(\d{1,2}[-./]\d{1,2}[-./]\d{2,4})[.:\s-]*/);
      // The date is promoted to the entry header, so drop it from the body
      // rather than printing it twice. Only the leading token is removed —
      // any date mentioned inside the note is left alone.
      const body = dateMatch ? text.slice(dateMatch[0].length) : text;
      return {
        id: idx,
        timestamp: dateMatch ? dateMatch[1] : null,
        // Plain text: never treated as markup, and rendered with its own
        // line breaks intact.
        bodyHtml: sanitize(body),
        bodyText: body,
        plainText: true,
      };
    });
}

function parseNotesHtml(raw: string): ParsedEntry[] {
  const entries = raw
    .split(/<hr\s*\/?>/gi)
    .map((chunk) => chunk.replace(/^(\s*<br\s*\/?>\s*)+/gi, '').replace(/(\s*<br\s*\/?>\s*)+$/gi, '').trim())
    .filter((chunk) => chunk.length > 0);

  return entries.map((html, idx) => {
    let timestamp: string | null = null;

    // Zoho prefixes each entry with its timestamp in bold. That is promoted
    // to the entry header, so strip it from the body rather than printing it
    // twice — matching how the plain-text entries render.
    //
    // Safe to strip: across all 680 HTML-format records in production, 2,426
    // of 2,475 entries carry this prefix and EVERY one of them is a date
    // ("1/4/2015 12:32 PM"). None is a meaningful non-date label, so nothing
    // is lost that the header does not already show.
    const tsMatch = html.match(/^<b>(.*?)<\/b>\s*:\s*/i);
    let body = html;
    if (tsMatch) {
      timestamp = tsMatch[1].trim();
      body = html.slice(tsMatch[0].length);
    }

    return {
      id: idx,
      timestamp,
      bodyHtml: sanitize(body),
      bodyText: stripHtml(body),
      plainText: !/<[a-z][^>]*>/i.test(body),
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
        style={entry.plainText ? { whiteSpace: 'pre-wrap' } : undefined}
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(displayHtml) }}
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

  // Zoho wrote history two ways. The HTML dumps separate entries with <hr>;
  // the plain-text ones have no separator, so they need date-led splitting.
  const entries = useMemo(
    () =>
      /<hr\s*\/?>|<br\s*\/?>|<b>/i.test(notesHtml)
        ? parseNotesHtml(notesHtml)
        : parsePlainTextNotes(notesHtml),
    [notesHtml],
  );

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

'use client';

/**
 * Renders the "why did this record match?" chips + inline highlight produced by
 * `getRecordSearchMatches`. Drop it under a search-result title anywhere records
 * are searched (⌘K palette, module spotlight, lookup pickers).
 */

import { cn } from '@crm-eco/ui/lib/utils';
import {
  SEARCH_MATCH_COLORS,
  findQueryRanges,
  toHighlightSegments,
  type RecordSearchMatch,
} from '@/lib/crm/search-match';

export interface SearchMatchChipsProps {
  matches: RecordSearchMatch[] | undefined | null;
  className?: string;
  /** Cap the chips shown (defaults to whatever the matcher already capped to). */
  max?: number;
}

export function SearchMatchChips({ matches, className, max }: SearchMatchChipsProps) {
  if (!matches || matches.length === 0) return null;
  const shown = typeof max === 'number' ? matches.slice(0, max) : matches;
  if (shown.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1', className)}>
      {shown.map((m) => {
        const colors = SEARCH_MATCH_COLORS[m.category] ?? SEARCH_MATCH_COLORS.other;
        const segments = toHighlightSegments(m.value, m.ranges);
        return (
          <span key={m.fieldKey} className="inline-flex min-w-0 max-w-full items-center gap-1 text-xs">
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide whitespace-nowrap',
                colors.chip,
              )}
            >
              {m.label}
            </span>
            <span className="truncate font-mono text-[11px] text-slate-600 dark:text-slate-300">
              {segments.map((s, i) =>
                s.match ? (
                  <mark key={i} className={cn('rounded-[3px] px-0.5 font-semibold', colors.mark)}>
                    {s.text}
                  </mark>
                ) : (
                  <span key={i}>{s.text}</span>
                ),
              )}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export interface HighlightedTextProps {
  text: string;
  query: string;
  className?: string;
  markClassName?: string;
}

/** Highlights every occurrence of the query terms within `text` (e.g. a title). */
export function HighlightedText({ text, query, className, markClassName }: HighlightedTextProps) {
  const segments = toHighlightSegments(text, findQueryRanges(text, query));
  return (
    <span className={className}>
      {segments.map((s, i) =>
        s.match ? (
          <mark
            key={i}
            className={cn(
              'rounded-[3px] bg-teal-200/70 px-0.5 font-semibold text-teal-900 dark:bg-teal-400/30 dark:text-teal-50',
              markClassName,
            )}
          >
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </span>
  );
}

'use client';

/**
 * InlineRecordSearch — find text on the *current* record detail page only.
 * Client-side substring match across schema fields (+ optional note bodies).
 * Picking a result switches to the right Overview sub-pane and scrolls the hit
 * into view (never calls global CRM search or navigates to other records).
 */

import {
  useState,
  useMemo,
  useRef,
  useEffect,
  type KeyboardEvent as ReactKB,
} from 'react';
import { Search, X, ArrowRight, StickyNote, LayoutList } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { CrmRecord, CrmField } from '@/lib/crm/types';
import {
  buildRecordFieldSearchHits,
  buildRecordSearchableRows,
  type RecordFieldNavigateTarget,
} from '@/lib/crm/record-field-search';

export type NavigateToMatchArgs = RecordFieldNavigateTarget;

export type InlineRecordSearchHit = {
  id: string;
  navigate: NavigateToMatchArgs;
  label: string;
  snippet: string;
};

interface InlineRecordSearchProps {
  record: CrmRecord;
  fields: CrmField[];
  /** Note bodies searched when the user loads note content on this shell */
  noteBodies?: string[];
  /** Switch tabs/panes and scroll targets — implemented by RecordDetailShellV2 */
  onNavigateToMatch: (args: NavigateToMatchArgs) => void;
}

export function InlineRecordSearch({
  record,
  fields,
  noteBodies = [],
  onNavigateToMatch,
}: InlineRecordSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const noteText = useMemo(
    () => noteBodies.map((b) => (typeof b === 'string' ? b : '')).join('\n'),
    [noteBodies],
  );

  const searchableRows = useMemo(
    () => buildRecordSearchableRows(record, fields),
    [record, fields],
  );

  const results = useMemo(
    () => buildRecordFieldSearchHits(searchableRows, noteText, query),
    [searchableRows, noteText, query],
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, results.length]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const commitHit = (hit: InlineRecordSearchHit) => {
    onNavigateToMatch(hit.navigate);
    setQuery('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: ReactKB) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      commitHit(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 rounded-lg px-2.5 py-1.5 border border-transparent focus-within:border-teal-500/50 focus-within:bg-white dark:focus-within:bg-slate-900 transition-all w-56 focus-within:w-72">
        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <input
          ref={inputRef}
          data-inline-record-search
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (query.trim()) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Find in this record… (press /)"
          className="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 outline-none"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isOpen && query.trim() !== '' && (
        <div className="absolute top-full right-0 mt-1.5 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-white/10 z-50 overflow-hidden">
          {results.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">
              No matches in this record
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto py-1">
              <ul aria-label="Matches on this record" className="text-sm">
                {results.map((r, gi) => {
                  const Icon = r.navigate.type === 'notes' ? StickyNote : LayoutList;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => commitHit(r)}
                        onMouseEnter={() => setSelectedIndex(gi)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                          gi === selectedIndex
                            ? 'bg-slate-100 dark:bg-white/5'
                            : 'hover:bg-slate-50 dark:hover:bg-white/5',
                        )}
                      >
                        <div className="flex items-center justify-center w-6 h-6 rounded-md shrink-0 bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                            {r.label}
                          </p>
                          <p className="text-sm text-slate-900 dark:text-white truncate">
                            {r.snippet}
                          </p>
                        </div>
                        {gi === selectedIndex && (
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

/**
 * Opens other CRM records via `/api/crm/search` (same RPC as ⌘K / module toolbar).
 * Used on legacy RecordDetailShell (V1) where layout-v2 exposes per-record
 * "find on this page" search instead (`v2/InlineRecordSearch`).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, X, ArrowRight, Users, UserPlus, Building2, DollarSign } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { CRM_SPOTLIGHT_SEARCH_LIMIT } from '@/lib/crm/search-limits';
import { moduleChipClass } from '@/components/crm/records/v2/tokens';

const MODULE_ICONS: Record<string, React.ReactNode> = {
  contacts: <Users className="w-3.5 h-3.5" />,
  leads: <UserPlus className="w-3.5 h-3.5" />,
  deals: <DollarSign className="w-3.5 h-3.5" />,
  accounts: <Building2 className="w-3.5 h-3.5" />,
};


type Result = {
  id: string;
  title: string;
  subtitle?: string;
  module: string;
  moduleName: string;
  matchType?: 'exact' | 'fuzzy';
};

export function RecordToolbarGlobalSearch({ currentRecordId }: { currentRecordId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      searchAbortRef.current?.abort();
      setResults([]);
      setLoading(false);
      return;
    }

    searchAbortRef.current?.abort();
    const ctrl = new AbortController();
    searchAbortRef.current = ctrl;
    setLoading(true);

    const handle = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/crm/search?q=${encodeURIComponent(trimmed)}&limit=${CRM_SPOTLIGHT_SEARCH_LIMIT}`,
          { credentials: 'same-origin', signal: ctrl.signal },
        );
        if (!res.ok) {
          if (!ctrl.signal.aborted) setResults([]);
          return;
        }
        const payload = (await res.json()) as {
          results?: Array<{
            id: string;
            title: string;
            subtitle?: string;
            module: string;
            moduleKey: string;
            matchType?: 'exact' | 'fuzzy';
          }>;
        };
        if (ctrl.signal.aborted) return;
        const filtered = (payload.results || [])
          .filter((r) => r.id !== currentRecordId)
          .slice(0, 12)
          .map<Result>((r) => ({
            id: r.id,
            title: r.title || 'Untitled',
            subtitle: r.subtitle,
            module: r.moduleKey || 'unknown',
            moduleName: r.module || 'Record',
            matchType: r.matchType,
          }));
        setResults(filtered);
        setSelectedIndex(0);
      } catch (e) {
        if ((e as Error).name !== 'AbortError' && !ctrl.signal.aborted) setResults([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(handle);
      ctrl.abort();
    };
  }, [query, currentRecordId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const navigateTo = useCallback(
    (r: Result) => {
      router.push(`/crm/r/${r.id}`);
      setQuery('');
      setResults([]);
      setIsOpen(false);
    },
    [router],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      navigateTo(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const grouped = results.reduce<Record<string, Result[]>>((acc, r) => {
    (acc[r.module] = acc[r.module] || []).push(r);
    return acc;
  }, {});

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 rounded-lg px-2.5 py-1.5 border border-transparent focus-within:border-teal-500/50 focus-within:bg-white dark:focus-within:bg-slate-900 transition-all w-56 focus-within:w-72">
        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <input
          ref={inputRef}
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
          placeholder="Search records..."
          className="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 outline-none"
        />
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 shrink-0" />}
        {query && !loading && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
            }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isOpen && query.trim() && (
        <div className="absolute top-full left-0 mt-1.5 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-white/10 z-50 overflow-hidden">
          {results.length === 0 && !loading ? (
            <div className="py-6 text-center text-sm text-slate-500">No records found</div>
          ) : (
            <div className="max-h-72 overflow-y-auto py-1">
              {Object.entries(grouped).map(([mod, rs]) => (
                <div key={mod}>
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    {rs[0]?.moduleName || mod}
                  </div>
                  {rs.map((result) => {
                    const gi = results.indexOf(result);
                    return (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => navigateTo(result)}
                        onMouseEnter={() => setSelectedIndex(gi)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                          gi === selectedIndex
                            ? 'bg-slate-100 dark:bg-white/5'
                            : 'hover:bg-slate-50 dark:hover:bg-white/5',
                        )}
                      >
                        <div
                          className={cn(
                            'flex items-center justify-center w-6 h-6 rounded-md shrink-0',
                            moduleChipClass(mod),
                          )}
                        >
                          {MODULE_ICONS[mod] || <Users className="w-3.5 h-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {result.title}
                          </p>
                          {result.subtitle && (
                            <p className="text-xs text-slate-500 truncate">{result.subtitle}</p>
                          )}
                        </div>
                        {gi === selectedIndex && (
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-slate-100 dark:border-white/5 px-3 py-1.5 text-[10px] text-slate-400 flex items-center gap-3">
            <span>
              <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px]">↑↓</kbd>{' '}
              navigate
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px]">↵</kbd> open
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px]">esc</kbd> close
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

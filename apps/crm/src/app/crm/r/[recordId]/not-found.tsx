'use client';

/**
 * 404 fallback for /crm/r/[recordId]. Renders when both:
 *   - the record doesn't exist / RLS hides it, AND
 *   - there's no audit-log tombstone to redirect to (pre-fix merges,
 *     or the id was never real).
 *
 * Rather than drop the user on a dead end, offer a quick name search so
 * they can find the record under its current id if it was absorbed into
 * another contact before merge audit logging was fixed.
 */

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { FileQuestion, ArrowLeft, Search, Loader2 } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  module: string;
  url: string;
}

export default function RecordNotFound() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      searchAbortRef.current?.abort();
      setResults([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    searchAbortRef.current?.abort();
    const ctrl = new AbortController();
    searchAbortRef.current = ctrl;

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/crm/search?q=${encodeURIComponent(trimmed)}&limit=10`,
          { credentials: 'same-origin', signal: ctrl.signal },
        );
        if (!res.ok) {
          if (!ctrl.signal.aborted) setResults([]);
          return;
        }
        const body = (await res.json()) as { results?: SearchResult[] };
        if (!ctrl.signal.aborted) setResults(body.results ?? []);
      } catch (e) {
        if ((e as Error).name !== 'AbortError' && !ctrl.signal.aborted) {
          setResults([]);
        }
      } finally {
        if (!ctrl.signal.aborted) {
          setIsSearching(false);
          setHasSearched(true);
        }
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      ctrl.abort();
    };
  }, [query]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center p-8 max-w-xl w-full">
        <div className="w-14 h-14 mx-auto mb-5 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <FileQuestion className="w-7 h-7 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Record not found
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
          This record may have been merged, deleted, or moved. If you know the
          name, search for the current version below.
        </p>

        <div className="relative mb-4 text-left">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, or phone…"
            className="pl-9"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
          )}
        </div>

        {hasSearched && results.length > 0 && (
          <ul className="mb-6 divide-y divide-slate-200 dark:divide-white/10 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-left">
            {results.map((r) => (
              <li key={r.id}>
                <Link
                  href={r.url}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {r.title}
                    </div>
                    {r.subtitle && (
                      <div className="text-xs text-slate-500 truncate">{r.subtitle}</div>
                    )}
                  </div>
                  <span className="shrink-0 text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {r.module}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {hasSearched && !isSearching && results.length === 0 && query.trim().length >= 2 && (
          <p className="text-sm text-slate-500 mb-6">
            No matches for &ldquo;{query.trim()}&rdquo;.
          </p>
        )}

        <Button variant="outline" asChild>
          <Link href="/crm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to CRM
          </Link>
        </Button>
      </div>
    </div>
  );
}

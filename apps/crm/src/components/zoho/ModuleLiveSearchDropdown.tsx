'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@crm-eco/ui';
import { cn } from '@crm-eco/ui/lib/utils';
import { Loader2, Search } from 'lucide-react';
import { SearchMatchChips, HighlightedText } from '@/components/crm/records/SearchMatchChips';
import type { RecordSearchMatch } from '@/lib/crm/search-match';

/** Result row from `/api/crm/search` (module-scoped spotlight). */
export type ModuleLiveSearchResult = {
  id: string;
  title: string;
  subtitle?: string;
  moduleKey: string;
  matchType?: 'exact' | 'fuzzy';
  /** Colour-coded "matched field" chips. */
  matches?: RecordSearchMatch[];
};

export interface ModuleLiveSearchDropdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder: string;
  results: ModuleLiveSearchResult[];
  loading: boolean;
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
  onSelectResult: (result: ModuleLiveSearchResult) => void;
  inputClassName?: string;
}

/**
 * Module toolbar spotlight search. Uses Radix Popover (portaled to `document.body`)
 * so results always render above sticky table headers and other stacking contexts.
 */
export function ModuleLiveSearchDropdown({
  open,
  onOpenChange,
  searchQuery,
  onSearchQueryChange,
  onSubmit,
  onKeyDown,
  placeholder,
  results,
  loading,
  selectedIndex,
  onSelectedIndexChange,
  onSelectResult,
  inputClassName,
}: ModuleLiveSearchDropdownProps) {
  const showPanel = open && searchQuery.trim().length >= 2;

  return (
    <Popover open={showPanel} onOpenChange={onOpenChange}>
      <form
        onSubmit={onSubmit}
        className="relative flex-1 min-w-[12rem] max-w-md group"
      >
        <PopoverTrigger asChild>
          <div className="relative w-full">
            <Search
              className={cn(
                'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors pointer-events-none z-[1]',
                'text-slate-500 dark:text-slate-400',
                'group-focus-within:text-teal-600 dark:group-focus-within:text-teal-400',
              )}
            />
            <input
              type="search"
              placeholder={placeholder}
              value={searchQuery}
              onChange={(e) => {
                onSearchQueryChange(e.target.value);
                onOpenChange(true);
              }}
              onFocus={() => onOpenChange(true)}
              onKeyDown={onKeyDown}
              className={cn(
                'flex h-10 w-full rounded-lg border bg-white dark:bg-slate-900 px-3 py-2 pl-9 text-sm shadow-sm',
                'border-slate-300 dark:border-slate-700',
                'hover:border-slate-400 dark:hover:border-slate-600',
                'text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400',
                'focus-visible:outline-none focus-visible:border-teal-500 focus-visible:ring-2 focus-visible:ring-teal-500/25 focus-visible:ring-offset-0',
                inputClassName,
              )}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            // Above sticky table headers (z-20), mass-action bars, and dialogs.
            'z-[200] w-[var(--radix-popover-trigger-width)] min-w-[20rem] p-0',
            'rounded-lg border border-slate-200 dark:border-slate-700',
            'bg-white dark:bg-slate-900 shadow-2xl overflow-hidden',
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {loading && results.length === 0 ? (
            <div className="px-3 py-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Searching…
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
              No matches. Press Enter to filter the list anyway.
            </div>
          ) : (
            <ul className="max-h-80 overflow-auto py-1 text-sm">
              {results.map((result, index) => (
                <li key={result.id}>
                  <button
                    type="button"
                    onClick={() => onSelectResult(result)}
                    onMouseEnter={() => onSelectedIndexChange(index)}
                    className={cn(
                      'w-full text-left px-3 py-2 flex items-start gap-2 transition-colors',
                      index === selectedIndex
                        ? 'bg-teal-50 dark:bg-teal-500/10'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
                    )}
                  >
                    <Search className="w-3.5 h-3.5 mt-0.5 text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-slate-900 dark:text-white">
                        <HighlightedText text={result.title || 'Untitled'} query={searchQuery} />
                      </div>
                      {result.matches && result.matches.length > 0 ? (
                        <SearchMatchChips matches={result.matches} className="mt-1" />
                      ) : result.subtitle ? (
                        <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {result.subtitle}
                        </div>
                      ) : null}
                    </div>
                    {result.matchType === 'fuzzy' && (
                      <span className="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400 flex-shrink-0">
                        fuzzy
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </form>
    </Popover>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import { VisuallyHidden } from '@crm-eco/ui';
import { Input } from '@crm-eco/ui/components/input';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  Search,
  Users,
  UserPlus,
  DollarSign,
  Building2,
  ArrowRight,
  Loader2,
  Inbox,
} from 'lucide-react';

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  module: string;
  moduleName: string;
}

interface GlobalSearchOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MODULE_ICONS: Record<string, React.ReactNode> = {
  contacts: <Users className="w-4 h-4" />,
  leads: <UserPlus className="w-4 h-4" />,
  deals: <DollarSign className="w-4 h-4" />,
  accounts: <Building2 className="w-4 h-4" />,
};

const MODULE_COLORS: Record<string, string> = {
  contacts: 'bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400',
  leads: 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400',
  deals: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
  accounts: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
};

export function GlobalSearchOverlay({ open, onOpenChange }: GlobalSearchOverlayProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Search function
  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    
    try {
      // Search across CRM records
      const { data: records } = await supabase
        .from('crm_records')
        .select(`
          id,
          title,
          email,
          phone,
          module_id,
          data,
          crm_modules!inner(key, name)
        `)
        .or(`title.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .limit(20);

      const searchResults: SearchResult[] = (records || []).map((record: any) => ({
        id: record.id,
        title: record.title || 
          [record.data?.first_name, record.data?.last_name].filter(Boolean).join(' ') || 
          'Untitled',
        subtitle: record.email || record.phone || undefined,
        module: record.crm_modules?.key || 'unknown',
        moduleName: record.crm_modules?.name || 'Record',
      }));

      setResults(searchResults);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      search(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, search]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            navigateToResult(results[selectedIndex]);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, results, selectedIndex]);

  const navigateToResult = (result: SearchResult) => {
    router.push(`/crm/r/${result.id}`);
    onOpenChange(false);
    setQuery('');
    setResults([]);
  };

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // Group results by module
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.module]) acc[result.module] = [];
    acc[result.module].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-xl overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
        <VisuallyHidden>
          <DialogTitle>Search Records</DialogTitle>
        </VisuallyHidden>
        {/* Search Input */}
        <div className="flex items-center border-b border-slate-200 dark:border-white/10 px-4">
          <Search className="w-5 h-5 text-slate-400 mr-3" />
          <Input
            placeholder="Search contacts, leads, deals..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 border-0 focus-visible:ring-0 h-14 text-base placeholder:text-slate-400"
            autoFocus
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {query.trim() === '' ? (
            <div className="py-12 text-center">
              <Search className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500">
                Start typing to search across all records
              </p>
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="py-12 text-center">
              <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500">
                No results found for "{query}"
              </p>
            </div>
          ) : (
            <div className="py-2">
              {Object.entries(groupedResults).map(([module, moduleResults]) => (
                <div key={module}>
                  <div className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {moduleResults[0]?.moduleName || module}
                  </div>
                  {moduleResults.map((result) => {
                    const globalIndex = results.indexOf(result);
                    const isSelected = globalIndex === selectedIndex;

                    return (
                      <button
                        key={result.id}
                        onClick={() => navigateToResult(result)}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                          isSelected 
                            ? 'bg-slate-100 dark:bg-white/5' 
                            : 'hover:bg-slate-50 dark:hover:bg-white/5'
                        )}
                      >
                        <div className={cn(
                          'flex items-center justify-center w-8 h-8 rounded-lg',
                          MODULE_COLORS[module] || MODULE_COLORS.contacts
                        )}>
                          {MODULE_ICONS[module] || <Users className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {result.title}
                          </p>
                          {result.subtitle && (
                            <p className="text-xs text-slate-500 truncate">
                              {result.subtitle}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <ArrowRight className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-white/10 px-4 py-2 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">↵</kbd>
              select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">esc</kbd>
            close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

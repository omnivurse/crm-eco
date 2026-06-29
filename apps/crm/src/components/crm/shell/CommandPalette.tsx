'use client';

/**
 * Global Command Palette (⌘K / Ctrl+K).
 *
 * Categories (in order of usefulness):
 *   1. Live terminal command match (if the query is a known shortcut)
 *   2. Record search results (cross-module, /api/crm/search)
 *   3. Recent records (/api/crm/recently-viewed)
 *   4. Navigation (dashboard, modules, settings)
 *   5. Quick Actions (create per-module, import)
 *   6. Terminal command hints (unfiltered state only)
 *
 * Every record result exposes two actions: "Open" and "✨ Draft AI email" (the
 * latter navigates with `?ai=email` which `RecordDetailShellV2` detects and
 * auto-triggers the follow-up draft flow).
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import { VisuallyHidden } from '@crm-eco/ui';
import { Input } from '@crm-eco/ui/components/input';
import { cn } from '@crm-eco/ui/lib/utils';
import type { CrmModule } from '@/lib/crm/types';
import {
  Search,
  Plus,
  Upload,
  Settings,
  Users,
  UserPlus,
  DollarSign,
  Building,
  LayoutDashboard,
  FileText,
  ArrowRight,
  Terminal,
  AlertTriangle,
  Eye,
  ArrowRightLeft,
  Sparkles,
  Clock,
  Loader2,
  Crosshair,
} from 'lucide-react';
import {
  getRecordCommandContext,
  subscribeRecordCommandContext,
} from '@/lib/crm/record-command-context';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modules: CrmModule[];
}

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
  keywords?: string[];
  /** Optional secondary action shown as a small sparkle chip. */
  secondary?: {
    label: string;
    action: () => void;
    icon: React.ReactNode;
  };
}

interface RecordSearchResult {
  id: string;
  title: string;
  subtitle?: string;
  module: string;
  moduleKey: string;
  url: string;
}

interface RecentlyViewedApiItem {
  recordId: string;
  moduleId: string;
  moduleKey: string | null;
  moduleName: string | null;
  title: string | null;
  lastViewedAt: string;
}

const iconMap: Record<string, React.ReactNode> = {
  user: <Users className="w-4 h-4" />,
  'user-plus': <UserPlus className="w-4 h-4" />,
  'dollar-sign': <DollarSign className="w-4 h-4" />,
  building: <Building className="w-4 h-4" />,
  file: <FileText className="w-4 h-4" />,
};

interface TerminalCommand {
  pattern: RegExp;
  syntax: string;
  description: string;
  execute: (match: RegExpMatchArray, navigate: (path: string) => void) => void;
}

const terminalCommands: TerminalCommand[] = [
  {
    pattern: /^(leads|contacts|deals|accounts|tasks)\s+view\s+(.+)$/i,
    syntax: '<module> view <name>',
    description: 'Load a specific view',
    execute: (match, navigate) => {
      const [, module, viewName] = match;
      navigate(`/crm/modules/${module.toLowerCase()}?view=${encodeURIComponent(viewName)}`);
    },
  },
  {
    pattern: /^deals?\s+at-?risk$/i,
    syntax: 'deals at-risk',
    description: 'Show at-risk deals',
    execute: (_, navigate) => {
      navigate('/crm/modules/deals?filter=at-risk');
    },
  },
  {
    pattern: /^open\s+(lead|contact|deal|account|task)s?\s+(.+)$/i,
    syntax: 'open <module> <name/id>',
    description: 'Open a record',
    execute: (match, navigate) => {
      const [, module, identifier] = match;
      if (identifier.match(/^[0-9a-f-]{36}$/i)) {
        navigate(`/crm/r/${identifier}`);
      } else {
        navigate(`/crm/modules/${module.toLowerCase()}s?search=${encodeURIComponent(identifier)}`);
      }
    },
  },
  {
    pattern: /^stage\s+([a-f0-9-]+)\s+(.+)$/i,
    syntax: 'stage <dealId> <stageName>',
    description: 'Change deal stage',
    execute: (match, navigate) => {
      const [, dealId, stageName] = match;
      navigate(`/crm/r/${dealId}?changeStage=${encodeURIComponent(stageName)}`);
    },
  },
  {
    pattern: /^(leads|contacts|deals|accounts)$/i,
    syntax: '<module>',
    description: 'Go to module',
    execute: (match, navigate) => {
      navigate(`/crm/modules/${match[1].toLowerCase()}`);
    },
  },
  {
    pattern: /^new\s+(lead|contact|deal|account|task)$/i,
    syntax: 'new <type>',
    description: 'Create new record',
    execute: (match, navigate) => {
      navigate(`/crm/modules/${match[1].toLowerCase()}s/new`);
    },
  },
  {
    pattern: /^(hot|warm|cold)\s+(leads?|contacts?)$/i,
    syntax: '<status> leads',
    description: 'Filter by status',
    execute: (match, navigate) => {
      const [, status, module] = match;
      const moduleKey = module.toLowerCase().endsWith('s')
        ? module.toLowerCase()
        : `${module.toLowerCase()}s`;
      navigate(`/crm/modules/${moduleKey}?filter=status:${status.toLowerCase()}`);
    },
  },
];

export function CommandPalette({ open, onOpenChange, modules }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<RecordSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [recents, setRecents] = useState<RecordSearchResult[]>([]);
  const [recordContextVersion, setRecordContextVersion] = useState(0);
  const searchAbortRef = useRef<AbortController | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => subscribeRecordCommandContext(() => setRecordContextVersion((v) => v + 1)), []);

  const recordCommandContext = useMemo(
    () => getRecordCommandContext(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version bump re-reads store
    [recordContextVersion],
  );

  const onRecordPage = pathname?.startsWith('/crm/r/') ?? false;

  const navigate = useCallback(
    (path: string) => {
      router.push(path);
      onOpenChange(false);
      setQuery('');
    },
    [router, onOpenChange],
  );

  // Load recent records on open (once per open cycle).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/crm/recently-viewed?limit=5', {
          credentials: 'same-origin',
        });
        if (!res.ok) return;
        const body = (await res.json()) as { data?: RecentlyViewedApiItem[] };
        if (cancelled) return;
        const items: RecordSearchResult[] = (body.data ?? []).map((it) => ({
          id: it.recordId,
          title: it.title || 'Untitled',
          subtitle: it.moduleName ?? undefined,
          module: it.moduleName ?? '',
          moduleKey: it.moduleKey ?? '',
          url: `/crm/r/${it.recordId}`,
        }));
        setRecents(items);
      } catch {
        /* network failure is non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Debounced live record search.
  useEffect(() => {
    const trimmed = query.trim();
    if (!open || trimmed.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    searchAbortRef.current?.abort();
    const ctrl = new AbortController();
    searchAbortRef.current = ctrl;
    setSearchLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/crm/search?q=${encodeURIComponent(trimmed)}&limit=8`,
          { credentials: 'same-origin', signal: ctrl.signal },
        );
        if (!res.ok) {
          if (!ctrl.signal.aborted) setSearchResults([]);
          return;
        }
        const body = (await res.json()) as { results?: RecordSearchResult[] };
        if (!ctrl.signal.aborted) {
          setSearchResults(body.results ?? []);
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        if (!ctrl.signal.aborted) setSearchResults([]);
      } finally {
        if (!ctrl.signal.aborted) setSearchLoading(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(handle);
      ctrl.abort();
    };
  }, [query, open]);

  // Terminal command match.
  const terminalMatch = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return null;
    for (const cmd of terminalCommands) {
      const match = trimmed.match(cmd.pattern);
      if (match) return { command: cmd, match };
    }
    return null;
  }, [query]);

  const recordCommands: CommandItem[] = useMemo(() => {
    const fromSearch: CommandItem[] = searchResults.map((r) => ({
      id: `record-${r.id}`,
      label: r.title,
      description: r.subtitle ? `${r.module} · ${r.subtitle}` : r.module,
      icon: <FileText className="w-4 h-4" />,
      action: () => navigate(r.url),
      category: 'Records',
      keywords: [r.title.toLowerCase(), r.module.toLowerCase(), r.moduleKey],
      secondary: {
        label: 'Draft AI email',
        icon: <Sparkles className="w-3.5 h-3.5" />,
        action: () => navigate(`${r.url}?ai=email`),
      },
    }));
    return fromSearch;
  }, [searchResults, navigate]);

  const recentCommands: CommandItem[] = useMemo(() => {
    // Hide recents once the user starts typing — searchResults take over.
    if (query.trim().length >= 2) return [];
    return recents.map((r) => ({
      id: `recent-${r.id}`,
      label: r.title,
      description: r.module || undefined,
      icon: <Clock className="w-4 h-4" />,
      action: () => navigate(r.url),
      category: 'Recently viewed',
      keywords: [r.title.toLowerCase(), r.module.toLowerCase()],
      secondary: {
        label: 'Draft AI email',
        icon: <Sparkles className="w-3.5 h-3.5" />,
        action: () => navigate(`${r.url}?ai=email`),
      },
    }));
  }, [recents, query, navigate]);

  const fieldJumpCommands: CommandItem[] = useMemo(() => {
    const trimmed = query.trim();
    if (!onRecordPage || !recordCommandContext || trimmed.length < 1) return [];

    return recordCommandContext.searchFields(trimmed).map((hit) => ({
      id: `field-jump-${hit.id}`,
      label: hit.label,
      description: hit.snippet
        ? `${recordCommandContext.recordTitle} · ${hit.snippet}`
        : recordCommandContext.recordTitle,
      icon: <Crosshair className="w-4 h-4" />,
      action: () => {
        recordCommandContext.jumpTo(hit.navigate);
        onOpenChange(false);
        setQuery('');
      },
      category: 'Jump to field',
      keywords: [hit.label.toLowerCase(), hit.snippet.toLowerCase()],
    }));
  }, [onRecordPage, recordCommandContext, query, onOpenChange]);

  const baseCommands: CommandItem[] = useMemo(() => {
    const commands: CommandItem[] = [
      {
        id: 'nav-dashboard',
        label: 'Go to CRM Dashboard',
        icon: <LayoutDashboard className="w-4 h-4" />,
        action: () => navigate('/crm'),
        category: 'Navigation',
        keywords: ['home', 'main', 'dashboard'],
      },
      ...modules.map((module) => ({
        id: `nav-${module.key}`,
        label: `Go to ${module.name_plural || module.name + 's'}`,
        icon: iconMap[module.icon] || <FileText className="w-4 h-4" />,
        action: () => navigate(`/crm/modules/${module.key}`),
        category: 'Navigation',
        keywords: [module.key, module.name.toLowerCase()],
      })),
      {
        id: 'nav-settings',
        label: 'Go to CRM Settings',
        icon: <Settings className="w-4 h-4" />,
        action: () => navigate('/crm/settings'),
        category: 'Navigation',
        keywords: ['config', 'preferences', 'modules', 'fields'],
      },
      ...modules.map((module) => ({
        id: `create-${module.key}`,
        label: `Create New ${module.name}`,
        description: `Add a new ${module.name.toLowerCase()} record`,
        icon: <Plus className="w-4 h-4" />,
        action: () => navigate(`/crm/modules/${module.key}/new`),
        category: 'Quick Actions',
        keywords: ['add', 'new', module.key],
      })),
      {
        id: 'action-import',
        label: 'Import Data',
        description: 'Import records from CSV or other sources',
        icon: <Upload className="w-4 h-4" />,
        action: () => navigate('/crm/import'),
        category: 'Quick Actions',
        keywords: ['csv', 'upload', 'bulk'],
      },
      {
        id: 'terminal-view',
        label: 'leads view <name>',
        description: 'Load a specific view for any module',
        icon: <Terminal className="w-4 h-4" />,
        action: () => setQuery('leads view '),
        category: 'Terminal Commands',
        keywords: ['view', 'filter', 'list'],
      },
      {
        id: 'terminal-atrisk',
        label: 'deals at-risk',
        description: 'Show at-risk deals that need attention',
        icon: <AlertTriangle className="w-4 h-4" />,
        action: () => {
          terminalCommands[1].execute(['deals at-risk'] as unknown as RegExpMatchArray, navigate);
        },
        category: 'Terminal Commands',
        keywords: ['risk', 'danger', 'closing'],
      },
      {
        id: 'terminal-open',
        label: 'open <module> <name/id>',
        description: 'Open a specific record by name or ID',
        icon: <Eye className="w-4 h-4" />,
        action: () => setQuery('open '),
        category: 'Terminal Commands',
        keywords: ['open', 'view', 'record'],
      },
      {
        id: 'terminal-stage',
        label: 'stage <dealId> <stage>',
        description: 'Change the stage of a deal',
        icon: <ArrowRightLeft className="w-4 h-4" />,
        action: () => setQuery('stage '),
        category: 'Terminal Commands',
        keywords: ['stage', 'transition', 'move', 'pipeline'],
      },
      {
        id: 'terminal-new',
        label: 'new <type>',
        description: 'Create a new record quickly',
        icon: <Plus className="w-4 h-4" />,
        action: () => setQuery('new '),
        category: 'Terminal Commands',
        keywords: ['create', 'add', 'new'],
      },
    ];
    return commands;
  }, [modules, navigate]);

  // Filter "base" commands by the free-text query.
  const filteredBase = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return baseCommands;
    return baseCommands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.description?.toLowerCase().includes(q) ||
        cmd.keywords?.some((k) => k.includes(q)),
    );
  }, [baseCommands, query]);

  // Assemble the final ordered list by category. Live record results win when
  // the user has typed, recents when idle.
  const orderedCategories = useMemo(() => {
    const buckets: Array<{ category: string; items: CommandItem[] }> = [];
    if (fieldJumpCommands.length > 0) {
      buckets.push({ category: 'Jump to field', items: fieldJumpCommands });
    }
    if (recordCommands.length > 0) {
      buckets.push({ category: 'Records', items: recordCommands });
    }
    if (recentCommands.length > 0) {
      buckets.push({ category: 'Recently viewed', items: recentCommands });
    }
    const byCat = new Map<string, CommandItem[]>();
    for (const cmd of filteredBase) {
      const arr = byCat.get(cmd.category) ?? [];
      arr.push(cmd);
      byCat.set(cmd.category, arr);
    }
    for (const cat of ['Navigation', 'Quick Actions', 'Terminal Commands']) {
      const items = byCat.get(cat);
      if (items && items.length > 0) buckets.push({ category: cat, items });
    }
    return buckets;
  }, [fieldJumpCommands, recordCommands, recentCommands, filteredBase]);

  const flatCommands = useMemo(
    () => orderedCategories.flatMap((b) => b.items),
    [orderedCategories],
  );

  // Keyboard navigation.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, Math.max(flatCommands.length - 1, 0)));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (terminalMatch) {
            terminalMatch.command.execute(terminalMatch.match, navigate);
            return;
          }
          if (flatCommands[selectedIndex]) {
            flatCommands[selectedIndex].action();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onOpenChange(false);
          setQuery('');
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, selectedIndex, flatCommands, onOpenChange, terminalMatch, navigate]);

  // Reset selection as the list changes.
  useEffect(() => {
    queueMicrotask(() => setSelectedIndex(0));
  }, [query, searchResults.length, recents.length]);

  // Global ⌘K / Ctrl+K toggle.
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-xl overflow-hidden">
        <VisuallyHidden>
          <DialogTitle>Command Palette</DialogTitle>
        </VisuallyHidden>

        <div className="flex items-center border-b px-3">
          <Search className="w-4 h-4 text-muted-foreground mr-2" />
          <Input
            placeholder={
              onRecordPage && recordCommandContext
                ? 'Jump to field, search records, run commands…'
                : 'Search records, run commands…'
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 border-0 focus-visible:ring-0 h-12 placeholder:text-muted-foreground"
            autoFocus
          />
          {searchLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mr-2" />
          ) : null}
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        <div className="max-h-[420px] overflow-y-auto py-2">
          {terminalMatch && (
            <div className="mb-2">
              <div className="px-3 py-1.5 text-xs font-medium text-teal-600 dark:text-teal-400 flex items-center gap-1">
                <Terminal className="w-3 h-3" />
                Terminal Command Matched
              </div>
              <button
                onClick={() => terminalMatch.command.execute(terminalMatch.match, navigate)}
                className="w-full flex items-center gap-3 px-3 py-2 text-left bg-teal-50 dark:bg-teal-500/10 border-l-2 border-teal-500 hover:bg-teal-100 dark:hover:bg-teal-500/20 transition-colors"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-md bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400">
                  <Terminal className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-slate-900 dark:text-white">
                    {terminalMatch.command.description}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono">
                    $ {query}
                  </p>
                </div>
                <kbd className="px-2 py-1 rounded bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 text-xs font-mono">
                  ↵
                </kbd>
              </button>
            </div>
          )}

          {flatCommands.length === 0 && !terminalMatch ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {query.trim().length >= 2
                ? 'No matches. Try a different query or a terminal command like "leads view All"'
                : 'Start typing to search records or run a command…'}
            </div>
          ) : (
            orderedCategories.map(({ category, items }) => (
              <div key={category}>
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  {category}
                </div>
                {items.map((cmd) => {
                  const index = flatCommands.indexOf(cmd);
                  const isSelected = index === selectedIndex;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => cmd.action()}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors',
                        isSelected && 'bg-muted',
                      )}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <span className="flex items-center justify-center w-8 h-8 rounded-md bg-muted text-muted-foreground">
                        {cmd.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{cmd.label}</p>
                        {cmd.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {cmd.description}
                          </p>
                        )}
                      </div>
                      {cmd.secondary ? (
                        <span
                          role="button"
                          tabIndex={-1}
                          onClick={(e) => {
                            e.stopPropagation();
                            cmd.secondary!.action();
                          }}
                          onMouseDown={(e) => e.preventDefault()}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium',
                            'border-violet-200 text-violet-700 hover:bg-violet-50',
                            'dark:border-violet-500/30 dark:text-violet-300 dark:hover:bg-violet-500/10',
                          )}
                        >
                          {cmd.secondary.icon}
                          {cmd.secondary.label}
                        </span>
                      ) : null}
                      {isSelected && !cmd.secondary && (
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="border-t px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono">↵</kbd>
              select
            </span>
            <span className="hidden sm:flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono">⌘K</kbd>
              toggle
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono">esc</kbd>
            close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
 * Record results are grouped per person (see lib/crm/palette-results.ts): the
 * same human found as a Contact + Lead + Member renders once, with a chip per
 * module. "Draft AI email" (navigates with `?ai=email`, which
 * `RecordDetailShellV2` detects and auto-triggers the draft) is keyboard-only
 * (⌘/Ctrl+Enter) and offered only when the row has an email AND the viewer is
 * a CRM admin/manager — there is no client-visible "AI configured" flag, so
 * this is the narrowest honest gate. Terminal command hints that only make
 * sense with a deals pipeline are hidden unless the org has `deals` enabled.
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
import { useUiPreferences } from '@/hooks/useUiPreferences';
import { parseHabitsProfile } from '@/lib/crm/habits/types';
import { sortModulesByHabits } from '@/lib/crm/habits/score';
import { emitHabitSignal, hashSearchQuery } from '@/lib/crm/habits/beacon';
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
import { SearchMatchChips, HighlightedText } from '@/components/crm/records/SearchMatchChips';
import type { RecordSearchMatch } from '@/lib/crm/search-match';
import {
  shouldClearEphemeralSearchOnOpenChange,
  useEphemeralSearchWhenClosed,
} from '@/hooks/useEphemeralSearchWhenClosed';
import { useClientAuth } from '@/hooks/useClientAuth';
import { SEARCH_PLACEHOLDER, SEARCH_PLACEHOLDER_ON_RECORD } from '@/lib/crm/search-copy';
import {
  groupPaletteResults,
  paletteResultLimit,
  resultHasEmail,
  type PaletteResultChip,
} from '@/lib/crm/palette-results';
import { canDraftAiEmail as roleCanDraftAiEmail } from '@/lib/crm/ai/email-draft-roles';
import { resolveCreateIntent } from '@/lib/crm/create-intent';
import { openCrmQuickCreate } from '@/lib/crm/create-intent-bus';

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
  /** Colour-coded "matched field" chips for record search results. */
  matches?: RecordSearchMatch[];
  /** Module name shown alongside chips (chips replace the description line). */
  moduleLabel?: string;
  /** Optional secondary action — keyboard-only (⌘/Ctrl+Enter), hinted on the selected row. */
  secondary?: {
    label: string;
    action: () => void;
    icon: React.ReactNode;
  };
  /** Module chips for a grouped person row (Contact / Lead / Member); each navigates. */
  chips?: PaletteResultChip[];
}

interface RecordSearchResult {
  id: string;
  title: string;
  subtitle?: string;
  module: string;
  moduleKey: string;
  url: string;
  matches?: RecordSearchMatch[];
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
  /** Only meaningful when the org has a deals pipeline module enabled. */
  requiresDeals?: boolean;
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
    requiresDeals: true,
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
    requiresDeals: true,
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

/**
 * Idle-state "Terminal Commands" hints. Deal-centric ("deals at-risk",
 * "stage <dealId> …") — rendered only when the org has a deals module.
 */
function terminalHintCommands({
  navigate,
  setQuery,
}: {
  navigate: (path: string) => void;
  setQuery: (q: string) => void;
}): CommandItem[] {
  return [
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
}

export function CommandPalette({ open, onOpenChange, modules }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Which module chip is armed on a grouped row (0 = primary). ←/→ move it;
  // Enter opens it. Stored with the row it belongs to so it implicitly resets
  // to the primary chip whenever a different row becomes selected.
  const [armedChip, setArmedChip] = useState<{ row: number; chip: number }>({ row: 0, chip: 0 });
  const chipIndex = armedChip.row === selectedIndex ? armedChip.chip : 0;
  const [searchResults, setSearchResults] = useState<RecordSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [recents, setRecents] = useState<RecordSearchResult[]>([]);
  const [recordContextVersion, setRecordContextVersion] = useState(0);
  const searchAbortRef = useRef<AbortController | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { preferences } = useUiPreferences();
  const { profile: clientProfile } = useClientAuth();
  // Same gate as /api/crm/ai/email-draft (shared constant) so the palette
  // never offers an action the API would 403.
  const canDraftAiEmail = roleCanDraftAiEmail(clientProfile?.crm_role);
  // Deal-centric hints/commands only when a deals pipeline exists for this org
  // (modules passed in are the org's enabled modules).
  const dealsEnabled = useMemo(
    () => modules.some((m) => m.key === 'deals' && m.is_enabled !== false),
    [modules],
  );
  const habits = parseHabitsProfile(preferences.habits);
  const orderedModules = useMemo(
    () => sortModulesByHabits(modules, habits),
    [modules, habits],
  );

  useEffect(() => subscribeRecordCommandContext(() => setRecordContextVersion((v) => v + 1)), []);

  const recordCommandContext = useMemo(
    () => getRecordCommandContext(),
    [recordContextVersion],
  );

  const onRecordPage = pathname?.startsWith('/crm/r/') ?? false;

  const resetSearch = useCallback(() => {
    setQuery('');
    setSearchResults([]);
    setSelectedIndex(0);
    setSearchLoading(false);
    searchAbortRef.current?.abort();
  }, []);

  // Shell-mounted palette: every close path must wipe the query (overlay
  // click, Escape, ⌘K toggle, result navigation). Shared hook owns the contract.
  useEphemeralSearchWhenClosed(open, resetSearch);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
      if (shouldClearEphemeralSearchOnOpenChange(nextOpen)) {
        resetSearch();
      }
    },
    [onOpenChange, resetSearch],
  );

  const navigate = useCallback(
    (path: string) => {
      router.push(path);
      handleOpenChange(false);
    },
    [router, handleOpenChange],
  );

  // Load recent records on open; boost habit top_records to the front.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/crm/recently-viewed?limit=12', {
          credentials: 'same-origin',
        });
        if (!res.ok) return;
        const body = (await res.json()) as { data?: RecentlyViewedApiItem[] };
        if (cancelled) return;
        let items: RecordSearchResult[] = (body.data ?? []).map((it) => ({
          id: it.recordId,
          title: it.title || 'Untitled',
          subtitle: it.moduleName ?? undefined,
          module: it.moduleName ?? '',
          moduleKey: it.moduleKey ?? '',
          url: `/crm/r/${it.recordId}`,
        }));
        const habitIds = habits?.top_records?.map((r) => r.id) ?? [];
        if (habitIds.length > 0) {
          const rank = new Map(habitIds.map((id, i) => [id, i]));
          items = [...items].sort((a, b) => {
            const ra = rank.has(a.id) ? rank.get(a.id)! : 999;
            const rb = rank.has(b.id) ? rank.get(b.id)! : 999;
            return ra - rb;
          });
        }
        setRecents(items.slice(0, 5));
      } catch {
        /* network failure is non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, habits?.top_records]);

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
          `/api/crm/search?q=${encodeURIComponent(trimmed)}&limit=${paletteResultLimit(trimmed)}`,
          { credentials: 'same-origin', signal: ctrl.signal },
        );
        if (!res.ok) {
          if (!ctrl.signal.aborted) setSearchResults([]);
          return;
        }
        const body = (await res.json()) as { results?: RecordSearchResult[] };
        if (!ctrl.signal.aborted) {
          setSearchResults(body.results ?? []);
          // Habit signal: hashed query only (never raw PII)
          void hashSearchQuery(trimmed).then((q_hash) => {
            emitHabitSignal('search_query', {
              meta: { q_hash },
              dedupeMs: 60_000,
            });
          });
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
      if (cmd.requiresDeals && !dealsEnabled) continue;
      const match = trimmed.match(cmd.pattern);
      if (match) return { command: cmd, match };
    }
    return null;
  }, [query, dealsEnabled]);

  const recordCommands: CommandItem[] = useMemo(() => {
    // One row per person: Contact + Lead + Member twins fold into a single
    // entry with a chip per module (pure helper, tested).
    return groupPaletteResults(searchResults).map((group) => {
      const r = group.primary;
      const moduleLabel = group.isMerged
        ? group.chips.map((c) => c.label).join(' · ')
        : r.module;
      const offerAi = canDraftAiEmail && group.results.some(resultHasEmail);
      const aiTarget = group.results.find(resultHasEmail) ?? r;
      return {
        id: `record-${r.id}`,
        label: r.title,
        description: r.subtitle ? `${moduleLabel} · ${r.subtitle}` : moduleLabel,
        icon: <FileText className="w-4 h-4" />,
        action: () => navigate(r.url),
        category: 'Records',
        keywords: [
          r.title.toLowerCase(),
          ...group.results.flatMap((m) => [m.module.toLowerCase(), m.moduleKey]),
        ],
        matches: r.matches,
        moduleLabel,
        chips: group.isMerged ? group.chips : undefined,
        secondary: offerAi
          ? {
              label: 'Draft AI email',
              icon: <Sparkles className="w-3.5 h-3.5" />,
              action: () => navigate(`${aiTarget.url}?ai=email`),
            }
          : undefined,
      };
    });
  }, [searchResults, navigate, canDraftAiEmail]);

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
      // No AI action here: the recents API carries no email, so we can't tell
      // whether a draft is even possible.
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
        handleOpenChange(false);
      },
      category: 'Jump to field',
      keywords: [hit.label.toLowerCase(), hit.snippet.toLowerCase()],
    }));
  }, [onRecordPage, recordCommandContext, query, handleOpenChange]);

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
      ...orderedModules.map((module) => ({
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
      ...orderedModules.flatMap((module) => {
        const intent = resolveCreateIntent({
          moduleKey: module.key,
          dealsEnabled,
        });
        if (intent.kind === 'blocked') return [];
        const isPerson = module.key === 'contacts' || module.key === 'members';
        return [
          {
            id: `create-${module.key}`,
            label: isPerson ? 'Add Member' : `Create New ${module.name}`,
            description: isPerson
              ? 'Quick add from an enrollment'
              : `Add a new ${module.name.toLowerCase()} record`,
            icon: <Plus className="w-4 h-4" />,
            action: () => {
              if (intent.kind === 'quick') {
                openCrmQuickCreate(intent.moduleKey);
                handleOpenChange(false);
                return;
              }
              navigate(intent.href);
            },
            category: 'Quick Actions',
            keywords: ['add', 'new', module.key],
          },
        ];
      }),
      {
        id: 'action-import',
        label: 'Import Data',
        description: 'Import records from CSV or other sources',
        icon: <Upload className="w-4 h-4" />,
        action: () => navigate('/crm/import'),
        category: 'Quick Actions',
        keywords: ['csv', 'upload', 'bulk'],
      },
      ...(dealsEnabled
        ? terminalHintCommands({ navigate, setQuery })
        : []),
    ];
    return commands;
  }, [orderedModules, navigate, dealsEnabled, handleOpenChange]);

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
        case 'ArrowRight':
        case 'ArrowLeft': {
          // On a grouped person row, ←/→ pick which module chip Enter opens.
          // Rows without chips keep the default (caret movement in the input).
          const current = flatCommands[selectedIndex];
          const chipCount = current?.chips?.length ?? 0;
          if (chipCount < 2) break;
          e.preventDefault();
          const delta = e.key === 'ArrowRight' ? 1 : -1;
          setArmedChip({
            row: selectedIndex,
            chip: Math.min(Math.max(chipIndex + delta, 0), chipCount - 1),
          });
          break;
        }
        case 'Enter': {
          e.preventDefault();
          const current = flatCommands[selectedIndex];
          // ⌘/Ctrl+Enter runs the keyboard-only secondary action (AI draft).
          if ((e.metaKey || e.ctrlKey) && current?.secondary) {
            current.secondary.action();
            return;
          }
          if (terminalMatch) {
            terminalMatch.command.execute(terminalMatch.match, navigate);
            return;
          }
          // Grouped row: open the armed chip (defaults to the primary record).
          const armedChip = current?.chips?.[chipIndex];
          if (armedChip && (current?.chips?.length ?? 0) > 1) {
            navigate(armedChip.url);
            return;
          }
          if (current) {
            current.action();
          }
          break;
        }
        case 'Escape':
          e.preventDefault();
          handleOpenChange(false);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, selectedIndex, chipIndex, flatCommands, handleOpenChange, terminalMatch, navigate]);

  // Reset selection as the list changes.
  useEffect(() => {
    queueMicrotask(() => {
      setSelectedIndex(0);
      setArmedChip({ row: 0, chip: 0 });
    });
  }, [query, searchResults.length, recents.length]);

  // Global ⌘K / Ctrl+K toggle — sole keyboard owner (TopBar button opens via bus).
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handleOpenChange(!open);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [open, handleOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="p-0 max-w-xl overflow-hidden">
        <VisuallyHidden>
          <DialogTitle>Command Palette</DialogTitle>
        </VisuallyHidden>

        <div className="flex items-center border-b px-3">
          <Search className="w-4 h-4 text-muted-foreground mr-2" />
          <Input
            placeholder={
              onRecordPage && recordCommandContext
                ? SEARCH_PLACEHOLDER_ON_RECORD
                : SEARCH_PLACEHOLDER
            }
            aria-label={
              onRecordPage && recordCommandContext
                ? SEARCH_PLACEHOLDER_ON_RECORD
                : SEARCH_PLACEHOLDER
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 border-0 focus-visible:ring-0 h-12 placeholder:text-muted-foreground"
            data-testid="crm-palette-input"
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

          {searchLoading && query.trim().length >= 2 && flatCommands.length === 0 && !terminalMatch ? (
            <div className="py-8 flex flex-col items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span>Searching records…</span>
            </div>
          ) : flatCommands.length === 0 && !terminalMatch ? (
            <div className="py-6 px-4 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                {query.trim().length >= 2
                  ? 'No matches in this palette. Try a different query or open the full search page.'
                  : 'Type a name, email, phone or member # — or a command.'}
              </p>
              {query.trim().length >= 2 ? (
                <button
                  type="button"
                  onClick={() => {
                    const q = query.trim();
                    handleOpenChange(false);
                    router.push(`/crm/search?q=${encodeURIComponent(q)}`);
                  }}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  <Search className="w-3.5 h-3.5" />
                  View all results for &ldquo;{query.trim()}&rdquo;
                </button>
              ) : null}
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
                      data-testid="crm-palette-result"
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
                        <p className="text-sm font-medium truncate">
                          {cmd.matches && cmd.matches.length > 0 ? (
                            <HighlightedText text={cmd.label} query={query} />
                          ) : (
                            cmd.label
                          )}
                        </p>
                        {cmd.chips && cmd.chips.length > 1 ? (
                          // Chips are NOT interactive elements (a <button> may not
                          // nest one). Keyboard: ←/→ arm a chip on the selected
                          // row, Enter opens it. Mouse: click a chip directly.
                          <div
                            className="mt-1 flex flex-wrap items-center gap-1"
                            role="group"
                            aria-label={`${cmd.label} appears in ${cmd.chips.length} modules`}
                          >
                            {cmd.chips.map((chip, ci) => {
                              const isArmed = isSelected && ci === chipIndex;
                              return (
                                <span
                                  key={chip.id}
                                  aria-current={isArmed ? 'true' : undefined}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(chip.url);
                                  }}
                                  onMouseDown={(e) => e.preventDefault()}
                                  title={`Open ${chip.label} record`}
                                  className={cn(
                                    'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium transition-colors',
                                    isArmed
                                      ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/40'
                                      : 'border-border bg-background/60 text-muted-foreground hover:text-foreground hover:bg-muted',
                                  )}
                                >
                                  {chip.label}
                                </span>
                              );
                            })}
                            {isSelected ? (
                              <span className="sr-only">
                                Use left and right arrow keys to pick a record type, Enter to open.
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        {cmd.matches && cmd.matches.length > 0 ? (
                          <>
                            {cmd.moduleLabel && !cmd.chips ? (
                              <p className="text-[11px] text-muted-foreground truncate">
                                {cmd.moduleLabel}
                              </p>
                            ) : null}
                            <SearchMatchChips matches={cmd.matches} className="mt-1" />
                          </>
                        ) : cmd.description ? (
                          <p className="text-xs text-muted-foreground truncate">
                            {cmd.description}
                          </p>
                        ) : null}
                      </div>
                      {isSelected && cmd.secondary ? (
                        <>
                          {/* Screen readers get the shortcut spelled out; sighted
                              users get the compact ⌘↵ badge (hidden on mobile). */}
                          <span className="sr-only">
                            Press Command or Control plus Enter to {cmd.secondary.label}.
                          </span>
                          <span
                            aria-hidden="true"
                            className="hidden sm:inline-flex items-center gap-1 text-[11px] text-muted-foreground shrink-0"
                          >
                            {cmd.secondary.icon}
                            <kbd className="px-1 py-0.5 rounded bg-muted font-mono">⌘↵</kbd>
                            {cmd.secondary.label}
                          </span>
                        </>
                      ) : null}
                      {isSelected && (
                        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="border-t px-3 py-2 flex items-center justify-between text-xs text-muted-foreground gap-2">
          <div className="flex items-center gap-3 min-w-0">
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
          <div className="flex items-center gap-2 shrink-0">
            {query.trim().length >= 2 ? (
              <button
                type="button"
                onClick={() => {
                  const q = query.trim();
                  handleOpenChange(false);
                  router.push(`/crm/search?q=${encodeURIComponent(q)}`);
                }}
                className="text-primary hover:underline font-medium truncate max-w-[10rem] sm:max-w-none"
              >
                View all results
              </button>
            ) : null}
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono">esc</kbd>
              close
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
  Filter,
  Hash,
} from 'lucide-react';

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
  syntax?: string;
}

const iconMap: Record<string, React.ReactNode> = {
  'user': <Users className="w-4 h-4" />,
  'user-plus': <UserPlus className="w-4 h-4" />,
  'dollar-sign': <DollarSign className="w-4 h-4" />,
  'building': <Building className="w-4 h-4" />,
  'file': <FileText className="w-4 h-4" />,
};

// Terminal command patterns
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
      // If it looks like a UUID, go directly to the record
      if (identifier.match(/^[0-9a-f-]{36}$/i)) {
        navigate(`/crm/r/${identifier}`);
      } else {
        // Otherwise search for it
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
      // Navigate to deal with stage change intent
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
      const moduleKey = module.toLowerCase().endsWith('s') ? module.toLowerCase() : `${module.toLowerCase()}s`;
      navigate(`/crm/modules/${moduleKey}?filter=status:${status.toLowerCase()}`);
    },
  },
];

export function CommandPalette({ open, onOpenChange, modules }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  const navigate = useCallback((path: string) => {
    router.push(path);
    onOpenChange(false);
    setQuery('');
  }, [router, onOpenChange]);

  // Check if query matches a terminal command
  const terminalMatch = useMemo(() => {
    if (!query.trim()) return null;
    for (const cmd of terminalCommands) {
      const match = query.trim().match(cmd.pattern);
      if (match) {
        return { command: cmd, match };
      }
    }
    return null;
  }, [query]);

  // Build command list
  const commands: CommandItem[] = useMemo(() => {
    const baseCommands: CommandItem[] = [
      // Navigation
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

      // Quick Actions
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

      // Terminal Commands (show as hints when no query)
      {
        id: 'terminal-view',
        label: 'leads view <name>',
        description: 'Load a specific view for any module',
        icon: <Terminal className="w-4 h-4" />,
        action: () => setQuery('leads view '),
        category: 'Terminal Commands',
        keywords: ['view', 'filter', 'list'],
        syntax: '<module> view <name>',
      },
      {
        id: 'terminal-atrisk',
        label: 'deals at-risk',
        description: 'Show at-risk deals that need attention',
        icon: <AlertTriangle className="w-4 h-4" />,
        action: () => {
          terminalCommands[1].execute(['deals at-risk'], navigate);
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
        syntax: 'open lead|contact|deal <identifier>',
      },
      {
        id: 'terminal-stage',
        label: 'stage <dealId> <stage>',
        description: 'Change the stage of a deal',
        icon: <ArrowRightLeft className="w-4 h-4" />,
        action: () => setQuery('stage '),
        category: 'Terminal Commands',
        keywords: ['stage', 'transition', 'move', 'pipeline'],
        syntax: 'stage <dealId> <stageName>',
      },
      {
        id: 'terminal-new',
        label: 'new <type>',
        description: 'Create a new record quickly',
        icon: <Plus className="w-4 h-4" />,
        action: () => setQuery('new '),
        category: 'Terminal Commands',
        keywords: ['create', 'add', 'new'],
        syntax: 'new lead|contact|deal|task',
      },
    ];

    return baseCommands;
  }, [modules, navigate]);

  // Filter commands based on query
  const filteredCommands = query.trim()
    ? commands.filter((cmd) => {
        const searchText = query.toLowerCase();
        return (
          cmd.label.toLowerCase().includes(searchText) ||
          cmd.description?.toLowerCase().includes(searchText) ||
          cmd.keywords?.some((k) => k.includes(searchText))
        );
      })
    : commands;

  // Group by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  const categories = Object.keys(groupedCommands);
  const flatCommands = categories.flatMap((cat) => groupedCommands[cat]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, flatCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          // If we have a terminal command match, execute it
          if (terminalMatch) {
            terminalMatch.command.execute(terminalMatch.match, navigate);
            return;
          }
          // Otherwise execute the selected command
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

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Global keyboard shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-lg overflow-hidden">
        <VisuallyHidden>
          <DialogTitle>Command Palette</DialogTitle>
        </VisuallyHidden>
        {/* Search Input */}
        <div className="flex items-center border-b px-3">
          <Search className="w-4 h-4 text-muted-foreground mr-2" />
          <Input
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 border-0 focus-visible:ring-0 h-12 placeholder:text-muted-foreground"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Command List */}
        <div className="max-h-80 overflow-y-auto py-2">
          {/* Terminal Command Match */}
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
              No commands found. Try typing a terminal command like "leads view All"
            </div>
          ) : (
            categories.map((category) => (
              <div key={category}>
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  {category}
                </div>
                {groupedCommands[category].map((cmd) => {
                  const index = flatCommands.indexOf(cmd);
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => cmd.action()}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors',
                        index === selectedIndex && 'bg-muted'
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
                      {index === selectedIndex && (
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
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

'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { CrmModule } from '@/lib/crm/types';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
  keywords?: string[];
}

const iconMap: Record<string, React.ReactNode> = {
  'user': <Users className="w-3.5 h-3.5" />,
  'user-plus': <UserPlus className="w-3.5 h-3.5" />,
  'dollar-sign': <DollarSign className="w-3.5 h-3.5" />,
  'building': <Building className="w-3.5 h-3.5" />,
  'file': <FileText className="w-3.5 h-3.5" />,
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
      const moduleKey = module.toLowerCase().endsWith('s') ? module.toLowerCase() : `${module.toLowerCase()}s`;
      navigate(`/crm/modules/${moduleKey}?filter=status:${status.toLowerCase()}`);
    },
  },
];

interface SmartChatInputProps {
  modules: CrmModule[];
}

export function SmartChatInput({ modules }: SmartChatInputProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const navigate = useCallback((path: string) => {
    router.push(path);
    setIsOpen(false);
    setQuery('');
    inputRef.current?.blur();
  }, [router]);

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

  const commands: CommandItem[] = useMemo(() => {
    const base: CommandItem[] = [
      {
        id: 'nav-dashboard',
        label: 'Go to CRM Dashboard',
        icon: <LayoutDashboard className="w-3.5 h-3.5" />,
        action: () => navigate('/crm'),
        category: 'Navigation',
        keywords: ['home', 'main', 'dashboard'],
      },
      ...modules.map((m) => ({
        id: `nav-${m.key}`,
        label: `Go to ${m.name_plural || m.name + 's'}`,
        icon: iconMap[m.icon] || <FileText className="w-3.5 h-3.5" />,
        action: () => navigate(`/crm/modules/${m.key}`),
        category: 'Navigation',
        keywords: [m.key, m.name.toLowerCase()],
      })),
      {
        id: 'nav-settings',
        label: 'Go to CRM Settings',
        icon: <Settings className="w-3.5 h-3.5" />,
        action: () => navigate('/crm/settings'),
        category: 'Navigation',
        keywords: ['config', 'preferences'],
      },
      ...modules.map((m) => ({
        id: `create-${m.key}`,
        label: `Create New ${m.name}`,
        description: `Add a new ${m.name.toLowerCase()} record`,
        icon: <Plus className="w-3.5 h-3.5" />,
        action: () => navigate(`/crm/modules/${m.key}/new`),
        category: 'Quick Actions',
        keywords: ['add', 'new', m.key],
      })),
      {
        id: 'action-import',
        label: 'Import Data',
        description: 'Import records from CSV',
        icon: <Upload className="w-3.5 h-3.5" />,
        action: () => navigate('/crm/import'),
        category: 'Quick Actions',
        keywords: ['csv', 'upload', 'bulk'],
      },
      {
        id: 'terminal-view',
        label: 'leads view <name>',
        description: 'Load a specific view for any module',
        icon: <Terminal className="w-3.5 h-3.5" />,
        action: () => { setQuery('leads view '); },
        category: 'Terminal Commands',
        keywords: ['view', 'filter', 'list'],
      },
      {
        id: 'terminal-atrisk',
        label: 'deals at-risk',
        description: 'Show at-risk deals',
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
        action: () => { terminalCommands[1].execute(['deals at-risk'], navigate); },
        category: 'Terminal Commands',
        keywords: ['risk', 'danger'],
      },
      {
        id: 'terminal-open',
        label: 'open <module> <name/id>',
        description: 'Open a specific record',
        icon: <Eye className="w-3.5 h-3.5" />,
        action: () => { setQuery('open '); },
        category: 'Terminal Commands',
        keywords: ['open', 'view', 'record'],
      },
      {
        id: 'terminal-stage',
        label: 'stage <dealId> <stage>',
        description: 'Change deal stage',
        icon: <ArrowRightLeft className="w-3.5 h-3.5" />,
        action: () => { setQuery('stage '); },
        category: 'Terminal Commands',
        keywords: ['stage', 'transition'],
      },
      {
        id: 'terminal-new',
        label: 'new <type>',
        description: 'Create a new record quickly',
        icon: <Plus className="w-3.5 h-3.5" />,
        action: () => { setQuery('new '); },
        category: 'Terminal Commands',
        keywords: ['create', 'add', 'new'],
      },
    ];

    return base;
  }, [modules, navigate]);

  const filteredCommands = query.trim()
    ? commands.filter((cmd) => {
        const s = query.toLowerCase();
        return (
          cmd.label.toLowerCase().includes(s) ||
          cmd.description?.toLowerCase().includes(s) ||
          cmd.keywords?.some((k) => k.includes(s))
        );
      })
    : commands;

  const grouped = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  const categories = Object.keys(grouped);
  const flat = categories.flatMap((c) => grouped[c]);

  const executeSelected = useCallback(() => {
    if (terminalMatch) {
      terminalMatch.command.execute(terminalMatch.match, navigate);
      return;
    }
    if (flat[selectedIndex]) {
      flat[selectedIndex].action();
    }
  }, [terminalMatch, flat, selectedIndex, navigate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flat.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        executeSelected();
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setQuery('');
        inputRef.current?.blur();
        break;
    }
  }, [isOpen, flat.length, executeSelected]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Global Ctrl+Space shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      // Also capture Ctrl+K for backwards compat with CommandPalette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 w-3.5 h-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Smart Chat (Ctrl+Space)"
          className={cn(
            'w-full h-7 pl-8 pr-16 text-xs rounded-md border transition-all',
            'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-700/50',
            'text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-500',
            'focus:outline-none focus:ring-1 focus:ring-teal-500/50 focus:border-teal-500/50',
            'focus:bg-white dark:focus:bg-slate-800'
          )}
        />
        <kbd className="absolute right-2 hidden sm:inline-flex h-4 select-none items-center gap-0.5 rounded border bg-slate-200/60 dark:bg-slate-700/50 px-1 font-mono text-[9px] font-medium text-slate-400 dark:text-slate-500">
          Ctrl+Space
        </kbd>
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-80 overflow-y-auto z-50"
        >
          {/* Terminal Match */}
          {terminalMatch && (
            <div className="border-b border-slate-100 dark:border-slate-800">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400 flex items-center gap-1">
                <Terminal className="w-3 h-3" />
                Command Match
              </div>
              <button
                onClick={() => terminalMatch.command.execute(terminalMatch.match, navigate)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left bg-teal-50/50 dark:bg-teal-500/5 hover:bg-teal-50 dark:hover:bg-teal-500/10 transition-colors"
              >
                <span className="flex items-center justify-center w-6 h-6 rounded bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400">
                  <Terminal className="w-3 h-3" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-800 dark:text-white truncate">
                    {terminalMatch.command.description}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
                    $ {query}
                  </p>
                </div>
                <kbd className="px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 text-[10px] font-mono">
                  ↵
                </kbd>
              </button>
            </div>
          )}

          {flat.length === 0 && !terminalMatch ? (
            <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
              No results. Try a terminal command like &quot;leads view All&quot;
            </div>
          ) : (
            categories.map((cat) => (
              <div key={cat} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {cat}
                </div>
                {grouped[cat].map((cmd) => {
                  const idx = flat.indexOf(cmd);
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => cmd.action()}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors',
                        idx === selectedIndex
                          ? 'bg-slate-100 dark:bg-slate-800'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      )}
                    >
                      <span className="flex items-center justify-center w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                        {cmd.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{cmd.label}</p>
                        {cmd.description && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{cmd.description}</p>
                        )}
                      </div>
                      {idx === selectedIndex && (
                        <ArrowRight className="w-3 h-3 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}

          {/* Footer */}
          <div className="border-t border-slate-100 dark:border-slate-800 px-3 py-1.5 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-0.5">
                <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-0.5">
                <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">↵</kbd>
                select
              </span>
            </div>
            <span className="flex items-center gap-0.5">
              <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">esc</kbd>
              close
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

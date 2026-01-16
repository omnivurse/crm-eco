'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
} from '@crm-eco/ui/components/dialog';
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
}

const iconMap: Record<string, React.ReactNode> = {
  'user': <Users className="w-4 h-4" />,
  'user-plus': <UserPlus className="w-4 h-4" />,
  'dollar-sign': <DollarSign className="w-4 h-4" />,
  'building': <Building className="w-4 h-4" />,
  'file': <FileText className="w-4 h-4" />,
};

export function CommandPalette({ open, onOpenChange, modules }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  const navigate = useCallback((path: string) => {
    router.push(path);
    onOpenChange(false);
    setQuery('');
  }, [router, onOpenChange]);

  // Build command list
  const commands: CommandItem[] = [
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
  ];

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
  }, [open, selectedIndex, flatCommands, onOpenChange]);

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
          {flatCommands.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No commands found.
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

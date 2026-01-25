import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, BookOpen, Package, BarChart, GitBranch, X } from 'lucide-react';

interface Command {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  action: () => void;
  keywords: string[];
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const commands: Command[] = [
    {
      id: 'new-ticket',
      title: 'New Ticket',
      description: 'Create a new support ticket',
      icon: FileText,
      action: () => navigate('/tickets/new'),
      keywords: ['new', 'create', 'ticket', 'issue'],
    },
    {
      id: 'search-kb',
      title: 'Search KB',
      description: 'Search knowledge base articles',
      icon: BookOpen,
      action: () => navigate('/kb'),
      keywords: ['search', 'knowledge', 'kb', 'articles', 'docs'],
    },
    {
      id: 'open-catalog',
      title: 'Open Catalog',
      description: 'Browse service catalog',
      icon: Package,
      action: () => navigate('/catalog'),
      keywords: ['catalog', 'services', 'request'],
    },
    {
      id: 'go-analytics',
      title: 'Go to Analytics',
      description: 'View reports and analytics',
      icon: BarChart,
      action: () => navigate('/analytics'),
      keywords: ['analytics', 'reports', 'metrics', 'stats'],
    },
    {
      id: 'create-flow',
      title: 'Create Flow',
      description: 'Create a new workflow',
      icon: GitBranch,
      action: () => navigate('/admin/workflows'),
      keywords: ['flow', 'workflow', 'automation'],
    },
  ];

  const filteredCommands = search
    ? commands.filter((cmd) =>
        [...cmd.keywords, cmd.title.toLowerCase()].some((keyword) =>
          keyword.includes(search.toLowerCase())
        )
      )
    : commands;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setOpen((prev) => !prev);
    }
    if (e.key === 'Escape') {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const executeCommand = (cmd: Command) => {
    cmd.action();
    setOpen(false);
    setSearch('');
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={() => setOpen(false)}
      />
      <div className="fixed inset-x-0 top-20 z-50 max-w-2xl mx-auto px-4">
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-2xl border border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
            <Search size={20} className="text-neutral-400" />
            <input
              type="text"
              placeholder="Type a command or search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none text-neutral-900 dark:text-white placeholder-gray-400"
              autoFocus
            />
            <button
              onClick={() => setOpen(false)}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              <X size={20} />
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto p-2">
            {filteredCommands.length === 0 ? (
              <div className="px-4 py-8 text-center text-neutral-500 dark:text-neutral-400">
                No commands found
              </div>
            ) : (
              filteredCommands.map((cmd) => {
                const Icon = cmd.icon;
                return (
                  <button
                    key={cmd.id}
                    onClick={() => executeCommand(cmd)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors text-left"
                  >
                    <div className="flex-shrink-0 w-10 h-10 bg-primary-100 dark:bg-primary-950/30 rounded-lg flex items-center justify-center">
                      <Icon size={20} className="text-primary-800 dark:text-primary-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-neutral-900 dark:text-white">
                        {cmd.title}
                      </div>
                      <div className="text-sm text-neutral-500 dark:text-neutral-400 truncate">
                        {cmd.description}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="px-4 py-2 border-t border-neutral-200 dark:border-neutral-700 text-xs text-neutral-500 dark:text-neutral-400">
            Press <kbd className="px-2 py-1 bg-neutral-100 dark:bg-neutral-700 rounded">⌘K</kbd> to toggle
          </div>
        </div>
      </div>
    </>
  );
}

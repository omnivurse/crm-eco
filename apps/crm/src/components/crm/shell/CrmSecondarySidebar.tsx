'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@crm-eco/ui/lib/utils';
import { Button } from '@crm-eco/ui/components/button';
import {
  Upload,
  TrendingUp,
  BarChart3,
  ClipboardList,
  Heart,
  ChevronLeft,
  ChevronRight,
  Settings,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';

interface CrmSecondarySidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function CrmSecondarySidebar({ isOpen, onToggle }: CrmSecondarySidebarProps) {
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname.startsWith(path);
  };

  // Collapsed state - just show toggle button
  if (!isOpen) {
    return (
      <div className="flex-shrink-0 w-12 glass-strong border-r border-slate-200 dark:border-white/5 flex flex-col items-center py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-8 w-8 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10"
          title="Expand sidebar"
        >
          <PanelLeft className="w-4 h-4" />
        </Button>
        
        <div className="w-6 h-px bg-slate-200 dark:bg-white/10 my-3" />

        {/* Icon-only navigation */}
        <div className="flex flex-col gap-1">
          <Link href="/crm/import">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 rounded-lg transition-all',
                'text-slate-500 hover:text-slate-900 dark:hover:text-white',
                'hover:bg-slate-100 dark:hover:bg-white/10',
                isActive('/crm/import') && 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              )}
              title="Import Data"
            >
              <Upload className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/crm/pipeline">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 rounded-lg transition-all',
                'text-slate-500 hover:text-slate-900 dark:hover:text-white',
                'hover:bg-slate-100 dark:hover:bg-white/10',
                isActive('/crm/pipeline') && 'bg-teal-50 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400'
              )}
              title="Pipeline"
            >
              <TrendingUp className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/crm/reports">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 rounded-lg transition-all',
                'text-slate-500 hover:text-slate-900 dark:hover:text-white',
                'hover:bg-slate-100 dark:hover:bg-white/10',
                isActive('/crm/reports') && 'bg-violet-50 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400'
              )}
              title="Reports"
            >
              <BarChart3 className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        <div className="w-6 h-px bg-slate-200 dark:bg-white/10 my-3" />

        <div className="flex flex-col gap-1">
          <Link href="/crm/enrollment">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 rounded-lg transition-all',
                'text-slate-500 hover:text-slate-900 dark:hover:text-white',
                'hover:bg-slate-100 dark:hover:bg-white/10',
                isActive('/crm/enrollment') && 'bg-teal-50 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400'
              )}
              title="Enrollment"
            >
              <ClipboardList className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/crm/needs">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 rounded-lg transition-all',
                'text-slate-500 hover:text-slate-900 dark:hover:text-white',
                'hover:bg-slate-100 dark:hover:bg-white/10',
                isActive('/crm/needs') && 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400'
              )}
              title="Needs"
            >
              <Heart className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        <div className="flex-1" />

        <Link href="/crm/settings">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-8 rounded-lg transition-all',
              'text-slate-500 hover:text-slate-900 dark:hover:text-white',
              'hover:bg-slate-100 dark:hover:bg-white/10',
              isActive('/crm/settings') && 'bg-slate-100 dark:bg-white/10'
            )}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    );
  }

  // Expanded state
  return (
    <aside className="flex-shrink-0 w-52 glass-strong border-r border-slate-200 dark:border-white/5 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-slate-200 dark:border-white/5">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tools</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-7 w-7 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white"
        >
          <PanelLeftClose className="w-4 h-4" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 scrollbar-thin">
        {/* Tools Section */}
        <div className="space-y-1">
          <Link href="/crm/import">
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-start gap-2.5 h-9 px-2.5 rounded-lg text-sm font-medium',
                'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                'hover:bg-slate-100 dark:hover:bg-white/10',
                isActive('/crm/import') && 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
              )}
            >
              <Upload className={cn('w-4 h-4', isActive('/crm/import') && 'text-emerald-600 dark:text-emerald-400')} />
              Import Data
            </Button>
          </Link>
          <Link href="/crm/pipeline">
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-start gap-2.5 h-9 px-2.5 rounded-lg text-sm font-medium',
                'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                'hover:bg-slate-100 dark:hover:bg-white/10',
                isActive('/crm/pipeline') && 'bg-teal-50 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-500/30'
              )}
            >
              <TrendingUp className={cn('w-4 h-4', isActive('/crm/pipeline') && 'text-teal-600 dark:text-teal-400')} />
              Pipeline
            </Button>
          </Link>
          <Link href="/crm/reports">
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-start gap-2.5 h-9 px-2.5 rounded-lg text-sm font-medium',
                'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                'hover:bg-slate-100 dark:hover:bg-white/10',
                isActive('/crm/reports') && 'bg-violet-50 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/30'
              )}
            >
              <BarChart3 className={cn('w-4 h-4', isActive('/crm/reports') && 'text-violet-600 dark:text-violet-400')} />
              Reports
            </Button>
          </Link>
        </div>

        {/* Health Sharing Section */}
        <div className="mt-6">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-2.5 mb-2">
            Health Sharing
          </p>
          <div className="space-y-1">
            <Link href="/crm/enrollment">
              <Button
                variant="ghost"
                className={cn(
                  'w-full justify-start gap-2.5 h-9 px-2.5 rounded-lg text-sm font-medium',
                  'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                  'hover:bg-slate-100 dark:hover:bg-white/10',
                  isActive('/crm/enrollment') && 'bg-teal-50 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-500/30'
                )}
              >
                <ClipboardList className={cn('w-4 h-4', isActive('/crm/enrollment') && 'text-teal-600 dark:text-teal-400')} />
                Enrollment
              </Button>
            </Link>
            <Link href="/crm/needs">
              <Button
                variant="ghost"
                className={cn(
                  'w-full justify-start gap-2.5 h-9 px-2.5 rounded-lg text-sm font-medium',
                  'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                  'hover:bg-slate-100 dark:hover:bg-white/10',
                  isActive('/crm/needs') && 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30'
                )}
              >
                <Heart className={cn('w-4 h-4', isActive('/crm/needs') && 'text-rose-600 dark:text-rose-400')} />
                Needs
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-200 dark:border-white/5 p-2">
        <Link href="/crm/settings">
          <Button
            variant="ghost"
            className={cn(
              'w-full justify-start gap-2.5 h-9 px-2.5 rounded-lg text-sm font-medium',
              'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
              'hover:bg-slate-100 dark:hover:bg-white/10',
              isActive('/crm/settings') && 'bg-slate-100 dark:bg-white/10'
            )}
          >
            <Settings className="w-4 h-4" />
            Settings
          </Button>
        </Link>
      </div>
    </aside>
  );
}

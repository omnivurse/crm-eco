'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@crm-eco/ui/lib/utils';
import { Button } from '@crm-eco/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import {
  Users,
  UserPlus,
  DollarSign,
  Building,
  FileText,
  Target,
  Briefcase,
  Heart,
  TrendingUp,
  BarChart3,
  ChevronDown,
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-react';
import type { CrmModule } from '@/lib/crm/types';

// Icon mapping for modules
const iconMap: Record<string, LucideIcon> = {
  'user': Users,
  'user-plus': UserPlus,
  'users': Users,
  'dollar-sign': DollarSign,
  'building': Building,
  'file': FileText,
  'file-text': FileText,
  'target': Target,
  'briefcase': Briefcase,
  'heart': Heart,
  'trending-up': TrendingUp,
  'bar-chart': BarChart3,
};

interface ModuleTabsProps {
  modules: CrmModule[];
  maxVisible?: number;
}

export function ModuleTabs({ modules, maxVisible = 6 }: ModuleTabsProps) {
  const pathname = usePathname();
  const tabsRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(maxVisible);

  const getIcon = (iconName: string): LucideIcon => {
    return iconMap[iconName] || FileText;
  };

  const isActive = (path: string) => {
    if (path === '/crm') {
      return pathname === '/crm';
    }
    return pathname.startsWith(path);
  };

  // Calculate visible tabs based on container width
  useEffect(() => {
    const calculateVisibleTabs = () => {
      if (!tabsRef.current) return;
      const containerWidth = tabsRef.current.offsetWidth;
      // Each tab is approximately 120px wide
      const tabWidth = 120;
      const moreButtonWidth = 80;
      const availableWidth = containerWidth - moreButtonWidth;
      const count = Math.max(2, Math.floor(availableWidth / tabWidth));
      setVisibleCount(Math.min(count, modules.length));
    };

    calculateVisibleTabs();
    window.addEventListener('resize', calculateVisibleTabs);
    return () => window.removeEventListener('resize', calculateVisibleTabs);
  }, [modules.length]);

  const visibleModules = modules.slice(0, visibleCount);
  const overflowModules = modules.slice(visibleCount);

  return (
    <div ref={tabsRef} className="flex items-center gap-1">
      {/* Dashboard Tab */}
      <Link href="/crm">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-9 px-3 gap-2 rounded-lg font-medium transition-all',
            'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
            'hover:bg-slate-100 dark:hover:bg-white/10',
            isActive('/crm') && pathname === '/crm' && 
              'bg-teal-50 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-500/30'
          )}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span className="hidden sm:inline">Dashboard</span>
        </Button>
      </Link>

      {/* Divider */}
      <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-1" />

      {/* Module Tabs */}
      {visibleModules.map((module) => {
        const Icon = getIcon(module.icon);
        const path = `/crm/modules/${module.key}`;
        return (
          <Link key={module.id} href={path}>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-9 px-3 gap-2 rounded-lg font-medium transition-all',
                'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                'hover:bg-slate-100 dark:hover:bg-white/10',
                isActive(path) && 
                  'bg-teal-50 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-500/30'
              )}
            >
              <Icon className={cn(
                'w-4 h-4',
                isActive(path) && 'text-teal-600 dark:text-teal-400'
              )} />
              <span className="hidden sm:inline">
                {module.name_plural || module.name + 's'}
              </span>
            </Button>
          </Link>
        );
      })}

      {/* More Dropdown */}
      {overflowModules.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-9 px-3 gap-1 rounded-lg font-medium transition-all',
                'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                'hover:bg-slate-100 dark:hover:bg-white/10'
              )}
            >
              More
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="start" 
            className="w-48 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10"
          >
            {overflowModules.map((module) => {
              const Icon = getIcon(module.icon);
              const path = `/crm/modules/${module.key}`;
              return (
                <DropdownMenuItem key={module.id} asChild>
                  <Link
                    href={path}
                    className={cn(
                      'flex items-center gap-2 cursor-pointer',
                      'text-slate-700 dark:text-slate-300',
                      isActive(path) && 'bg-teal-50 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {module.name_plural || module.name + 's'}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

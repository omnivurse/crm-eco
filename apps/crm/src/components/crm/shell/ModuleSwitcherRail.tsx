'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Users,
  MessageSquare,
  DollarSign,
  Settings2,
  BarChart3,
  Plug,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  TOP_MODULES,
  TOP_MODULE_TITLES,
  resolveTopModuleFromPathname,
  useModule,
  type TopModule,
} from '@/contexts/ModuleContext';

const iconMap: Record<string, LucideIcon> = {
  users: Users,
  'message-square': MessageSquare,
  'dollar-sign': DollarSign,
  'settings-2': Settings2,
  'bar-chart-3': BarChart3,
  plug: Plug,
  settings: Settings,
};

const SETTINGS_MODULE: TopModule = 'settings';

interface ModuleSwitcherRailProps {
  /** Sidebar expanded — show labels beside icons. */
  expanded: boolean;
  className?: string;
}

/**
 * Zoho-style module switcher embedded in the contextual left rail.
 */
export function ModuleSwitcherRail({ expanded, className }: ModuleSwitcherRailProps) {
  const pathname = usePathname();
  const { setActiveModule } = useModule();
  const activeModule = resolveTopModuleFromPathname(pathname);

  const modules = [
    ...TOP_MODULES,
    { key: SETTINGS_MODULE, label: 'Settings', icon: 'settings', href: '/crm/settings' },
  ] as const;

  return (
    <div
      className={cn(
        'border-b border-slate-200/80 dark:border-white/5',
        expanded ? 'px-2 py-2' : 'px-1 py-2',
        className,
      )}
    >
      <div
        className={cn(
          expanded ? 'grid grid-cols-2 gap-1' : 'flex flex-col items-center gap-1',
        )}
      >
        {modules.map((module) => {
          const Icon = getIcon(module.icon);
          const isActive = activeModule === module.key;

          return (
            <Link
              prefetch={false}
              key={module.key}
              href={module.href}
              data-crm-module={module.key}
              title={TOP_MODULE_TITLES[module.key as TopModule] ?? module.label}
              onClick={() => setActiveModule(module.key as TopModule)}
              style={isActive ? { backgroundColor: 'var(--mod-bg)', color: 'var(--mod-fg)' } : undefined}
              className={cn(
                'flex items-center rounded-md transition-colors',
                expanded ? 'gap-2 px-2 py-1.5 text-[11px] font-medium' : 'h-8 w-8 justify-center',
                isActive
                  ? ''
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white',
              )}
            >
              <Icon className={cn('shrink-0', expanded ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
              {expanded && <span className="truncate">{module.label}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function getIcon(iconName: string): LucideIcon {
  return iconMap[iconName] || Users;
}

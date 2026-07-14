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

function getIcon(iconName: string): LucideIcon {
  return iconMap[iconName] || Users;
}

/**
 * Sticky Zoho-style module tab strip — always visible below the top bar so
 * reps can switch CRM / Communications / Revenue without hunting in menus.
 */
export function CrmModuleTabBar() {
  const pathname = usePathname();
  const { setActiveModule } = useModule();
  const activeModule = resolveTopModuleFromPathname(pathname);

  const handleClick = (key: TopModule) => {
    setActiveModule(key);
  };

  return (
    <div className="sticky top-12 z-[35] shrink-0 border-b border-slate-200/80 bg-white/95 backdrop-blur-md dark:border-white/5 dark:bg-slate-950/95">
      <div className="flex items-center gap-0 overflow-x-auto scrollbar-thin px-2 sm:px-4 lg:px-5">
        {TOP_MODULES.map((module) => {
          const Icon = getIcon(module.icon);
          const isActive = activeModule === module.key;

          return (
            <Link
              prefetch={false}
              key={module.key}
              href={module.href}
              data-crm-module={module.key}
              onClick={() => handleClick(module.key)}
              style={isActive ? { color: 'var(--mod-fg)' } : undefined}
              className={cn(
                'relative flex shrink-0 snap-start items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors sm:text-[13px]',
                isActive
                  ? ''
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                style={isActive ? { color: 'var(--mod-fg)' } : undefined}
                className={cn('h-3.5 w-3.5', !isActive && 'text-slate-400')}
              />
              <span>{module.label}</span>
              {isActive && (
                <span
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--mod-border)' }}
                />
              )}
            </Link>
          );
        })}

        <span className="mx-1 h-4 w-px shrink-0 bg-slate-200 dark:bg-white/10" aria-hidden />

        <Link
          prefetch={false}
          href="/crm/settings"
          data-crm-module="settings"
          onClick={() => handleClick('settings')}
          style={activeModule === 'settings' ? { color: 'var(--mod-fg)' } : undefined}
          className={cn(
            'relative flex shrink-0 snap-start items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors sm:text-[13px]',
            activeModule === 'settings'
              ? ''
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white',
          )}
          aria-current={activeModule === 'settings' ? 'page' : undefined}
        >
          <Settings
            className="h-3.5 w-3.5"
            style={activeModule === 'settings' ? { color: 'var(--mod-fg)' } : undefined}
          />
          <span>Settings</span>
          {activeModule === 'settings' && (
            <span
              className="absolute inset-x-2 bottom-0 h-0.5 rounded-full"
              style={{ backgroundColor: 'var(--mod-border)' }}
            />
          )}
        </Link>
      </div>
    </div>
  );
}

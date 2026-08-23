'use client';

import Link from 'next/link';
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
  useModule,
  type TopModule,
} from '@/contexts/ModuleContext';
import type { NavProfile } from '@/lib/crm/nav-profile';

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

const MODULE_TABS: Array<{
  key: TopModule;
  label: string;
  icon: string;
  href: string;
}> = [
  ...TOP_MODULES,
  { key: 'settings', label: 'Settings', icon: 'settings', href: '/crm/settings' },
];

interface CrmModuleTabBarProps {
  /**
   * `'simple'` (tenant flag `crm.nav.simple`) renders no tab strip at all —
   * small orgs get one flat sidebar menu instead of 7 top-level tabs.
   */
  navProfile?: NavProfile;
}

/**
 * Sticky module tab strip under the top bar. Full profile only: reps switch
 * CRM / Communications / Revenue without hunting in menus.
 *
 * NV-8 (D10): desktop chrome. Below `lg` the phone gets exactly ONE module
 * switcher — the grid inside the nav drawer (`ModuleSwitcherRail`) — so the
 * strip is hidden rather than duplicating it above a 390px viewport.
 */
export function CrmModuleTabBar({ navProfile = 'full' }: CrmModuleTabBarProps) {
  // NV-2: the provider's tab (sticky on cross-tab sidebar hops; URL-resolved
  // on a fresh load) — one source for the strip, the rail and the sidebar.
  const { activeModule, setActiveModule } = useModule();

  if (navProfile === 'simple') return null;

  return (
    <nav
      aria-label="Modules"
      data-testid="crm-module-tabbar"
      className="hidden lg:block sticky top-[var(--crm-topbar-h)] z-[35] isolate shrink-0 border-b border-border bg-background"
    >
      <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-thin px-1.5 sm:px-3 lg:px-4">
        {MODULE_TABS.map((module) => {
          const Icon = getIcon(module.icon);
          const isActive = activeModule === module.key;

          return (
            <Link
              prefetch={false}
              key={module.key}
              href={module.href}
              data-crm-module={module.key}
              data-testid="crm-module-tab"
              onClick={() => setActiveModule(module.key)}
              style={
                isActive
                  ? { color: 'var(--mod-fg)' }
                  : undefined
              }
              className={cn(
                'relative flex shrink-0 snap-start items-center gap-1.5 h-[var(--crm-modulebar-h)] px-2.5 sm:px-3',
                'text-[13px] tracking-[-0.01em] rounded-md',
                'transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                isActive
                  ? 'font-semibold'
                  : 'font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                style={isActive ? { color: 'var(--mod-fg)' } : undefined}
                className={cn(
                  'hidden h-3.5 w-3.5 sm:block',
                  !isActive && 'text-muted-foreground/70',
                )}
                aria-hidden
              />
              <span>{module.label}</span>
              {isActive && (
                <span
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--mod-border)' }}
                  aria-hidden
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

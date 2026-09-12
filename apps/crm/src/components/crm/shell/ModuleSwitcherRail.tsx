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
  TOP_MODULE_TITLES,
  useModule,
  type TopModule,
} from '@/contexts/ModuleContext';
import { formatUnreadBadge, unreadBadgeAriaLabel } from '@/lib/inbox/unread-badge';

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
  /** Live unread inbox conversations; counted once in CrmShell. */
  inboxUnread?: number | null;
}

/**
 * Zoho-style module switcher embedded in the contextual left rail.
 */
export function ModuleSwitcherRail({ expanded, className, inboxUnread = null }: ModuleSwitcherRailProps) {
  // NV-2: the provider owns the tab (sticky across cross-tab sidebar hops) —
  // the rail, the tab strip and the sidebar menu all read the same value.
  const { activeModule, setActiveModule } = useModule();

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
          const unreadBadge =
            module.key === 'communications' ? formatUnreadBadge(inboxUnread) : null;
          const unreadLabel =
            module.key === 'communications' ? unreadBadgeAriaLabel(inboxUnread) : null;

          return (
            <Link
              prefetch={false}
              key={module.key}
              href={module.href}
              data-crm-module={module.key}
              title={
                unreadLabel
                  ? `${TOP_MODULE_TITLES[module.key as TopModule] ?? module.label}, ${unreadLabel}`
                  : TOP_MODULE_TITLES[module.key as TopModule] ?? module.label
              }
              onClick={() => setActiveModule(module.key as TopModule)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={unreadLabel ? `${module.label}, ${unreadLabel}` : undefined}
              style={isActive ? { backgroundColor: 'var(--mod-bg)', color: 'var(--mod-fg)' } : undefined}
              className={cn(
                'relative flex items-center rounded-md transition-colors',
                expanded ? 'gap-2 px-2 py-1.5 text-[11px] font-medium' : 'h-8 w-8 justify-center',
                isActive
                  ? ''
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white',
              )}
            >
              <Icon className={cn('shrink-0', expanded ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
              {expanded && <span className="truncate">{module.label}</span>}
              {unreadBadge && expanded && (
                <span
                  data-testid="crm-comms-unread-badge"
                  aria-hidden
                  className="ml-auto min-w-[16px] h-4 px-1 inline-flex items-center justify-center rounded-full bg-teal-500 text-[10px] font-bold leading-none text-white tabular-nums"
                >
                  {unreadBadge}
                </span>
              )}
              {unreadBadge && !expanded && (
                <span
                  data-testid="crm-comms-unread-dot"
                  aria-hidden
                  className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-teal-500"
                />
              )}
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

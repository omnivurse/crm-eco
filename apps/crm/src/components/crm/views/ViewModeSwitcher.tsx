'use client';

import { memo } from 'react';
import {
  Table2,
  List,
  Kanban,
  BarChart3,
  Clock,
  PanelLeftClose,
  CalendarDays,
  Network,
  LayoutGrid,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';
import type { ViewMode } from '@/lib/crm/types';

interface ViewModeSwitcherProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  /**
   * Modes rendered as always-visible radios, in this order. Omit for today's
   * behaviour (every mode as a radio, no menu). When given, the remaining
   * modes move into a "More views" dropdown; a currently-active hidden mode
   * is promoted into the radios so the checked state is always visible.
   */
  visibleModes?: ViewMode[];
  /** Accessible label / tooltip for the overflow menu trigger. */
  moreLabel?: string;
  className?: string;
}

interface ViewModeOption {
  mode: ViewMode;
  icon: typeof Table2;
  label: string;
  shortLabel: string;
  /**
   * Only shown while it is the current value — never offered as a choice.
   * Tree view is entered from ModuleHeader ("By Agent") and only makes sense
   * for modules with hierarchy data.
   */
  activeOnly?: boolean;
}

const VIEW_MODE_OPTIONS: ViewModeOption[] = [
  { mode: 'table', icon: Table2, label: 'Table View', shortLabel: 'Table' },
  { mode: 'list', icon: List, label: 'List View', shortLabel: 'List' },
  { mode: 'kanban', icon: Kanban, label: 'Kanban Board', shortLabel: 'Kanban' },
  { mode: 'chart', icon: BarChart3, label: 'Chart View', shortLabel: 'Chart' },
  { mode: 'timeline', icon: Clock, label: 'Timeline View', shortLabel: 'Timeline' },
  { mode: 'calendar', icon: CalendarDays, label: 'Calendar View', shortLabel: 'Calendar' },
  { mode: 'split', icon: PanelLeftClose, label: 'Split View', shortLabel: 'Split' },
  { mode: 'tree', icon: Network, label: 'Tree View', shortLabel: 'Tree', activeOnly: true },
];

const OPTION_BY_MODE = new Map(VIEW_MODE_OPTIONS.map((o) => [o.mode, o]));

/**
 * Split the catalogue into always-visible radios and overflow-menu items.
 * Exported for tests.
 */
export function partitionViewModes(
  value: ViewMode,
  visibleModes?: ViewMode[],
): { visible: ViewModeOption[]; more: ViewModeOption[] } {
  const visible: ViewModeOption[] = [];
  const seen = new Set<ViewMode>();
  const push = (mode: ViewMode) => {
    const opt = OPTION_BY_MODE.get(mode);
    if (!opt || seen.has(mode)) return;
    seen.add(mode);
    visible.push(opt);
  };
  if (visibleModes) {
    visibleModes.forEach(push);
  } else {
    // Default: every choosable mode, in catalogue order.
    VIEW_MODE_OPTIONS.filter((o) => !o.activeOnly).forEach((o) => push(o.mode));
  }
  // Promote the active mode so a radiogroup always has its checked radio.
  push(value);
  const more = visibleModes
    ? VIEW_MODE_OPTIONS.filter((o) => !seen.has(o.mode) && !o.activeOnly)
    : [];
  return { visible, more };
}

export const ViewModeSwitcher = memo(function ViewModeSwitcher({
  value,
  onChange,
  visibleModes,
  moreLabel = 'More views',
  className,
}: ViewModeSwitcherProps) {
  const { visible, more } = partitionViewModes(value, visibleModes);
  const moreActive = more.some((m) => m.mode === value);

  const radios = (
    <div
      className={cn(
        'inline-flex items-center rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100/50 dark:bg-slate-800/50 p-0.5',
        more.length === 0 && className,
      )}
      role="radiogroup"
      aria-label="View mode"
    >
      {visible.map(({ mode, icon: Icon, label }) => {
        const isActive = value === mode;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={label}
            title={label}
            onClick={() => onChange(mode)}
            className={cn(
              'relative flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1',
              isActive
                ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
            )}
          >
            <Icon className="w-4 h-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );

  if (more.length === 0) return radios;

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      {radios}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={moreLabel}
            title={moreLabel}
            className={cn(
              'h-8 w-8 p-0 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
              moreActive && 'text-teal-600 dark:text-teal-400',
            )}
          >
            <LayoutGrid className="w-4 h-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[10rem]">
          <DropdownMenuRadioGroup
            value={value}
            onValueChange={(next) => onChange(next as ViewMode)}
          >
            {more.map(({ mode, icon: Icon, label }) => (
              <DropdownMenuRadioItem key={mode} value={mode} className="gap-2 text-sm cursor-pointer">
                <Icon className="w-4 h-4 text-slate-500" aria-hidden />
                <span className="flex-1">{label}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});

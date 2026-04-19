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
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { ViewMode } from '@/lib/crm/types';

interface ViewModeSwitcherProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

const VIEW_MODE_OPTIONS: { mode: ViewMode; icon: typeof Table2; label: string; shortLabel: string }[] = [
  { mode: 'table', icon: Table2, label: 'Table View', shortLabel: 'Table' },
  { mode: 'list', icon: List, label: 'List View', shortLabel: 'List' },
  { mode: 'kanban', icon: Kanban, label: 'Kanban Board', shortLabel: 'Kanban' },
  { mode: 'chart', icon: BarChart3, label: 'Chart View', shortLabel: 'Chart' },
  { mode: 'timeline', icon: Clock, label: 'Timeline View', shortLabel: 'Timeline' },
  { mode: 'calendar', icon: CalendarDays, label: 'Calendar View', shortLabel: 'Calendar' },
  { mode: 'split', icon: PanelLeftClose, label: 'Split View', shortLabel: 'Split' },
];

export const ViewModeSwitcher = memo(function ViewModeSwitcher({
  value,
  onChange,
  className,
}: ViewModeSwitcherProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100/50 dark:bg-slate-800/50 p-0.5',
        className
      )}
      role="radiogroup"
      aria-label="View mode"
    >
      {VIEW_MODE_OPTIONS.map(({ mode, icon: Icon, label }) => {
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
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
});

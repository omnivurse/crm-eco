'use client';

import { useState } from 'react';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  User,
  Clock,
  Calendar,
  CalendarDays,
  Edit3,
  UserX,
  AlertCircle,
  Check,
} from 'lucide-react';
import type { ViewFilter, QuickFilterType } from '@/lib/crm/types';

interface QuickFiltersProps {
  currentUserId: string;
  activeFilter: QuickFilterType | null;
  onFilterChange: (filters: ViewFilter[], filterType: QuickFilterType | null) => void;
  className?: string;
  showOverdue?: boolean;
}

interface QuickFilterConfig {
  type: QuickFilterType;
  label: string;
  icon: React.ReactNode;
  getFilters: (userId: string) => ViewFilter[];
}

const QUICK_FILTERS: QuickFilterConfig[] = [
  {
    type: 'my_records',
    label: 'My Records',
    icon: <User className="w-3.5 h-3.5" />,
    getFilters: (userId) => [{ field: 'owner_id', operator: 'equals', value: userId }],
  },
  {
    type: 'recently_viewed',
    label: 'Recently Viewed',
    icon: <Clock className="w-3.5 h-3.5" />,
    getFilters: () => [],
  },
  {
    type: 'created_today',
    label: 'Created Today',
    icon: <Calendar className="w-3.5 h-3.5" />,
    getFilters: () => [{ field: 'created_at', operator: 'today', value: null }],
  },
  {
    type: 'created_this_week',
    label: 'This Week',
    icon: <CalendarDays className="w-3.5 h-3.5" />,
    getFilters: () => [{ field: 'created_at', operator: 'this_week', value: null }],
  },
  {
    type: 'modified_today',
    label: 'Modified Today',
    icon: <Edit3 className="w-3.5 h-3.5" />,
    getFilters: () => [{ field: 'updated_at', operator: 'today', value: null }],
  },
  {
    type: 'unassigned',
    label: 'Unassigned',
    icon: <UserX className="w-3.5 h-3.5" />,
    getFilters: () => [{ field: 'owner_id', operator: 'is_null', value: null }],
  },
  {
    type: 'overdue',
    label: 'Overdue',
    icon: <AlertCircle className="w-3.5 h-3.5" />,
    getFilters: () => {
      const now = new Date().toISOString();
      return [
        { field: 'due_date', operator: 'lt', value: now },
        { field: 'status', operator: 'not_equals', value: 'completed' },
      ];
    },
  },
];

export function QuickFilters({
  currentUserId,
  activeFilter,
  onFilterChange,
  className,
  showOverdue = false,
}: QuickFiltersProps) {
  const handleFilterClick = (filter: QuickFilterConfig) => {
    if (activeFilter === filter.type) {
      onFilterChange([], null);
    } else {
      onFilterChange(filter.getFilters(currentUserId), filter.type);
    }
  };

  const filtersToShow = showOverdue
    ? QUICK_FILTERS
    : QUICK_FILTERS.filter((f) => f.type !== 'overdue');

  return (
    <div className={cn('flex items-center gap-1.5 flex-wrap', className)}>
      {filtersToShow.map((filter) => (
        <Button
          key={filter.type}
          variant={activeFilter === filter.type ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleFilterClick(filter)}
          className={cn(
            'h-7 px-2.5 text-xs font-medium gap-1.5 rounded-full transition-all',
            activeFilter === filter.type
              ? 'bg-teal-600 hover:bg-teal-700 text-white border-teal-600'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 hover:border-slate-300 dark:hover:border-white/20'
          )}
        >
          {filter.icon}
          <span>{filter.label}</span>
          {activeFilter === filter.type && (
            <Check className="w-3 h-3 ml-0.5" />
          )}
        </Button>
      ))}
    </div>
  );
}

export type { QuickFilterType };

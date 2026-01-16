'use client';

import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';
import { X, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import type { ViewFilter, CrmField } from '@/lib/crm/types';

interface FilterChipsBarProps {
  filters: ViewFilter[];
  fields: CrmField[];
  sortField?: string | null;
  sortDirection?: 'asc' | 'desc';
  totalCount: number;
  onRemoveFilter: (index: number) => void;
  onClearAll: () => void;
  onSortChange?: (field: string, direction: 'asc' | 'desc') => void;
  className?: string;
}

const OPERATOR_LABELS: Record<string, string> = {
  equals: 'is',
  not_equals: 'is not',
  contains: 'contains',
  starts_with: 'starts with',
  ends_with: 'ends with',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  is_null: 'is empty',
  is_not_null: 'is not empty',
  in: 'is any of',
  between: 'between',
  before: 'before',
  after: 'after',
};

export function FilterChipsBar({
  filters,
  fields,
  sortField,
  sortDirection = 'asc',
  totalCount,
  onRemoveFilter,
  onClearAll,
  onSortChange,
  className,
}: FilterChipsBarProps) {
  const fieldMap = new Map(fields.map(f => [f.key, f]));

  const getFieldLabel = (key: string): string => {
    return fieldMap.get(key)?.label || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  };

  const sortableFields = fields.filter(f => 
    ['text', 'number', 'date', 'datetime', 'email', 'select', 'currency'].includes(f.type)
  );

  if (filters.length === 0 && !sortField) {
    return null;
  }

  return (
    <div className={cn(
      'flex items-center gap-2 py-2 px-1 flex-wrap',
      className
    )}>
      {/* Filter Chips */}
      {filters.map((filter, index) => (
        <div
          key={index}
          className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs
            bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300
            border border-slate-200 dark:border-white/10"
        >
          <span className="font-medium">{getFieldLabel(filter.field)}</span>
          <span className="text-slate-500 dark:text-slate-400">{OPERATOR_LABELS[filter.operator] || filter.operator}</span>
          {!['is_null', 'is_not_null'].includes(filter.operator) && (
            <span className="font-medium text-teal-600 dark:text-teal-400">
              {formatValue(filter.value)}
            </span>
          )}
          <button
            onClick={() => onRemoveFilter(index)}
            className="ml-0.5 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Sort Dropdown */}
      {onSortChange && sortableFields.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              Sort: {sortField ? getFieldLabel(sortField) : 'Default'}
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10"
          >
            {sortableFields.slice(0, 10).map((field) => (
              <DropdownMenuItem
                key={field.key}
                onClick={() => onSortChange(
                  field.key,
                  sortField === field.key && sortDirection === 'asc' ? 'desc' : 'asc'
                )}
                className={cn(
                  'text-sm cursor-pointer',
                  sortField === field.key && 'text-teal-600 dark:text-teal-400'
                )}
              >
                {field.label}
                {sortField === field.key && (
                  <span className="ml-auto text-xs">
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Count */}
      <span className="text-xs text-slate-500 dark:text-slate-400 px-2">
        {totalCount.toLocaleString()} records
      </span>

      {/* Clear All */}
      {filters.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-7 px-2 text-xs text-slate-500 hover:text-red-600 dark:hover:text-red-400"
        >
          Clear All
        </Button>
      )}
    </div>
  );
}

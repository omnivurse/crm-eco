'use client';

import { useState, useCallback, useMemo } from 'react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@crm-eco/ui/components/popover';
import { cn } from '@crm-eco/ui/lib/utils';
import { Columns3, Check, GripVertical, MoveHorizontal, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import type { CrmField } from '@/lib/crm/types';
import { pickDefaultListColumns } from '@/lib/crm/default-list-columns';

/**
 * Window event broadcast by "Reset column widths". The list table for the
 * matching `storageKey` (module key — see `useColumnResize`) resets every
 * column back to its default width. Detail-less / key-less events reset all
 * mounted tables.
 */
export const CRM_COLUMN_WIDTHS_RESET_EVENT = 'crm:reset-column-widths';
export interface ColumnWidthsResetDetail {
  storageKey?: string;
}

interface ColumnsButtonProps {
  fields: CrmField[];
  visibleColumns: string[];
  onColumnsChange: (columns: string[]) => void;
  className?: string;
  /**
   * localStorage key suffix the list table persists its widths under
   * (`useColumnResize({ storageKey })`, i.e. the module key). When provided,
   * a "Reset column widths" action is shown; omit to hide it.
   */
  columnWidthsStorageKey?: string;
  /** Override for the reset action (defaults to broadcasting the window event). */
  onResetColumnWidths?: () => void;
}

export function ColumnsButton({
  fields,
  visibleColumns,
  onColumnsChange,
  className,
  columnWidthsStorageKey,
  onResetColumnWidths,
}: ColumnsButtonProps) {
  const [open, setOpen] = useState(false);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  // Members has 91 fields — a search box makes the 288px list usable.
  const [query, setQuery] = useState('');

  const toggleColumn = useCallback((fieldKey: string) => {
    if (visibleColumns.includes(fieldKey)) {
      if (visibleColumns.length <= 1) return;
      onColumnsChange(visibleColumns.filter(c => c !== fieldKey));
    } else {
      onColumnsChange([...visibleColumns, fieldKey]);
    }
  }, [visibleColumns, onColumnsChange]);

  const handleDragStart = (e: React.DragEvent, fieldKey: string) => {
    setDraggedColumn(fieldKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, fieldKey: string) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === fieldKey) return;

    const currentIndex = visibleColumns.indexOf(draggedColumn);
    const targetIndex = visibleColumns.indexOf(fieldKey);

    if (currentIndex === -1 || targetIndex === -1) return;

    const newColumns = [...visibleColumns];
    newColumns.splice(currentIndex, 1);
    newColumns.splice(targetIndex, 0, draggedColumn);
    onColumnsChange(newColumns);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
  };

  const selectAll = () => {
    onColumnsChange(fields.map(f => f.key));
  };

  const resetColumns = () => {
    // Same identity-first default the list uses when a module has no view.
    const defaultColumns = pickDefaultListColumns(fields);
    onColumnsChange(defaultColumns.length > 0 ? defaultColumns : ['title', 'status', 'created_at']);
  };

  const showResetWidths = Boolean(columnWidthsStorageKey) || Boolean(onResetColumnWidths);
  const resetColumnWidths = useCallback(() => {
    if (onResetColumnWidths) {
      onResetColumnWidths();
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent<ColumnWidthsResetDetail>(CRM_COLUMN_WIDTHS_RESET_EVENT, {
          detail: { storageKey: columnWidthsStorageKey },
        }),
      );
    }
    toast.success('Column widths reset');
  }, [onResetColumnWidths, columnWidthsStorageKey]);

  // Sort fields to show visible ones first, in their current order
  const sortedFields = useMemo(() => [
    ...visibleColumns.map(key => fields.find(f => f.key === key)).filter(Boolean) as CrmField[],
    ...fields.filter(f => !visibleColumns.includes(f.key)),
  ], [fields, visibleColumns]);

  const normalizedQuery = query.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;
  const shownFields = useMemo(() => {
    if (!isSearching) return sortedFields;
    return sortedFields.filter(
      (f) =>
        f.label.toLowerCase().includes(normalizedQuery) ||
        f.key.toLowerCase().includes(normalizedQuery),
    );
  }, [sortedFields, isSearching, normalizedQuery]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-9 px-2.5 gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
            visibleColumns.length !== fields.length && 'text-teal-600 dark:text-teal-400',
            className
          )}
        >
          <Columns3 className="w-4 h-4" />
          <span className="hidden sm:inline">Columns</span>
          {visibleColumns.length !== fields.length && (
            <span className="text-xs bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 px-1.5 py-0.5 rounded-full">
              {visibleColumns.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 p-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10"
      >
        <div className="p-3 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-900 dark:text-white">
            Visible Columns
          </span>
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={selectAll}
              className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300"
            >
              All
            </button>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <button
              onClick={resetColumns}
              className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="px-2 pt-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${fields.length} columns…`}
              aria-label="Search columns"
              autoFocus
              className="h-8 pl-8 pr-7 text-xs bg-white dark:bg-slate-900/50"
              onKeyDown={(e) => {
                if (e.key === 'Escape' && query) {
                  e.stopPropagation();
                  setQuery('');
                }
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear column search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto p-2 space-y-0.5 scrollbar-thin" role="listbox" aria-multiselectable aria-label="Columns">
          {shownFields.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
              No columns match &quot;{query.trim()}&quot;
            </p>
          )}
          {shownFields.map((field) => {
            const isVisible = visibleColumns.includes(field.key);
            // Reordering is by drag between *visible* rows; while searching
            // the list is a subset so we disable drag to avoid confusing jumps.
            const canDrag = isVisible && !isSearching;

            return (
              <div
                key={field.id}
                role="option"
                aria-selected={isVisible}
                tabIndex={0}
                draggable={canDrag}
                onDragStart={(e) => canDrag && handleDragStart(e, field.key)}
                onDragOver={(e) => canDrag && handleDragOver(e, field.key)}
                onDragEnd={handleDragEnd}
                className={cn(
                  'flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors',
                  'hover:bg-slate-100 dark:hover:bg-white/5',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                  isVisible ? 'text-slate-900 dark:text-white' : 'text-slate-500',
                  draggedColumn === field.key && 'opacity-50'
                )}
                onClick={() => toggleColumn(field.key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleColumn(field.key);
                  }
                }}
              >
                {canDrag && (
                  <GripVertical className="w-3.5 h-3.5 text-slate-400 cursor-grab flex-shrink-0" aria-hidden />
                )}
                <div
                  className={cn(
                    'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0',
                    isVisible
                      ? 'bg-teal-500 border-teal-500'
                      : 'border-slate-300 dark:border-slate-600'
                  )}
                >
                  {isVisible && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="flex-1 text-sm truncate">{field.label}</span>
                {field.is_title_field && (
                  <span className="text-[10px] text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 px-1.5 py-0.5 rounded">
                    Title
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-2 border-t border-slate-200 dark:border-white/5 space-y-1">
          {showResetWidths && (
            <button
              type="button"
              onClick={resetColumnWidths}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
            >
              <MoveHorizontal className="h-3.5 w-3.5" aria-hidden />
              Reset column widths
            </button>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            {isSearching ? 'Clear the search to drag-reorder columns' : 'Drag to reorder visible columns'}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

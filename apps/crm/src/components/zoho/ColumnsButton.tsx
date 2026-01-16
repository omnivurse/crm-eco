'use client';

import { useState, useCallback } from 'react';
import { Button } from '@crm-eco/ui/components/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@crm-eco/ui/components/popover';
import { cn } from '@crm-eco/ui/lib/utils';
import { Columns3, Check, GripVertical } from 'lucide-react';
import type { CrmField } from '@/lib/crm/types';

interface ColumnsButtonProps {
  fields: CrmField[];
  visibleColumns: string[];
  onColumnsChange: (columns: string[]) => void;
  className?: string;
}

export function ColumnsButton({
  fields,
  visibleColumns,
  onColumnsChange,
  className,
}: ColumnsButtonProps) {
  const [open, setOpen] = useState(false);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);

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
    const titleField = fields.find(f => f.is_title_field);
    const defaultColumns = titleField 
      ? [titleField.key, 'status', 'email', 'created_at'].filter(c => fields.some(f => f.key === c))
      : ['title', 'status', 'created_at'];
    onColumnsChange(defaultColumns);
  };

  // Sort fields to show visible ones first, in their current order
  const sortedFields = [
    ...visibleColumns.map(key => fields.find(f => f.key === key)).filter(Boolean) as CrmField[],
    ...fields.filter(f => !visibleColumns.includes(f.key)),
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
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

        <div className="max-h-72 overflow-y-auto p-2 space-y-0.5 scrollbar-thin">
          {sortedFields.map((field) => {
            const isVisible = visibleColumns.includes(field.key);
            
            return (
              <div
                key={field.id}
                draggable={isVisible}
                onDragStart={(e) => handleDragStart(e, field.key)}
                onDragOver={(e) => handleDragOver(e, field.key)}
                onDragEnd={handleDragEnd}
                className={cn(
                  'flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors',
                  'hover:bg-slate-100 dark:hover:bg-white/5',
                  isVisible ? 'text-slate-900 dark:text-white' : 'text-slate-500',
                  draggedColumn === field.key && 'opacity-50'
                )}
                onClick={() => toggleColumn(field.key)}
              >
                {isVisible && (
                  <GripVertical className="w-3.5 h-3.5 text-slate-400 cursor-grab flex-shrink-0" />
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

        <div className="p-2 border-t border-slate-200 dark:border-white/5">
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            Drag to reorder visible columns
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

'use client';

import { useState } from 'react';
import { cn } from '@crm-eco/ui/lib/utils';
import { Button } from '@crm-eco/ui/components/button';
import { Checkbox } from '@crm-eco/ui/components/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@crm-eco/ui/components/popover';
import { Columns3, GripVertical, Check } from 'lucide-react';

interface CrmField {
  id: string;
  key: string;
  label: string;
  type: string;
  is_system?: boolean;
  is_title_field?: boolean;
}

interface ColumnPickerProps {
  fields: CrmField[];
  visibleColumns: string[];
  onColumnsChange: (columns: string[]) => void;
}

export function ColumnPicker({ fields, visibleColumns, onColumnsChange }: ColumnPickerProps) {
  const [open, setOpen] = useState(false);

  const toggleColumn = (fieldKey: string) => {
    if (visibleColumns.includes(fieldKey)) {
      // Don't allow removing all columns
      if (visibleColumns.length <= 1) return;
      onColumnsChange(visibleColumns.filter(c => c !== fieldKey));
    } else {
      onColumnsChange([...visibleColumns, fieldKey]);
    }
  };

  const selectAll = () => {
    onColumnsChange(fields.map(f => f.key));
  };

  const selectNone = () => {
    // Keep at least the title field
    const titleField = fields.find(f => f.is_title_field);
    onColumnsChange(titleField ? [titleField.key] : [fields[0]?.key].filter(Boolean));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-2.5 gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
        >
          <Columns3 className="w-4 h-4" />
          <span className="hidden sm:inline">Columns</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        align="end" 
        className="w-64 p-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10"
      >
        <div className="p-3 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-900 dark:text-white">Visible Columns</span>
          <div className="flex items-center gap-2">
            <button 
              onClick={selectAll}
              className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300"
            >
              All
            </button>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <button 
              onClick={selectNone}
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Reset
            </button>
          </div>
        </div>
        
        <div className="max-h-64 overflow-y-auto p-2 space-y-1 scrollbar-thin">
          {fields.map((field) => (
            <button
              key={field.id}
              onClick={() => toggleColumn(field.key)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors',
                'hover:bg-slate-100 dark:hover:bg-white/5',
                visibleColumns.includes(field.key) 
                  ? 'text-slate-900 dark:text-white' 
                  : 'text-slate-500'
              )}
            >
              <div className={cn(
                'w-4 h-4 rounded border flex items-center justify-center',
                visibleColumns.includes(field.key)
                  ? 'bg-teal-500 border-teal-500'
                  : 'border-slate-300 dark:border-slate-600'
              )}>
                {visibleColumns.includes(field.key) && (
                  <Check className="w-3 h-3 text-white" />
                )}
              </div>
              <span className="flex-1">{field.label}</span>
              {field.is_title_field && (
                <span className="text-[10px] text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 px-1.5 py-0.5 rounded">
                  Title
                </span>
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

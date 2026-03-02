'use client';

import { useState } from 'react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  Search,
  GripVertical,
  Trash2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import type { FieldOption } from '../useReportBuilder';
import type { ReportColumn } from '@/lib/reports/types';

const TYPE_BADGES: Record<string, { label: string; color: string }> = {
  text: { label: 'Abc', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
  number: { label: '#', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' },
  currency: { label: '$', color: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
  date: { label: 'Date', color: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400' },
  boolean: { label: 'T/F', color: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' },
  select: { label: 'List', color: 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-400' },
  email: { label: '@', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
  phone: { label: 'Tel', color: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400' },
  url: { label: 'URL', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400' },
  textarea: { label: 'Txt', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
};

interface StepColumnsProps {
  columns: ReportColumn[];
  allFields: FieldOption[];
  primaryModuleKey: string;
  relatedModuleKeys: string[];
  onAddColumn: (field: FieldOption) => void;
  onRemoveColumn: (field: string, moduleKey?: string) => void;
  onReorderColumns: (from: number, to: number) => void;
}

export function StepColumns({
  columns,
  allFields,
  primaryModuleKey,
  relatedModuleKeys,
  onAddColumn,
  onRemoveColumn,
  onReorderColumns,
}: StepColumnsProps) {
  const [search, setSearch] = useState('');
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set());
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Group fields by module
  const moduleGroups: { moduleKey: string; moduleName: string; fields: FieldOption[] }[] = [];

  const primaryFields = allFields.filter(f => f.module_key === primaryModuleKey);
  if (primaryFields.length > 0) {
    moduleGroups.push({
      moduleKey: primaryModuleKey,
      moduleName: primaryFields[0].module_name + ' (Primary)',
      fields: primaryFields,
    });
  }

  for (const mk of relatedModuleKeys) {
    const fields = allFields.filter(f => f.module_key === mk);
    if (fields.length > 0) {
      moduleGroups.push({
        moduleKey: mk,
        moduleName: fields[0].module_name,
        fields: fields,
      });
    }
  }

  const isColumnSelected = (field: FieldOption) =>
    columns.some(c => c.field === field.key && c.module_key === field.module_key);

  const filteredGroups = moduleGroups.map(group => ({
    ...group,
    fields: group.fields.filter(f =>
      f.label.toLowerCase().includes(search.toLowerCase()) ||
      f.key.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(g => g.fields.length > 0);

  const toggleCollapse = (moduleKey: string) => {
    setCollapsedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleKey)) {
        next.delete(moduleKey);
      } else {
        next.add(moduleKey);
      }
      return next;
    });
  };

  const selectAllInModule = (fields: FieldOption[]) => {
    fields.forEach(f => {
      if (!isColumnSelected(f)) onAddColumn(f);
    });
  };

  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== index) {
      onReorderColumns(dragIndex, index);
      setDragIndex(index);
    }
  };
  const handleDragEnd = () => setDragIndex(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Available Fields */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            Available Fields
          </h3>
          <span className="text-xs text-slate-500">
            {allFields.length} fields
          </span>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search fields..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>

        <div className="border border-slate-200 dark:border-slate-700 rounded-lg max-h-[400px] overflow-y-auto">
          {filteredGroups.map((group) => (
            <div key={group.moduleKey}>
              <button
                type="button"
                onClick={() => toggleCollapse(group.moduleKey)}
                className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <div className="flex items-center gap-2">
                  {collapsedModules.has(group.moduleKey)
                    ? <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                    {group.moduleName}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); selectAllInModule(group.fields); }}
                  className="text-xs text-teal-600 dark:text-teal-400 hover:underline"
                >
                  Select All
                </button>
              </button>

              {!collapsedModules.has(group.moduleKey) && (
                <div>
                  {group.fields.map((field) => {
                    const selected = isColumnSelected(field);
                    const badge = TYPE_BADGES[field.type] || TYPE_BADGES.text;
                    return (
                      <button
                        key={`${field.module_key}.${field.key}`}
                        type="button"
                        onClick={() => selected ? onRemoveColumn(field.key, field.module_key) : onAddColumn(field)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0',
                          selected
                            ? 'bg-teal-50 dark:bg-teal-500/5'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                        )}
                      >
                        {selected
                          ? <CheckCircle2 className="w-4 h-4 text-teal-500 flex-shrink-0" />
                          : <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600 flex-shrink-0" />}
                        <span className="flex-1 text-sm text-slate-800 dark:text-slate-200 truncate">
                          {field.label}
                        </span>
                        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', badge.color)}>
                          {badge.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {filteredGroups.length === 0 && (
            <div className="p-4 text-center text-sm text-slate-500">
              {allFields.length === 0
                ? 'Select a module first to see available fields'
                : 'No fields match your search'}
            </div>
          )}
        </div>
      </div>

      {/* Right: Selected Columns */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            Selected Columns
          </h3>
          <span className="text-xs text-slate-500">
            {columns.length} selected
          </span>
        </div>

        {columns.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-8 text-center">
            <p className="text-sm text-slate-500">
              Click fields on the left to add them to your report
            </p>
          </div>
        ) : (
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg max-h-[440px] overflow-y-auto">
            {columns.map((col, index) => (
              <div
                key={`${col.module_key}.${col.field}`}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors',
                  dragIndex === index ? 'bg-violet-50 dark:bg-violet-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                )}
              >
                <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-600 cursor-grab flex-shrink-0" />
                <span className="text-xs font-medium text-slate-400 w-5 text-right flex-shrink-0">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 dark:text-slate-200 truncate">
                    {col.label}
                  </p>
                  {col.module_key && col.module_key !== primaryModuleKey && (
                    <p className="text-xs text-slate-400">from {col.module_key}</p>
                  )}
                </div>
                <span className={cn(
                  'text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0',
                  (TYPE_BADGES[col.type] || TYPE_BADGES.text).color
                )}>
                  {(TYPE_BADGES[col.type] || TYPE_BADGES.text).label}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-400 hover:text-red-600 flex-shrink-0"
                  onClick={() => onRemoveColumn(col.field, col.module_key)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

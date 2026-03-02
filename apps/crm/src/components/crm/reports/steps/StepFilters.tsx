'use client';

import { useState } from 'react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { cn } from '@crm-eco/ui/lib/utils';
import { Plus, Trash2, Filter, ToggleLeft, ToggleRight } from 'lucide-react';
import { FILTER_OPERATORS_BY_TYPE, type FieldOption } from '../useReportBuilder';
import type { ReportFilter, FilterGroup } from '@/lib/reports/types';

interface StepFiltersProps {
  allFields: FieldOption[];
  filters: ReportFilter[];
  filterLogic: FilterGroup | null;
  onAddFilter: () => void;
  onUpdateFilter: (index: number, updates: Partial<ReportFilter>) => void;
  onRemoveFilter: (index: number) => void;
  onSetFilterLogic: (logic: FilterGroup | null) => void;
}

export function StepFilters({
  allFields,
  filters,
  filterLogic,
  onAddFilter,
  onUpdateFilter,
  onRemoveFilter,
  onSetFilterLogic,
}: StepFiltersProps) {
  // Global logic: AND or OR between all top-level filter rows
  const globalLogic = filterLogic?.logic || 'and';

  const toggleGlobalLogic = () => {
    const newLogic = globalLogic === 'and' ? 'or' : 'and';
    onSetFilterLogic({
      logic: newLogic,
      conditions: filters,
    });
  };

  const getOperatorsForField = (fieldKey: string) => {
    const field = allFields.find(f => f.key === fieldKey);
    const type = field?.type || 'text';
    return FILTER_OPERATORS_BY_TYPE[type] || FILTER_OPERATORS_BY_TYPE.text;
  };

  const getFieldLabel = (fieldKey: string) => {
    return allFields.find(f => f.key === fieldKey)?.label || fieldKey;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-500" />
            Filter Conditions
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Define which records to include in the report. Leave empty to include all records.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onAddFilter} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Add Filter
        </Button>
      </div>

      {/* Global logic toggle */}
      {filters.length > 1 && (
        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
          <span className="text-sm text-slate-600 dark:text-slate-400">Match</span>
          <button
            type="button"
            onClick={toggleGlobalLogic}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              globalLogic === 'and'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
            )}
          >
            {globalLogic === 'and' ? (
              <><ToggleLeft className="w-4 h-4" /> ALL conditions (AND)</>
            ) : (
              <><ToggleRight className="w-4 h-4" /> ANY condition (OR)</>
            )}
          </button>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {globalLogic === 'and'
              ? 'Records must match every condition'
              : 'Records can match any condition'}
          </span>
        </div>
      )}

      {/* Filter rows */}
      {filters.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-8 text-center">
          <Filter className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">
            No filters applied. All records will be included in the report.
          </p>
          <Button variant="outline" size="sm" onClick={onAddFilter} className="mt-3 gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Add First Filter
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filters.map((filter, index) => {
            const operators = getOperatorsForField(filter.field);
            const currentOp = operators.find(op => op.value === filter.operator);
            const needsValue = currentOp?.needsValue !== false;

            return (
              <div key={index}>
                {/* AND/OR connector between rows */}
                {index > 0 && (
                  <div className="flex items-center gap-2 py-1 pl-4">
                    <span className={cn(
                      'text-xs font-bold uppercase px-2 py-0.5 rounded',
                      globalLogic === 'and'
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
                        : 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                    )}>
                      {globalLogic}
                    </span>
                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                  </div>
                )}

                <div className="flex items-center gap-2 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                  {/* Field selector */}
                  <Select
                    value={filter.field}
                    onValueChange={(v) => {
                      const ops = getOperatorsForField(v);
                      onUpdateFilter(index, { field: v, operator: ops[0]?.value || 'equals', value: '' });
                    }}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      {allFields.map((f) => (
                        <SelectItem key={`${f.module_key}.${f.key}`} value={f.key}>
                          {f.label}
                          {f.module_key && (
                            <span className="text-xs text-slate-400 ml-1">({f.module_key})</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Operator selector */}
                  <Select
                    value={filter.operator}
                    onValueChange={(v) => onUpdateFilter(index, { operator: v })}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Value input */}
                  {needsValue && (
                    <Input
                      placeholder="Value"
                      value={String(filter.value || '')}
                      onChange={(e) => onUpdateFilter(index, { value: e.target.value })}
                      className="flex-1 min-w-[120px]"
                    />
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-400 hover:text-red-600 flex-shrink-0"
                    onClick={() => onRemoveFilter(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick tips */}
      {filters.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-xs text-blue-700 dark:text-blue-400">
            <strong>Tip:</strong> Use the AND/OR toggle above to control whether records must match
            all conditions or just any one condition. Currently matching{' '}
            <strong>{globalLogic === 'and' ? 'ALL' : 'ANY'}</strong> of {filters.length} condition{filters.length !== 1 ? 's' : ''}.
          </p>
        </div>
      )}
    </div>
  );
}

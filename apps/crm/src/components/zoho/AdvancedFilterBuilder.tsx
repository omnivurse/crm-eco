'use client';

import { useState, useCallback } from 'react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@crm-eco/ui/components/popover';
import { cn } from '@crm-eco/ui/lib/utils';
import { Filter, Plus, X, ChevronDown, Trash2 } from 'lucide-react';
import type { CrmField, ViewFilter } from '@/lib/crm/types';

export interface FilterRule {
  field: string;
  operator: string;
  value: unknown;
}

export interface FilterGroup {
  connector: 'AND' | 'OR';
  rules: (FilterRule | FilterGroup)[];
}

interface AdvancedFilterBuilderProps {
  fields: CrmField[];
  filters: ViewFilter[];
  onFiltersChange: (filters: ViewFilter[]) => void;
  onSaveView?: (name: string, filters: ViewFilter[]) => void;
  className?: string;
}

type FilterOperator = ViewFilter['operator'];

const OPERATORS: Record<string, { label: string; types: string[]; needsValue: boolean }> = {
  equals: { label: 'is', types: ['text', 'select', 'email', 'phone', 'number', 'date', 'boolean'], needsValue: true },
  not_equals: { label: 'is not', types: ['text', 'select', 'email', 'phone', 'number', 'date', 'boolean'], needsValue: true },
  contains: { label: 'contains', types: ['text', 'textarea', 'email', 'phone'], needsValue: true },
  starts_with: { label: 'starts with', types: ['text', 'email', 'phone'], needsValue: true },
  ends_with: { label: 'ends with', types: ['text', 'email', 'phone'], needsValue: true },
  gt: { label: 'greater than', types: ['number', 'currency', 'date', 'datetime'], needsValue: true },
  gte: { label: 'greater or equal', types: ['number', 'currency', 'date', 'datetime'], needsValue: true },
  lt: { label: 'less than', types: ['number', 'currency', 'date', 'datetime'], needsValue: true },
  lte: { label: 'less or equal', types: ['number', 'currency', 'date', 'datetime'], needsValue: true },
  is_null: { label: 'is empty', types: ['text', 'textarea', 'select', 'email', 'phone', 'number', 'date', 'datetime', 'url'], needsValue: false },
  is_not_null: { label: 'is not empty', types: ['text', 'textarea', 'select', 'email', 'phone', 'number', 'date', 'datetime', 'url'], needsValue: false },
};

function getOperatorsForType(type: string): FilterOperator[] {
  return Object.entries(OPERATORS)
    .filter(([_, config]) => config.types.includes(type))
    .map(([key]) => key as FilterOperator);
}

function FilterRow({
  filter,
  fields,
  onUpdate,
  onRemove,
  showConnector,
  connector,
  onConnectorChange,
}: {
  filter: ViewFilter;
  fields: CrmField[];
  onUpdate: (filter: ViewFilter) => void;
  onRemove: () => void;
  showConnector: boolean;
  connector?: 'AND' | 'OR';
  onConnectorChange?: (connector: 'AND' | 'OR') => void;
}) {
  const field = fields.find(f => f.key === filter.field);
  const fieldType = field?.type || 'text';
  const availableOperators = getOperatorsForType(fieldType);
  const operatorConfig = OPERATORS[filter.operator];
  const needsValue = operatorConfig?.needsValue !== false;

  const renderValueInput = () => {
    if (!needsValue) return null;

    if (fieldType === 'select' && field?.options?.length) {
      return (
        <Select
          value={String(filter.value || '')}
          onValueChange={(value) => onUpdate({ ...filter, value })}
        >
          <SelectTrigger className="h-8 w-32 text-xs bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10">
            <SelectValue placeholder="Value" />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
            {field.options.map((option) => (
              <SelectItem key={option} value={option} className="text-xs">
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (fieldType === 'boolean') {
      return (
        <Select
          value={String(filter.value || '')}
          onValueChange={(value) => onUpdate({ ...filter, value: value === 'true' })}
        >
          <SelectTrigger className="h-8 w-24 text-xs bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10">
            <SelectValue placeholder="Value" />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
            <SelectItem value="true" className="text-xs">Yes</SelectItem>
            <SelectItem value="false" className="text-xs">No</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    if (['date', 'datetime'].includes(fieldType)) {
      return (
        <Input
          type="date"
          value={String(filter.value || '')}
          onChange={(e) => onUpdate({ ...filter, value: e.target.value })}
          className="h-8 w-36 text-xs bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10"
        />
      );
    }

    if (['number', 'currency'].includes(fieldType)) {
      return (
        <Input
          type="number"
          value={String(filter.value || '')}
          onChange={(e) => onUpdate({ ...filter, value: e.target.valueAsNumber || 0 })}
          placeholder="Value"
          className="h-8 w-28 text-xs bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10"
        />
      );
    }

    return (
      <Input
        type="text"
        value={String(filter.value || '')}
        onChange={(e) => onUpdate({ ...filter, value: e.target.value })}
        placeholder="Value"
        className="h-8 w-32 text-xs bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10"
      />
    );
  };

  return (
    <div className="flex items-center gap-2">
      {/* Connector */}
      {showConnector && onConnectorChange && (
        <Select value={connector} onValueChange={(v) => onConnectorChange(v as 'AND' | 'OR')}>
          <SelectTrigger className="h-8 w-16 text-xs bg-slate-100 dark:bg-slate-800 border-0 font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
            <SelectItem value="AND" className="text-xs font-medium">AND</SelectItem>
            <SelectItem value="OR" className="text-xs font-medium">OR</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Field */}
      <Select
        value={filter.field}
        onValueChange={(value) => onUpdate({ ...filter, field: value, value: null })}
      >
        <SelectTrigger className="h-8 w-32 text-xs bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10">
          <SelectValue placeholder="Field" />
        </SelectTrigger>
        <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 max-h-60">
          {fields.map((f) => (
            <SelectItem key={f.key} value={f.key} className="text-xs">
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator */}
      <Select
        value={filter.operator}
        onValueChange={(value) => onUpdate({ ...filter, operator: value as FilterOperator })}
      >
        <SelectTrigger className="h-8 w-32 text-xs bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
          {availableOperators.map((op) => (
            <SelectItem key={op} value={op} className="text-xs">
              {OPERATORS[op].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value */}
      {renderValueInput()}

      {/* Remove */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

export function AdvancedFilterBuilder({
  fields,
  filters,
  onFiltersChange,
  onSaveView,
  className,
}: AdvancedFilterBuilderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [connector, setConnector] = useState<'AND' | 'OR'>('AND');
  const [viewName, setViewName] = useState('');

  const addFilter = useCallback(() => {
    const firstField = fields[0];
    if (!firstField) return;

    const newFilter: ViewFilter = {
      field: firstField.key,
      operator: 'equals',
      value: null,
    };
    onFiltersChange([...filters, newFilter]);
  }, [fields, filters, onFiltersChange]);

  const updateFilter = useCallback((index: number, filter: ViewFilter) => {
    const updated = [...filters];
    updated[index] = filter;
    onFiltersChange(updated);
  }, [filters, onFiltersChange]);

  const removeFilter = useCallback((index: number) => {
    onFiltersChange(filters.filter((_, i) => i !== index));
  }, [filters, onFiltersChange]);

  const clearFilters = useCallback(() => {
    onFiltersChange([]);
  }, [onFiltersChange]);

  const handleSaveView = () => {
    if (viewName.trim() && onSaveView) {
      onSaveView(viewName.trim(), filters);
      setViewName('');
      setIsOpen(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-9 px-3 gap-2 border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50',
            'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
            filters.length > 0 && 'border-teal-500/50 text-teal-600 dark:text-teal-400',
            className
          )}
        >
          <Filter className="w-4 h-4" />
          Filters
          {filters.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs rounded-full bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300">
              {filters.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[520px] p-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10"
      >
        <div className="p-3 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Filter Records</h3>
          {filters.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-7 text-xs text-slate-500 hover:text-red-600"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Clear all
            </Button>
          )}
        </div>

        <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
          {filters.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              No filters applied. Add a filter to narrow down results.
            </p>
          ) : (
            filters.map((filter, index) => (
              <FilterRow
                key={index}
                filter={filter}
                fields={fields}
                onUpdate={(updated) => updateFilter(index, updated)}
                onRemove={() => removeFilter(index)}
                showConnector={index > 0}
                connector={connector}
                onConnectorChange={index === 1 ? setConnector : undefined}
              />
            ))
          )}
        </div>

        <div className="p-3 border-t border-slate-200 dark:border-white/5 space-y-3">
          <Button
            variant="outline"
            size="sm"
            onClick={addFilter}
            className="w-full border-dashed border-slate-300 dark:border-white/10 text-slate-600 dark:text-slate-400"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Filter
          </Button>

          {filters.length > 0 && onSaveView && (
            <div className="flex items-center gap-2">
              <Input
                placeholder="View name..."
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                className="h-8 text-xs flex-1"
              />
              <Button
                size="sm"
                onClick={handleSaveView}
                disabled={!viewName.trim()}
                className="h-8 bg-teal-500 hover:bg-teal-400 text-white"
              >
                Save View
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

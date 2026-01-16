'use client';

import { useState, useCallback } from 'react';
import { Plus, X, Filter, ChevronDown } from 'lucide-react';
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
import type { CrmField, ViewFilter } from '@/lib/crm/types';

interface FilterBuilderProps {
  fields: CrmField[];
  filters: ViewFilter[];
  onFiltersChange: (filters: ViewFilter[]) => void;
  className?: string;
}

type FilterOperator = ViewFilter['operator'];

const OPERATORS: Record<string, { label: string; types: string[] }> = {
  equals: { label: 'equals', types: ['text', 'select', 'email', 'phone', 'number', 'date', 'boolean'] },
  not_equals: { label: 'does not equal', types: ['text', 'select', 'email', 'phone', 'number', 'date', 'boolean'] },
  contains: { label: 'contains', types: ['text', 'textarea', 'email', 'phone'] },
  starts_with: { label: 'starts with', types: ['text', 'email', 'phone'] },
  ends_with: { label: 'ends with', types: ['text', 'email', 'phone'] },
  gt: { label: 'greater than', types: ['number', 'currency', 'date', 'datetime'] },
  gte: { label: 'greater than or equal', types: ['number', 'currency', 'date', 'datetime'] },
  lt: { label: 'less than', types: ['number', 'currency', 'date', 'datetime'] },
  lte: { label: 'less than or equal', types: ['number', 'currency', 'date', 'datetime'] },
  is_null: { label: 'is empty', types: ['text', 'textarea', 'select', 'email', 'phone', 'number', 'date', 'datetime', 'url'] },
  is_not_null: { label: 'is not empty', types: ['text', 'textarea', 'select', 'email', 'phone', 'number', 'date', 'datetime', 'url'] },
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
}: {
  filter: ViewFilter;
  fields: CrmField[];
  onUpdate: (filter: ViewFilter) => void;
  onRemove: () => void;
}) {
  const field = fields.find(f => f.key === filter.field);
  const fieldType = field?.type || 'text';
  const availableOperators = getOperatorsForType(fieldType);
  const needsValue = !['is_null', 'is_not_null'].includes(filter.operator);

  const renderValueInput = () => {
    if (!needsValue) return null;

    if (fieldType === 'select' && field?.options?.length) {
      return (
        <Select
          value={String(filter.value || '')}
          onValueChange={(value) => onUpdate({ ...filter, value })}
        >
          <SelectTrigger className="h-9 bg-slate-900/50 border-white/10 text-white">
            <SelectValue placeholder="Select value" />
          </SelectTrigger>
          <SelectContent className="glass-card border-white/10">
            {field.options.map((option) => (
              <SelectItem 
                key={option} 
                value={option}
                className="text-slate-300 focus:text-white focus:bg-white/10"
              >
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
          <SelectTrigger className="h-9 bg-slate-900/50 border-white/10 text-white">
            <SelectValue placeholder="Select value" />
          </SelectTrigger>
          <SelectContent className="glass-card border-white/10">
            <SelectItem value="true" className="text-slate-300 focus:text-white focus:bg-white/10">
              Yes
            </SelectItem>
            <SelectItem value="false" className="text-slate-300 focus:text-white focus:bg-white/10">
              No
            </SelectItem>
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
          className="h-9 bg-slate-900/50 border-white/10 text-white"
        />
      );
    }

    if (['number', 'currency'].includes(fieldType)) {
      return (
        <Input
          type="number"
          value={String(filter.value || '')}
          onChange={(e) => onUpdate({ ...filter, value: e.target.valueAsNumber || 0 })}
          placeholder="Enter value"
          className="h-9 bg-slate-900/50 border-white/10 text-white placeholder:text-slate-500"
        />
      );
    }

    return (
      <Input
        type="text"
        value={String(filter.value || '')}
        onChange={(e) => onUpdate({ ...filter, value: e.target.value })}
        placeholder="Enter value"
        className="h-9 bg-slate-900/50 border-white/10 text-white placeholder:text-slate-500"
      />
    );
  };

  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-900/30 border border-white/5">
      {/* Field Select */}
      <Select
        value={filter.field}
        onValueChange={(value) => onUpdate({ ...filter, field: value, value: null })}
      >
        <SelectTrigger className="h-9 w-40 bg-slate-900/50 border-white/10 text-white">
          <SelectValue placeholder="Select field" />
        </SelectTrigger>
        <SelectContent className="glass-card border-white/10">
          {fields.map((f) => (
            <SelectItem 
              key={f.key} 
              value={f.key}
              className="text-slate-300 focus:text-white focus:bg-white/10"
            >
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator Select */}
      <Select
        value={filter.operator}
        onValueChange={(value) => onUpdate({ ...filter, operator: value as FilterOperator })}
      >
        <SelectTrigger className="h-9 w-44 bg-slate-900/50 border-white/10 text-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="glass-card border-white/10">
          {availableOperators.map((op) => (
            <SelectItem 
              key={op} 
              value={op}
              className="text-slate-300 focus:text-white focus:bg-white/10"
            >
              {OPERATORS[op].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value Input */}
      <div className="flex-1 min-w-[120px]">
        {renderValueInput()}
      </div>

      {/* Remove Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="h-9 w-9 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

export function FilterBuilder({
  fields,
  filters,
  onFiltersChange,
  className,
}: FilterBuilderProps) {
  const [isOpen, setIsOpen] = useState(false);

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
    const updated = filters.filter((_, i) => i !== index);
    onFiltersChange(updated);
  }, [filters, onFiltersChange]);

  const clearFilters = useCallback(() => {
    onFiltersChange([]);
  }, [onFiltersChange]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'h-10 px-3 rounded-xl bg-slate-900/50 border-white/10 text-slate-300 hover:text-white hover:border-white/20',
            filters.length > 0 && 'border-teal-500/50 text-teal-400',
            className
          )}
        >
          <Filter className="w-4 h-4 mr-2" />
          Filters
          {filters.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-teal-500/20 text-teal-400">
              {filters.length}
            </span>
          )}
          <ChevronDown className="w-4 h-4 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[600px] p-4 glass-card border-white/10" 
        align="start"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Filters</h3>
            {filters.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-7 text-xs text-slate-400 hover:text-white"
              >
                Clear all
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {filters.map((filter, index) => (
              <FilterRow
                key={index}
                filter={filter}
                fields={fields}
                onUpdate={(updated) => updateFilter(index, updated)}
                onRemove={() => removeFilter(index)}
              />
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={addFilter}
            className="w-full glass border-white/10 text-slate-300 hover:text-white hover:border-white/20"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add filter
          </Button>

          {filters.length > 0 && (
            <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => setIsOpen(false)}
                className="bg-teal-500 hover:bg-teal-400 text-white"
              >
                Apply Filters
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

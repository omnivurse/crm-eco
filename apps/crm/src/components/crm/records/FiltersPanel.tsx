'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@crm-eco/ui/lib/utils';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { ChevronLeft, ChevronRight, Filter, X, Plus, Search } from 'lucide-react';

interface CrmField {
  id: string;
  key: string;
  label: string;
  type: string;
  options?: string;
}

interface FilterCondition {
  field: string;
  operator: string;
  value: string;
}

interface FiltersPanelProps {
  fields: CrmField[];
  moduleKey: string;
  isOpen: boolean;
  onToggle: () => void;
}

const OPERATORS: Record<string, Array<{ value: string; label: string }>> = {
  text: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' },
  ],
  email: [
    { value: 'equals', label: 'Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'is_empty', label: 'Is empty' },
  ],
  select: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not equals' },
    { value: 'is_empty', label: 'Is empty' },
  ],
  number: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not equals' },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'less_than', label: 'Less than' },
    { value: 'is_empty', label: 'Is empty' },
  ],
  date: [
    { value: 'equals', label: 'Equals' },
    { value: 'before', label: 'Before' },
    { value: 'after', label: 'After' },
    { value: 'is_empty', label: 'Is empty' },
  ],
};

export function FiltersPanel({ fields, moduleKey, isOpen, onToggle }: FiltersPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters();
  };

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim());
    } else {
      params.delete('q');
    }

    if (filters.length > 0) {
      params.set('filters', JSON.stringify(filters));
    } else {
      params.delete('filters');
    }

    params.delete('page'); // Reset pagination
    router.push(`/crm/modules/${moduleKey}?${params.toString()}`);
  };

  const clearFilters = () => {
    setFilters([]);
    setSearchQuery('');
    const params = new URLSearchParams(searchParams.toString());
    params.delete('q');
    params.delete('filters');
    params.delete('page');
    router.push(`/crm/modules/${moduleKey}?${params.toString()}`);
  };

  const addFilter = () => {
    setFilters([...filters, { field: '', operator: 'equals', value: '' }]);
  };

  const updateFilter = (index: number, updates: Partial<FilterCondition>) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], ...updates };
    setFilters(newFilters);
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const getOperatorsForField = (fieldKey: string) => {
    const field = fields.find(f => f.key === fieldKey);
    const type = field?.type || 'text';
    return OPERATORS[type] || OPERATORS.text;
  };

  const getFieldOptions = (fieldKey: string): string[] => {
    const field = fields.find(f => f.key === fieldKey);
    if (!field?.options) return [];
    try {
      return JSON.parse(field.options);
    } catch {
      return [];
    }
  };

  // Collapsed state
  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="fixed left-14 top-20 z-20 h-9 w-9 rounded-lg bg-white dark:bg-slate-900 shadow-md border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
        title="Show filters"
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <div className="w-72 flex-shrink-0 glass-strong border-r border-slate-200 dark:border-white/5 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/5">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <span className="text-sm font-semibold text-slate-900 dark:text-white">Filters</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-7 w-7 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-slate-200 dark:border-white/5">
        <form onSubmit={handleSearch}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="search"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10"
            />
          </div>
        </form>
      </div>

      {/* Filter Conditions */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {filters.length === 0 ? (
          <div className="text-center py-6">
            <Filter className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No filters applied</p>
            <p className="text-xs text-slate-400 mt-1">Add a filter to narrow results</p>
          </div>
        ) : (
          filters.map((filter, index) => (
            <div key={index} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  {index === 0 ? 'Where' : 'And'}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFilter(index)}
                  className="h-6 w-6 text-slate-400 hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>

              {/* Field Selector */}
              <Select
                value={filter.field}
                onValueChange={(value) => updateFilter(index, { field: value, value: '' })}
              >
                <SelectTrigger className="h-8 text-sm bg-white dark:bg-slate-900/50">
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  {fields.map((field) => (
                    <SelectItem key={field.id} value={field.key}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Operator Selector */}
              {filter.field && (
                <Select
                  value={filter.operator}
                  onValueChange={(value) => updateFilter(index, { operator: value })}
                >
                  <SelectTrigger className="h-8 text-sm bg-white dark:bg-slate-900/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getOperatorsForField(filter.field).map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Value Input */}
              {filter.field && !['is_empty', 'is_not_empty'].includes(filter.operator) && (
                <>
                  {fields.find(f => f.key === filter.field)?.type === 'select' ? (
                    <Select
                      value={filter.value}
                      onValueChange={(value) => updateFilter(index, { value })}
                    >
                      <SelectTrigger className="h-8 text-sm bg-white dark:bg-slate-900/50">
                        <SelectValue placeholder="Select value" />
                      </SelectTrigger>
                      <SelectContent>
                        {getFieldOptions(filter.field).map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={fields.find(f => f.key === filter.field)?.type === 'number' ? 'number' : 'text'}
                      placeholder="Enter value"
                      value={filter.value}
                      onChange={(e) => updateFilter(index, { value: e.target.value })}
                      className="h-8 text-sm bg-white dark:bg-slate-900/50"
                    />
                  )}
                </>
              )}
            </div>
          ))
        )}

        {/* Add Filter Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={addFilter}
          className="w-full h-8 text-sm text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Filter
        </Button>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-slate-200 dark:border-white/5 space-y-2">
        <Button
          onClick={applyFilters}
          className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white"
        >
          Apply Filters
        </Button>
        {(filters.length > 0 || searchQuery) && (
          <Button
            variant="ghost"
            onClick={clearFilters}
            className="w-full text-slate-600 dark:text-slate-400"
          >
            Clear All
          </Button>
        )}
      </div>
    </div>
  );
}

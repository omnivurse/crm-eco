import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { DataSource, Filter, FilterOperator, ColumnDefinition } from 'shared';
import { getColumnsForDataSource } from 'shared';

const FILTER_OPERATORS: { value: FilterOperator; label: string; types: string[] }[] = [
  { value: 'eq', label: 'equals', types: ['text', 'number', 'date', 'datetime', 'status', 'boolean'] },
  { value: 'neq', label: 'not equals', types: ['text', 'number', 'date', 'datetime', 'status', 'boolean'] },
  { value: 'gt', label: 'greater than', types: ['number', 'date', 'datetime', 'currency', 'percent'] },
  { value: 'gte', label: 'greater or equal', types: ['number', 'date', 'datetime', 'currency', 'percent'] },
  { value: 'lt', label: 'less than', types: ['number', 'date', 'datetime', 'currency', 'percent'] },
  { value: 'lte', label: 'less or equal', types: ['number', 'date', 'datetime', 'currency', 'percent'] },
  { value: 'like', label: 'contains', types: ['text', 'email', 'phone'] },
  { value: 'starts_with', label: 'starts with', types: ['text', 'email'] },
  { value: 'ends_with', label: 'ends with', types: ['text', 'email'] },
  { value: 'in', label: 'in list', types: ['text', 'status'] },
  { value: 'is_null', label: 'is empty', types: ['text', 'number', 'date', 'datetime', 'email', 'phone'] },
  { value: 'is_not_null', label: 'is not empty', types: ['text', 'number', 'date', 'datetime', 'email', 'phone'] },
  { value: 'between', label: 'between', types: ['number', 'date', 'datetime', 'currency'] },
];

const STATUS_OPTIONS: Record<string, string[]> = {
  members: ['active', 'inactive', 'pending', 'cancelled', 'terminated'],
  advisors: ['active', 'inactive', 'pending', 'terminated'],
  enrollments: ['active', 'inactive', 'pending', 'cancelled', 'terminated'],
  commissions: ['pending', 'approved', 'paid', 'cancelled'],
};

interface FilterBuilderProps {
  dataSource: DataSource;
  filters: Filter[];
  onFiltersChange: (filters: Filter[]) => void;
}

export function FilterBuilder({ dataSource, filters, onFiltersChange }: FilterBuilderProps) {
  const columns = getColumnsForDataSource(dataSource);

  const addFilter = () => {
    const newFilter: Filter = {
      column: columns[0]?.key || '',
      operator: 'eq',
      value: '',
    };
    onFiltersChange([...filters, newFilter]);
  };

  const updateFilter = (index: number, updates: Partial<Filter>) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], ...updates };
    onFiltersChange(newFilters);
  };

  const removeFilter = (index: number) => {
    onFiltersChange(filters.filter((_, i) => i !== index));
  };

  const getColumnType = (columnKey: string): string => {
    const col = columns.find((c) => c.key === columnKey);
    return col?.type || 'text';
  };

  const getAvailableOperators = (columnKey: string) => {
    const type = getColumnType(columnKey);
    return FILTER_OPERATORS.filter((op) => op.types.includes(type));
  };

  const renderValueInput = (filter: Filter, index: number) => {
    const type = getColumnType(filter.column);
    const operator = filter.operator;

    // No value needed for null checks
    if (operator === 'is_null' || operator === 'is_not_null') {
      return null;
    }

    // Status dropdown
    if (type === 'status') {
      const options = STATUS_OPTIONS[dataSource] || ['active', 'inactive'];

      if (operator === 'in') {
        return (
          <select
            multiple
            value={Array.isArray(filter.value) ? filter.value as string[] : []}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
              updateFilter(index, { value: selected });
            }}
            className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      }

      return (
        <select
          value={String(filter.value || '')}
          onChange={(e) => updateFilter(index, { value: e.target.value })}
          className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
        >
          <option value="">Select status</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    // Boolean dropdown
    if (type === 'boolean') {
      return (
        <select
          value={String(filter.value || '')}
          onChange={(e) => updateFilter(index, { value: e.target.value === 'true' })}
          className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
        >
          <option value="">Select value</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    }

    // Date input
    if (type === 'date' || type === 'datetime') {
      if (operator === 'between') {
        return (
          <div className="flex-1 flex items-center gap-2">
            <input
              type="date"
              value={String(filter.value || '')}
              onChange={(e) => updateFilter(index, { value: e.target.value })}
              className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
            />
            <span className="text-neutral-500">to</span>
            <input
              type="date"
              value={String(filter.value2 || '')}
              onChange={(e) => updateFilter(index, { value2: e.target.value })}
              className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
            />
          </div>
        );
      }

      return (
        <input
          type="date"
          value={String(filter.value || '')}
          onChange={(e) => updateFilter(index, { value: e.target.value })}
          className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
        />
      );
    }

    // Number input
    if (type === 'number' || type === 'currency' || type === 'percent') {
      if (operator === 'between') {
        return (
          <div className="flex-1 flex items-center gap-2">
            <input
              type="number"
              value={String(filter.value || '')}
              onChange={(e) => updateFilter(index, { value: Number(e.target.value) })}
              placeholder="From"
              className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
            />
            <span className="text-neutral-500">to</span>
            <input
              type="number"
              value={String(filter.value2 || '')}
              onChange={(e) => updateFilter(index, { value2: Number(e.target.value) })}
              placeholder="To"
              className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
            />
          </div>
        );
      }

      return (
        <input
          type="number"
          value={String(filter.value || '')}
          onChange={(e) => updateFilter(index, { value: Number(e.target.value) })}
          placeholder="Enter value"
          className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
        />
      );
    }

    // Default text input
    return (
      <input
        type="text"
        value={String(filter.value || '')}
        onChange={(e) => updateFilter(index, { value: e.target.value })}
        placeholder="Enter value"
        className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
      />
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
          Filters
        </h3>
        <button
          onClick={addFilter}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Filter
        </button>
      </div>

      {filters.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-lg">
          <p className="text-neutral-500 dark:text-neutral-400">
            No filters applied. Click "Add Filter" to narrow down results.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filters.map((filter, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg"
            >
              {/* Column Select */}
              <select
                value={filter.column}
                onChange={(e) => {
                  const newColumn = e.target.value;
                  const availableOps = getAvailableOperators(newColumn);
                  const currentOpValid = availableOps.some((op) => op.value === filter.operator);
                  updateFilter(index, {
                    column: newColumn,
                    operator: currentOpValid ? filter.operator : availableOps[0]?.value || 'eq',
                    value: '',
                    value2: undefined,
                  });
                }}
                className="w-48 px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-sm"
              >
                {columns.map((col) => (
                  <option key={col.key} value={col.key}>
                    {col.label}
                  </option>
                ))}
              </select>

              {/* Operator Select */}
              <select
                value={filter.operator}
                onChange={(e) => updateFilter(index, { operator: e.target.value as FilterOperator })}
                className="w-40 px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-sm"
              >
                {getAvailableOperators(filter.column).map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>

              {/* Value Input */}
              {renderValueInput(filter, index)}

              {/* Remove Button */}
              <button
                onClick={() => removeFilter(index)}
                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState, useMemo } from 'react';
import { Search, GripVertical, Check, ChevronDown, ChevronRight } from 'lucide-react';
import type { DataSource, ColumnDefinition } from 'shared';
import { getColumnsForDataSource } from 'shared';

interface ColumnPickerProps {
  dataSource: DataSource;
  selectedColumns: string[];
  onColumnsChange: (columns: string[]) => void;
}

export function ColumnPicker({
  dataSource,
  selectedColumns,
  onColumnsChange,
}: ColumnPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['primary']));

  const columns = useMemo(() => getColumnsForDataSource(dataSource), [dataSource]);

  // Group columns by table
  const groupedColumns = useMemo(() => {
    const groups: Record<string, ColumnDefinition[]> = {};

    columns.forEach((col) => {
      const groupKey = col.joinRequired || 'primary';
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(col);
    });

    return groups;
  }, [columns]);

  // Filter columns by search
  const filteredGroups = useMemo(() => {
    if (!searchQuery) return groupedColumns;

    const query = searchQuery.toLowerCase();
    const filtered: Record<string, ColumnDefinition[]> = {};

    Object.entries(groupedColumns).forEach(([group, cols]) => {
      const matchingCols = cols.filter(
        (col) =>
          col.label.toLowerCase().includes(query) ||
          col.key.toLowerCase().includes(query)
      );
      if (matchingCols.length > 0) {
        filtered[group] = matchingCols;
      }
    });

    return filtered;
  }, [groupedColumns, searchQuery]);

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  const toggleColumn = (columnKey: string) => {
    if (selectedColumns.includes(columnKey)) {
      onColumnsChange(selectedColumns.filter((c) => c !== columnKey));
    } else {
      onColumnsChange([...selectedColumns, columnKey]);
    }
  };

  const selectAllInGroup = (group: string) => {
    const groupCols = groupedColumns[group] || [];
    const groupKeys = groupCols.map((c) => c.key);
    const allSelected = groupKeys.every((k) => selectedColumns.includes(k));

    if (allSelected) {
      // Deselect all in group
      onColumnsChange(selectedColumns.filter((c) => !groupKeys.includes(c)));
    } else {
      // Select all in group
      const newSelected = new Set([...selectedColumns, ...groupKeys]);
      onColumnsChange(Array.from(newSelected));
    }
  };

  const moveColumn = (fromIndex: number, toIndex: number) => {
    const newColumns = [...selectedColumns];
    const [removed] = newColumns.splice(fromIndex, 1);
    newColumns.splice(toIndex, 0, removed);
    onColumnsChange(newColumns);
  };

  const getGroupLabel = (group: string): string => {
    if (group === 'primary') {
      return dataSource.charAt(0).toUpperCase() + dataSource.slice(1);
    }
    return group.charAt(0).toUpperCase() + group.slice(1);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Available Columns */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
            Available Columns
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search columns..."
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
          {Object.entries(filteredGroups).map(([group, cols]) => {
            const isExpanded = expandedGroups.has(group);
            const groupKeys = cols.map((c) => c.key);
            const selectedInGroup = groupKeys.filter((k) => selectedColumns.includes(k)).length;

            return (
              <div key={group} className="border-b border-neutral-200 dark:border-neutral-700 last:border-b-0">
                <button
                  onClick={() => toggleGroup(group)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-750 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-neutral-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-neutral-500" />
                    )}
                    <span className="font-medium text-neutral-900 dark:text-white">
                      {getGroupLabel(group)}
                    </span>
                    <span className="text-xs text-neutral-500">
                      ({selectedInGroup}/{cols.length})
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      selectAllInGroup(group);
                    }}
                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    {selectedInGroup === cols.length ? 'Deselect All' : 'Select All'}
                  </button>
                </button>

                {isExpanded && (
                  <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
                    {cols.map((col) => {
                      const isSelected = selectedColumns.includes(col.key);

                      return (
                        <button
                          key={col.key}
                          onClick={() => toggleColumn(col.key)}
                          className={`
                            w-full flex items-center justify-between px-4 py-2 text-left transition-colors
                            ${isSelected
                              ? 'bg-primary-50 dark:bg-primary-900/20'
                              : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'
                            }
                          `}
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium text-neutral-900 dark:text-white">
                              {col.label}
                            </p>
                            <p className="text-xs text-neutral-500">
                              {col.key} ({col.type})
                            </p>
                          </div>
                          {isSelected && (
                            <Check className="w-4 h-4 text-primary-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Columns */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
          Selected Columns ({selectedColumns.length})
        </h3>

        {selectedColumns.length === 0 ? (
          <div className="border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-lg p-8 text-center">
            <p className="text-neutral-500 dark:text-neutral-400">
              Select columns from the left to include in your report
            </p>
          </div>
        ) : (
          <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
            {selectedColumns.map((columnKey, index) => {
              const colDef = columns.find((c) => c.key === columnKey);
              if (!colDef) return null;

              return (
                <div
                  key={columnKey}
                  className="flex items-center gap-2 px-4 py-2 border-b border-neutral-200 dark:border-neutral-700 last:border-b-0 bg-white dark:bg-neutral-800 group"
                >
                  <GripVertical className="w-4 h-4 text-neutral-400 cursor-grab" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">
                      {colDef.label}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {colDef.key}
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {index > 0 && (
                      <button
                        onClick={() => moveColumn(index, index - 1)}
                        className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                        title="Move up"
                      >
                        <ChevronDown className="w-4 h-4 rotate-180" />
                      </button>
                    )}
                    {index < selectedColumns.length - 1 && (
                      <button
                        onClick={() => moveColumn(index, index + 1)}
                        className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                        title="Move down"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => toggleColumn(columnKey)}
                      className="p-1 text-red-400 hover:text-red-600"
                      title="Remove"
                    >
                      <span className="text-sm">&times;</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

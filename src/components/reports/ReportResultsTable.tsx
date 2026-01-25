import { useState, useMemo } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Square,
  CheckSquare,
} from 'lucide-react';
import type { ColumnDefinition, ColumnType, Sorting } from 'shared';
import { formatValueForExport } from 'shared';

interface ReportResultsTableProps {
  data: Record<string, unknown>[];
  columns: ColumnDefinition[];
  totalCount: number;
  page: number;
  pageSize: number;
  sorting: Sorting[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSortChange: (sorting: Sorting[]) => void;
  selectedRows?: Set<string>;
  onRowSelectionChange?: (selected: Set<string>) => void;
  loading?: boolean;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function ReportResultsTable({
  data,
  columns,
  totalCount,
  page,
  pageSize,
  sorting,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  selectedRows,
  onRowSelectionChange,
  loading = false,
}: ReportResultsTableProps) {
  const totalPages = Math.ceil(totalCount / pageSize);
  const showSelection = !!onRowSelectionChange;

  const handleSort = (columnKey: string) => {
    const existingSort = sorting.find((s) => s.column === columnKey);

    if (existingSort) {
      if (existingSort.direction === 'asc') {
        // Change to desc
        onSortChange(
          sorting.map((s) =>
            s.column === columnKey ? { ...s, direction: 'desc' } : s
          )
        );
      } else {
        // Remove sort
        onSortChange(sorting.filter((s) => s.column !== columnKey));
      }
    } else {
      // Add new sort
      onSortChange([...sorting, { column: columnKey, direction: 'asc' }]);
    }
  };

  const getSortDirection = (columnKey: string): 'asc' | 'desc' | null => {
    const sort = sorting.find((s) => s.column === columnKey);
    return sort?.direction || null;
  };

  const toggleRowSelection = (rowId: string) => {
    if (!onRowSelectionChange || !selectedRows) return;

    const newSelection = new Set(selectedRows);
    if (newSelection.has(rowId)) {
      newSelection.delete(rowId);
    } else {
      newSelection.add(rowId);
    }
    onRowSelectionChange(newSelection);
  };

  const toggleAllSelection = () => {
    if (!onRowSelectionChange || !selectedRows) return;

    const allIds = data.map((row) => String(row.id || row.member_number || ''));
    const allSelected = allIds.every((id) => selectedRows.has(id));

    if (allSelected) {
      onRowSelectionChange(new Set());
    } else {
      onRowSelectionChange(new Set(allIds));
    }
  };

  const formatCell = (value: unknown, type: ColumnType): string => {
    return formatValueForExport(value, type);
  };

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      inactive: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300',
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      terminated: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    };
    return colors[status?.toLowerCase()] || 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300';
  };

  const renderCell = (value: unknown, type: ColumnType): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-neutral-400">-</span>;
    }

    if (type === 'status') {
      return (
        <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(String(value))}`}>
          {String(value)}
        </span>
      );
    }

    if (type === 'boolean') {
      return value ? (
        <span className="text-green-600 dark:text-green-400">Yes</span>
      ) : (
        <span className="text-neutral-400">No</span>
      );
    }

    if (type === 'currency') {
      const num = Number(value);
      if (!isNaN(num)) {
        return (
          <span className="font-mono">
            ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      }
    }

    if (type === 'percent') {
      const num = Number(value);
      if (!isNaN(num)) {
        return <span>{num.toFixed(2)}%</span>;
      }
    }

    return formatCell(value, type);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-500 dark:text-neutral-400">No data found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 dark:bg-neutral-800">
              <tr>
                {showSelection && (
                  <th className="px-4 py-3 w-10">
                    <button
                      onClick={toggleAllSelection}
                      className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                    >
                      {data.length > 0 &&
                      data.every((row) =>
                        selectedRows?.has(String(row.id || row.member_number || ''))
                      ) ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                )}
                {columns.map((col) => {
                  const sortDir = getSortDirection(col.key);
                  const columnKey = col.key.replace('.', '_');

                  return (
                    <th
                      key={col.key}
                      className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                      onClick={() => handleSort(columnKey)}
                    >
                      <div className="flex items-center gap-1">
                        <span>{col.label}</span>
                        <div className="flex flex-col">
                          <ChevronUp
                            className={`w-3 h-3 -mb-1 ${
                              sortDir === 'asc'
                                ? 'text-primary-500'
                                : 'text-neutral-300 dark:text-neutral-600'
                            }`}
                          />
                          <ChevronDown
                            className={`w-3 h-3 -mt-1 ${
                              sortDir === 'desc'
                                ? 'text-primary-500'
                                : 'text-neutral-300 dark:text-neutral-600'
                            }`}
                          />
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-neutral-900 divide-y divide-neutral-200 dark:divide-neutral-700">
              {data.map((row, rowIndex) => {
                const rowId = String(row.id || row.member_number || rowIndex);
                const isSelected = selectedRows?.has(rowId);

                return (
                  <tr
                    key={rowId}
                    className={`
                      hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors
                      ${isSelected ? 'bg-primary-50 dark:bg-primary-900/10' : ''}
                    `}
                  >
                    {showSelection && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleRowSelection(rowId)}
                          className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary-500" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    )}
                    {columns.map((col) => {
                      const cellKey = col.key.replace('.', '_');
                      const value = row[cellKey] ?? row[col.key];

                      return (
                        <td
                          key={col.key}
                          className="px-4 py-3 text-sm text-neutral-900 dark:text-white whitespace-nowrap"
                        >
                          {renderCell(value, col.type)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of{' '}
            {totalCount} results
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-1 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-sm"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(1)}
              disabled={page === 1}
              className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronsLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <span className="px-3 text-sm text-neutral-600 dark:text-neutral-400">
              Page {page} of {totalPages}
            </span>

            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => onPageChange(totalPages)}
              disabled={page === totalPages}
              className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronsRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

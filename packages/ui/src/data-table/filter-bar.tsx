'use client';

import type { ReactNode } from 'react';
import { Download, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { Button } from '../components/button';
import { Input } from '../components/input';
import type { AppliedFilter, FilterDef } from './types';

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filterDefs: FilterDef[];
  filters: AppliedFilter[];
  onFilterChange: (key: string, value: string | null) => void;
  onClear: () => void;
  onRefresh: () => void;
  onExport?: () => void;
  loading?: boolean;
  toolbar?: ReactNode;
};

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filterDefs,
  filters,
  onFilterChange,
  onClear,
  onRefresh,
  onExport,
  loading,
  toolbar,
}: Props) {
  const hasActive =
    Boolean(search) || filters.some((f) => f.value !== undefined && f.value !== '');

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9"
          aria-label="Search"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {filterDefs.map((def) => {
          if (def.type !== 'select' || !def.options?.length) return null;
          const current = filters.find((f) => f.key === def.key)?.value;
          const value = current === undefined || current === null ? 'all' : String(current);
          return (
            <select
              key={def.key}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={value}
              onChange={(e) => onFilterChange(def.key, e.target.value)}
              aria-label={def.label}
            >
              <option value="all">All {def.label}</option>
              {def.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          );
        })}
        {hasActive && (
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            <X className="mr-1 h-4 w-4" />
            Clear
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
        {onExport && (
          <Button type="button" variant="outline" size="sm" onClick={onExport}>
            <Download className="mr-1 h-4 w-4" />
            Export
          </Button>
        )}
        {toolbar}
      </div>
    </div>
  );
}

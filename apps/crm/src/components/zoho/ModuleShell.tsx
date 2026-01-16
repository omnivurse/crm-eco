'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@crm-eco/ui/components/input';
import { cn } from '@crm-eco/ui/lib/utils';
import { Search } from 'lucide-react';
import { ModuleHeader } from './ModuleHeader';
import { ViewsDropdown } from './ViewsDropdown';
import { AdvancedFilterBuilder } from './AdvancedFilterBuilder';
import { FilterChipsBar } from './FilterChipsBar';
import { ColumnsButton } from './ColumnsButton';
import { DensityToggle } from './DensityToggle';
import { MassActionsBar } from './MassActionsBar';
import type { Density } from './ViewPreferencesContext';
import type { CrmModule, CrmField, CrmView, CrmRecord, ViewFilter } from '@/lib/crm/types';

interface ModuleShellProps {
  module: CrmModule;
  records: CrmRecord[];
  fields: CrmField[];
  views: CrmView[];
  activeViewId?: string;
  totalCount: number;
  children: React.ReactNode;
  className?: string;
}

export function ModuleShell({
  module,
  records,
  fields,
  views,
  activeViewId,
  totalCount,
  children,
  className,
}: ModuleShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Local state
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<ViewFilter[]>([]);
  const [density, setDensity] = useState<Density>('default');
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    views.find(v => v.id === activeViewId)?.columns || ['title', 'status', 'email', 'created_at']
  );
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Derived state
  const selectedCount = selectedIds.size;

  // Handlers
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (searchQuery.trim()) {
      params.set('search', searchQuery.trim());
    } else {
      params.delete('search');
    }
    params.delete('page');
    router.push(`/crm/modules/${module.key}?${params.toString()}`);
  }, [searchQuery, searchParams, router, module.key]);

  const handleRemoveFilter = useCallback((index: number) => {
    setFilters(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters([]);
  }, []);

  const handleSortChange = useCallback((field: string, direction: 'asc' | 'desc') => {
    setSortField(field);
    setSortDirection(direction);
    // TODO: Apply sort to query
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(records.map(r => r.id)));
  }, [records]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Bulk action handlers (placeholders)
  const handleAssignOwner = useCallback(() => {
    console.log('Assign owner to:', Array.from(selectedIds));
    // TODO: Open assign owner dialog
  }, [selectedIds]);

  const handleChangeStatus = useCallback(() => {
    console.log('Change status for:', Array.from(selectedIds));
    // TODO: Open status change dialog
  }, [selectedIds]);

  const handleChangeStage = useCallback(() => {
    console.log('Change stage for:', Array.from(selectedIds));
    // TODO: Open stage change dialog
  }, [selectedIds]);

  const handleAddTag = useCallback(() => {
    console.log('Add tag to:', Array.from(selectedIds));
    // TODO: Open add tag dialog
  }, [selectedIds]);

  const handleSendEmail = useCallback(() => {
    console.log('Send email to:', Array.from(selectedIds));
    // TODO: Open email composer
  }, [selectedIds]);

  const handleDelete = useCallback(() => {
    console.log('Delete:', Array.from(selectedIds));
    // TODO: Perform delete
    setSelectedIds(new Set());
  }, [selectedIds]);

  const handleExport = useCallback(() => {
    console.log('Export:', selectedCount > 0 ? Array.from(selectedIds) : 'all');
    // TODO: Trigger export
  }, [selectedIds, selectedCount]);

  const handleCreateView = useCallback(() => {
    console.log('Create new view');
    // TODO: Open create view dialog
  }, []);

  const handleSaveView = useCallback((name: string, viewFilters: ViewFilter[]) => {
    console.log('Save view:', name, viewFilters);
    // TODO: Save view to DB or localStorage
  }, []);

  // Context for child components
  const shellContext = useMemo(() => ({
    selectedIds,
    setSelectedIds,
    density,
    visibleColumns,
    sortField,
    sortDirection,
    moduleKey: module.key,
  }), [selectedIds, density, visibleColumns, sortField, sortDirection, module.key]);

  return (
    <div className={cn('max-w-7xl mx-auto space-y-4', className)}>
      {/* Header */}
      <ModuleHeader
        module={module}
        totalCount={totalCount}
        onExport={handleExport}
      />

      {/* Toolbar */}
      <div className="glass-card rounded-xl border border-slate-200 dark:border-white/10 p-3">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Left: Views + Search */}
          <div className="flex items-center gap-2 flex-1">
            <ViewsDropdown
              views={views}
              activeViewId={activeViewId}
              moduleKey={module.key}
              onCreateView={handleCreateView}
            />

            <form onSubmit={handleSearch} className="relative flex-1 max-w-sm">
              <Search className={cn(
                'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors',
                searchFocused ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'
              )} />
              <Input
                type="search"
                placeholder={`Search ${module.name_plural?.toLowerCase() || 'records'}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className={cn(
                  'pl-9 h-9 rounded-lg text-sm',
                  'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10',
                  'text-slate-900 dark:text-white placeholder:text-slate-400',
                  searchFocused && 'border-teal-500 ring-2 ring-teal-500/20'
                )}
              />
            </form>
          </div>

          {/* Right: Filters + Columns + Density */}
          <div className="flex items-center gap-2">
            <AdvancedFilterBuilder
              fields={fields}
              filters={filters}
              onFiltersChange={setFilters}
              onSaveView={handleSaveView}
            />

            <ColumnsButton
              fields={fields}
              visibleColumns={visibleColumns}
              onColumnsChange={setVisibleColumns}
            />

            <DensityToggle
              value={density}
              onChange={setDensity}
            />
          </div>
        </div>

        {/* Filter Chips Bar */}
        <FilterChipsBar
          filters={filters}
          fields={fields}
          sortField={sortField}
          sortDirection={sortDirection}
          totalCount={totalCount}
          onRemoveFilter={handleRemoveFilter}
          onClearAll={handleClearFilters}
          onSortChange={handleSortChange}
        />
      </div>

      {/* Table Content */}
      <div
        data-module-shell-context={JSON.stringify(shellContext)}
        className={cn(
          'relative',
          density === 'compact' && '[&_table_td]:py-1.5 [&_table_th]:py-2',
          density === 'comfortable' && '[&_table_td]:py-4 [&_table_th]:py-3'
        )}
      >
        {children}
      </div>

      {/* Mass Actions Bar */}
      <MassActionsBar
        selectedCount={selectedCount}
        totalCount={totalCount}
        onSelectAll={handleSelectAll}
        onClearSelection={handleClearSelection}
        onAssignOwner={handleAssignOwner}
        onChangeStatus={handleChangeStatus}
        onChangeStage={module.key === 'deals' ? handleChangeStage : undefined}
        onAddTag={handleAddTag}
        onSendEmail={handleSendEmail}
        onDelete={handleDelete}
        onExport={handleExport}
        moduleKey={module.key}
      />
    </div>
  );
}

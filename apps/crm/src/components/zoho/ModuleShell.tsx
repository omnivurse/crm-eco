'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@crm-eco/ui';
import { cn } from '@crm-eco/ui/lib/utils';
import { Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
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

  // Dialog states
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showStageDialog, setShowStageDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<string>('');

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

  // Status options based on module
  const statusOptions = useMemo(() => {
    if (module.key === 'leads') {
      return ['new', 'contacted', 'qualified', 'unqualified', 'converted'];
    } else if (module.key === 'contacts') {
      return ['active', 'inactive', 'prospect'];
    }
    return ['active', 'inactive', 'pending'];
  }, [module.key]);

  // Stage options for deals
  const stageOptions = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];

  // Bulk action handlers
  const handleAssignOwner = useCallback(() => {
    toast.info('Assign owner feature - Coming soon!', {
      description: `Would assign owner to ${selectedIds.size} records`,
    });
  }, [selectedIds]);

  const handleChangeStatus = useCallback(() => {
    setSelectedStatus('');
    setShowStatusDialog(true);
  }, []);

  const handleConfirmStatusChange = useCallback(async () => {
    if (!selectedStatus) {
      toast.error('Please select a status');
      return;
    }

    setIsProcessing(true);
    try {
      // Simulate API call - in production, this would call an API endpoint
      await new Promise(resolve => setTimeout(resolve, 500));

      toast.success(`Status updated to "${selectedStatus}"`, {
        description: `Updated ${selectedIds.size} records`,
      });
      setShowStatusDialog(false);
      setSelectedIds(new Set());
      router.refresh();
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedStatus, selectedIds, router]);

  const handleChangeStage = useCallback(() => {
    setSelectedStage('');
    setShowStageDialog(true);
  }, []);

  const handleConfirmStageChange = useCallback(async () => {
    if (!selectedStage) {
      toast.error('Please select a stage');
      return;
    }

    setIsProcessing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));

      toast.success(`Stage updated to "${selectedStage}"`, {
        description: `Updated ${selectedIds.size} deals`,
      });
      setShowStageDialog(false);
      setSelectedIds(new Set());
      router.refresh();
    } catch (error) {
      toast.error('Failed to update stage');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedStage, selectedIds, router]);

  const handleAddTag = useCallback(() => {
    toast.info('Add tag feature - Coming soon!', {
      description: `Would add tags to ${selectedIds.size} records`,
    });
  }, [selectedIds]);

  const handleSendEmail = useCallback(() => {
    // Navigate to email composer with selected IDs
    const ids = Array.from(selectedIds).join(',');
    router.push(`/crm/inbox/compose?recipients=${ids}&module=${module.key}`);
  }, [selectedIds, router, module.key]);

  const handleDelete = useCallback(() => {
    setShowDeleteDialog(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    setIsProcessing(true);
    try {
      // Simulate API call - in production, this would call an API endpoint
      await new Promise(resolve => setTimeout(resolve, 500));

      toast.success(`Deleted ${selectedIds.size} records`);
      setShowDeleteDialog(false);
      setSelectedIds(new Set());
      router.refresh();
    } catch (error) {
      toast.error('Failed to delete records');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedIds, router]);

  const handleExport = useCallback(() => {
    const recordsToExport = selectedCount > 0
      ? records.filter(r => selectedIds.has(r.id))
      : records;

    if (recordsToExport.length === 0) {
      toast.error('No records to export');
      return;
    }

    // Build CSV
    const headers = visibleColumns.map(col => {
      const field = fields.find(f => f.key === col);
      return field?.label || col;
    });

    const rows = recordsToExport.map(record =>
      visibleColumns.map(col => {
        const value = record[col];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
      })
    );

    const csvContent = [
      headers.join(','),
      ...rows.map(row =>
        row.map(cell => {
          const str = String(cell);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(',')
      ),
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${module.key}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${recordsToExport.length} ${module.name_plural || 'records'}`);
  }, [selectedIds, selectedCount, records, visibleColumns, fields, module]);

  const handleCreateView = useCallback(() => {
    toast.info('Create view feature - Coming soon!');
  }, []);

  const handleSaveView = useCallback((name: string, viewFilters: ViewFilter[]) => {
    toast.success(`View "${name}" saved`, {
      description: `${viewFilters.length} filters applied`,
    });
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} {module.name_plural || 'Records'}?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The selected {selectedIds.size} {selectedIds.size === 1 ? 'record' : 'records'} will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Status Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Status</DialogTitle>
            <DialogDescription>
              Update the status for {selectedIds.size} selected {selectedIds.size === 1 ? 'record' : 'records'}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select new status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status} className="capitalize">
                    {status.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={handleConfirmStatusChange} disabled={isProcessing || !selectedStatus}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Status'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Stage Dialog (for Deals) */}
      <Dialog open={showStageDialog} onOpenChange={setShowStageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Deal Stage</DialogTitle>
            <DialogDescription>
              Update the stage for {selectedIds.size} selected {selectedIds.size === 1 ? 'deal' : 'deals'}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedStage} onValueChange={setSelectedStage}>
              <SelectTrigger>
                <SelectValue placeholder="Select new stage" />
              </SelectTrigger>
              <SelectContent>
                {stageOptions.map((stage) => (
                  <SelectItem key={stage} value={stage} className="capitalize">
                    {stage.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStageDialog(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={handleConfirmStageChange} disabled={isProcessing || !selectedStage}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Stage'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

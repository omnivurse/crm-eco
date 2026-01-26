'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
import { ModuleShellProvider } from './ModuleShellContext';
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
  const [sortField, setSortField] = useState<string | null>(searchParams.get('sortField'));
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(
    (searchParams.get('sortDirection') as 'asc' | 'desc') || 'asc'
  );

  // Dialog states
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showStageDialog, setShowStageDialog] = useState(false);
  const [showAssignOwnerDialog, setShowAssignOwnerDialog] = useState(false);
  const [showAddTagDialog, setShowAddTagDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; full_name: string; email: string }>>([]);
  const [availableTags, setAvailableTags] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const [newTagName, setNewTagName] = useState<string>('');

  // Derived state
  const selectedCount = selectedIds.size;

  // Track if initial mount to avoid triggering search on page load
  const isInitialMount = useRef(true);
  const searchParamsRef = useRef(searchParams);

  // Keep searchParams ref updated without triggering effect
  useEffect(() => {
    searchParamsRef.current = searchParams;
  }, [searchParams]);

  // Debounced live search - only triggered by searchQuery changes
  useEffect(() => {
    // Skip the initial mount to avoid double navigation
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParamsRef.current.toString());
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      } else {
        params.delete('search');
      }
      params.delete('page');
      router.push(`/crm/modules/${module.key}?${params.toString()}`);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, router, module.key]);

  // Handlers
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    // Search is already handled by the debounced effect
  }, []);

  const handleRemoveFilter = useCallback((index: number) => {
    setFilters(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters([]);
  }, []);

  const handleSortChange = useCallback((field: string, direction: 'asc' | 'desc') => {
    setSortField(field);
    setSortDirection(direction);

    // Apply sort to URL query params
    const params = new URLSearchParams(searchParams.toString());
    params.set('sortField', field);
    params.set('sortDirection', direction);
    params.delete('page'); // Reset to first page when sorting changes
    router.push(`/crm/modules/${module.key}?${params.toString()}`);
  }, [searchParams, router, module.key]);

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

  // Fetch team members for assign owner dialog
  const fetchTeamMembers = useCallback(async () => {
    try {
      const response = await fetch('/api/team/members?crmOnly=true');
      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data);
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  }, []);

  // Fetch tags for add tag dialog
  const fetchTags = useCallback(async () => {
    try {
      const response = await fetch(`/api/crm/tags?module=${module.key}`);
      if (response.ok) {
        const data = await response.json();
        setAvailableTags(data);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  }, [module.key]);

  // Bulk action handlers
  const handleAssignOwner = useCallback(() => {
    setSelectedOwnerId('');
    fetchTeamMembers();
    setShowAssignOwnerDialog(true);
  }, [fetchTeamMembers]);

  const handleConfirmAssignOwner = useCallback(async () => {
    if (!selectedOwnerId) {
      toast.error('Please select an owner');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/crm/records/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_ids: Array.from(selectedIds),
          updates: { owner_id: selectedOwnerId },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to assign owner');
      }

      const result = await response.json();
      toast.success(`Owner assigned successfully`, {
        description: `Updated ${result.updated_count} records`,
      });
      setShowAssignOwnerDialog(false);
      setSelectedIds(new Set());
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to assign owner');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedOwnerId, selectedIds, router]);

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
      const response = await fetch('/api/crm/records/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_ids: Array.from(selectedIds),
          updates: { status: selectedStatus },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update status');
      }

      const result = await response.json();
      toast.success(`Status updated to "${selectedStatus}"`, {
        description: `Updated ${result.updated_count} records`,
      });
      setShowStatusDialog(false);
      setSelectedIds(new Set());
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update status');
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
      const response = await fetch('/api/crm/records/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_ids: Array.from(selectedIds),
          updates: { stage: selectedStage },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update stage');
      }

      const result = await response.json();
      toast.success(`Stage updated to "${selectedStage}"`, {
        description: `Updated ${result.updated_count} deals`,
      });
      setShowStageDialog(false);
      setSelectedIds(new Set());
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update stage');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedStage, selectedIds, router]);

  const handleAddTag = useCallback(() => {
    setSelectedTagIds([]);
    setNewTagName('');
    fetchTags();
    setShowAddTagDialog(true);
  }, [fetchTags]);

  const handleCreateTag = useCallback(async () => {
    if (!newTagName.trim()) return;

    try {
      const response = await fetch('/api/crm/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create tag');
      }

      const newTag = await response.json();
      setAvailableTags((prev) => [...prev, newTag]);
      setSelectedTagIds((prev) => [...prev, newTag.id]);
      setNewTagName('');
      toast.success(`Tag "${newTag.name}" created`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create tag');
    }
  }, [newTagName]);

  const handleConfirmAddTag = useCallback(async () => {
    if (selectedTagIds.length === 0) {
      toast.error('Please select at least one tag');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/crm/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_ids: Array.from(selectedIds),
          tag_ids: selectedTagIds,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add tags');
      }

      toast.success(`Tags added successfully`, {
        description: `Added ${selectedTagIds.length} tag(s) to ${selectedIds.size} records`,
      });
      setShowAddTagDialog(false);
      setSelectedIds(new Set());
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add tags');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedTagIds, selectedIds, router]);

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
      const response = await fetch('/api/crm/records/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_ids: Array.from(selectedIds),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete records');
      }

      const result = await response.json();
      toast.success(`Deleted ${result.deleted_count} records`);
      setShowDeleteDialog(false);
      setSelectedIds(new Set());
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete records');
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

    const rows = recordsToExport.map(record => {
      // Access record properties with proper typing
      const recordData = record as unknown as Record<string, unknown>;
      return visibleColumns.map(col => {
        // Try direct property first, then check data object
        const value = recordData[col] ?? (record.data as Record<string, unknown>)?.[col];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
      });
    });

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
    setVisibleColumns,
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
      <ModuleShellProvider value={shellContext}>
        <div
          className={cn(
            'relative',
            density === 'compact' && '[&_table_td]:py-1.5 [&_table_th]:py-2',
            density === 'comfortable' && '[&_table_td]:py-4 [&_table_th]:py-3'
          )}
        >
          {children}
        </div>
      </ModuleShellProvider>

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

      {/* Assign Owner Dialog */}
      <Dialog open={showAssignOwnerDialog} onOpenChange={setShowAssignOwnerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Owner</DialogTitle>
            <DialogDescription>
              Assign an owner to {selectedIds.size} selected {selectedIds.size === 1 ? 'record' : 'records'}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedOwnerId} onValueChange={setSelectedOwnerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.full_name || member.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignOwnerDialog(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={handleConfirmAssignOwner} disabled={isProcessing || !selectedOwnerId}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                'Assign Owner'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Tag Dialog */}
      <Dialog open={showAddTagDialog} onOpenChange={setShowAddTagDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Tags</DialogTitle>
            <DialogDescription>
              Add tags to {selectedIds.size} selected {selectedIds.size === 1 ? 'record' : 'records'}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Existing Tags */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Tags</label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      setSelectedTagIds((prev) =>
                        prev.includes(tag.id)
                          ? prev.filter((id) => id !== tag.id)
                          : [...prev, tag.id]
                      );
                    }}
                    className={cn(
                      'px-3 py-1 rounded-full text-sm font-medium transition-colors',
                      selectedTagIds.includes(tag.id)
                        ? 'bg-teal-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    )}
                    style={selectedTagIds.includes(tag.id) ? {} : { borderLeft: `3px solid ${tag.color}` }}
                  >
                    {tag.name}
                  </button>
                ))}
                {availableTags.length === 0 && (
                  <p className="text-sm text-slate-500">No tags yet. Create one below.</p>
                )}
              </div>
            </div>

            {/* Create New Tag */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Create New Tag</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter tag name..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateTag();
                    }
                  }}
                />
                <Button variant="outline" onClick={handleCreateTag} disabled={!newTagName.trim()}>
                  Add
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTagDialog(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={handleConfirmAddTag} disabled={isProcessing || selectedTagIds.length === 0}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding Tags...
                </>
              ) : (
                `Add ${selectedTagIds.length} Tag${selectedTagIds.length !== 1 ? 's' : ''}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import { useState, useCallback, useMemo, useEffect, useRef, memo } from 'react';
import { queuedSend } from '@/lib/offline/queued-send';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Combobox } from '@crm-eco/ui';
import type { ComboboxOption } from '@crm-eco/ui';
import { cn } from '@crm-eco/ui/lib/utils';
import { Loader2, Users, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ModuleHeader } from './ModuleHeader';
import { ViewsDropdown } from './ViewsDropdown';
import { FilterSidebarTrigger } from '@/components/crm/filters/FilterSidebarTrigger';
import { TerritoryFilter } from '@/components/crm/filters/TerritoryFilter';
import { FilterChipsBar } from './FilterChipsBar';
import { ColumnsButton } from './ColumnsButton';
import { DensityToggle } from './DensityToggle';
import { MassActionsBar } from './MassActionsBar';
import { ModuleShellProvider } from './ModuleShellContext';
import { RecentlyViewedRail } from '@/components/crm/records/v2/RecentlyViewedRail';
import { QuickFilterChips } from '@/components/crm/records/v2/QuickFilterChips';
import { ViewModeSwitcher } from '@/components/crm/views/ViewModeSwitcher';
import { SavedViewsBar } from '@/components/crm/views/SavedViewsBar';
import { MobileToolbarDrawer } from './MobileToolbarDrawer';
import { ModuleLiveSearchDropdown, type ModuleLiveSearchResult } from './ModuleLiveSearchDropdown';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { Density } from './ViewPreferencesContext';
import type { CrmModule, CrmField, CrmView, CrmRecord, CrmTerritory, ViewFilter, ViewMode } from '@/lib/crm/types';
import { CRM_SPOTLIGHT_SEARCH_LIMIT } from '@/lib/crm/search-limits';

export type RecordScope = 'all' | 'mine' | 'downline';

/** Validate parsed filter objects from URL to prevent malformed state */
function isValidFilter(f: unknown): f is ViewFilter {
  if (!f || typeof f !== 'object') return false;
  const obj = f as Record<string, unknown>;
  return typeof obj.field === 'string' && typeof obj.operator === 'string';
}

interface ModuleShellProps {
  module: CrmModule;
  records: CrmRecord[];
  fields: CrmField[];
  views: CrmView[];
  activeViewId?: string;
  totalCount: number;
  children: React.ReactNode;
  className?: string;
  userRole?: string | null;
  /** Available territories for territory filter dropdown */
  territories?: CrmTerritory[];
}

export const ModuleShell = memo(function ModuleShell({
  module,
  records,
  fields,
  views,
  activeViewId,
  totalCount,
  children,
  className,
  userRole,
  territories = [],
}: ModuleShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Local state
  const [viewMode, setViewMode] = useState<ViewMode>(
    (searchParams.get('viewMode') as ViewMode) || 'table'
  );
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  // Live smart-search dropdown — same /api/crm/search backend the header
  // uses, scoped to the current module so results don't leak across modules.
  const [liveResults, setLiveResults] = useState<ModuleLiveSearchResult[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);
  const [liveSelectedIdx, setLiveSelectedIdx] = useState(0);
  const liveAbortRef = useRef<AbortController | null>(null);
  const [scope, setScope] = useState<RecordScope>(
    (searchParams.get('scope') as RecordScope) || 'all'
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<ViewFilter[]>(() => {
    const filtersParam = searchParams.get('filters');
    if (filtersParam) {
      try {
        const parsed = JSON.parse(filtersParam);
        if (Array.isArray(parsed)) return parsed.filter(isValidFilter);
      } catch { /* ignore */ }
    }
    return [];
  });
  const [density, setDensity] = useState<Density>('default');
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    views.find(v => v.id === activeViewId)?.columns || fields.map(f => f.key)
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

  // Mobile: collapse the right-side toolbar cluster into a bottom sheet
  // and auto-swap the `table` view for `list` since tables are effectively
  // unreadable on phones.
  const isMobile = useIsMobile();
  const [mobileToolbarOpen, setMobileToolbarOpen] = useState(false);
  // On small screens, both table and split layouts are hard to use (split hides
  // the preview or makes rows untappable). Use list rows — they navigate on tap.
  const effectiveViewMode: ViewMode =
    isMobile && (viewMode === 'table' || viewMode === 'split') ? 'list' : viewMode;
  const mobileActiveCount =
    filters.length + (scope !== 'all' ? 1 : 0) + (searchQuery ? 1 : 0);

  const searchParamsRef = useRef(searchParams);

  // Keep searchParams ref updated without triggering effect
  useEffect(() => {
    searchParamsRef.current = searchParams;
  }, [searchParams]);

  // Sync viewMode from URL when navigation changes the query params
  // (e.g., clicking "By Agent" / "By Advisor" buttons in ModuleHeader)
  useEffect(() => {
    const urlViewMode = (searchParams.get('viewMode') as ViewMode) || 'table';
    setViewMode((prev) => (prev === urlViewMode ? prev : urlViewMode));
  }, [searchParams]);

  // Sync filter state from URL on browser back/forward navigation
  useEffect(() => {
    const filtersParam = searchParams.get('filters');
    if (filtersParam) {
      try {
        const parsed = JSON.parse(filtersParam);
        if (Array.isArray(parsed)) {
          setFilters(parsed.filter(isValidFilter));
          return;
        }
      } catch { /* ignore */ }
    }
    // No filters param in URL -- clear state if we had any
    setFilters((prev) => (prev.length === 0 ? prev : []));
  }, [searchParams]);

  /** Push current search box value to the URL if it differs (same logic as debounced + Enter submit). */
  const flushSearchToUrl = useCallback(() => {
    const params = new URLSearchParams(searchParamsRef.current.toString());
    const trimmed = searchQuery.trim();
    const urlSearch = (params.get('search') || '').trim();
    if (trimmed === urlSearch) {
      return;
    }
    if (trimmed) {
      params.set('search', trimmed);
    } else {
      params.delete('search');
    }
    params.delete('page');
    router.push(`/crm/modules/${module.key}?${params.toString()}`, { scroll: false });
  }, [searchQuery, router, module.key]);

  // Debounced live search — first keystroke must update the URL (do not skip initial effect).
  useEffect(() => {
    const timer = window.setTimeout(flushSearchToUrl, 300);
    return () => window.clearTimeout(timer);
  }, [flushSearchToUrl]);

  // Live smart-search dropdown — debounced fetch + AbortController, same
  // pattern as GlobalSearchOverlay so the toolbar feels identical to the
  // top-header spotlight.
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      liveAbortRef.current?.abort();
      setLiveResults([]);
      setLiveLoading(false);
      return;
    }

    liveAbortRef.current?.abort();
    const ctrl = new AbortController();
    liveAbortRef.current = ctrl;
    setLiveLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/crm/search?q=${encodeURIComponent(trimmed)}&module=${encodeURIComponent(module.key)}&limit=${CRM_SPOTLIGHT_SEARCH_LIMIT}`,
          { signal: ctrl.signal, credentials: 'same-origin' },
        );
        if (!res.ok) {
          if (!ctrl.signal.aborted) setLiveResults([]);
          return;
        }
        const payload = (await res.json()) as {
          results?: Array<{
            id: string;
            title: string;
            subtitle?: string;
            moduleKey: string;
            matchType?: 'exact' | 'fuzzy';
          }>;
        };
        if (!ctrl.signal.aborted) {
          setLiveResults(payload.results ?? []);
          setLiveSelectedIdx(0);
        }
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return;
        if (!ctrl.signal.aborted) setLiveResults([]);
      } finally {
        if (!ctrl.signal.aborted) setLiveLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [searchQuery, module.key]);

  // Scope change handler
  const handleScopeChange = useCallback((newScope: RecordScope) => {
    setScope(newScope);
    const params = new URLSearchParams(searchParamsRef.current.toString());
    if (newScope === 'all') {
      params.delete('scope');
    } else {
      params.set('scope', newScope);
    }
    params.delete('page');
    router.push(`/crm/modules/${module.key}?${params.toString()}`, { scroll: false });
  }, [router, module.key]);

  const isAdminOrOwner = userRole === 'owner' || userRole === 'admin' || userRole === 'staff';

  // Handlers
  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      // Enter should search immediately instead of waiting on the 300ms debounce.
      flushSearchToUrl();
    },
    [flushSearchToUrl],
  );

  // Persist filters to URL
  const pushFiltersToUrl = useCallback((newFilters: ViewFilter[]) => {
    const params = new URLSearchParams(searchParamsRef.current.toString());
    if (newFilters.length > 0) {
      params.set('filters', JSON.stringify(newFilters));
    } else {
      params.delete('filters');
    }
    params.delete('page');
    router.push(`/crm/modules/${module.key}?${params.toString()}`);
  }, [router, module.key]);

  const handleRemoveFilter = useCallback((index: number) => {
    setFilters(prev => {
      const next = prev.filter((_, i) => i !== index);
      pushFiltersToUrl(next);
      return next;
    });
  }, [pushFiltersToUrl]);

  // Toggle a quick-filter preset: merges/removes its filters and (if set)
  // updates the URL scope so the state survives a page reload.
  const handleQuickPreset = useCallback(
    (
      preset: {
        filters: ViewFilter[];
        scope?: RecordScope;
      },
      active: boolean,
    ) => {
      setFilters((prev) => {
        let next: ViewFilter[];
        if (active) {
          // Remove this preset's filters (matched by field+operator).
          next = prev.filter(
            (f) =>
              !preset.filters.some(
                (p) => p.field === f.field && p.operator === f.operator,
              ),
          );
        } else {
          // Replace any matching filters, then append the missing ones.
          const withoutOverlap = prev.filter(
            (f) =>
              !preset.filters.some(
                (p) => p.field === f.field && p.operator === f.operator,
              ),
          );
          next = [...withoutOverlap, ...preset.filters];
        }
        pushFiltersToUrl(next);
        return next;
      });
      if (preset.scope) {
        handleScopeChange(active ? 'all' : preset.scope);
      }
    },
    [pushFiltersToUrl, handleScopeChange],
  );

  const handleClearFilters = useCallback(() => {
    setFilters([]);
    pushFiltersToUrl([]);
  }, [pushFiltersToUrl]);

  const handleSortChange = useCallback((field: string, direction: 'asc' | 'desc') => {
    setSortField(field);
    setSortDirection(direction);

    // Apply sort to URL query params (use ref to avoid stale closure)
    const params = new URLSearchParams(searchParamsRef.current.toString());
    params.set('sortField', field);
    params.set('sortDirection', direction);
    params.delete('page');
    router.push(`/crm/modules/${module.key}?${params.toString()}`);
  }, [router, module.key]);

  /**
   * Select every record matching the current list-page filter state, across
   * pagination boundaries. Uses the dedicated IDs-only endpoint so we don't
   * pull full rows; capped at 5k by the server.
   */
  const handleSelectAll = useCallback(async () => {
    // Fast path — if everything the user could see is already loaded (single
    // page), just select them client-side without a round trip.
    if (records.length >= totalCount) {
      setSelectedIds(new Set(records.map((r) => r.id)));
      return;
    }

    const params = new URLSearchParams();
    params.set('module_key', module.key);
    const search = searchParamsRef.current.get('search');
    if (search) params.set('search', search);
    const advisorId = searchParamsRef.current.get('advisor_id');
    if (advisorId) params.set('advisor_id', advisorId);
    const includeDownline = searchParamsRef.current.get('include_downline');
    if (includeDownline) params.set('include_downline', includeDownline);
    const contactType = searchParamsRef.current.get('contact_type');
    if (contactType) params.set('contact_type', contactType);
    const groupId = searchParamsRef.current.get('group_id');
    if (groupId) params.set('group_id', groupId);

    try {
      const res = await fetch(`/api/crm/records/ids?${params.toString()}`, {
        credentials: 'same-origin',
      });
      if (!res.ok) {
        toast.error('Failed to select all records');
        return;
      }
      const body = (await res.json()) as {
        ids: string[];
        total: number;
        capped: boolean;
      };
      setSelectedIds(new Set(body.ids));
      if (body.capped) {
        toast.warning(
          `Selected first ${body.ids.length.toLocaleString()} of ${body.total.toLocaleString()} matches`,
          { description: 'Narrow your filters to act on all rows.' },
        );
      } else {
        toast.success(`Selected ${body.ids.length.toLocaleString()} records`);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to select all records',
      );
    }
  }, [records, totalCount, module.key]);

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

  /**
   * Render a toast that honors the partial-failure shape returned by
   * `/api/crm/records/bulk`. If every requested row came back in
   * `updated_ids`, this looks like a normal success toast. If some were
   * skipped (RLS / wrong org / deleted) or failed, we surface the counts
   * and escalate to `warning` / `error` accordingly.
   */
  const reportBulkResult = useCallback(
    (
      result: {
        updated_ids?: string[];
        deleted_ids?: string[];
        skipped_ids?: string[];
        failed?: Array<{ id: string; reason: string }>;
      },
      successTitle: string,
      unit = 'record',
    ) => {
      const changed = (result.updated_ids ?? result.deleted_ids ?? []).length;
      const skipped = (result.skipped_ids ?? []).length;
      const failed = (result.failed ?? []).length;
      const unitPlural = changed === 1 ? unit : `${unit}s`;
      const parts: string[] = [`${changed} ${unitPlural}`];
      if (skipped > 0) parts.push(`${skipped} skipped`);
      if (failed > 0) parts.push(`${failed} failed`);
      const desc = parts.join(' · ');
      if (failed > 0) {
        toast.error(successTitle, { description: desc });
      } else if (skipped > 0) {
        toast.warning(successTitle, {
          description: `${desc} — skipped rows may be in another org or deleted.`,
        });
      } else {
        toast.success(successTitle, { description: desc });
      }
    },
    [],
  );

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
    const count = selectedIds.size;
    const sendResult = await queuedSend({
      method: 'PATCH',
      url: '/api/crm/records/bulk',
      body: {
        record_ids: Array.from(selectedIds),
        module_id: module.id,
        updates: { owner_id: selectedOwnerId === '__unassigned__' ? null : selectedOwnerId },
      },
      queue: {
        label:
          selectedOwnerId === '__unassigned__'
            ? `Clear owner on ${count} record${count === 1 ? '' : 's'}`
            : `Assign owner to ${count} record${count === 1 ? '' : 's'}`,
        moduleKey: module.key,
      },
    });
    setIsProcessing(false);

    if (sendResult.ok) {
      const result = await sendResult.response.json();
      reportBulkResult(
        result,
        selectedOwnerId === '__unassigned__' ? 'Owner cleared' : 'Owner assigned',
      );
      setShowAssignOwnerDialog(false);
      setSelectedIds(new Set());
      router.refresh();
    } else if (sendResult.queued) {
      toast.info(
        `Queued for ${count} record${count === 1 ? '' : 's'} — will sync when reconnected`,
      );
      setShowAssignOwnerDialog(false);
      setSelectedIds(new Set());
    } else {
      toast.error(sendResult.error || 'Failed to assign owner');
    }
  }, [selectedOwnerId, selectedIds, router, reportBulkResult, module.key, module.id]);

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
    const count = selectedIds.size;
    const sendResult = await queuedSend({
      method: 'PATCH',
      url: '/api/crm/records/bulk',
      body: {
        record_ids: Array.from(selectedIds),
        module_id: module.id,
        updates: { status: selectedStatus },
      },
      queue: {
        label: `Status → "${selectedStatus}" on ${count} record${count === 1 ? '' : 's'}`,
        moduleKey: module.key,
      },
    });
    setIsProcessing(false);

    if (sendResult.ok) {
      const result = await sendResult.response.json();
      reportBulkResult(result, `Status → "${selectedStatus}"`);
      setShowStatusDialog(false);
      setSelectedIds(new Set());
      router.refresh();
    } else if (sendResult.queued) {
      toast.info(
        `Queued for ${count} record${count === 1 ? '' : 's'} — will sync when reconnected`,
      );
      setShowStatusDialog(false);
      setSelectedIds(new Set());
    } else {
      toast.error(sendResult.error || 'Failed to update status');
    }
  }, [selectedStatus, selectedIds, router, reportBulkResult, module.key, module.id]);

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
    const count = selectedIds.size;
    const sendResult = await queuedSend({
      method: 'PATCH',
      url: '/api/crm/records/bulk',
      body: {
        record_ids: Array.from(selectedIds),
        module_id: module.id,
        updates: { stage: selectedStage },
      },
      queue: {
        label: `Stage → "${selectedStage}" on ${count} deal${count === 1 ? '' : 's'}`,
        moduleKey: module.key,
      },
    });
    setIsProcessing(false);

    if (sendResult.ok) {
      const result = await sendResult.response.json();
      reportBulkResult(result, `Stage → "${selectedStage}"`, 'deal');
      setShowStageDialog(false);
      setSelectedIds(new Set());
      router.refresh();
    } else if (sendResult.queued) {
      toast.info(
        `Queued for ${count} deal${count === 1 ? '' : 's'} — will sync when reconnected`,
      );
      setShowStageDialog(false);
      setSelectedIds(new Set());
    } else {
      toast.error(sendResult.error || 'Failed to update stage');
    }
  }, [selectedStage, selectedIds, router, reportBulkResult, module.key, module.id]);

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
    const count = selectedIds.size;
    const sendResult = await queuedSend({
      method: 'DELETE',
      url: '/api/crm/records/bulk',
      body: { record_ids: Array.from(selectedIds), module_id: module.id },
      queue: {
        label: `Delete ${count} record${count === 1 ? '' : 's'}`,
        moduleKey: module.key,
      },
    });
    setIsProcessing(false);

    if (sendResult.ok) {
      const result = await sendResult.response.json();
      reportBulkResult(result, 'Records deleted');
      setShowDeleteDialog(false);
      setSelectedIds(new Set());
      router.refresh();
    } else if (sendResult.queued) {
      toast.info(
        `Queued delete for ${count} record${count === 1 ? '' : 's'} — will sync when reconnected`,
      );
      setShowDeleteDialog(false);
      setSelectedIds(new Set());
    } else {
      toast.error(sendResult.error || 'Failed to delete records');
    }
  }, [selectedIds, router, reportBulkResult, module.key, module.id]);

  const handleExport = useCallback(async () => {
    if (selectedCount > 0) {
      const recordsToExport = records.filter((r) => selectedIds.has(r.id));
      if (recordsToExport.length === 0) {
        toast.error('No records to export');
        return;
      }

      const headers = visibleColumns.map((col) => {
        const field = fields.find((f) => f.key === col);
        return field?.label || col;
      });

      const rows = recordsToExport.map((record) => {
        const recordData = record as unknown as Record<string, unknown>;
        return visibleColumns.map((col) => {
          const value = recordData[col] ?? (record.data as Record<string, unknown>)?.[col];
          if (value === null || value === undefined) return '';
          if (typeof value === 'object') return JSON.stringify(value);
          return String(value);
        });
      });

      const csvContent = [
        headers.join(','),
        ...rows.map((row) =>
          row
            .map((cell) => {
              const str = String(cell);
              if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
              }
              return str;
            })
            .join(','),
        ),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${module.key}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${recordsToExport.length} selected ${module.name_plural || 'records'}`);
      return;
    }

    if (totalCount === 0) {
      toast.error('No records to export');
      return;
    }

    const params = new URLSearchParams();
    params.set('module_key', module.key);

    const validFilters = filters.filter(isValidFilter);
    if (validFilters.length > 0) {
      params.set('filters', JSON.stringify(validFilters));
    } else if (activeViewId) {
      params.set('view', activeViewId);
    }

    if (searchQuery.trim()) {
      params.set('search', searchQuery.trim());
    }
    if (scope !== 'all') {
      params.set('scope', scope);
    }

    const territory = searchParamsRef.current.get('territory');
    if (territory) {
      params.set('territory', territory);
    }

    if (sortField) {
      params.set('sortField', sortField);
      params.set('sortDirection', sortDirection);
    }

    params.set('columns', visibleColumns.join(','));

    const toastId = 'crm-export-csv';
    toast.loading('Building CSV…', { id: toastId });
    try {
      const res = await fetch(`/api/crm/records/export-csv?${params.toString()}`);
      if (!res.ok) {
        const errBody = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(errBody?.error || `Export failed (${res.status})`);
      }

      const blob = await res.blob();
      const dlUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const cd = res.headers.get('Content-Disposition');
      let fname = `${module.key}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      const m = cd?.match(/filename="([^"]+)"/);
      if (m?.[1]) {
        fname = m[1];
      }
      link.setAttribute('href', dlUrl);
      link.setAttribute('download', fname);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(dlUrl);

      toast.success(`Exported all matching ${module.name_plural || 'records'}`, {
        id: toastId,
        description: 'Same filters and sort as this list (up to 100k rows).',
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed', { id: toastId });
    }
  }, [
    selectedCount,
    selectedIds,
    records,
    visibleColumns,
    fields,
    module,
    totalCount,
    filters,
    activeViewId,
    searchQuery,
    scope,
    sortField,
    sortDirection,
  ]);

  const handleCreateView = useCallback(() => {
    const viewName = prompt('Enter a name for the new view:');
    if (!viewName?.trim()) return;
    // Navigate to create view with the name pre-filled
    const params = new URLSearchParams({ name: viewName.trim() });
    window.location.href = `/crm/modules/${module.key}/views/new?${params.toString()}`;
  }, [module.key]);

  const handleSaveView = useCallback((name: string, viewFilters: ViewFilter[]) => {
    toast.success(`View "${name}" saved`, {
      description: `${viewFilters.length} filters applied`,
    });
  }, []);

  // View mode change handler - also persists to URL
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    const params = new URLSearchParams(searchParamsRef.current.toString());
    if (mode === 'table') {
      params.delete('viewMode');
    } else {
      params.set('viewMode', mode);
    }
    // Clean up tree-specific params when switching away from tree view
    if (mode !== 'tree') {
      params.delete('treeGroupBy');
    }
    router.push(`/crm/modules/${module.key}?${params.toString()}`);
  }, [router, module.key]);

  // Context for child components — expose the *effective* view mode so
  // children render the list card view on phones even when the user's
  // saved preference is `table`. The user's choice is preserved in URL
  // state and restored when they resize back to desktop.
  const shellContext = useMemo(() => ({
    selectedIds,
    setSelectedIds,
    density,
    visibleColumns,
    setVisibleColumns,
    sortField,
    sortDirection,
    handleSortChange,
    moduleKey: module.key,
    viewMode: effectiveViewMode,
    setViewMode: handleViewModeChange,
  }), [selectedIds, density, visibleColumns, sortField, sortDirection, handleSortChange, module.key, effectiveViewMode, handleViewModeChange]);

  return (
    <div className={cn('w-full space-y-4', className)}>
      {/* Header */}
      <ModuleHeader
        module={module}
        totalCount={totalCount}
        onExport={handleExport}
      />

      {/* Recently viewed rail — auto-hides when the user has no history */}
      <RecentlyViewedRail moduleKey={module.key} />

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

            <ModuleLiveSearchDropdown
              open={liveOpen}
              onOpenChange={setLiveOpen}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              onSubmit={handleSearch}
              placeholder={`Search ${module.name_plural?.toLowerCase() || 'records'}...`}
              results={liveResults}
              loading={liveLoading}
              selectedIndex={liveSelectedIdx}
              onSelectedIndexChange={setLiveSelectedIdx}
              onSelectResult={(target) => {
                setLiveOpen(false);
                router.push(`/crm/r/${target.id}`);
              }}
              onKeyDown={(e) => {
                if (!liveOpen || liveResults.length === 0) return;
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setLiveSelectedIdx((i) => Math.min(i + 1, liveResults.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setLiveSelectedIdx((i) => Math.max(i - 1, 0));
                } else if (e.key === 'Enter' && liveResults[liveSelectedIdx]) {
                  e.preventDefault();
                  const target = liveResults[liveSelectedIdx];
                  setLiveOpen(false);
                  router.push(`/crm/r/${target.id}`);
                } else if (e.key === 'Escape') {
                  setLiveOpen(false);
                }
              }}
            />
          </div>

          {/* Scope + Territory Filters (hidden on mobile — lives in the sheet) */}
          <div className="hidden md:flex items-center gap-2">
            <Select value={scope} onValueChange={(v) => handleScopeChange(v as RecordScope)}>
              <SelectTrigger className="h-9 w-[150px] text-sm rounded-lg bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10">
                <Users className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {isAdminOrOwner && (
                  <SelectItem value="all">All Records</SelectItem>
                )}
                <SelectItem value="mine">My Records</SelectItem>
                <SelectItem value="downline">My Downline</SelectItem>
              </SelectContent>
            </Select>

            {territories.length > 0 && (
              <TerritoryFilter territories={territories} moduleKey={module.key} />
            )}
          </div>

          {/* Right: View Mode + Filters + Columns + Density — collapsed
              behind a single "Filters & View" button on mobile, which
              opens MobileToolbarDrawer. */}
          <div className="hidden md:flex items-center gap-2">
            <ViewModeSwitcher
              value={viewMode}
              onChange={handleViewModeChange}
            />

            <div className="w-px h-6 bg-slate-200 dark:bg-white/10" />

            <FilterSidebarTrigger
              fields={fields}
              filters={filters}
              onFiltersChange={(newFilters) => {
                setFilters(newFilters);
                pushFiltersToUrl(newFilters);
              }}
            />

            {(viewMode === 'table' || viewMode === 'split') && (
              <>
                <ColumnsButton
                  fields={fields}
                  visibleColumns={visibleColumns}
                  onColumnsChange={setVisibleColumns}
                />

                <DensityToggle
                  value={density}
                  onChange={setDensity}
                />
              </>
            )}
          </div>

          {/* Mobile-only single "Filters & View" trigger. Active count
              pill mirrors the badge inside the sheet so users can see
              at a glance whether filters are applied. */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMobileToolbarOpen(true)}
            className="md:hidden h-9 px-3 gap-1.5 rounded-lg bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="text-sm">Filters & View</span>
            {mobileActiveCount > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-teal-500 text-white text-[10px] font-bold">
                {mobileActiveCount}
              </span>
            )}
          </Button>
        </div>

        {/* Saved Views Bar + Quick Preset Chips */}
        <div className="px-1 flex items-center gap-3 flex-wrap">
          <SavedViewsBar
            pageKey={module.key}
            currentFilters={filters}
            currentViewState={{
              sort: { field: sortField, direction: sortDirection },
              columns: visibleColumns,
              scope,
              viewMode,
              search: searchQuery,
            }}
            onApplyView={(newFilters) => {
              setFilters(newFilters as ViewFilter[]);
              pushFiltersToUrl(newFilters as ViewFilter[]);
            }}
            onApplyViewState={(state) => {
              // Rehydrate every piece of list UI from the saved blob. We
              // push one combined URL update so the history entry reflects
              // the applied view as a single step. SavedViewsBar declares
              // a loose ViewFilter with `operator: string`; cast back to
              // the module's narrower FilterOperator-backed type.
              const next = (state.filters ?? []) as ViewFilter[];
              setFilters(next);
              if (state.columns) setVisibleColumns(state.columns);
              if (state.sort?.field) {
                setSortField(state.sort.field);
                setSortDirection(state.sort.direction ?? 'asc');
              }
              if (state.viewMode) {
                setViewMode(state.viewMode as ViewMode);
              }
              if (state.scope) setScope(state.scope);
              if (typeof state.search === 'string') setSearchQuery(state.search);

              const params = new URLSearchParams(
                searchParamsRef.current.toString(),
              );
              if (next.length > 0) params.set('filters', JSON.stringify(next));
              else params.delete('filters');
              if (state.sort?.field) {
                params.set('sortField', state.sort.field);
                params.set('sortDirection', state.sort.direction ?? 'asc');
              } else {
                params.delete('sortField');
                params.delete('sortDirection');
              }
              if (state.scope && state.scope !== 'all') params.set('scope', state.scope);
              else params.delete('scope');
              if (state.viewMode) params.set('viewMode', state.viewMode);
              else params.delete('viewMode');
              if (state.search) params.set('search', state.search);
              else params.delete('search');
              params.delete('page');
              router.push(`/crm/modules/${module.key}?${params.toString()}`);
            }}
          />
          <QuickFilterChips
            currentFilters={filters}
            currentScope={scope}
            onApplyPreset={(preset, active) =>
              handleQuickPreset(
                { filters: preset.filters, scope: preset.scope },
                active,
              )
            }
          />
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
            {(() => {
              const ownerOptions: ComboboxOption[] = [
                { value: '__unassigned__', label: 'Unassigned', subtext: 'Clear owner assignment' },
                ...teamMembers.map((m) => ({
                  value: m.id,
                  label: m.full_name || m.email,
                  subtext: m.full_name ? m.email : undefined,
                })),
              ];
              return (
                <Combobox
                  options={ownerOptions}
                  value={selectedOwnerId}
                  onValueChange={setSelectedOwnerId}
                  placeholder="Choose an Advisor / Agent"
                  searchPlaceholder="Search by name..."
                  emptyText="No team members found."
                  clearable
                />
              );
            })()}
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
                'Assign'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile-only "Filters & View" bottom sheet — re-uses every
          control from the desktop toolbar so there's exactly one source
          of state, just a different presentation. Opens via the compact
          trigger rendered above. */}
      <MobileToolbarDrawer
        open={mobileToolbarOpen}
        onOpenChange={setMobileToolbarOpen}
        activeCount={mobileActiveCount}
        sections={[
          {
            id: 'viewmode',
            label: 'View mode',
            content: (
              <ViewModeSwitcher
                value={viewMode}
                onChange={(m) => {
                  handleViewModeChange(m);
                  setMobileToolbarOpen(false);
                }}
              />
            ),
          },
          {
            id: 'scope',
            label: 'Record scope',
            content: (
              <Select value={scope} onValueChange={(v) => handleScopeChange(v as RecordScope)}>
                <SelectTrigger className="h-10 w-full rounded-lg bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10">
                  <Users className="w-4 h-4 mr-1.5 text-slate-400" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isAdminOrOwner && <SelectItem value="all">All Records</SelectItem>}
                  <SelectItem value="mine">My Records</SelectItem>
                  <SelectItem value="downline">My Downline</SelectItem>
                </SelectContent>
              </Select>
            ),
          },
          ...(territories.length > 0
            ? [
                {
                  id: 'territory',
                  label: 'Territory',
                  content: (
                    <TerritoryFilter territories={territories} moduleKey={module.key} />
                  ),
                },
              ]
            : []),
          {
            id: 'filters',
            label: 'Advanced filters',
            content: (
              <FilterSidebarTrigger
                fields={fields}
                filters={filters}
                onFiltersChange={(newFilters) => {
                  setFilters(newFilters);
                  pushFiltersToUrl(newFilters);
                }}
              />
            ),
          },
          ...(viewMode === 'table' || viewMode === 'split'
            ? [
                {
                  id: 'columns',
                  label: 'Columns',
                  content: (
                    <ColumnsButton
                      fields={fields}
                      visibleColumns={visibleColumns}
                      onColumnsChange={setVisibleColumns}
                    />
                  ),
                },
                {
                  id: 'density',
                  label: 'Row density',
                  content: <DensityToggle value={density} onChange={setDensity} />,
                },
              ]
            : []),
        ]}
      />

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
});

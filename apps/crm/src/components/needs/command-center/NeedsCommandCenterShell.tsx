'use client';

import { useState, useMemo, useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  HeartPulse,
  CalendarDays,
  CalendarClock,
  LayoutGrid,
  Save,
  Bookmark,
  ChevronDown,
  Star,
  Trash2,
  Loader2,
} from 'lucide-react';
import { startOfWeek, subDays, startOfDay } from 'date-fns';
import {
  type NeedStatus,
  getUrgencyLabelCRM,
  OPEN_NEED_STATUSES,
  type NeedsCommandCenterSavedView,
  type NeedsCommandCenterSavedFilters,
} from '@crm-eco/lib';
import { NeedsFiltersBar, type SlaFilter } from './NeedsFiltersBar';
import { NeedsTable, type NeedWithMember } from './NeedsTable';
import { WorkloadPanel } from './WorkloadPanel';
import type { WorkloadBucket, AssignableProfile } from '@/app/(dashboard)/needs/command-center/page';
import {
  createNeedsSavedView,
  setNeedsSavedViewDefault,
  deleteNeedsSavedView,
  clearNeedsSavedViewDefault,
} from '@/app/(dashboard)/needs/command-center/actions';

interface SlaCounts {
  overdue: number;
  atRisk: number;
  onTrack: number;
}

// Saved view keys (built-in presets)
export type SavedViewKey = 'all' | 'today_overdue' | 'new_this_week' | 'new_last_7_days';

interface NeedsCommandCenterShellProps {
  needs: NeedWithMember[];
  slaCounts: SlaCounts;
  workload: WorkloadBucket[];
  assignableProfiles: AssignableProfile[];
  currentProfileId: string;
  savedViews: NeedsCommandCenterSavedView[];
  defaultSavedViewId: string | null;
}

export function NeedsCommandCenterShell({ 
  needs, 
  slaCounts, 
  workload,
  assignableProfiles,
  currentProfileId,
  savedViews,
  defaultSavedViewId,
}: NeedsCommandCenterShellProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  
  // Filter state
  const [selectedSlaFilter, setSelectedSlaFilter] = useState<SlaFilter>('all');
  const [selectedStatuses, setSelectedStatuses] = useState<NeedStatus[]>([]);
  const [search, setSearch] = useState('');
  
  // Saved view state (built-in presets)
  const [savedView, setSavedView] = useState<SavedViewKey>('all');
  
  // Assignee filter state
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | 'all'>('all');
  
  // Personal saved view state
  const [activeSavedViewId, setActiveSavedViewId] = useState<string | null>(null);
  const hasAppliedDefaultRef = useRef(false);
  
  // Save View Dialog state
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Apply default saved view on initial load
  useEffect(() => {
    if (hasAppliedDefaultRef.current) return;
    if (!defaultSavedViewId) return;
    
    const defaultView = savedViews.find(v => v.id === defaultSavedViewId);
    if (!defaultView) return;
    
    applySavedFiltersToState(defaultView.filters);
    setActiveSavedViewId(defaultView.id);
    hasAppliedDefaultRef.current = true;
  }, [defaultSavedViewId, savedViews]);
  
  /**
   * Apply a saved view's filters to local state
   */
  function applySavedFiltersToState(filters: NeedsCommandCenterSavedFilters) {
    setSavedView(filters.savedView ?? 'all');
    setSelectedSlaFilter(filters.selectedSlaFilter ?? 'all');
    setSelectedStatuses((filters.selectedStatuses ?? []) as NeedStatus[]);
    setSearch(filters.search ?? '');
    setSelectedAssigneeId(filters.selectedAssigneeId ?? 'all');
  }
  
  /**
   * Build current filters as a saveable object
   */
  function buildCurrentFilters(): NeedsCommandCenterSavedFilters {
    return {
      savedView,
      selectedSlaFilter,
      selectedStatuses,
      search,
      selectedAssigneeId,
    };
  }
  
  /**
   * Handle applying a personal saved view
   */
  function handleApplyPersonalSavedView(viewId: string) {
    const view = savedViews.find(v => v.id === viewId);
    if (!view) return;
    
    applySavedFiltersToState(view.filters);
    setActiveSavedViewId(view.id);
  }
  
  /**
   * Handle saving current filters as a new view
   */
  function handleSaveView() {
    if (!newViewName.trim()) {
      setSaveError('Please enter a view name');
      return;
    }
    
    const filters = buildCurrentFilters();
    startTransition(async () => {
      const result = await createNeedsSavedView({
        name: newViewName.trim(),
        filters,
        setAsDefault,
      });
      
      if (!result.success) {
        setSaveError(result.error || 'Failed to save view');
      } else {
        setIsSaveDialogOpen(false);
        setNewViewName('');
        setSetAsDefault(false);
        setSaveError(null);
        if (result.viewId) {
          setActiveSavedViewId(result.viewId);
        }
        router.refresh();
      }
    });
  }
  
  /**
   * Handle setting a view as default
   */
  function handleSetDefault(viewId: string) {
    startTransition(async () => {
      const result = await setNeedsSavedViewDefault(viewId);
      if (result.success) {
        router.refresh();
      }
    });
  }
  
  /**
   * Handle clearing default view
   */
  function handleClearDefault() {
    startTransition(async () => {
      const result = await clearNeedsSavedViewDefault();
      if (result.success) {
        router.refresh();
      }
    });
  }
  
  /**
   * Handle deleting a saved view
   */
  function handleDeleteView(viewId: string) {
    startTransition(async () => {
      const result = await deleteNeedsSavedView(viewId);
      if (result.success) {
        if (activeSavedViewId === viewId) {
          setActiveSavedViewId(null);
        }
        router.refresh();
      }
    });
  }

  // Filter needs based on current filters
  const filteredNeeds = useMemo(() => {
    let filtered = [...needs];
    
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
    const sevenDaysAgo = subDays(todayStart, 7);

    // Apply saved view filter first
    switch (savedView) {
      case 'today_overdue':
        filtered = filtered.filter(n => {
          return (
            n.urgency_light === 'red' &&
            OPEN_NEED_STATUSES.includes(n.status)
          );
        });
        break;
      case 'new_this_week':
        filtered = filtered.filter(n => {
          const createdAt = new Date(n.created_at);
          return createdAt >= weekStart && createdAt <= now;
        });
        break;
      case 'new_last_7_days':
        filtered = filtered.filter(n => {
          const createdAt = new Date(n.created_at);
          return createdAt >= sevenDaysAgo && createdAt <= now;
        });
        break;
      case 'all':
      default:
        // no extra filter
        break;
    }

    // SLA filter
    if (selectedSlaFilter !== 'all') {
      filtered = filtered.filter(need => need.urgency_light === selectedSlaFilter);
    }

    // Status filter
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(need => selectedStatuses.includes(need.status));
    }

    // Assignee filter
    if (selectedAssigneeId !== 'all') {
      filtered = filtered.filter(need => 
        (need.assigned_to_profile_id ?? 'unassigned') === selectedAssigneeId
      );
    }

    // Search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(need => {
        const memberName = `${need.member_first_name || ''} ${need.member_last_name || ''}`.toLowerCase();
        const needType = need.need_type.toLowerCase();
        const description = (need.description || '').toLowerCase();
        const assigneeName = (need.assigned_to_name || '').toLowerCase();
        
        return memberName.includes(searchLower) || 
               needType.includes(searchLower) || 
               description.includes(searchLower) ||
               assigneeName.includes(searchLower);
      });
    }

    return filtered;
  }, [needs, savedView, selectedSlaFilter, selectedStatuses, selectedAssigneeId, search]);

  // Handle saved view change (built-in presets)
  const handleSavedViewChange = (view: SavedViewKey) => {
    setSavedView(view);
    setActiveSavedViewId(null); // Clear personal view when switching to built-in
    // Reset other filters when changing saved view (optional, keeps it clean)
    if (view !== 'all') {
      setSelectedSlaFilter('all');
      setSelectedStatuses([]);
    }
  };

  // Built-in saved views configuration
  const builtInViews: { key: SavedViewKey; label: string; icon: React.ElementType }[] = [
    { key: 'all', label: 'All Needs', icon: LayoutGrid },
    { key: 'today_overdue', label: "Today's Overdue", icon: AlertTriangle },
    { key: 'new_this_week', label: 'New This Week', icon: CalendarDays },
    { key: 'new_last_7_days', label: 'Last 7 Days', icon: CalendarClock },
  ];
  
  // Find active personal view name (if any)
  const activePersonalView = savedViews.find(v => v.id === activeSavedViewId);
  const defaultView = savedViews.find(v => v.is_default);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Needs Command Center</h1>
          <p className="text-slate-500 mt-1">
            SLA-driven queue for Needs and sharing operations
          </p>
        </div>
        
        {/* My Views & Save View */}
        <div className="flex items-center gap-2">
          {/* My Views Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" disabled={isPending}>
                <Bookmark className="w-4 h-4" />
                <span>
                  {activePersonalView ? activePersonalView.name : 'My Views'}
                </span>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Personal Views</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {savedViews.length === 0 ? (
                <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                  No saved views yet.
                  <br />
                  Save your current filters to create one.
                </div>
              ) : (
                savedViews.map((view) => (
                  <DropdownMenuItem
                    key={view.id}
                    onClick={() => handleApplyPersonalSavedView(view.id)}
                    className="flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      {view.is_default && (
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      )}
                      <span className={activeSavedViewId === view.id ? 'font-medium' : ''}>
                        {view.name}
                      </span>
                    </span>
                  </DropdownMenuItem>
                ))
              )}
              
              {savedViews.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Manage
                  </DropdownMenuLabel>
                  
                  {activeSavedViewId && (
                    <>
                      <DropdownMenuItem
                        onClick={() => handleSetDefault(activeSavedViewId)}
                        disabled={isPending || activePersonalView?.is_default}
                      >
                        <Star className="w-4 h-4 mr-2" />
                        {activePersonalView?.is_default ? 'Default view' : 'Set as default'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteView(activeSavedViewId)}
                        disabled={isPending}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete view
                      </DropdownMenuItem>
                    </>
                  )}
                  
                  {defaultView && (
                    <DropdownMenuItem
                      onClick={handleClearDefault}
                      disabled={isPending}
                    >
                      Clear default
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Save View Button */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setIsSaveDialogOpen(true)}
            disabled={isPending}
          >
            <Save className="w-4 h-4" />
            <span>Save View</span>
          </Button>
        </div>
      </div>

      {/* Saved Views Row (Built-in Presets) */}
      <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg w-fit">
        {builtInViews.map((view) => {
          const Icon = view.icon;
          const isActive = savedView === view.key && !activeSavedViewId;
          return (
            <button
              key={view.key}
              onClick={() => handleSavedViewChange(view.key)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${isActive 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-200'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              <span>{view.label}</span>
            </button>
          );
        })}
      </div>
      
      {/* Save View Dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Current Filters</DialogTitle>
            <DialogDescription>
              Save your current filters as a personal view for quick access.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="view-name" className="text-sm font-medium">
                View Name
              </label>
              <Input
                id="view-name"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="e.g., My high-priority queue"
                disabled={isPending}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Checkbox
                id="set-default"
                checked={setAsDefault}
                onCheckedChange={(checked) => setSetAsDefault(Boolean(checked))}
                disabled={isPending}
              />
              <label htmlFor="set-default" className="text-sm text-muted-foreground">
                Set as my default view
              </label>
            </div>
            
            {saveError && (
              <p className="text-sm text-red-600">{saveError}</p>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsSaveDialogOpen(false);
                setNewViewName('');
                setSetAsDefault(false);
                setSaveError(null);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveView} disabled={isPending || !newViewName.trim()}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SLA Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard
          label="Total Needs"
          count={needs.length}
          icon={HeartPulse}
          colorClass="border-l-blue-500"
          iconColorClass="text-blue-500"
          onClick={() => setSelectedSlaFilter('all')}
          isActive={selectedSlaFilter === 'all'}
        />
        <SummaryCard
          label={getUrgencyLabelCRM('green')}
          count={slaCounts.onTrack}
          icon={CheckCircle}
          colorClass="border-l-emerald-500"
          iconColorClass="text-emerald-500"
          onClick={() => setSelectedSlaFilter('green')}
          isActive={selectedSlaFilter === 'green'}
        />
        <SummaryCard
          label={getUrgencyLabelCRM('orange')}
          count={slaCounts.atRisk}
          icon={Clock}
          colorClass="border-l-amber-500"
          iconColorClass="text-amber-500"
          onClick={() => setSelectedSlaFilter('orange')}
          isActive={selectedSlaFilter === 'orange'}
        />
        <SummaryCard
          label={getUrgencyLabelCRM('red')}
          count={slaCounts.overdue}
          icon={AlertTriangle}
          colorClass="border-l-red-500"
          iconColorClass="text-red-500"
          onClick={() => setSelectedSlaFilter('red')}
          isActive={selectedSlaFilter === 'red'}
        />
      </div>

      {/* Workload Panel */}
      <WorkloadPanel 
        workload={workload}
        selectedAssigneeId={selectedAssigneeId}
        onSelectAssignee={setSelectedAssigneeId}
      />

      {/* Filters */}
      <NeedsFiltersBar
        selectedSlaFilter={selectedSlaFilter}
        onChangeSlaFilter={setSelectedSlaFilter}
        selectedStatuses={selectedStatuses}
        onChangeStatuses={setSelectedStatuses}
        search={search}
        onSearchChange={setSearch}
      />

      {/* Results count */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">
          Showing {filteredNeeds.length} of {needs.length} needs
          {selectedAssigneeId !== 'all' && (
            <span className="ml-2 text-blue-600">
              (filtered by assignee)
            </span>
          )}
        </div>
        {(savedView !== 'all' || selectedAssigneeId !== 'all') && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              setSavedView('all');
              setSelectedAssigneeId('all');
              setSelectedSlaFilter('all');
              setSelectedStatuses([]);
              setSearch('');
            }}
          >
            Reset all filters
          </Button>
        )}
      </div>

      {/* Needs Table */}
      <NeedsTable 
        needs={filteredNeeds} 
        assignableProfiles={assignableProfiles}
        currentProfileId={currentProfileId}
      />
    </div>
  );
}

// Summary Card Component
interface SummaryCardProps {
  label: string;
  count: number;
  icon: React.ElementType;
  colorClass: string;
  iconColorClass: string;
  onClick: () => void;
  isActive: boolean;
}

function SummaryCard({ 
  label, 
  count, 
  icon: Icon, 
  colorClass, 
  iconColorClass, 
  onClick,
  isActive 
}: SummaryCardProps) {
  return (
    <Card 
      className={`
        border-l-4 ${colorClass} cursor-pointer transition-all hover:shadow-md
        ${isActive ? 'ring-2 ring-offset-1' : ''}
      `}
      onClick={onClick}
    >
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-slate-900">{count}</div>
            <p className="text-sm text-slate-500">{label}</p>
          </div>
          <Icon className={`w-8 h-8 ${iconColorClass} opacity-20`} />
        </div>
      </CardContent>
    </Card>
  );
}

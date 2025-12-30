'use client';

import { useState, useMemo, useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Input,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui';
import {
  Search,
  UserPlus,
  Users,
  CheckCircle,
  TrendingUp,
  Filter,
  Save,
  Bookmark,
  ChevronDown,
  Star,
  Trash2,
  Loader2,
} from 'lucide-react';
import {
  type LeadsBoardSavedView,
  type LeadsBoardSavedFilters,
  type LeadStatus,
  type LeadSource,
  LEAD_STATUSES,
  LEAD_SOURCES,
  getLeadStatusLabel,
  getLeadSourceLabel,
} from '@crm-eco/lib';
import {
  createLeadsSavedView,
  setLeadsSavedViewDefault,
  deleteLeadsSavedView,
  clearLeadsSavedViewDefault,
} from '@/app/(dashboard)/leads/actions';

// ============================================================================
// TYPES
// ============================================================================

export interface LeadWithAdvisor {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  state: string | null;
  status: string;
  source: string | null;
  advisor_id: string | null;
  created_at: string;
  updated_at: string;
  advisors?: { first_name: string; last_name: string } | null;
}

export interface AdvisorOption {
  id: string;
  first_name: string;
  last_name: string;
}

interface LeadsBoardShellProps {
  leads: LeadWithAdvisor[];
  savedViews: LeadsBoardSavedView[];
  defaultSavedViewId: string | null;
  advisors: AdvisorOption[];
  stats: {
    total: number;
    new: number;
    qualified: number;
    converted: number;
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case 'new':
      return 'default';
    case 'contacted':
      return 'secondary';
    case 'working':
      return 'warning';
    case 'qualified':
      return 'success';
    case 'converted':
      return 'success';
    case 'unqualified':
    case 'lost':
      return 'destructive';
    default:
      return 'outline';
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export function LeadsBoardShell({
  leads,
  savedViews,
  defaultSavedViewId,
  advisors,
  stats,
}: LeadsBoardShellProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Filter state
  const [selectedStatuses, setSelectedStatuses] = useState<LeadStatus[]>([]);
  const [selectedSources, setSelectedSources] = useState<LeadSource[]>([]);
  const [selectedAdvisorId, setSelectedAdvisorId] = useState<string | 'all'>('all');
  const [search, setSearch] = useState('');

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

    const defaultView = savedViews.find((v) => v.id === defaultSavedViewId);
    if (!defaultView) return;

    applySavedFiltersToState(defaultView.filters);
    setActiveSavedViewId(defaultView.id);
    hasAppliedDefaultRef.current = true;
  }, [defaultSavedViewId, savedViews]);

  /**
   * Apply a saved view's filters to local state
   */
  function applySavedFiltersToState(filters: LeadsBoardSavedFilters) {
    setSelectedStatuses((filters.selectedStatuses ?? []) as LeadStatus[]);
    setSelectedSources((filters.selectedSources ?? []) as LeadSource[]);
    setSelectedAdvisorId(filters.selectedAdvisorId ?? 'all');
    setSearch(filters.search ?? '');
  }

  /**
   * Build current filters as a saveable object
   */
  function buildCurrentFilters(): LeadsBoardSavedFilters {
    return {
      selectedStatuses,
      selectedSources,
      selectedAdvisorId,
      search,
    };
  }

  /**
   * Handle applying a personal saved view
   */
  function handleApplyPersonalSavedView(viewId: string) {
    const view = savedViews.find((v) => v.id === viewId);
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
      const result = await createLeadsSavedView({
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
      const result = await setLeadsSavedViewDefault(viewId);
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
      const result = await clearLeadsSavedViewDefault();
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
      const result = await deleteLeadsSavedView(viewId);
      if (result.success) {
        if (activeSavedViewId === viewId) {
          setActiveSavedViewId(null);
        }
        router.refresh();
      }
    });
  }

  /**
   * Reset all filters
   */
  function handleResetFilters() {
    setSelectedStatuses([]);
    setSelectedSources([]);
    setSelectedAdvisorId('all');
    setSearch('');
    setActiveSavedViewId(null);
  }

  // Filter leads based on current filters
  const filteredLeads = useMemo(() => {
    let filtered = [...leads];

    // Status filter
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter((l) =>
        selectedStatuses.includes(l.status as LeadStatus)
      );
    }

    // Source filter
    if (selectedSources.length > 0) {
      filtered = filtered.filter(
        (l) => l.source && selectedSources.includes(l.source as LeadSource)
      );
    }

    // Advisor filter
    if (selectedAdvisorId !== 'all') {
      if (selectedAdvisorId === 'unassigned') {
        filtered = filtered.filter((l) => !l.advisor_id);
      } else {
        filtered = filtered.filter((l) => l.advisor_id === selectedAdvisorId);
      }
    }

    // Search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter((l) => {
        const name = `${l.first_name} ${l.last_name}`.toLowerCase();
        const email = l.email.toLowerCase();
        const phone = (l.phone || '').toLowerCase();

        return (
          name.includes(searchLower) ||
          email.includes(searchLower) ||
          phone.includes(searchLower)
        );
      });
    }

    return filtered;
  }, [leads, selectedStatuses, selectedSources, selectedAdvisorId, search]);

  // Find active personal view
  const activePersonalView = savedViews.find((v) => v.id === activeSavedViewId);
  const defaultView = savedViews.find((v) => v.is_default);

  const hasActiveFilters =
    selectedStatuses.length > 0 ||
    selectedSources.length > 0 ||
    selectedAdvisorId !== 'all' ||
    search.trim() !== '';

  const statCards = [
    { label: 'Total Leads', value: stats.total, icon: Users, color: 'text-slate-600' },
    { label: 'New', value: stats.new, icon: UserPlus, color: 'text-blue-600' },
    { label: 'Qualified', value: stats.qualified, icon: CheckCircle, color: 'text-amber-600' },
    { label: 'Converted', value: stats.converted, icon: TrendingUp, color: 'text-emerald-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-600">Track and convert potential members</p>
        </div>
        <div className="flex items-center gap-2">
          {/* My Views Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" disabled={isPending}>
                <Bookmark className="w-4 h-4" />
                <span>{activePersonalView ? activePersonalView.name : 'My Views'}</span>
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
                    <DropdownMenuItem onClick={handleClearDefault} disabled={isPending}>
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

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-full bg-slate-100 ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Leads Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Leads</CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />

              {/* Status Filter */}
              <Select
                value={selectedStatuses.length === 1 ? selectedStatuses[0] : 'all'}
                onValueChange={(value) => {
                  if (value === 'all') {
                    setSelectedStatuses([]);
                  } else {
                    setSelectedStatuses([value as LeadStatus]);
                  }
                  setActiveSavedViewId(null);
                }}
              >
                <SelectTrigger className="w-32 h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {LEAD_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {getLeadStatusLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Source Filter */}
              <Select
                value={selectedSources.length === 1 ? selectedSources[0] : 'all'}
                onValueChange={(value) => {
                  if (value === 'all') {
                    setSelectedSources([]);
                  } else {
                    setSelectedSources([value as LeadSource]);
                  }
                  setActiveSavedViewId(null);
                }}
              >
                <SelectTrigger className="w-32 h-9">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {LEAD_SOURCES.map((source) => (
                    <SelectItem key={source} value={source}>
                      {getLeadSourceLabel(source)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Advisor Filter */}
              <Select
                value={selectedAdvisorId}
                onValueChange={(value) => {
                  setSelectedAdvisorId(value);
                  setActiveSavedViewId(null);
                }}
              >
                <SelectTrigger className="w-36 h-9">
                  <SelectValue placeholder="Advisor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Advisors</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {advisors.map((advisor) => (
                    <SelectItem key={advisor.id} value={advisor.id}>
                      {advisor.first_name} {advisor.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search leads..."
                className="pl-9 h-9"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setActiveSavedViewId(null);
                }}
              />
            </div>
          </div>
        </CardHeader>

        {/* Results info */}
        <div className="px-6 pb-2 flex items-center justify-between">
          <div className="text-sm text-slate-500">
            Showing {filteredLeads.length} of {leads.length} leads
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={handleResetFilters}>
              Reset filters
            </Button>
          )}
        </div>

        <CardContent>
          {filteredLeads.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserPlus className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-600 mb-2">No leads found</p>
              <p className="text-sm text-slate-500">
                {hasActiveFilters
                  ? 'Try adjusting your filters'
                  : 'Click "Add Lead" to create your first lead'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Advisor</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">
                      {lead.first_name} {lead.last_name}
                    </TableCell>
                    <TableCell>{lead.email}</TableCell>
                    <TableCell>{lead.phone ?? '-'}</TableCell>
                    <TableCell>{lead.state ?? '-'}</TableCell>
                    <TableCell>
                      {lead.source ? getLeadSourceLabel(lead.source as LeadSource) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(lead.status)}>
                        {getLeadStatusLabel(lead.status as LeadStatus)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {lead.advisors
                        ? `${lead.advisors.first_name} ${lead.advisors.last_name}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {format(new Date(lead.created_at), 'MMM d, yyyy')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
                placeholder="e.g., My qualified leads"
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

            {saveError && <p className="text-sm text-red-600">{saveError}</p>}
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
    </div>
  );
}


'use client';

import { useState, useMemo, useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
  Ticket,
  Filter,
  Save,
  Bookmark,
  ChevronDown,
  Star,
  Trash2,
  Loader2,
} from 'lucide-react';
import {
  type TicketsBoardSavedView,
  type TicketsBoardSavedFilters,
  type TicketStatus,
  type TicketCategory,
  type TicketPriority,
  TICKET_STATUSES,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  getTicketStatusLabel,
  getTicketCategoryLabel,
  getTicketPriorityLabel,
} from '@crm-eco/lib';
import { TicketStatusBadge } from '@/components/shared/status-badge';
import { PriorityBadge } from '@/components/shared/priority-badge';
import { CategoryBadge } from '@/components/shared/category-badge';
import {
  createTicketsSavedView,
  setTicketsSavedViewDefault,
  deleteTicketsSavedView,
  clearTicketsSavedViewDefault,
} from '@/app/(dashboard)/tickets/actions';

// ============================================================================
// TYPES
// ============================================================================

export interface TicketWithRelations {
  id: string;
  subject: string;
  description: string | null;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  updated_at: string;
  assigned_to_profile_id: string | null;
  created_by?: { full_name: string } | null;
  assigned_to?: { full_name: string } | null;
  members?: { id: string; first_name: string; last_name: string } | null;
}

export interface AssignableProfile {
  id: string;
  full_name: string;
}

interface TicketsBoardShellProps {
  tickets: TicketWithRelations[];
  savedViews: TicketsBoardSavedView[];
  defaultSavedViewId: string | null;
  assignableProfiles: AssignableProfile[];
  stats: {
    total: number;
    open: number;
    inProgress: number;
    urgent: number;
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function TicketsBoardShell({
  tickets,
  savedViews,
  defaultSavedViewId,
  assignableProfiles,
  stats,
}: TicketsBoardShellProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Filter state
  const [selectedStatuses, setSelectedStatuses] = useState<TicketStatus[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<TicketCategory[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<TicketPriority[]>([]);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | 'all'>('all');
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
  function applySavedFiltersToState(filters: TicketsBoardSavedFilters) {
    setSelectedStatuses((filters.selectedStatuses ?? []) as TicketStatus[]);
    setSelectedCategories((filters.selectedCategories ?? []) as TicketCategory[]);
    setSelectedPriorities((filters.selectedPriorities ?? []) as TicketPriority[]);
    setSelectedAssigneeId(filters.selectedAssigneeId ?? 'all');
    setSearch(filters.search ?? '');
  }

  /**
   * Build current filters as a saveable object
   */
  function buildCurrentFilters(): TicketsBoardSavedFilters {
    return {
      selectedStatuses,
      selectedCategories,
      selectedPriorities,
      selectedAssigneeId,
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
      const result = await createTicketsSavedView({
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
      const result = await setTicketsSavedViewDefault(viewId);
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
      const result = await clearTicketsSavedViewDefault();
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
      const result = await deleteTicketsSavedView(viewId);
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
    setSelectedCategories([]);
    setSelectedPriorities([]);
    setSelectedAssigneeId('all');
    setSearch('');
    setActiveSavedViewId(null);
  }

  // Filter tickets based on current filters
  const filteredTickets = useMemo(() => {
    let filtered = [...tickets];

    // Status filter
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter((t) =>
        selectedStatuses.includes(t.status as TicketStatus)
      );
    }

    // Category filter
    if (selectedCategories.length > 0) {
      filtered = filtered.filter((t) =>
        selectedCategories.includes(t.category as TicketCategory)
      );
    }

    // Priority filter
    if (selectedPriorities.length > 0) {
      filtered = filtered.filter((t) =>
        selectedPriorities.includes(t.priority as TicketPriority)
      );
    }

    // Assignee filter
    if (selectedAssigneeId !== 'all') {
      if (selectedAssigneeId === 'unassigned') {
        filtered = filtered.filter((t) => !t.assigned_to_profile_id);
      } else {
        filtered = filtered.filter(
          (t) => t.assigned_to_profile_id === selectedAssigneeId
        );
      }
    }

    // Search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter((t) => {
        const subject = t.subject.toLowerCase();
        const description = (t.description || '').toLowerCase();
        const memberName = t.members
          ? `${t.members.first_name} ${t.members.last_name}`.toLowerCase()
          : '';
        const assigneeName = t.assigned_to?.full_name?.toLowerCase() || '';

        return (
          subject.includes(searchLower) ||
          description.includes(searchLower) ||
          memberName.includes(searchLower) ||
          assigneeName.includes(searchLower)
        );
      });
    }

    return filtered;
  }, [
    tickets,
    selectedStatuses,
    selectedCategories,
    selectedPriorities,
    selectedAssigneeId,
    search,
  ]);

  // Find active personal view
  const activePersonalView = savedViews.find((v) => v.id === activeSavedViewId);
  const defaultView = savedViews.find((v) => v.is_default);

  const hasActiveFilters =
    selectedStatuses.length > 0 ||
    selectedCategories.length > 0 ||
    selectedPriorities.length > 0 ||
    selectedAssigneeId !== 'all' ||
    search.trim() !== '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-500">Manage support tickets and service requests</p>
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
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            <p className="text-sm text-slate-500">Total Tickets</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-slate-900">{stats.open}</div>
            <p className="text-sm text-slate-500">Open</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-slate-900">{stats.inProgress}</div>
            <p className="text-sm text-slate-500">In Progress</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-slate-900">{stats.urgent}</div>
            <p className="text-sm text-slate-500">Urgent</p>
          </CardContent>
        </Card>
      </div>

      {/* Tickets Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-slate-400" />
            All Tickets
          </CardTitle>
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
                    setSelectedStatuses([value as TicketStatus]);
                  }
                  setActiveSavedViewId(null);
                }}
              >
                <SelectTrigger className="w-32 h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {TICKET_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {getTicketStatusLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Category Filter */}
              <Select
                value={selectedCategories.length === 1 ? selectedCategories[0] : 'all'}
                onValueChange={(value) => {
                  if (value === 'all') {
                    setSelectedCategories([]);
                  } else {
                    setSelectedCategories([value as TicketCategory]);
                  }
                  setActiveSavedViewId(null);
                }}
              >
                <SelectTrigger className="w-32 h-9">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {TICKET_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {getTicketCategoryLabel(cat)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Priority Filter */}
              <Select
                value={selectedPriorities.length === 1 ? selectedPriorities[0] : 'all'}
                onValueChange={(value) => {
                  if (value === 'all') {
                    setSelectedPriorities([]);
                  } else {
                    setSelectedPriorities([value as TicketPriority]);
                  }
                  setActiveSavedViewId(null);
                }}
              >
                <SelectTrigger className="w-28 h-9">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  {TICKET_PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {getTicketPriorityLabel(priority)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search tickets..."
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
            Showing {filteredTickets.length} of {tickets.length} tickets
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={handleResetFilters}>
              Reset filters
            </Button>
          )}
        </div>

        <CardContent>
          {filteredTickets.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Ticket className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="font-medium">No tickets found</p>
              <p className="text-sm text-slate-400 mt-1">
                {hasActiveFilters
                  ? 'Try adjusting your filters'
                  : 'Click "Create Ticket" to create your first ticket'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.map((ticket) => (
                  <TableRow key={ticket.id} className="cursor-pointer hover:bg-slate-50">
                    <TableCell>
                      <Link href={`/tickets/${ticket.id}`} className="block">
                        <div className="font-medium text-blue-600 hover:text-blue-800 hover:underline max-w-[250px] truncate">
                          {ticket.subject}
                        </div>
                        <div className="text-xs text-slate-400 truncate max-w-[250px]">
                          {ticket.description}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <CategoryBadge category={ticket.category} />
                    </TableCell>
                    <TableCell>
                      <TicketStatusBadge status={ticket.status} />
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={ticket.priority} />
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {ticket.members ? (
                        <Link
                          href={`/members/${ticket.members.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {ticket.members.first_name} {ticket.members.last_name}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {ticket.assigned_to?.full_name ?? (
                        <span className="text-slate-400">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm">
                      {format(new Date(ticket.created_at), 'MMM d, yyyy')}
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
                placeholder="e.g., My open urgent tickets"
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


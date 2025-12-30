'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, Button } from '@crm-eco/ui';
import { CheckCircle, Clock, AlertTriangle, HeartPulse, CalendarDays, CalendarClock, Calendar, LayoutGrid } from 'lucide-react';
import { startOfWeek, subDays, startOfDay, isSameDay } from 'date-fns';
import { type NeedStatus, getUrgencyLabelCRM, OPEN_NEED_STATUSES } from '@crm-eco/lib';
import { NeedsFiltersBar, type SlaFilter } from './NeedsFiltersBar';
import { NeedsTable, type NeedWithMember } from './NeedsTable';
import { WorkloadPanel } from './WorkloadPanel';
import type { WorkloadBucket } from '@/app/(dashboard)/needs/command-center/page';

interface SlaCounts {
  overdue: number;
  atRisk: number;
  onTrack: number;
}

// Saved view keys
export type SavedViewKey = 'all' | 'today_overdue' | 'new_this_week' | 'new_last_7_days';

interface NeedsCommandCenterShellProps {
  needs: NeedWithMember[];
  slaCounts: SlaCounts;
  workload: WorkloadBucket[];
}

export function NeedsCommandCenterShell({ needs, slaCounts, workload }: NeedsCommandCenterShellProps) {
  // Filter state
  const [selectedSlaFilter, setSelectedSlaFilter] = useState<SlaFilter>('all');
  const [selectedStatuses, setSelectedStatuses] = useState<NeedStatus[]>([]);
  const [search, setSearch] = useState('');
  
  // Saved view state
  const [savedView, setSavedView] = useState<SavedViewKey>('all');
  
  // Assignee filter state
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | 'all'>('all');

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

  // Handle saved view change
  const handleSavedViewChange = (view: SavedViewKey) => {
    setSavedView(view);
    // Reset other filters when changing saved view (optional, keeps it clean)
    if (view !== 'all') {
      setSelectedSlaFilter('all');
      setSelectedStatuses([]);
    }
  };

  // Saved views configuration
  const savedViews: { key: SavedViewKey; label: string; icon: React.ElementType }[] = [
    { key: 'all', label: 'All Needs', icon: LayoutGrid },
    { key: 'today_overdue', label: "Today's Overdue", icon: AlertTriangle },
    { key: 'new_this_week', label: 'New This Week', icon: CalendarDays },
    { key: 'new_last_7_days', label: 'Last 7 Days', icon: CalendarClock },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Needs Command Center</h1>
        <p className="text-slate-500 mt-1">
          SLA-driven queue for Needs and sharing operations
        </p>
      </div>

      {/* Saved Views Row */}
      <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg w-fit">
        {savedViews.map((view) => {
          const Icon = view.icon;
          const isActive = savedView === view.key;
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
      <NeedsTable needs={filteredNeeds} />
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

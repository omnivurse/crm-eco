'use client';

import { Button, Input, Badge } from '@crm-eco/ui';
import { Search, X, CheckCircle, Clock, AlertTriangle, HeartPulse } from 'lucide-react';
import { type NeedStatus, getNeedStatusLabel, OPEN_NEED_STATUSES, TERMINAL_NEED_STATUSES } from '@crm-eco/lib';

export type SlaFilter = 'all' | 'green' | 'orange' | 'red';

interface NeedsFiltersBarProps {
  selectedSlaFilter: SlaFilter;
  onChangeSlaFilter: (filter: SlaFilter) => void;
  selectedStatuses: NeedStatus[];
  onChangeStatuses: (statuses: NeedStatus[]) => void;
  search: string;
  onSearchChange: (search: string) => void;
}

const ALL_STATUSES: NeedStatus[] = [...OPEN_NEED_STATUSES, ...TERMINAL_NEED_STATUSES];

const SLA_TABS: { value: SlaFilter; label: string; icon: React.ElementType; colorClass: string }[] = [
  { value: 'all', label: 'All', icon: HeartPulse, colorClass: 'bg-blue-600 text-white' },
  { value: 'green', label: 'On Track', icon: CheckCircle, colorClass: 'bg-emerald-600 text-white' },
  { value: 'orange', label: 'At-Risk', icon: Clock, colorClass: 'bg-amber-500 text-white' },
  { value: 'red', label: 'Overdue', icon: AlertTriangle, colorClass: 'bg-red-600 text-white' },
];

export function NeedsFiltersBar({
  selectedSlaFilter,
  onChangeSlaFilter,
  selectedStatuses,
  onChangeStatuses,
  search,
  onSearchChange,
}: NeedsFiltersBarProps) {
  const toggleStatus = (status: NeedStatus) => {
    if (selectedStatuses.includes(status)) {
      onChangeStatuses(selectedStatuses.filter(s => s !== status));
    } else {
      onChangeStatuses([...selectedStatuses, status]);
    }
  };

  const clearFilters = () => {
    onChangeSlaFilter('all');
    onChangeStatuses([]);
    onSearchChange('');
  };

  const hasActiveFilters = selectedSlaFilter !== 'all' || selectedStatuses.length > 0 || search.length > 0;

  return (
    <div className="space-y-4">
      {/* SLA Filter Tabs */}
      <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg w-fit">
        {SLA_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = selectedSlaFilter === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => onChangeSlaFilter(tab.value)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${isActive 
                  ? `${tab.colorClass} shadow-sm` 
                  : 'text-slate-600 hover:bg-slate-200'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Status Filters + Search */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search member or need..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Status multi-select as badge buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500">Status:</span>
          {ALL_STATUSES.map((status) => {
            const isSelected = selectedStatuses.includes(status);
            return (
              <button
                key={status}
                onClick={() => toggleStatus(status)}
                className={`
                  px-2.5 py-1 rounded-full text-xs font-medium transition-all border
                  ${isSelected
                    ? 'bg-blue-100 text-blue-800 border-blue-300'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }
                `}
              >
                {getNeedStatusLabel(status)}
              </button>
            );
          })}
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4 mr-1" />
            Clear filters
          </Button>
        )}
      </div>

      {/* Active filters summary */}
      {selectedStatuses.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500">Active filters:</span>
          {selectedStatuses.map((status) => (
            <Badge 
              key={status} 
              variant="secondary"
              className="cursor-pointer hover:bg-slate-200"
              onClick={() => toggleStatus(status)}
            >
              {getNeedStatusLabel(status)}
              <X className="w-3 h-3 ml-1" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}


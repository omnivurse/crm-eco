'use client';

import * as React from 'react';
import { useState, useCallback } from 'react';
import { cn } from '../lib/utils';
import { Button } from './button';
import { Input } from './input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';
import { Search, X, Filter, Calendar } from 'lucide-react';
import type { RiskLevel } from './risk-level-badge';

export interface AuditLogFilterState {
  userId?: string;
  actionType?: string;
  riskLevel?: RiskLevel | 'all';
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
}

export interface AuditLogUser {
  id: string;
  name: string;
  email: string;
}

export interface AuditLogFiltersProps {
  users?: AuditLogUser[];
  onFiltersChange: (filters: AuditLogFilterState) => void;
  initialFilters?: Partial<AuditLogFilterState>;
  className?: string;
  showUserFilter?: boolean;
  showActionFilter?: boolean;
  showRiskFilter?: boolean;
  showDateFilter?: boolean;
  showSearch?: boolean;
}

const ACTION_TYPES = [
  { value: 'all', label: 'All Actions' },
  { value: 'login_success', label: 'Login Success' },
  { value: 'login_failed', label: 'Login Failed' },
  { value: 'logout', label: 'Logout' },
  { value: 'role_changed', label: 'Role Changed' },
  { value: 'record_created', label: 'Record Created' },
  { value: 'record_updated', label: 'Record Updated' },
  { value: 'record_deleted', label: 'Record Deleted' },
  { value: 'bulk_update', label: 'Bulk Update' },
  { value: 'bulk_delete', label: 'Bulk Delete' },
  { value: 'data_exported', label: 'Data Exported' },
  { value: 'data_imported', label: 'Data Imported' },
  { value: 'settings_updated', label: 'Settings Updated' },
  { value: 'member_created', label: 'Member Created' },
  { value: 'member_terminated', label: 'Member Terminated' },
  { value: 'payment_processed', label: 'Payment Processed' },
  { value: 'refund_issued', label: 'Refund Issued' },
];

const RISK_LEVELS = [
  { value: 'all', label: 'All Risk Levels' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export function AuditLogFilters({
  users = [],
  onFiltersChange,
  initialFilters = {},
  className,
  showUserFilter = true,
  showActionFilter = true,
  showRiskFilter = true,
  showDateFilter = true,
  showSearch = true,
}: AuditLogFiltersProps) {
  const [filters, setFilters] = useState<AuditLogFilterState>(initialFilters);

  const updateFilter = useCallback(
    <K extends keyof AuditLogFilterState>(key: K, value: AuditLogFilterState[K]) => {
      const newFilters = { ...filters, [key]: value === 'all' ? undefined : value };
      setFilters(newFilters);
      onFiltersChange(newFilters);
    },
    [filters, onFiltersChange]
  );

  const clearFilters = useCallback(() => {
    setFilters({});
    onFiltersChange({});
  }, [onFiltersChange]);

  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== undefined && v !== '' && v !== 'all'
  );

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-white/10',
        className
      )}
    >
      {/* Search */}
      {showSearch && (
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search logs..."
            value={filters.searchQuery || ''}
            onChange={(e) => updateFilter('searchQuery', e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      )}

      {/* User Filter */}
      {showUserFilter && users.length > 0 && (
        <Select
          value={filters.userId || 'all'}
          onValueChange={(v) => updateFilter('userId', v === 'all' ? undefined : v)}
        >
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="All Users" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name || user.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Action Type Filter */}
      {showActionFilter && (
        <Select
          value={filters.actionType || 'all'}
          onValueChange={(v) => updateFilter('actionType', v === 'all' ? undefined : v)}
        >
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            {ACTION_TYPES.map((action) => (
              <SelectItem key={action.value} value={action.value}>
                {action.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Risk Level Filter */}
      {showRiskFilter && (
        <Select
          value={filters.riskLevel || 'all'}
          onValueChange={(v) =>
            updateFilter('riskLevel', v === 'all' ? undefined : (v as RiskLevel))
          }
        >
          <SelectTrigger className="w-[150px] h-9">
            <SelectValue placeholder="All Risk Levels" />
          </SelectTrigger>
          <SelectContent>
            {RISK_LEVELS.map((level) => (
              <SelectItem key={level.value} value={level.value}>
                {level.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Date Range */}
      {showDateFilter && (
        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => updateFilter('dateFrom', e.target.value)}
              className="pl-9 w-[140px] h-9"
              placeholder="From"
            />
          </div>
          <span className="text-slate-400">-</span>
          <Input
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) => updateFilter('dateTo', e.target.value)}
            className="w-[140px] h-9"
            placeholder="To"
          />
        </div>
      )}

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="h-9 px-3 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <X className="w-4 h-4 mr-1" />
          Clear
        </Button>
      )}

      {/* Filter indicator */}
      {hasActiveFilters && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 dark:bg-teal-500/10 rounded-md border border-teal-200 dark:border-teal-500/20">
          <Filter className="w-3 h-3 text-teal-600 dark:text-teal-400" />
          <span className="text-xs font-medium text-teal-700 dark:text-teal-400">
            Filtered
          </span>
        </div>
      )}
    </div>
  );
}

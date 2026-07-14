'use client';

import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';
import { X, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import type { ViewFilter, CrmField } from '@/lib/crm/types';

interface FilterChipsBarProps {
  filters: ViewFilter[];
  fields: CrmField[];
  sortField?: string | null;
  sortDirection?: 'asc' | 'desc';
  totalCount: number;
  onRemoveFilter: (index: number) => void;
  onClearAll: () => void;
  onSortChange?: (field: string, direction: 'asc' | 'desc') => void;
  className?: string;
}

const OPERATOR_LABELS: Record<string, string> = {
  equals: 'is',
  not_equals: 'is not',
  contains: 'contains',
  starts_with: 'starts with',
  ends_with: 'ends with',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  is_null: 'is empty',
  is_not_null: 'is not empty',
  in: 'is any of',
  not_in: 'is not any of',
  between: 'between',
  before: 'before',
  after: 'after',
  // Date presets
  today: 'is today',
  yesterday: 'is yesterday',
  this_week: 'is this week',
  last_week: 'was last week',
  this_month: 'is this month',
  last_month: 'was last month',
  this_quarter: 'is this quarter',
  last_quarter: 'was last quarter',
  this_year: 'is this year',
  last_year: 'was last year',
  last_n_days: 'in last',
  next_n_days: 'in next',
};

/** Human-readable labels for system filter presets */
const SYSTEM_PRESET_LABELS: Record<string, string> = {
  touched_records: 'Touched Records',
  untouched_records: 'Untouched Records',
  my_records: 'My Records',
  created_today: 'Created Today',
  created_this_week: 'Created This Week',
  modified_today: 'Modified Today',
  modified_this_week: 'Modified This Week',
  unassigned: 'Unassigned',
  has_activities: 'Has Activities',
  no_activities: 'No Activities',
  has_notes: 'Has Notes',
  has_open_tasks: 'Has Open Tasks',
  has_overdue_tasks: 'Has Overdue Tasks',
  locked: 'Locked',
  website_activity: 'Website Activity',
  chats: 'Chats',
  campaigns: 'Campaigns',
  cadences: 'Cadences',
  record_action: 'Record Action',
  related_records_action: 'Related Records Action',
  scoring_rules: 'Scoring Rules',
  latest_email_status: 'Latest Email Status',
  attended_by: 'Attended By',
  browser: 'Browser',
  operating_system: 'Operating System',
  portal_name: 'Portal Name',
  search_engine: 'Search Engine',
  time_spent_minutes: 'Time Spent (Min)',
  time_visited: 'Time Visited',
  avg_time_spent_minutes: 'Avg Time Spent (Min)',
  days_visited: 'Days Visited',
  first_page_visited: 'First Page Visited',
  first_visit: 'First Visit',
  most_recent_visit: 'Most Recent Visit',
  number_of_chats: 'Number Of Chats',
  referrer: 'Referrer',
  visitor_score: 'Visitor Score',
  // Business lane presets
  healthshare_records: 'HealthShare Records',
  insurance_records: 'Insurance Records',
  unclassified_records: 'Needs Classification',
  needs_review_records: 'Needs Review',
  // Owner filter
  owner_is: 'Filtered by Owner',
};

/** Human-readable labels for related module keys */
const RELATED_MODULE_LABELS: Record<string, string> = {
  activities: 'Activities',
  calls: 'Calls',
  emails: 'Emails',
  meetings: 'Meetings',
  tasks: 'Tasks',
  notes: 'Notes',
  accounts: 'Accounts',
  contacts: 'Contacts',
  leads: 'Leads',
  campaigns: 'Campaigns',
  products: 'Products',
  lead_products: 'Lead Products',
  invoices: 'Invoices',
  prospects: 'Prospects',
  prospect_roles: 'Prospect Roles',
  providers: 'Providers',
  aca_clients: 'ACA Clients',
  cirrusmd_contacts: 'CirrusMD Contacts',
  planstin_contacts: 'Planstin Contacts',
  pricing_matrix: 'Pricing Matrix',
  producers: 'Producers',
  services: 'Services',
  solutions: 'Solutions',
  support: 'Support',
  data_subject_requests: 'Data Subject Requests',
  meeting_invitees: 'Meeting Invitees',
  reporting_contacts: 'Contacts (Reporting)',
};

export function FilterChipsBar({
  filters,
  fields,
  sortField,
  sortDirection = 'asc',
  totalCount,
  onRemoveFilter,
  onClearAll,
  onSortChange,
  className,
}: FilterChipsBarProps) {
  const fieldMap = new Map(fields.map(f => [f.key, f]));

  const getFieldLabel = (key: string): string => {
    return fieldMap.get(key)?.label || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  };

  const sortableFields = fields.filter(f => 
    ['text', 'number', 'date', 'datetime', 'email', 'select', 'currency'].includes(f.type)
  );

  if (filters.length === 0 && !sortField) {
    return null;
  }

  return (
    <div className={cn(
      'flex items-center gap-2 py-1.5 px-1 flex-wrap',
      className
    )}>
      {/* Filter Chips -- supports field, system, and related categories */}
      {filters.map((filter, index) => {
        const category = filter.category || 'field';

        // System preset chip
        if (category === 'system' && filter.systemPreset) {
          const presetLabel = SYSTEM_PRESET_LABELS[filter.systemPreset] || filter.systemPreset;
          const hasValue = filter.secondValue != null && filter.secondValue !== '';
          return (
            <div
              key={index}
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs
                bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300
                border border-purple-200 dark:border-purple-800"
            >
              <span className="font-medium">{presetLabel}</span>
              {hasValue && (
                <span className="text-purple-500 dark:text-purple-400">
                  : {formatValue(filter.secondValue)}
                </span>
              )}
              <button
                onClick={() => onRemoveFilter(index)}
                className="ml-0.5 p-0.5 rounded-full hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        }

        // Related module chip
        if (category === 'related' && filter.relatedModule) {
          const condLabel = filter.relatedCondition === 'has_none' ? 'No' : 'Has';
          return (
            <div
              key={index}
              className={cn(
                'inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs border',
                filter.relatedCondition === 'has_none'
                  ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                  : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
              )}
            >
              <span className="text-slate-500 dark:text-slate-400">{condLabel}</span>
              <span className="font-medium">
                {RELATED_MODULE_LABELS[filter.relatedModule] || filter.relatedModule}
              </span>
              <button
                onClick={() => onRemoveFilter(index)}
                className="ml-0.5 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        }

        // Default: field filter chip
        return (
          <div
            key={index}
            className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs
              bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300
              border border-slate-200 dark:border-white/10"
          >
            <span className="font-medium">{getFieldLabel(filter.field)}</span>
            <span className="text-slate-500 dark:text-slate-400">{OPERATOR_LABELS[filter.operator] || filter.operator}</span>
            {!['is_null', 'is_not_null', 'today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'this_quarter', 'last_quarter', 'this_year', 'last_year'].includes(filter.operator) && (
              <span className="font-medium text-teal-600 dark:text-teal-400">
                {formatValue(filter.value)}
                {['last_n_days', 'next_n_days'].includes(filter.operator) ? ' days' : ''}
              </span>
            )}
            <button
              onClick={() => onRemoveFilter(index)}
              className="ml-0.5 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Sort Dropdown */}
      {onSortChange && sortableFields.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              Sort: {sortField ? getFieldLabel(sortField) : 'Default'}
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10"
          >
            {sortableFields.slice(0, 10).map((field) => (
              <DropdownMenuItem
                key={field.key}
                onClick={() => onSortChange(
                  field.key,
                  sortField === field.key && sortDirection === 'asc' ? 'desc' : 'asc'
                )}
                className={cn(
                  'text-sm cursor-pointer',
                  sortField === field.key && 'text-teal-600 dark:text-teal-400'
                )}
              >
                {field.label}
                {sortField === field.key && (
                  <span className="ml-auto text-xs">
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Count */}
      <span className="text-xs text-slate-500 dark:text-slate-400 px-2">
        {totalCount.toLocaleString()} records
      </span>

      {/* Clear All */}
      {filters.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-7 px-2 text-xs text-slate-500 hover:text-red-600 dark:hover:text-red-400"
        >
          Clear All
        </Button>
      )}
    </div>
  );
}

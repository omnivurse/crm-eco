'use client';

import { useState, useMemo, useCallback, memo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@crm-eco/ui/components/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  User,
  Mail,
  Phone,
  Inbox,
  Plus,
  Calendar,
  Clock,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { CrmRecord, CrmField } from '@/lib/crm/types';

interface TimelineViewProps {
  records: CrmRecord[];
  fields: CrmField[];
  moduleKey: string;
  onRowClick?: (recordId: string) => void;
}

type SortByDate = 'created_at' | 'updated_at';

const STATUS_COLORS: Record<string, string> = {
  'Active': 'bg-emerald-500',
  'New': 'bg-blue-500',
  'Contacted': 'bg-cyan-500',
  'Qualified': 'bg-violet-500',
  'Working': 'bg-amber-500',
  'Converted': 'bg-emerald-500',
  'Lost': 'bg-red-500',
  'Closed Won': 'bg-emerald-500',
  'Closed Lost': 'bg-red-500',
  'Hot Prospect - ready to move': 'bg-orange-500',
  'Prospect': 'bg-blue-500',
  'Inactive': 'bg-slate-400',
  'In-Active': 'bg-slate-400',
};

function getStatusDotColor(record: CrmRecord): string {
  const rawStatus = record.status ?? record.data?.status ?? record.data?.lead_status ?? record.data?.contact_status;
  const status = rawStatus ? String(rawStatus) : '';
  return STATUS_COLORS[status] || 'bg-slate-400';
}

function getDisplayName(record: CrmRecord): string {
  if (record.title && record.title !== 'Untitled') return record.title;
  const firstName = record.data?.first_name || '';
  const lastName = record.data?.last_name || '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  return fullName || record.data?.account_name as string || record.data?.name as string || record.title || 'Untitled';
}

function getStatusText(record: CrmRecord): string {
  const rawStatus = record.status ?? record.data?.status ?? record.data?.lead_status ?? record.data?.contact_status;
  return rawStatus ? String(rawStatus) : '';
}

interface DateGroup {
  label: string;
  key: string;
  records: CrmRecord[];
}

function groupRecordsByDate(records: CrmRecord[], dateField: SortByDate): DateGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const thisWeekStart = new Date(today.getTime() - today.getDay() * 86400000);
  const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 86400000);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const groups: Record<string, CrmRecord[]> = {
    today: [],
    yesterday: [],
    this_week: [],
    last_week: [],
    this_month: [],
    last_month: [],
    older: [],
  };

  const sorted = [...records].sort((a, b) =>
    new Date(b[dateField]).getTime() - new Date(a[dateField]).getTime()
  );

  sorted.forEach(record => {
    const date = new Date(record[dateField]);
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (dateOnly.getTime() === today.getTime()) {
      groups.today.push(record);
    } else if (dateOnly.getTime() === yesterday.getTime()) {
      groups.yesterday.push(record);
    } else if (dateOnly >= thisWeekStart && dateOnly < today) {
      groups.this_week.push(record);
    } else if (dateOnly >= lastWeekStart && dateOnly < thisWeekStart) {
      groups.last_week.push(record);
    } else if (dateOnly >= thisMonthStart && dateOnly < lastWeekStart) {
      groups.this_month.push(record);
    } else if (dateOnly >= lastMonthStart && dateOnly < thisMonthStart) {
      groups.last_month.push(record);
    } else {
      groups.older.push(record);
    }
  });

  const labels: Record<string, string> = {
    today: 'Today',
    yesterday: 'Yesterday',
    this_week: 'This Week',
    last_week: 'Last Week',
    this_month: 'This Month',
    last_month: 'Last Month',
    older: 'Older',
  };

  return Object.entries(groups)
    .filter(([, recs]) => recs.length > 0)
    .map(([key, recs]) => ({
      label: labels[key],
      key,
      records: recs,
    }));
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Timeline Entry Card
const TimelineEntry = memo(function TimelineEntry({
  record,
  dateField,
  isLast,
  onClick,
}: {
  record: CrmRecord;
  dateField: SortByDate;
  isLast: boolean;
  onClick: () => void;
}) {
  const displayName = getDisplayName(record);
  const status = getStatusText(record);
  const dotColor = getStatusDotColor(record);
  const email = (record.email || record.data?.email) as string | undefined;
  const phone = (record.phone || record.data?.phone) as string | undefined;
  const amount = Number(record.data?.amount) || 0;
  const relativeTime = formatRelativeTime(record[dateField]);

  return (
    <div className="flex gap-4 group">
      {/* Timeline Rail */}
      <div className="flex flex-col items-center flex-shrink-0 w-8">
        <div className={cn(
          'w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 shadow-sm z-10 mt-1.5 transition-transform group-hover:scale-125',
          dotColor
        )} />
        {!isLast && (
          <div className="w-0.5 flex-1 bg-slate-200 dark:bg-white/10 -mt-0.5" />
        )}
      </div>

      {/* Content Card */}
      <div
        className={cn(
          'flex-1 mb-4 p-4 rounded-xl border border-slate-200 dark:border-white/10 transition-all cursor-pointer',
          'bg-white dark:bg-slate-800/50',
          'hover:border-teal-500/30 hover:shadow-md'
        )}
        onClick={onClick}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Link
                href={`/crm/r/${record.id}`}
                className="font-semibold text-sm text-slate-900 dark:text-white hover:text-teal-600 dark:hover:text-teal-400 transition-colors truncate"
                onClick={(e) => e.stopPropagation()}
              >
                {displayName}
              </Link>
              {status && (
                <span className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0',
                  'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10'
                )}>
                  {status}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
              {email && (
                <span className="flex items-center gap-1 truncate max-w-[200px]">
                  <Mail className="w-3 h-3 flex-shrink-0" />
                  {email}
                </span>
              )}
              {phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3 flex-shrink-0" />
                  {phone}
                </span>
              )}
              {amount > 0 && (
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  ${amount.toLocaleString()}
                </span>
              )}
              {record.owner_id && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3 flex-shrink-0" />
                  Assigned
                </span>
              )}
            </div>
          </div>

          <span className="text-[11px] text-slate-400 dark:text-slate-500 flex-shrink-0 mt-0.5" suppressHydrationWarning>
            {relativeTime}
          </span>
        </div>
      </div>
    </div>
  );
});

// Date Group Section
const DateGroupSection = memo(function DateGroupSection({
  group,
  dateField,
  onClick,
}: {
  group: DateGroup;
  dateField: SortByDate;
  onClick: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div>
      {/* Group Header */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 mb-3 group/header cursor-pointer"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover/header:text-slate-600 dark:group-hover/header:text-slate-300" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 group-hover/header:text-slate-600 dark:group-hover/header:text-slate-300" />
        )}
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover/header:text-slate-900 dark:group-hover/header:text-white transition-colors">
          {group.label}
        </h3>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {group.records.length} {group.records.length === 1 ? 'record' : 'records'}
        </span>
      </button>

      {/* Group Content */}
      {!collapsed && (
        <div className="ml-2">
          {group.records.map((record, idx) => (
            <TimelineEntry
              key={record.id}
              record={record}
              dateField={dateField}
              isLast={idx === group.records.length - 1}
              onClick={() => onClick(record.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export const TimelineView = memo(function TimelineView({
  records,
  fields,
  moduleKey,
  onRowClick,
}: TimelineViewProps) {
  const router = useRouter();
  const [sortByDate, setSortByDate] = useState<SortByDate>('created_at');

  const dateGroups = useMemo(
    () => groupRecordsByDate(records, sortByDate),
    [records, sortByDate]
  );

  const handleClick = useCallback((id: string) => {
    if (onRowClick) {
      onRowClick(id);
    } else {
      router.push(`/crm/r/${id}`);
    }
  }, [onRowClick, router]);

  if (records.length === 0) {
    return (
      <div className="glass-card rounded-2xl border border-slate-200 dark:border-white/10 p-12 text-center">
        <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800/50 inline-block mb-4">
          <Inbox className="w-10 h-10 text-slate-400 dark:text-slate-600" />
        </div>
        <p className="text-lg font-medium text-slate-900 dark:text-white mb-1">No records yet</p>
        <p className="text-sm text-slate-500 mb-4">Create records to see them on the timeline.</p>
        <Button className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400" asChild>
          <Link href={`/crm/modules/${moduleKey}/new`}>
            <Plus className="w-4 h-4 mr-2" />
            Create Record
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <Clock className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Sort by</span>
        <Select value={sortByDate} onValueChange={(v) => setSortByDate(v as SortByDate)}>
          <SelectTrigger className="h-9 w-[160px] text-sm rounded-lg bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">Date Created</SelectItem>
            <SelectItem value="updated_at">Last Modified</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">
          {records.length} records across {dateGroups.length} periods
        </span>
      </div>

      {/* Timeline */}
      <div className="glass-card rounded-2xl border border-slate-200 dark:border-white/10 p-6">
        <div className="space-y-6">
          {dateGroups.map(group => (
            <DateGroupSection
              key={group.key}
              group={group}
              dateField={sortByDate}
              onClick={handleClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

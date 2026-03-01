'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Button,
} from '@crm-eco/ui';
import {
  ClipboardCheck,
  Clock,
  CalendarCheck,
  Bell,
  TrendingDown,
  MessageSquare,
  UserPlus,
  RefreshCw,
  Inbox,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@crm-eco/ui/lib/utils';
import { WorkqueueItemRow } from './WorkqueueItemRow';
import type {
  WorkqueueItem,
  WorkqueueSummary,
  WorkqueueTab,
  WorkqueueActionKey,
  WorkqueueResponse,
} from '@/lib/workqueue/types';

// ---------------------------------------------------------------------------
// Stat card config
// ---------------------------------------------------------------------------

interface StatConfig {
  key: keyof WorkqueueSummary;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  filterTab: WorkqueueTab;
  filterTypes?: WorkqueueItem['type'][];
}

const STAT_CARDS: StatConfig[] = [
  {
    key: 'approvals',
    label: 'Approvals',
    icon: ClipboardCheck,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-500/20',
    filterTab: 'approvals',
  },
  {
    key: 'overdueTasks',
    label: 'Overdue',
    icon: Clock,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-500/20',
    filterTab: 'tasks',
    filterTypes: ['overdue_task'],
  },
  {
    key: 'todayTasks',
    label: "Today's Tasks",
    icon: CalendarCheck,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-500/20',
    filterTab: 'tasks',
    filterTypes: ['today_task'],
  },
  {
    key: 'followUps',
    label: 'Follow-ups',
    icon: Bell,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-100 dark:bg-purple-500/20',
    filterTab: 'tasks',
    filterTypes: ['follow_up'],
  },
  {
    key: 'newLeads',
    label: 'New Leads',
    icon: UserPlus,
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-100 dark:bg-orange-500/20',
    filterTab: 'leads',
  },
  {
    key: 'atRiskDeals',
    label: 'At Risk',
    icon: TrendingDown,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-500/20',
    filterTab: 'deals',
  },
  {
    key: 'messages',
    label: 'Messages',
    icon: MessageSquare,
    color: 'text-teal-600 dark:text-teal-400',
    bg: 'bg-teal-100 dark:bg-teal-500/20',
    filterTab: 'messages',
  },
];

// ---------------------------------------------------------------------------
// Tabs that map item types to a tab value
// ---------------------------------------------------------------------------

const TAB_TYPE_MAP: Record<WorkqueueTab, WorkqueueItem['type'][] | null> = {
  all: null,
  approvals: ['pending_approval'],
  tasks: ['overdue_task', 'today_task', 'follow_up'],
  deals: ['at_risk_deal'],
  messages: ['unread_message'],
};

// ---------------------------------------------------------------------------
// Auto-refresh interval (ms)
// ---------------------------------------------------------------------------

const REFRESH_INTERVAL = 60_000;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkqueueView() {
  const [items, setItems] = useState<WorkqueueItem[]>([]);
  const [summary, setSummary] = useState<WorkqueueSummary>({
    approvals: 0,
    overdueTasks: 0,
    todayTasks: 0,
    followUps: 0,
    atRiskDeals: 0,
    messages: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<WorkqueueTab>('all');
  const [subFilter, setSubFilter] = useState<WorkqueueItem['type'][] | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // -----------------------------------------------------------------------
  // Fetch
  // -----------------------------------------------------------------------

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/crm/workqueue');
      if (!res.ok) throw new Error('Failed to fetch');
      const data: WorkqueueResponse = await res.json();
      setItems(data.items);
      setSummary(data.summary);
    } catch {
      if (!silent) toast.error('Failed to load workqueue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    timerRef.current = setInterval(() => fetchData(true), REFRESH_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchData]);

  // -----------------------------------------------------------------------
  // Quick-action handler
  // -----------------------------------------------------------------------

  const handleAction = useCallback(
    async (
      itemId: string,
      itemType: WorkqueueItem['type'],
      action: WorkqueueActionKey,
    ): Promise<boolean> => {
      try {
        const res = await fetch('/api/crm/workqueue/act', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId, itemType, action }),
        });

        const data = await res.json();
        if (!data.success) {
          toast.error(data.error || 'Action failed');
          return false;
        }

        const label =
          action === 'approve'
            ? 'Approved'
            : action === 'reject'
              ? 'Rejected'
              : action === 'complete'
                ? 'Completed'
                : action === 'snooze'
                  ? 'Snoozed for 24h'
                  : action === 'dismiss'
                    ? 'Dismissed'
                    : 'Done';

        toast.success(label);

        // Refresh counts after a short delay
        setTimeout(() => fetchData(true), 800);
        return true;
      } catch {
        toast.error('Action failed');
        return false;
      }
    },
    [fetchData],
  );

  // -----------------------------------------------------------------------
  // Filtering
  // -----------------------------------------------------------------------

  const visibleItems = (() => {
    // If a sub-filter from stat card is active, use that
    if (subFilter) return items.filter((i) => subFilter.includes(i.type));
    // Otherwise filter by tab
    const types = TAB_TYPE_MAP[activeTab];
    if (!types) return items;
    return items.filter((i) => types.includes(i.type));
  })();

  function handleStatClick(stat: StatConfig) {
    setActiveTab(stat.filterTab);
    setSubFilter(stat.filterTypes || null);
  }

  function handleTabChange(tab: string) {
    setActiveTab(tab as WorkqueueTab);
    setSubFilter(null);
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {STAT_CARDS.map((stat) => {
          const Icon = stat.icon;
          const count = summary[stat.key] as number;
          const isActive =
            subFilter && stat.filterTypes
              ? JSON.stringify(subFilter) === JSON.stringify(stat.filterTypes)
              : !subFilter && activeTab === stat.filterTab && activeTab !== 'all';

          return (
            <button
              key={stat.key}
              onClick={() => handleStatClick(stat)}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                isActive
                  ? 'border-slate-400 dark:border-slate-500 shadow-sm bg-white dark:bg-slate-800'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-600',
              )}
            >
              <div className={cn('p-2 rounded-lg', stat.bg)}>
                <Icon className={cn('w-4 h-4', stat.color)} />
              </div>
              <div>
                <p className={cn('text-lg font-bold tabular-nums', stat.color)}>{count}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{stat.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tabs + refresh */}
      <div className="flex items-center justify-between gap-4">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="flex-1"
        >
          <TabsList>
            <TabsTrigger value="all">
              All
              {summary.total > 0 && (
                <span className="ml-1.5 text-xs bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded-full tabular-nums">
                  {summary.total}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approvals">
              <ClipboardCheck className="w-3.5 h-3.5 mr-1.5" />
              Approvals
            </TabsTrigger>
            <TabsTrigger value="tasks">
              <Clock className="w-3.5 h-3.5 mr-1.5" />
              Tasks & Follow-ups
            </TabsTrigger>
            <TabsTrigger value="deals">
              <TrendingDown className="w-3.5 h-3.5 mr-1.5" />
              Deals
            </TabsTrigger>
            <TabsTrigger value="messages">
              <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
              Messages
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchData()}
          disabled={loading}
          className="shrink-0"
        >
          <RefreshCw className={cn('w-4 h-4 mr-1.5', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Item list */}
      <div className="rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05),0_20px_25px_-5px_rgba(0,0,0,0.05)]">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
          </div>
        ) : visibleItems.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {visibleItems.map((item) => (
              <WorkqueueItemRow
                key={`${item.type}-${item.id}`}
                item={item}
                onAction={handleAction}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mb-4">
              <Inbox className="w-7 h-7 text-emerald-500 dark:text-emerald-400" />
            </div>
            <p className="text-base font-semibold text-slate-700 dark:text-slate-200">
              All clear!
            </p>
            <p className="text-sm mt-1">No items requiring your attention</p>
          </div>
        )}
      </div>
    </div>
  );
}

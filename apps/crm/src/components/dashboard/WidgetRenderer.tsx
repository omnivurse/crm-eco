'use client';

import dynamic from 'next/dynamic';
import { cn } from '@crm-eco/ui/lib/utils';
import type { WidgetInstance, WidgetSize } from '@/lib/dashboard/types';
import { WIDGET_REGISTRY } from '@/lib/dashboard/widget-registry';

// Loading skeleton for widgets
function WidgetSkeleton() {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50 overflow-hidden animate-pulse">
      <div className="h-1 bg-slate-200 dark:bg-slate-700" />
      <div className="p-6 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-3 w-24 bg-slate-100 dark:bg-slate-800 rounded" />
          </div>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-lg" />
        <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-lg" />
        <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-lg" />
      </div>
    </div>
  );
}

// Dynamic imports with loading skeletons for code splitting
const TodaysTasksWidget = dynamic(() => import('./widgets/TodaysTasksWidget'), { loading: WidgetSkeleton });
const QuickActionsWidget = dynamic(() => import('./widgets/QuickActionsWidget'), { loading: WidgetSkeleton });
const AtRiskDealsWidget = dynamic(() => import('./widgets/AtRiskDealsWidget'), { loading: WidgetSkeleton });
const RecentActivityWidget = dynamic(() => import('./widgets/RecentActivityWidget'), { loading: WidgetSkeleton });
const UpcomingTasksWidget = dynamic(() => import('./widgets/UpcomingTasksWidget'), { loading: WidgetSkeleton });
const PipelineSummaryWidget = dynamic(() => import('./widgets/PipelineSummaryWidget'), { loading: WidgetSkeleton });
const TopDealsWidget = dynamic(() => import('./widgets/TopDealsWidget'), { loading: WidgetSkeleton });
const PerformanceMetricsWidget = dynamic(() => import('./widgets/PerformanceMetricsWidget'), { loading: WidgetSkeleton });
const CalendarEventsWidget = dynamic(() => import('./widgets/CalendarEventsWidget'), { loading: WidgetSkeleton });
const NotesMemosWidget = dynamic(() => import('./widgets/NotesMemosWidget'), { loading: WidgetSkeleton });
const EmailStatsWidget = dynamic(() => import('./widgets/EmailStatsWidget'), { loading: WidgetSkeleton });
const LeadConversionWidget = dynamic(() => import('./widgets/LeadConversionWidget'), { loading: WidgetSkeleton });
const TeamLeaderboardWidget = dynamic(() => import('./widgets/TeamLeaderboardWidget'), { loading: WidgetSkeleton });
const RevenueChartWidget = dynamic(() => import('./widgets/RevenueChartWidget'), { loading: WidgetSkeleton });

// Using 'any' here since each widget has its own specific data type
const WIDGET_COMPONENTS: Record<string, React.ComponentType<any>> = {
  'todays-tasks': TodaysTasksWidget,
  'quick-actions': QuickActionsWidget,
  'at-risk-deals': AtRiskDealsWidget,
  'recent-activity': RecentActivityWidget,
  'upcoming-tasks': UpcomingTasksWidget,
  'pipeline-summary': PipelineSummaryWidget,
  'top-deals': TopDealsWidget,
  'performance-metrics': PerformanceMetricsWidget,
  'calendar-events': CalendarEventsWidget,
  'notes-memos': NotesMemosWidget,
  'email-stats': EmailStatsWidget,
  'lead-conversion': LeadConversionWidget,
  'team-leaderboard': TeamLeaderboardWidget,
  'revenue-chart': RevenueChartWidget,
};

interface WidgetRendererProps {
  widget: WidgetInstance;
  data: unknown;
  isDragging?: boolean;
}

export function WidgetRenderer({ widget, data, isDragging }: WidgetRendererProps) {
  const Component = WIDGET_COMPONENTS[widget.type];
  const definition = WIDGET_REGISTRY[widget.type];

  if (!Component) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
        <p className="text-sm text-red-600 dark:text-red-400">
          Unknown widget type: {widget.type}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'h-full transition-all duration-200',
        isDragging && 'ring-2 ring-teal-500 ring-offset-2'
      )}
    >
      <Component data={data} size={widget.size} />
    </div>
  );
}

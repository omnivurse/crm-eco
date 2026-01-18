'use client';

import dynamic from 'next/dynamic';
import { cn } from '@crm-eco/ui/lib/utils';
import type { WidgetInstance, WidgetSize } from '@/lib/dashboard/types';
import { WIDGET_REGISTRY } from '@/lib/dashboard/widget-registry';

// Dynamic imports for code splitting
const TodaysTasksWidget = dynamic(() => import('./widgets/TodaysTasksWidget'));
const QuickActionsWidget = dynamic(() => import('./widgets/QuickActionsWidget'));
const AtRiskDealsWidget = dynamic(() => import('./widgets/AtRiskDealsWidget'));
const RecentActivityWidget = dynamic(() => import('./widgets/RecentActivityWidget'));
const UpcomingTasksWidget = dynamic(() => import('./widgets/UpcomingTasksWidget'));
const PipelineSummaryWidget = dynamic(() => import('./widgets/PipelineSummaryWidget'));
const TopDealsWidget = dynamic(() => import('./widgets/TopDealsWidget'));
const PerformanceMetricsWidget = dynamic(() => import('./widgets/PerformanceMetricsWidget'));
const CalendarEventsWidget = dynamic(() => import('./widgets/CalendarEventsWidget'));
const NotesMemosWidget = dynamic(() => import('./widgets/NotesMemosWidget'));
const EmailStatsWidget = dynamic(() => import('./widgets/EmailStatsWidget'));
const LeadConversionWidget = dynamic(() => import('./widgets/LeadConversionWidget'));
const TeamLeaderboardWidget = dynamic(() => import('./widgets/TeamLeaderboardWidget'));
const RevenueChartWidget = dynamic(() => import('./widgets/RevenueChartWidget'));

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

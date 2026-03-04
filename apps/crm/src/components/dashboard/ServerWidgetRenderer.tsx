import type { WidgetInstance, WidgetSize } from '@/lib/dashboard/types';
import { WIDGET_REGISTRY } from '@/lib/dashboard/widget-registry';

// Import all widgets directly (no dynamic imports - these are Server Components)
import TodaysTasksWidget from './widgets/TodaysTasksWidget';
import QuickActionsWidget from './widgets/QuickActionsWidget';
import AtRiskDealsWidget from './widgets/AtRiskDealsWidget';
import RecentActivityWidget from './widgets/RecentActivityWidget';
import UpcomingTasksWidget from './widgets/UpcomingTasksWidget';
import PipelineSummaryWidget from './widgets/PipelineSummaryWidget';
import TopDealsWidget from './widgets/TopDealsWidget';
import PerformanceMetricsWidget from './widgets/PerformanceMetricsWidget';
import CalendarEventsWidget from './widgets/CalendarEventsWidget';
import NotesMemosWidget from './widgets/NotesMemosWidget';
import EmailStatsWidget from './widgets/EmailStatsWidget';
import LeadConversionWidget from './widgets/LeadConversionWidget';
import TeamLeaderboardWidget from './widgets/TeamLeaderboardWidget';
import RevenueChartWidget from './widgets/RevenueChartWidget';
import SalesCommandTilesWidget from './widgets/SalesCommandTilesWidget';
import ModuleStatsWidget from './widgets/ModuleStatsWidget';
import PipelineFunnelWidget from './widgets/PipelineFunnelWidget';
import AdvisorContactsWidget from './widgets/AdvisorContactsWidget';
import AdvisorGrowthWidget from './widgets/AdvisorGrowthWidget';
import TopAdvisorsWidget from './widgets/TopAdvisorsWidget';
import LowestChurnAdvisorsWidget from './widgets/LowestChurnAdvisorsWidget';
import AdvisorRetentionWidget from './widgets/AdvisorRetentionWidget';

// Base props interface for all widgets
interface BaseWidgetProps {
  data: unknown;
  size: WidgetSize;
}

// Widget component type that accepts base props
type WidgetComponent = React.ComponentType<BaseWidgetProps>;

// Map widget types to components
// Using type assertion since each widget has specific data types
const WIDGET_COMPONENTS: Record<string, WidgetComponent> = {
  'todays-tasks': TodaysTasksWidget as WidgetComponent,
  'quick-actions': QuickActionsWidget as WidgetComponent,
  'at-risk-deals': AtRiskDealsWidget as WidgetComponent,
  'recent-activity': RecentActivityWidget as WidgetComponent,
  'upcoming-tasks': UpcomingTasksWidget as WidgetComponent,
  'pipeline-summary': PipelineSummaryWidget as WidgetComponent,
  'top-deals': TopDealsWidget as WidgetComponent,
  'performance-metrics': PerformanceMetricsWidget as WidgetComponent,
  'calendar-events': CalendarEventsWidget as WidgetComponent,
  'notes-memos': NotesMemosWidget as WidgetComponent,
  'email-stats': EmailStatsWidget as WidgetComponent,
  'lead-conversion': LeadConversionWidget as WidgetComponent,
  'team-leaderboard': TeamLeaderboardWidget as WidgetComponent,
  'revenue-chart': RevenueChartWidget as WidgetComponent,
  'sales-command-tiles': SalesCommandTilesWidget as WidgetComponent,
  'module-stats': ModuleStatsWidget as WidgetComponent,
  'pipeline-funnel': PipelineFunnelWidget as WidgetComponent,
  'advisor-contacts': AdvisorContactsWidget as WidgetComponent,
  'advisor-growth': AdvisorGrowthWidget as WidgetComponent,
  'top-advisors': TopAdvisorsWidget as WidgetComponent,
  'lowest-churn-advisors': LowestChurnAdvisorsWidget as WidgetComponent,
  'advisor-member-retention': AdvisorRetentionWidget as WidgetComponent,
};

interface ServerWidgetRendererProps {
  widget: WidgetInstance;
  data: unknown;
}

/**
 * Server Component that renders widget content.
 * This is rendered on the server and passed as children to client-side wrappers.
 */
export function ServerWidgetRenderer({ widget, data }: ServerWidgetRendererProps) {
  const Component = WIDGET_COMPONENTS[widget.type];

  if (!Component) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
        <p className="text-sm text-red-600 dark:text-red-400">
          Unknown widget type: {widget.type}
        </p>
      </div>
    );
  }

  return <Component data={data} size={widget.size} />;
}

/**
 * Pre-renders all widgets for a layout.
 * Returns a map of widget ID to pre-rendered ReactNode.
 */
export function preRenderWidgets(
  widgets: WidgetInstance[],
  widgetData: Record<string, unknown>
): Record<string, React.ReactNode> {
  const rendered: Record<string, React.ReactNode> = {};

  for (const widget of widgets) {
    const definition = WIDGET_REGISTRY[widget.type];
    const dataKey = definition?.dataKey;
    const data = dataKey ? widgetData[dataKey] : null;

    rendered[widget.id] = (
      <ServerWidgetRenderer key={widget.id} widget={widget} data={data} />
    );
  }

  return rendered;
}

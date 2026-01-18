/**
 * Dashboard Widget Registry - Catalog of available widgets
 */

import type { WidgetDefinition, DashboardLayoutConfig } from './types';

// Re-export types for convenience
export type { WidgetDefinition, DashboardLayoutConfig } from './types';

export const WIDGET_REGISTRY: Record<string, WidgetDefinition> = {
  'todays-tasks': {
    id: 'todays-tasks',
    name: "Today's Tasks",
    description: 'Tasks due today with overdue alerts',
    icon: 'Sun',
    defaultSize: 'medium',
    allowedSizes: ['small', 'medium', 'large'],
    category: 'tasks',
    dataKey: 'todaysTasks',
  },
  'quick-actions': {
    id: 'quick-actions',
    name: 'Quick Actions',
    description: 'Common CRM actions at your fingertips',
    icon: 'Zap',
    defaultSize: 'small',
    allowedSizes: ['small', 'medium'],
    category: 'quick-actions',
    dataKey: 'quickActions',
  },
  'at-risk-deals': {
    id: 'at-risk-deals',
    name: 'At-Risk Deals',
    description: 'Stale deals requiring attention (7+ days)',
    icon: 'Flame',
    defaultSize: 'medium',
    allowedSizes: ['small', 'medium', 'large'],
    category: 'deals',
    dataKey: 'atRiskDeals',
  },
  'recent-activity': {
    id: 'recent-activity',
    name: 'Recent Activity',
    description: 'Latest CRM activity feed',
    icon: 'Activity',
    defaultSize: 'medium',
    allowedSizes: ['small', 'medium', 'large'],
    category: 'activity',
    dataKey: 'recentActivity',
  },
  'upcoming-tasks': {
    id: 'upcoming-tasks',
    name: 'Upcoming Tasks',
    description: 'Tasks for the next 7 days',
    icon: 'Calendar',
    defaultSize: 'medium',
    allowedSizes: ['small', 'medium', 'large'],
    category: 'tasks',
    dataKey: 'upcomingTasks',
  },
  'pipeline-summary': {
    id: 'pipeline-summary',
    name: 'Pipeline Summary',
    description: 'Deal pipeline overview by stage',
    icon: 'BarChart3',
    defaultSize: 'large',
    allowedSizes: ['medium', 'large', 'full'],
    category: 'deals',
    dataKey: 'pipelineSummary',
  },
  'top-deals': {
    id: 'top-deals',
    name: 'Top Deals',
    description: 'Highest value opportunities',
    icon: 'TrendingUp',
    defaultSize: 'medium',
    allowedSizes: ['small', 'medium', 'large'],
    category: 'deals',
    dataKey: 'topDeals',
  },
  'performance-metrics': {
    id: 'performance-metrics',
    name: 'Performance Metrics',
    description: 'Key performance indicators',
    icon: 'Target',
    defaultSize: 'large',
    allowedSizes: ['medium', 'large', 'full'],
    category: 'metrics',
    dataKey: 'performanceMetrics',
  },
  'calendar-events': {
    id: 'calendar-events',
    name: 'Calendar Events',
    description: 'Upcoming meetings and events',
    icon: 'CalendarDays',
    defaultSize: 'medium',
    allowedSizes: ['small', 'medium', 'large'],
    category: 'other',
    dataKey: 'calendarEvents',
  },
  'notes-memos': {
    id: 'notes-memos',
    name: 'Notes & Memos',
    description: 'Personal notes and reminders',
    icon: 'StickyNote',
    defaultSize: 'small',
    allowedSizes: ['small', 'medium'],
    category: 'other',
    dataKey: 'notesMemos',
  },
  'email-stats': {
    id: 'email-stats',
    name: 'Email Stats',
    description: 'Sent, opened, and replied email metrics',
    icon: 'Mail',
    defaultSize: 'medium',
    allowedSizes: ['small', 'medium', 'large'],
    category: 'email',
    dataKey: 'emailStats',
  },
  'lead-conversion': {
    id: 'lead-conversion',
    name: 'Lead Conversion',
    description: 'Lead to deal conversion funnel',
    icon: 'ArrowRightCircle',
    defaultSize: 'large',
    allowedSizes: ['medium', 'large', 'full'],
    category: 'metrics',
    dataKey: 'leadConversion',
  },
  'team-leaderboard': {
    id: 'team-leaderboard',
    name: 'Team Leaderboard',
    description: 'Top performers by deals and tasks',
    icon: 'Trophy',
    defaultSize: 'medium',
    allowedSizes: ['small', 'medium', 'large'],
    category: 'metrics',
    dataKey: 'teamLeaderboard',
  },
  'revenue-chart': {
    id: 'revenue-chart',
    name: 'Revenue Chart',
    description: 'Monthly and quarterly revenue trends',
    icon: 'LineChart',
    defaultSize: 'full',
    allowedSizes: ['large', 'full'],
    category: 'metrics',
    dataKey: 'revenueChart',
  },
};

export const DEFAULT_LAYOUT: DashboardLayoutConfig = {
  widgets: [
    { id: 'widget-1', type: 'todays-tasks', position: 0, size: 'medium' },
    { id: 'widget-2', type: 'at-risk-deals', position: 1, size: 'medium' },
    { id: 'widget-3', type: 'quick-actions', position: 2, size: 'small' },
    { id: 'widget-4', type: 'recent-activity', position: 3, size: 'medium' },
  ],
};

export const WIDGET_CATEGORIES = [
  { id: 'tasks', label: 'Tasks', icon: 'CheckSquare' },
  { id: 'deals', label: 'Deals', icon: 'DollarSign' },
  { id: 'activity', label: 'Activity', icon: 'Activity' },
  { id: 'metrics', label: 'Metrics', icon: 'BarChart3' },
  { id: 'email', label: 'Email', icon: 'Mail' },
  { id: 'quick-actions', label: 'Actions', icon: 'Zap' },
  { id: 'other', label: 'Other', icon: 'MoreHorizontal' },
] as const;

export function getWidgetDefinition(type: string): WidgetDefinition | undefined {
  return WIDGET_REGISTRY[type];
}

export function getWidgetsByCategory(category: string): WidgetDefinition[] {
  return Object.values(WIDGET_REGISTRY).filter((w) => w.category === category);
}

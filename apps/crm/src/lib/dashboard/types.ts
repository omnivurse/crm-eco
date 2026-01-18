/**
 * Dashboard Widget System - Type Definitions
 */

export type WidgetSize = 'small' | 'medium' | 'large' | 'full';

export type WidgetCategory =
  | 'tasks'
  | 'deals'
  | 'activity'
  | 'metrics'
  | 'quick-actions'
  | 'email'
  | 'other';

export interface WidgetDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  defaultSize: WidgetSize;
  allowedSizes: WidgetSize[];
  category: WidgetCategory;
  dataKey: string;
}

export interface WidgetInstance {
  id: string;
  type: string;
  position: number;
  size: WidgetSize;
}

export interface DashboardLayoutConfig {
  widgets: WidgetInstance[];
}

export interface DashboardLayoutState extends DashboardLayoutConfig {
  isDirty: boolean;
  isLoading: boolean;
  isSaving: boolean;
}

export interface WidgetDataMap {
  todaysTasks: unknown;
  upcomingTasks: unknown;
  recentActivity: unknown;
  atRiskDeals: unknown;
  topDeals: unknown;
  pipelineSummary: unknown;
  performanceMetrics: unknown;
  calendarEvents: unknown;
  quickActions: null;
  notesMemos: unknown;
  emailStats: unknown;
  leadConversion: unknown;
  teamLeaderboard: unknown;
  revenueChart: unknown;
  moduleStats: unknown;
}

export type WidgetDataKey = keyof WidgetDataMap;

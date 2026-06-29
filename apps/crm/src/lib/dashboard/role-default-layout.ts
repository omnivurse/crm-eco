/**
 * Role-aware dashboard defaults — applied only when the user has no saved
 * layout in saved_views. Existing custom layouts are never overwritten.
 */

import type { CrmRole } from '@/lib/crm/types';
import type { DashboardLayoutConfig, WidgetInstance } from './types';
import { DEFAULT_LAYOUT } from './widget-registry';

function layout(widgets: WidgetInstance[]): DashboardLayoutConfig {
  return { widgets };
}

/** Sales reps — tasks, pipeline, and personal queue first. */
const AGENT_LAYOUT: DashboardLayoutConfig = layout([
  { id: 'agent-w1', type: 'todays-tasks', position: 0, size: 'medium' },
  { id: 'agent-w2', type: 'at-risk-deals', position: 0, size: 'medium' },
  { id: 'agent-w3', type: 'upcoming-tasks', position: 1, size: 'medium' },
  { id: 'agent-w4', type: 'recent-activity', position: 1, size: 'medium' },
  { id: 'agent-w5', type: 'quick-actions', position: 2, size: 'small' },
  { id: 'agent-w6', type: 'pipeline-funnel', position: 3, size: 'full' },
]);

/** Team leads — pipeline + advisor visibility. */
const MANAGER_LAYOUT: DashboardLayoutConfig = layout([
  { id: 'mgr-w1', type: 'sales-command-tiles', position: 0, size: 'full' },
  { id: 'mgr-w2', type: 'todays-tasks', position: 1, size: 'medium' },
  { id: 'mgr-w3', type: 'at-risk-deals', position: 1, size: 'medium' },
  { id: 'mgr-w4', type: 'advisor-contacts', position: 2, size: 'large' },
  { id: 'mgr-w5', type: 'pipeline-funnel', position: 3, size: 'full' },
  { id: 'mgr-w6', type: 'recent-activity', position: 4, size: 'medium' },
]);

/** Read-only — metrics and activity, no action widgets. */
const VIEWER_LAYOUT: DashboardLayoutConfig = layout([
  { id: 'view-w1', type: 'module-stats', position: 0, size: 'full' },
  { id: 'view-w2', type: 'pipeline-funnel', position: 1, size: 'full' },
  { id: 'view-w3', type: 'recent-activity', position: 2, size: 'medium' },
  { id: 'view-w4', type: 'calendar-events', position: 2, size: 'medium' },
]);

/**
 * Pick the best default widget grid for a CRM role.
 * Falls back to org-wide DEFAULT_LAYOUT (admin-oriented).
 */
export function resolveDefaultDashboardLayout(
  crmRole: CrmRole | null | undefined,
): DashboardLayoutConfig {
  switch (crmRole) {
    case 'crm_agent':
      return AGENT_LAYOUT;
    case 'crm_manager':
      return MANAGER_LAYOUT;
    case 'crm_viewer':
      return VIEWER_LAYOUT;
    case 'crm_admin':
    default:
      return DEFAULT_LAYOUT;
  }
}

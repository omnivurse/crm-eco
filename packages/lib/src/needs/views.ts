/**
 * Types for Personal Saved Views in the Needs Command Center.
 */

import type { NeedStatus } from '../types';

/**
 * Preset/built-in saved view keys.
 */
export type SavedViewKey = 'all' | 'today_overdue' | 'new_this_week' | 'new_last_7_days';

/**
 * SLA filter values.
 */
export type SlaFilterValue = 'all' | 'green' | 'orange' | 'red';

/**
 * The serialized filter state for the Needs Command Center.
 * Stored in saved_views.filters as JSONB.
 */
export type NeedsCommandCenterSavedFilters = {
  /** Preset/builtin view (All / Today's Overdue / New This Week / New Last 7 Days) */
  savedView?: SavedViewKey;

  /** SLA bucket filter */
  selectedSlaFilter?: SlaFilterValue;

  /** Status filters - list of NeedStatus values */
  selectedStatuses?: NeedStatus[];

  /** Search term (member name, description, etc.) */
  search?: string;

  /** Assignee filter */
  selectedAssigneeId?: string | 'all';
};

/**
 * A saved view for the Needs Command Center.
 */
export interface NeedsCommandCenterSavedView {
  id: string;
  organization_id: string;
  owner_profile_id: string;
  context: string;
  name: string;
  is_default: boolean;
  filters: NeedsCommandCenterSavedFilters;
  created_at: string;
  updated_at: string;
}

/**
 * Context identifier for the Needs Command Center saved views.
 */
export const NEEDS_COMMAND_CENTER_CONTEXT = 'needs_command_center';


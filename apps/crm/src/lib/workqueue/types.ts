/**
 * Workqueue -- All-in-One View Types
 *
 * Shared between API route, page, and components.
 */

// ---------------------------------------------------------------------------
// Work Item Types
// ---------------------------------------------------------------------------

export type WorkqueueItemType =
  | 'pending_approval'
  | 'overdue_task'
  | 'today_task'
  | 'follow_up'
  | 'at_risk_deal'
  | 'unread_message'
  | 'new_lead';

export type WorkqueuePriority = 'urgent' | 'high' | 'normal' | 'low';

export type WorkqueueActionKey =
  | 'approve'
  | 'reject'
  | 'request_changes'
  | 'complete'
  | 'snooze'
  | 'open'
  | 'dismiss'
  | 'reply';

export type WorkqueueActionVariant = 'primary' | 'danger' | 'secondary';

export interface WorkqueueAction {
  key: WorkqueueActionKey;
  label: string;
  variant: WorkqueueActionVariant;
}

export interface WorkqueueItem {
  id: string;
  type: WorkqueueItemType;
  priority: WorkqueuePriority;
  title: string;
  subtitle: string;
  recordId?: string;
  recordTitle?: string;
  moduleKey?: string;
  meta: Record<string, unknown>;
  createdAt: string;
  dueAt?: string;
  actions: WorkqueueAction[];
}

// ---------------------------------------------------------------------------
// Summary / Counts
// ---------------------------------------------------------------------------

export interface WorkqueueSummary {
  approvals: number;
  overdueTasks: number;
  todayTasks: number;
  followUps: number;
  atRiskDeals: number;
  messages: number;
  newLeads: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Tab Filter
// ---------------------------------------------------------------------------

export type WorkqueueTab =
  | 'all'
  | 'approvals'
  | 'tasks'
  | 'leads'
  | 'deals'
  | 'messages';

// ---------------------------------------------------------------------------
// API Request / Response
// ---------------------------------------------------------------------------

export interface WorkqueueResponse {
  items: WorkqueueItem[];
  summary: WorkqueueSummary;
}

export interface WorkqueueActRequest {
  itemId: string;
  itemType: WorkqueueItemType;
  action: WorkqueueActionKey;
  comment?: string;
}

export interface WorkqueueActResponse {
  success: boolean;
  error?: string;
}

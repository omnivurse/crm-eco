/**
 * Activity Log System — Type Definitions
 *
 * Lightweight, high-performance activity logging for all software actions.
 */

// ─── Core types ──────────────────────────────────────────────────────────────

export type ActivityCategory =
  | 'crm'
  | 'billing'
  | 'auth'
  | 'enrollment'
  | 'commission'
  | 'email'
  | 'admin'
  | 'portal'
  | 'integration'
  | 'system';

export interface ActivityLogEntry {
  /** Action performed, e.g. 'record.created', 'email.sent', 'login.success' */
  action: string;
  /** High-level category, e.g. 'crm', 'billing', 'auth' */
  category: ActivityCategory;
  /** Type of entity affected, e.g. 'contact', 'deal', 'invoice' */
  entityType?: string;
  /** ID of the entity affected */
  entityId?: string;
  /** Human-readable description of the activity */
  description?: string;
  /** Arbitrary structured data (diffs, context, etc.) */
  metadata?: Record<string, unknown>;
  /** Caller-supplied IP (auto-resolved from headers if omitted) */
  ipAddress?: string;
  /** Caller-supplied user-agent (auto-resolved from headers if omitted) */
  userAgent?: string;
}

export interface ActivityLogResult {
  success: boolean;
  activityId?: string;
  error?: string;
}

export interface ActivityLogRecord {
  id: string;
  organization_id: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  category: string;
  entity_type: string | null;
  entity_id: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface ActivityLogFilters {
  category?: ActivityCategory;
  action?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  dateFrom?: Date | string;
  dateTo?: Date | string;
}

// ─── Predefined actions ─────────────────────────────────────────────────────

export const ActivityActions = {
  // CRM
  RECORD_CREATED: 'record.created',
  RECORD_UPDATED: 'record.updated',
  RECORD_DELETED: 'record.deleted',
  RECORD_VIEWED: 'record.viewed',
  RECORD_IMPORTED: 'record.imported',
  RECORD_EXPORTED: 'record.exported',
  BULK_UPDATE: 'record.bulk_updated',
  BULK_DELETE: 'record.bulk_deleted',

  // Notes / Tasks / Calls
  NOTE_ADDED: 'note.added',
  TASK_CREATED: 'task.created',
  TASK_COMPLETED: 'task.completed',
  CALL_LOGGED: 'call.logged',
  MEETING_SCHEDULED: 'meeting.scheduled',

  // Email
  EMAIL_SENT: 'email.sent',
  EMAIL_OPENED: 'email.opened',
  EMAIL_CLICKED: 'email.clicked',
  EMAIL_BOUNCED: 'email.bounced',
  CAMPAIGN_LAUNCHED: 'campaign.launched',
  SEQUENCE_STARTED: 'sequence.started',

  // Auth
  LOGIN_SUCCESS: 'auth.login_success',
  LOGIN_FAILED: 'auth.login_failed',
  LOGOUT: 'auth.logout',
  PASSWORD_CHANGED: 'auth.password_changed',
  MFA_ENABLED: 'auth.mfa_enabled',

  // Enrollment
  ENROLLMENT_CREATED: 'enrollment.created',
  ENROLLMENT_APPROVED: 'enrollment.approved',
  ENROLLMENT_REJECTED: 'enrollment.rejected',
  ENROLLMENT_STEP_COMPLETED: 'enrollment.step_completed',

  // Billing
  PAYMENT_PROCESSED: 'billing.payment_processed',
  PAYMENT_FAILED: 'billing.payment_failed',
  INVOICE_CREATED: 'billing.invoice_created',
  REFUND_ISSUED: 'billing.refund_issued',

  // Commission
  COMMISSION_CALCULATED: 'commission.calculated',
  COMMISSION_PAID: 'commission.paid',

  // Admin / Settings
  SETTINGS_UPDATED: 'settings.updated',
  USER_INVITED: 'user.invited',
  USER_DEACTIVATED: 'user.deactivated',
  ROLE_CHANGED: 'user.role_changed',

  // Integration
  INTEGRATION_CONNECTED: 'integration.connected',
  INTEGRATION_DISCONNECTED: 'integration.disconnected',
  SYNC_COMPLETED: 'integration.sync_completed',
  SYNC_FAILED: 'integration.sync_failed',
  WEBHOOK_RECEIVED: 'integration.webhook_received',

  // System
  SYSTEM_ERROR: 'system.error',
  MIGRATION_RUN: 'system.migration_run',
  MAINTENANCE_STARTED: 'system.maintenance_started',
  MAINTENANCE_COMPLETED: 'system.maintenance_completed',
} as const;

export type ActivityAction = (typeof ActivityActions)[keyof typeof ActivityActions] | string;

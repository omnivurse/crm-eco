/**
 * Enterprise Audit Logging System - Type Definitions
 */

export type AppSource = 'crm' | 'admin' | 'portal' | 'system';

export type ActionCategory =
  | 'authentication'
  | 'authorization'
  | 'data_access'
  | 'data_modification'
  | 'data_deletion'
  | 'data_export'
  | 'configuration'
  | 'integration'
  | 'system';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AuditLogEntry {
  appSource: AppSource;
  action: string;
  actionCategory: ActionCategory;
  description?: string;
  riskLevel?: RiskLevel;

  // Target information
  targetEntityType?: string;
  targetEntityId?: string;
  targetUserId?: string;

  // Detailed payload
  details?: Record<string, unknown>;
  changes?: {
    old?: Record<string, unknown>;
    new?: Record<string, unknown>;
  };

  // Request context (auto-populated from headers if not provided)
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  sessionId?: string;
}

export interface AuditLogResult {
  success: boolean;
  auditId?: string;
  error?: string;
}

export interface AuditLogRecord {
  id: string;
  sequence_number: number;
  previous_hash: string | null;
  entry_hash: string;
  organization_id: string;
  app_source: AppSource;
  actor_id: string | null;
  actor_role: string | null;
  actor_email: string | null;
  target_user_id: string | null;
  target_entity_type: string | null;
  target_entity_id: string | null;
  action: string;
  action_category: ActionCategory;
  description: string | null;
  risk_level: RiskLevel;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
  session_id: string | null;
  details: Record<string, unknown>;
  changes: Record<string, unknown>;
  created_at: string;
}

export interface AuditLogFilters {
  userId?: string;
  actions?: string[];
  riskLevels?: RiskLevel[];
  entityType?: string;
  appSource?: AppSource;
  dateFrom?: Date | string;
  dateTo?: Date | string;
  searchQuery?: string;
}

/**
 * Predefined audit actions for type safety and consistency
 */
export const AuditActions = {
  // Authentication
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  LOGOUT: 'logout',
  PASSWORD_RESET: 'password_reset',
  PASSWORD_CHANGED: 'password_changed',
  MFA_ENABLED: 'mfa_enabled',
  MFA_DISABLED: 'mfa_disabled',
  SESSION_EXPIRED: 'session_expired',

  // Authorization
  ROLE_CHANGED: 'role_changed',
  PERMISSION_GRANTED: 'permission_granted',
  PERMISSION_REVOKED: 'permission_revoked',

  // User Management
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  USER_DELETED: 'user_deleted',
  USER_DEACTIVATED: 'user_deactivated',
  USER_REACTIVATED: 'user_reactivated',
  USER_INVITED: 'user_invited',

  // Data Operations - Generic
  RECORD_VIEWED: 'record_viewed',
  RECORD_CREATED: 'record_created',
  RECORD_UPDATED: 'record_updated',
  RECORD_DELETED: 'record_deleted',
  BULK_UPDATE: 'bulk_update',
  BULK_DELETE: 'bulk_delete',

  // Data Export/Import
  DATA_EXPORTED: 'data_exported',
  DATA_IMPORTED: 'data_imported',
  REPORT_GENERATED: 'report_generated',
  REPORT_EXPORTED: 'report_exported',

  // Configuration
  SETTINGS_UPDATED: 'settings_updated',
  SETTINGS_VIEWED: 'settings_viewed',
  API_KEY_CREATED: 'api_key_created',
  API_KEY_REVOKED: 'api_key_revoked',
  WEBHOOK_CONFIGURED: 'webhook_configured',

  // Integration
  INTEGRATION_CONNECTED: 'integration_connected',
  INTEGRATION_DISCONNECTED: 'integration_disconnected',
  SYNC_STARTED: 'sync_started',
  SYNC_COMPLETED: 'sync_completed',
  SYNC_FAILED: 'sync_failed',

  // CRM Specific
  LEAD_CREATED: 'lead_created',
  LEAD_UPDATED: 'lead_updated',
  LEAD_CONVERTED: 'lead_converted',
  LEAD_DELETED: 'lead_deleted',
  CONTACT_CREATED: 'contact_created',
  CONTACT_UPDATED: 'contact_updated',
  CONTACT_DELETED: 'contact_deleted',
  DEAL_CREATED: 'deal_created',
  DEAL_UPDATED: 'deal_updated',
  DEAL_WON: 'deal_won',
  DEAL_LOST: 'deal_lost',
  DEAL_DELETED: 'deal_deleted',
  TASK_CREATED: 'task_created',
  TASK_COMPLETED: 'task_completed',
  EMAIL_SENT: 'email_sent',
  CAMPAIGN_LAUNCHED: 'campaign_launched',

  // Admin Portal Specific
  MEMBER_CREATED: 'member_created',
  MEMBER_UPDATED: 'member_updated',
  MEMBER_TERMINATED: 'member_terminated',
  MEMBER_REINSTATED: 'member_reinstated',
  ENROLLMENT_CREATED: 'enrollment_created',
  ENROLLMENT_APPROVED: 'enrollment_approved',
  ENROLLMENT_REJECTED: 'enrollment_rejected',
  ENROLLMENT_CANCELLED: 'enrollment_cancelled',
  PAYMENT_PROCESSED: 'payment_processed',
  PAYMENT_FAILED: 'payment_failed',
  REFUND_ISSUED: 'refund_issued',
  COMMISSION_PROCESSED: 'commission_processed',
  COMMISSION_PAID: 'commission_paid',

  // PHI Access (HIPAA)
  PHI_ACCESSED: 'phi_accessed',
  PHI_EXPORTED: 'phi_exported',
  PHI_MODIFIED: 'phi_modified',

  // System Events
  SYSTEM_ERROR: 'system_error',
  MAINTENANCE_STARTED: 'maintenance_started',
  MAINTENANCE_COMPLETED: 'maintenance_completed',
} as const;

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions] | string;

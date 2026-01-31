/**
 * Enterprise Audit Logging System - Core Logger
 *
 * Provides server-side audit logging functions for both CRM and Admin apps.
 * All logs are stored with tamper-proof hash chains.
 */

import { createServerSupabaseClient } from '../supabase/server';
import { evaluateRiskLevel } from './risk-evaluator';
import type { AuditLogEntry, AuditLogResult, RiskLevel, AppSource } from './types';

/**
 * Get client IP address from request headers
 * Works with Next.js headers() function
 */
async function getClientIP(headersList?: Headers): Promise<string | null> {
  try {
    if (!headersList) {
      const { headers } = await import('next/headers');
      headersList = await headers();
    }

    return (
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      headersList.get('cf-connecting-ip') ||
      null
    );
  } catch {
    return null;
  }
}

/**
 * Get user agent from request headers
 */
async function getUserAgent(headersList?: Headers): Promise<string | null> {
  try {
    if (!headersList) {
      const { headers } = await import('next/headers');
      headersList = await headers();
    }

    return headersList.get('user-agent');
  } catch {
    return null;
  }
}

/**
 * Log an audit event to the unified audit logs table
 *
 * @param entry - The audit log entry to record
 * @returns Result with success status and audit ID
 *
 * @example
 * // Basic usage
 * await logAuditEvent({
 *   appSource: 'crm',
 *   action: 'record_updated',
 *   actionCategory: 'data_modification',
 *   targetEntityType: 'contact',
 *   targetEntityId: contact.id,
 *   changes: { old: oldData, new: newData }
 * });
 *
 * @example
 * // With explicit risk level
 * await logAuditEvent({
 *   appSource: 'admin',
 *   action: 'member_terminated',
 *   actionCategory: 'data_modification',
 *   riskLevel: 'high',
 *   targetEntityType: 'member',
 *   targetEntityId: memberId,
 *   description: 'Member terminated due to non-payment',
 *   details: { reason: 'Non-payment', effectiveDate: '2026-02-01' }
 * });
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<AuditLogResult> {
  try {
    const supabase = await createServerSupabaseClient();

    // Auto-populate request context if not provided
    const ipAddress = entry.ipAddress || (await getClientIP());
    const userAgent = entry.userAgent || (await getUserAgent());

    // Auto-evaluate risk level if not provided
    const riskLevel: RiskLevel =
      entry.riskLevel ||
      evaluateRiskLevel({
        action: entry.action,
        actionCategory: entry.actionCategory,
        targetEntityType: entry.targetEntityType,
        changes: entry.changes,
        details: entry.details,
      });

    // Call the RPC function
    // Note: Type assertion needed until Supabase types are regenerated with the new function
    const { data, error } = await (supabase.rpc as CallableFunction)('log_audit_event', {
      p_app_source: entry.appSource,
      p_action: entry.action,
      p_action_category: entry.actionCategory,
      p_risk_level: riskLevel,
      p_target_entity_type: entry.targetEntityType || null,
      p_target_entity_id: entry.targetEntityId || null,
      p_target_user_id: entry.targetUserId || null,
      p_description: entry.description || null,
      p_details: entry.details || {},
      p_changes: entry.changes || {},
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_request_id: entry.requestId || null,
      p_session_id: entry.sessionId || null,
    }) as { data: string | null; error: Error | null };

    if (error) {
      console.error('[AuditLogger] Failed to log event:', error);
      return { success: false, error: error.message };
    }

    return { success: true, auditId: data ?? undefined };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[AuditLogger] Exception while logging:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Log an audit event asynchronously (fire-and-forget)
 * Use for non-critical logging where you don't need to wait for confirmation
 *
 * @param entry - The audit log entry to record
 */
export function logAuditEventAsync(entry: AuditLogEntry): void {
  logAuditEvent(entry).catch((err) =>
    console.error('[AuditLogger] Async log failed:', err)
  );
}

/**
 * Create a scoped audit logger for a specific app
 * Reduces boilerplate by pre-setting the app source
 *
 * @param appSource - The app source ('crm' | 'admin' | 'portal' | 'system')
 * @returns Scoped logger functions
 *
 * @example
 * // In CRM app
 * const crmAudit = createAuditLogger('crm');
 *
 * await crmAudit.log({
 *   action: 'lead_converted',
 *   actionCategory: 'data_modification',
 *   targetEntityType: 'lead',
 *   targetEntityId: leadId
 * });
 */
export function createAuditLogger(appSource: AppSource) {
  return {
    /**
     * Log an audit event
     */
    log: (entry: Omit<AuditLogEntry, 'appSource'>) =>
      logAuditEvent({ ...entry, appSource }),

    /**
     * Log an audit event asynchronously
     */
    logAsync: (entry: Omit<AuditLogEntry, 'appSource'>) =>
      logAuditEventAsync({ ...entry, appSource }),

    /**
     * Log with change tracking (old/new values)
     */
    logWithChanges: <T extends Record<string, unknown>>(
      action: string,
      actionCategory: AuditLogEntry['actionCategory'],
      entityType: string,
      entityId: string,
      oldData: T | null,
      newData: T | null,
      additionalDetails?: Record<string, unknown>
    ) =>
      logAuditEvent({
        appSource,
        action,
        actionCategory,
        targetEntityType: entityType,
        targetEntityId: entityId,
        changes: {
          old: oldData || undefined,
          new: newData || undefined,
        },
        details: additionalDetails,
      }),

    /**
     * Log a data access event
     */
    logAccess: (entityType: string, entityId: string, details?: Record<string, unknown>) =>
      logAuditEvent({
        appSource,
        action: 'record_viewed',
        actionCategory: 'data_access',
        targetEntityType: entityType,
        targetEntityId: entityId,
        details,
      }),

    /**
     * Log a data export event
     */
    logExport: (
      entityType: string,
      format: string,
      recordCount: number,
      details?: Record<string, unknown>
    ) =>
      logAuditEvent({
        appSource,
        action: 'data_exported',
        actionCategory: 'data_export',
        targetEntityType: entityType,
        details: {
          format,
          recordCount,
          ...details,
        },
      }),
  };
}

/**
 * Wrapper for operations that should be audited
 * Automatically logs the action and captures any errors
 *
 * @param entry - The audit log entry configuration
 * @param operation - The async operation to wrap
 * @returns The result of the operation
 *
 * @example
 * const result = await withAuditLogging(
 *   {
 *     appSource: 'admin',
 *     action: 'payment_processed',
 *     actionCategory: 'data_modification',
 *     targetEntityType: 'payment',
 *     targetEntityId: paymentId
 *   },
 *   async () => {
 *     return processPayment(paymentId);
 *   }
 * );
 */
export async function withAuditLogging<T>(
  entry: AuditLogEntry,
  operation: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await operation();

    // Log successful operation
    await logAuditEvent({
      ...entry,
      details: {
        ...entry.details,
        duration_ms: Date.now() - startTime,
        status: 'success',
      },
    });

    return result;
  } catch (error) {
    // Log failed operation with elevated risk
    await logAuditEvent({
      ...entry,
      riskLevel: 'medium', // Failures elevate risk for investigation
      details: {
        ...entry.details,
        duration_ms: Date.now() - startTime,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    throw error;
  }
}

/**
 * Log authentication events with standardized format
 *
 * @param appSource - The app source
 * @param action - The auth action (login_success, login_failed, logout, etc.)
 * @param userEmail - The user's email
 * @param details - Additional details
 */
export async function logAuthEvent(
  appSource: AppSource,
  action: 'login_success' | 'login_failed' | 'logout' | 'password_reset' | 'mfa_enabled' | 'mfa_disabled',
  userEmail: string,
  details?: Record<string, unknown>
): Promise<AuditLogResult> {
  return logAuditEvent({
    appSource,
    action,
    actionCategory: 'authentication',
    description: getAuthDescription(action, userEmail),
    details: {
      email: userEmail,
      ...details,
    },
  });
}

function getAuthDescription(
  action: string,
  email: string
): string {
  switch (action) {
    case 'login_success':
      return `User ${email} logged in successfully`;
    case 'login_failed':
      return `Failed login attempt for ${email}`;
    case 'logout':
      return `User ${email} logged out`;
    case 'password_reset':
      return `Password reset initiated for ${email}`;
    case 'mfa_enabled':
      return `MFA enabled for ${email}`;
    case 'mfa_disabled':
      return `MFA disabled for ${email}`;
    default:
      return `Auth event: ${action} for ${email}`;
  }
}

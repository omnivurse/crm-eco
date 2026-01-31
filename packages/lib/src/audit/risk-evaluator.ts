/**
 * Enterprise Audit Logging System - Risk Level Evaluator
 *
 * Automatically classifies audit events by risk level based on:
 * - Action type
 * - Target entity type (PHI sensitivity)
 * - Fields being modified
 * - Bulk operation indicators
 */

import type { ActionCategory, RiskLevel, AuditAction } from './types';
import { AuditActions } from './types';

export interface RiskEvaluationContext {
  action: AuditAction;
  actionCategory: ActionCategory;
  targetEntityType?: string;
  changes?: {
    old?: Record<string, unknown>;
    new?: Record<string, unknown>;
  };
  details?: Record<string, unknown>;
}

/**
 * Actions that are critical by nature
 */
const CRITICAL_ACTIONS = new Set<string>([
  'super_admin_created',
  'organization_deleted',
  'billing_config_changed',
  'security_settings_changed',
  'all_data_exported',
]);

/**
 * Actions that are inherently high-risk
 */
const HIGH_RISK_ACTIONS = new Set<string>([
  AuditActions.USER_DELETED,
  AuditActions.BULK_DELETE,
  AuditActions.ROLE_CHANGED,
  AuditActions.MFA_DISABLED,
  AuditActions.MEMBER_TERMINATED,
  AuditActions.REFUND_ISSUED,
  AuditActions.API_KEY_CREATED,
  AuditActions.API_KEY_REVOKED,
  AuditActions.PERMISSION_GRANTED,
  AuditActions.PERMISSION_REVOKED,
  AuditActions.PHI_EXPORTED,
  AuditActions.PHI_MODIFIED,
]);

/**
 * Actions that are medium-risk
 */
const MEDIUM_RISK_ACTIONS = new Set<string>([
  AuditActions.DATA_EXPORTED,
  AuditActions.DATA_IMPORTED,
  AuditActions.BULK_UPDATE,
  AuditActions.LOGIN_FAILED,
  AuditActions.SETTINGS_UPDATED,
  AuditActions.WEBHOOK_CONFIGURED,
  AuditActions.INTEGRATION_CONNECTED,
  AuditActions.PHI_ACCESSED,
]);

/**
 * PHI-related entity types that elevate risk
 */
const PHI_ENTITY_TYPES = new Set<string>([
  'member',
  'enrollment',
  'dependent',
  'contact',
  'medical_record',
  'health_record',
  'phi',
  'patient',
]);

/**
 * Sensitive fields that elevate risk when modified
 */
const SENSITIVE_FIELDS = new Set<string>([
  'ssn',
  'social_security_number',
  'date_of_birth',
  'dob',
  'email',
  'phone',
  'address',
  'payment_method',
  'bank_account',
  'credit_card',
  'role',
  'crm_role',
  'permissions',
  'password',
  'password_hash',
  'api_key',
  'secret',
  'token',
]);

/**
 * Evaluate the risk level for an audit event
 *
 * @param context - The context of the audit event
 * @returns The computed risk level
 *
 * @example
 * const risk = evaluateRiskLevel({
 *   action: 'role_changed',
 *   actionCategory: 'authorization',
 *   targetEntityType: 'user',
 * });
 * // Returns: 'high'
 */
export function evaluateRiskLevel(context: RiskEvaluationContext): RiskLevel {
  const { action, actionCategory, targetEntityType, changes, details } = context;

  // Check for critical actions first
  if (CRITICAL_ACTIONS.has(action)) {
    return 'critical';
  }

  // Check for high-risk actions
  if (HIGH_RISK_ACTIONS.has(action)) {
    return 'high';
  }

  // Data deletion is always at least high risk
  if (actionCategory === 'data_deletion') {
    return 'high';
  }

  // Check bulk operations
  if (details?.bulk === true || details?.count && (details.count as number) > 10) {
    if (actionCategory === 'data_deletion') {
      return 'critical';
    }
    return 'high';
  }

  // Check if PHI is involved
  if (targetEntityType && PHI_ENTITY_TYPES.has(targetEntityType.toLowerCase())) {
    // PHI deletion is critical
    if (actionCategory === 'data_deletion') {
      return 'critical';
    }
    // PHI export is high risk
    if (actionCategory === 'data_export') {
      return 'high';
    }
    // PHI modifications are high risk
    if (actionCategory === 'data_modification') {
      return 'high';
    }
    // PHI access is medium risk
    if (actionCategory === 'data_access') {
      return 'medium';
    }
  }

  // Data export is at least medium risk
  if (actionCategory === 'data_export') {
    return 'medium';
  }

  // Check for sensitive field modifications
  if (changes?.old || changes?.new) {
    const oldFields = changes.old ? Object.keys(changes.old) : [];
    const newFields = changes.new ? Object.keys(changes.new) : [];
    const modifiedFields = [...new Set([...oldFields, ...newFields])];

    const hasSensitiveChanges = modifiedFields.some((field) =>
      SENSITIVE_FIELDS.has(field.toLowerCase())
    );

    if (hasSensitiveChanges) {
      return 'high';
    }
  }

  // Configuration changes are medium risk
  if (actionCategory === 'configuration') {
    return 'medium';
  }

  // Authorization changes are medium risk minimum
  if (actionCategory === 'authorization') {
    return 'medium';
  }

  // Check for medium-risk actions
  if (MEDIUM_RISK_ACTIONS.has(action)) {
    return 'medium';
  }

  // Integration changes are medium risk
  if (actionCategory === 'integration') {
    return 'medium';
  }

  // Default to low risk
  return 'low';
}

/**
 * Check if a risk level meets or exceeds a threshold
 *
 * @param level - The risk level to check
 * @param threshold - The minimum threshold
 * @returns True if level >= threshold
 */
export function meetsRiskThreshold(level: RiskLevel, threshold: RiskLevel): boolean {
  const riskOrder: Record<RiskLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  };

  return riskOrder[level] >= riskOrder[threshold];
}

/**
 * Get a human-readable description of a risk level
 */
export function getRiskLevelDescription(level: RiskLevel): string {
  switch (level) {
    case 'critical':
      return 'Critical - Requires immediate attention';
    case 'high':
      return 'High - Significant security impact';
    case 'medium':
      return 'Medium - Moderate security relevance';
    case 'low':
      return 'Low - Standard activity';
    default:
      return 'Unknown risk level';
  }
}

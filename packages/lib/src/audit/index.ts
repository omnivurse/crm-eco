/**
 * Enterprise Audit Logging System
 *
 * Provides tamper-proof, hash-chained audit logging for
 * compliance, security, debugging, and accountability.
 *
 * @example
 * import { logAuditEvent, createAuditLogger, AuditActions } from '@crm-eco/lib/audit';
 *
 * // Direct logging
 * await logAuditEvent({
 *   appSource: 'crm',
 *   action: AuditActions.RECORD_UPDATED,
 *   actionCategory: 'data_modification',
 *   targetEntityType: 'contact',
 *   targetEntityId: 'uuid',
 * });
 *
 * // Scoped logger
 * const audit = createAuditLogger('admin');
 * await audit.log({ action: 'member_created', ... });
 */

// Type definitions
export type {
  AppSource,
  ActionCategory,
  RiskLevel,
  AuditLogEntry,
  AuditLogResult,
  AuditLogRecord,
  AuditLogFilters,
  AuditAction,
} from './types';

// Action constants
export { AuditActions } from './types';

// Risk evaluation
export {
  evaluateRiskLevel,
  meetsRiskThreshold,
  getRiskLevelDescription,
  type RiskEvaluationContext,
} from './risk-evaluator';

// Core logging functions
export {
  logAuditEvent,
  logAuditEventAsync,
  createAuditLogger,
  withAuditLogging,
  logAuthEvent,
} from './audit-logger';

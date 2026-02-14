/**
 * Activity Log System
 *
 * High-performance, partitioned activity logging for all software actions.
 * Uses monthly range partitions for fast writes and efficient cleanup.
 *
 * @example
 * import {
 *   logActivity,
 *   logActivityAsync,
 *   createActivityLogger,
 *   ActivityActions,
 * } from '@crm-eco/lib/activity-log';
 *
 * // Direct logging
 * await logActivity({
 *   action: ActivityActions.RECORD_CREATED,
 *   category: 'crm',
 *   entityType: 'contact',
 *   entityId: 'uuid-here',
 * });
 *
 * // Fire-and-forget (hot paths)
 * logActivityAsync({
 *   action: ActivityActions.RECORD_VIEWED,
 *   category: 'crm',
 *   entityType: 'contact',
 *   entityId: 'uuid-here',
 * });
 *
 * // Scoped logger for a module
 * const billingLog = createActivityLogger('billing');
 * billingLog.logAsync({
 *   action: ActivityActions.PAYMENT_PROCESSED,
 *   entityType: 'invoice',
 *   entityId: invoiceId,
 * });
 */

// Type definitions
export type {
  ActivityCategory,
  ActivityLogEntry,
  ActivityLogResult,
  ActivityLogRecord,
  ActivityLogFilters,
  ActivityAction,
} from './types';

// Action constants
export { ActivityActions } from './types';

// Core logging functions
export {
  logActivity,
  logActivityAsync,
  createActivityLogger,
  withActivityLog,
} from './logger';

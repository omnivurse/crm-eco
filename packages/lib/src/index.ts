export * from './supabase/client';
export * from './types';
export * from './activities';
export * from './imports';
export * from './enrollment';
export * from './ai';
export * from './members';
export * from './needs';
export * from './views';
export * from './billing';
export * from './commissions';
export * from './email';
export * from './tracking';
export * from './realtime';
// activity-log is server-only (uses next/headers via supabase/server)
// Import directly: import { logActivity } from '@crm-eco/lib/activity-log';
export { ActivityActions } from './activity-log/types';
export type {
  ActivityCategory,
  ActivityLogEntry,
  ActivityLogResult,
  ActivityLogRecord,
  ActivityLogFilters,
  ActivityAction,
} from './activity-log/types';

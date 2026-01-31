/**
 * Audit Logging System - Shared Module
 *
 * Provides React hooks and utilities for audit log subscriptions.
 *
 * @example
 * import { useAuditFeed } from '@crm-eco/shared/audit';
 *
 * const auditFeed = useAuditFeed(supabase, {
 *   orgId: profile.organization_id,
 *   onHighRiskEvent: (event) => toast.warning(event.description)
 * });
 */

export * from './types';
export { useAuditFeed, useAuditSubscription } from './use-audit-feed';

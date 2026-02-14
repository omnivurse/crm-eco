/**
 * Activity Log System — Core Logger
 *
 * Server-side helpers for logging activities to the partitioned activity_log table.
 * Uses the log_activity() RPC for fast, non-blocking writes.
 */

import { createServerSupabaseClient } from '../supabase/server';
import type { ActivityLogEntry, ActivityLogResult, ActivityCategory } from './types';

// ─── Request context helpers ────────────────────────────────────────────────

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

// ─── Core logging function ──────────────────────────────────────────────────

/**
 * Log an activity to the partitioned activity_log table via RPC.
 *
 * @example
 * await logActivity({
 *   action: 'record.created',
 *   category: 'crm',
 *   entityType: 'contact',
 *   entityId: contact.id,
 *   description: 'Created new contact John Doe',
 * });
 */
export async function logActivity(entry: ActivityLogEntry): Promise<ActivityLogResult> {
  try {
    const supabase = await createServerSupabaseClient();

    const ipAddress = entry.ipAddress || (await getClientIP());
    const userAgent = entry.userAgent || (await getUserAgent());

    const { data, error } = await (supabase.rpc as CallableFunction)('log_activity', {
      p_action: entry.action,
      p_category: entry.category,
      p_entity_type: entry.entityType || null,
      p_entity_id: entry.entityId || null,
      p_description: entry.description || null,
      p_metadata: entry.metadata || {},
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
    }) as { data: string | null; error: Error | null };

    if (error) {
      console.error('[ActivityLog] Failed to log:', error);
      return { success: false, error: error.message };
    }

    return { success: true, activityId: data ?? undefined };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[ActivityLog] Exception:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Fire-and-forget activity log. Does NOT block the caller.
 * Use this in hot paths where you don't need to wait for confirmation.
 *
 * @example
 * // In a Server Action — log without awaiting
 * logActivityAsync({
 *   action: 'record.viewed',
 *   category: 'crm',
 *   entityType: 'contact',
 *   entityId: contactId,
 * });
 */
export function logActivityAsync(entry: ActivityLogEntry): void {
  logActivity(entry).catch((err) =>
    console.error('[ActivityLog] Async log failed:', err)
  );
}

// ─── Scoped logger ──────────────────────────────────────────────────────────

/**
 * Create a scoped activity logger for a specific category.
 * Reduces boilerplate when logging many activities from the same module.
 *
 * @example
 * const crmLog = createActivityLogger('crm');
 *
 * // Awaited (when you care about success)
 * await crmLog.log({
 *   action: 'record.updated',
 *   entityType: 'deal',
 *   entityId: dealId,
 *   metadata: { changes: diff },
 * });
 *
 * // Fire-and-forget (hot paths)
 * crmLog.logAsync({
 *   action: 'record.viewed',
 *   entityType: 'deal',
 *   entityId: dealId,
 * });
 */
export function createActivityLogger(category: ActivityCategory) {
  return {
    /** Log an activity and wait for the result */
    log: (entry: Omit<ActivityLogEntry, 'category'>) =>
      logActivity({ ...entry, category }),

    /** Fire-and-forget log — does not block the caller */
    logAsync: (entry: Omit<ActivityLogEntry, 'category'>) =>
      logActivityAsync({ ...entry, category }),

    /** Log an entity CRUD action with optional before/after diff */
    logChange: <T extends Record<string, unknown>>(
      action: string,
      entityType: string,
      entityId: string,
      oldData?: T | null,
      newData?: T | null,
      description?: string
    ) =>
      logActivity({
        action,
        category,
        entityType,
        entityId,
        description,
        metadata: {
          ...(oldData ? { old: oldData } : {}),
          ...(newData ? { new: newData } : {}),
        },
      }),

    /** Fire-and-forget entity change log */
    logChangeAsync: <T extends Record<string, unknown>>(
      action: string,
      entityType: string,
      entityId: string,
      oldData?: T | null,
      newData?: T | null,
      description?: string
    ) =>
      logActivityAsync({
        action,
        category,
        entityType,
        entityId,
        description,
        metadata: {
          ...(oldData ? { old: oldData } : {}),
          ...(newData ? { new: newData } : {}),
        },
      }),
  };
}

// ─── Convenience wrappers ───────────────────────────────────────────────────

/**
 * Wrap an async operation with automatic activity logging.
 * Logs success or failure after the operation completes.
 *
 * @example
 * const result = await withActivityLog(
 *   {
 *     action: 'billing.payment_processed',
 *     category: 'billing',
 *     entityType: 'payment',
 *     entityId: paymentId,
 *   },
 *   async () => processPayment(paymentId)
 * );
 */
export async function withActivityLog<T>(
  entry: ActivityLogEntry,
  operation: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await operation();

    // Log success — fire-and-forget so we don't slow down the response
    logActivityAsync({
      ...entry,
      metadata: {
        ...entry.metadata,
        duration_ms: Date.now() - startTime,
        status: 'success',
      },
    });

    return result;
  } catch (error) {
    // Log failure — also fire-and-forget
    logActivityAsync({
      ...entry,
      metadata: {
        ...entry.metadata,
        duration_ms: Date.now() - startTime,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    throw error;
  }
}

/**
 * PHI Access Audit Logging Service
 * 
 * HIPAA-compliant audit trail for all access to Protected Health Information
 * Logs: who accessed what, when, from where, and which PHI fields
 */

import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { headers } from 'next/headers';
import { identifyPHIFields, type PHIFieldType } from './encryption';

export type PHIAction =
    | 'view'
    | 'create'
    | 'update'
    | 'delete'
    | 'export'
    | 'print'
    | 'download'
    | 'search';

export type ResourceType =
    | 'contact'
    | 'member'
    | 'enrollment'
    | 'lead'
    | 'deal'
    | 'record';

export interface PHIAccessLogEntry {
    userId: string;
    organizationId: string;
    action: PHIAction;
    resourceType: ResourceType;
    resourceId?: string;
    recordName?: string; // Sanitized name for audit display
    phiFieldsAccessed?: string[];
    metadata?: Record<string, unknown>;
}

export interface AuthEventEntry {
    userId?: string;
    email?: string;
    eventType: AuthEventType;
    metadata?: Record<string, unknown>;
}

export type AuthEventType =
    | 'login_success'
    | 'login_failed'
    | 'logout'
    | 'mfa_challenge'
    | 'mfa_success'
    | 'mfa_failed'
    | 'password_reset'
    | 'password_change'
    | 'session_expired'
    | 'session_invalidated';

/**
 * Get client IP address from request headers
 */
function getClientIP(): string | null {
    const headersList = headers();
    // Check various headers for client IP
    return (
        headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        headersList.get('x-real-ip') ||
        headersList.get('cf-connecting-ip') || // Cloudflare
        null
    );
}

/**
 * Get user agent from request headers
 */
function getUserAgent(): string | null {
    const headersList = headers();
    return headersList.get('user-agent');
}

/**
 * Log PHI access for HIPAA compliance
 * Call this whenever PHI is accessed
 */
export async function logPHIAccess(entry: PHIAccessLogEntry): Promise<void> {
    try {
        const supabase = await createServerSupabaseClient();
        const ipAddress = getClientIP();
        const userAgent = getUserAgent();

        await (supabase.from('phi_access_log') as any).insert({
            user_id: entry.userId,
            organization_id: entry.organizationId,
            action: entry.action,
            resource_type: entry.resourceType,
            resource_id: entry.resourceId,
            record_name: entry.recordName,
            phi_fields_accessed: entry.phiFieldsAccessed || [],
            ip_address: ipAddress,
            user_agent: userAgent,
            metadata: entry.metadata || {},
        });
    } catch (error) {
        // Log to server console but don't throw - audit logging should not break the app
        console.error('[HIPAA Audit] Failed to log PHI access:', error);
    }
}

/**
 * Log authentication events
 */
export async function logAuthEvent(entry: AuthEventEntry): Promise<void> {
    try {
        const supabase = await createServerSupabaseClient();
        const ipAddress = getClientIP();
        const userAgent = getUserAgent();

        await (supabase.from('auth_events') as any).insert({
            user_id: entry.userId,
            email: entry.email,
            event_type: entry.eventType,
            ip_address: ipAddress,
            user_agent: userAgent,
            metadata: entry.metadata || {},
        });
    } catch (error) {
        console.error('[HIPAA Audit] Failed to log auth event:', error);
    }
}

/**
 * Wrapper to automatically log PHI access when viewing records
 * Usage: await withPHILogging(userId, orgId, 'contact', contactId, async () => { ... })
 */
export async function withPHILogging<T>(
    userId: string,
    organizationId: string,
    resourceType: ResourceType,
    resourceId: string,
    action: PHIAction,
    operation: () => Promise<T>
): Promise<T> {
    const startTime = Date.now();
    let success = true;
    let error: Error | null = null;

    try {
        const result = await operation();

        // Identify PHI fields if result is an object
        let phiFields: string[] = [];
        if (result && typeof result === 'object' && !Array.isArray(result)) {
            phiFields = identifyPHIFields(result as Record<string, unknown>);
        }

        await logPHIAccess({
            userId,
            organizationId,
            action,
            resourceType,
            resourceId,
            phiFieldsAccessed: phiFields,
            metadata: { duration_ms: Date.now() - startTime },
        });

        return result;
    } catch (err) {
        success = false;
        error = err instanceof Error ? err : new Error(String(err));

        // Log failed access attempt
        const supabase = await createServerSupabaseClient();
        await (supabase.from('phi_access_log') as any).insert({
            user_id: userId,
            organization_id: organizationId,
            action,
            resource_type: resourceType,
            resource_id: resourceId,
            success: false,
            failure_reason: error.message,
            ip_address: getClientIP(),
            user_agent: getUserAgent(),
        });

        throw error;
    }
}

/**
 * Get recent PHI access logs for a user (for security dashboard)
 */
export async function getUserPHIAccessLogs(
    userId: string,
    limit = 50
): Promise<unknown[]> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
        .from('phi_access_log')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data || [];
}

/**
 * Get organization PHI access summary (for admin dashboard)
 */
export async function getOrganizationPHIAccessSummary(
    organizationId: string,
    days = 30
): Promise<{
    totalAccesses: number;
    uniqueUsers: number;
    exportCount: number;
    failedAttempts: number;
}> {
    const supabase = await createServerSupabaseClient();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('phi_access_log')
        .select('user_id, action, success')
        .eq('organization_id', organizationId)
        .gte('created_at', since);

    if (error) throw error;

    const logs = (data || []) as any[];
    const uniqueUsers = new Set(logs.map((l: { user_id: string }) => l.user_id)).size;
    const exportCount = logs.filter((l: { action: string }) => l.action === 'export').length;
    const failedAttempts = logs.filter((l: { success: boolean }) => !l.success).length;

    return {
        totalAccesses: logs.length,
        uniqueUsers,
        exportCount,
        failedAttempts,
    };
}

/**
 * Get recent auth events for security monitoring
 */
export async function getRecentAuthEvents(
    organizationId: string,
    eventTypes?: AuthEventType[],
    limit = 100
): Promise<unknown[]> {
    const supabase = await createServerSupabaseClient();

    let query = supabase
        .from('auth_events')
        .select(`
      *,
      profiles!auth_events_user_id_fkey (
        full_name,
        organization_id
      )
    `)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (eventTypes && eventTypes.length > 0) {
        query = query.in('event_type', eventTypes);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Filter by organization (users belonging to the org)
    return (data || []).filter(
        (event: { profiles?: { organization_id?: string } }) =>
            event.profiles?.organization_id === organizationId
    );
}

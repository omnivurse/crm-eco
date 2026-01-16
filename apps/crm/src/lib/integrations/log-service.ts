import { createServerSupabaseClient as createClient } from '@crm-eco/lib/supabase/server';
import type {
  IntegrationLog,
  LogEventType,
  LogStatus,
  LogDirection,
  IntegrationProvider,
} from './types';

// ============================================================================
// Log Service
// Writing and querying integration logs
// Note: Using 'as any' for table names since these are new tables not yet in generated types
// ============================================================================

export interface CreateLogParams {
  connection_id?: string;
  event_type: LogEventType;
  provider: IntegrationProvider | string;
  direction?: LogDirection;
  method?: string;
  endpoint?: string;
  request_body?: Record<string, unknown>;
  response_body?: Record<string, unknown>;
  response_status?: number;
  status?: LogStatus;
  error_code?: string;
  error_message?: string;
  error_details?: Record<string, unknown>;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
  duration_ms?: number;
}

export interface LogFilters {
  connection_id?: string;
  provider?: IntegrationProvider | string;
  event_type?: LogEventType;
  status?: LogStatus;
  direction?: LogDirection;
  entity_type?: string;
  entity_id?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
}

export interface LogsResult {
  logs: IntegrationLog[];
  total: number;
  hasMore: boolean;
}

export interface LogStats {
  total: number;
  success: number;
  error: number;
  warning: number;
  by_provider: Record<string, number>;
  by_event_type: Record<string, number>;
}

// Helper to get supabase client with any table access
async function getSupabaseAny() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Create a new log entry
 */
export async function createLog(params: CreateLogParams): Promise<IntegrationLog> {
  const supabase = await getSupabaseAny();
  
  // Get org_id from profile
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single();
  
  if (!profile) {
    throw new Error('User profile not found');
  }
  
  const logData = {
    org_id: profile.organization_id,
    connection_id: params.connection_id || null,
    event_type: params.event_type,
    provider: params.provider,
    direction: params.direction || 'outbound',
    method: params.method || null,
    endpoint: params.endpoint || null,
    request_body: params.request_body || null,
    response_body: params.response_body || null,
    response_status: params.response_status || null,
    status: params.status || 'success',
    error_code: params.error_code || null,
    error_message: params.error_message || null,
    error_details: params.error_details || null,
    entity_type: params.entity_type || null,
    entity_id: params.entity_id || null,
    metadata: params.metadata || {},
    duration_ms: params.duration_ms || null,
  };
  
  const { data, error } = await supabase
    .from('integration_logs')
    .insert(logData)
    .select()
    .single();
  
  if (error) {
    console.error('Error creating log:', error);
    throw new Error('Failed to create log');
  }
  
  return data as IntegrationLog;
}

/**
 * Get logs with filtering and pagination
 */
export async function getLogs(
  filters?: LogFilters,
  page: number = 1,
  limit: number = 50
): Promise<LogsResult> {
  const supabase = await getSupabaseAny();
  
  let query = supabase
    .from('integration_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });
  
  // Apply filters
  if (filters?.connection_id) {
    query = query.eq('connection_id', filters.connection_id);
  }
  if (filters?.provider) {
    query = query.eq('provider', filters.provider);
  }
  if (filters?.event_type) {
    query = query.eq('event_type', filters.event_type);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.direction) {
    query = query.eq('direction', filters.direction);
  }
  if (filters?.entity_type) {
    query = query.eq('entity_type', filters.entity_type);
  }
  if (filters?.entity_id) {
    query = query.eq('entity_id', filters.entity_id);
  }
  if (filters?.from_date) {
    query = query.gte('created_at', filters.from_date);
  }
  if (filters?.to_date) {
    query = query.lte('created_at', filters.to_date);
  }
  if (filters?.search) {
    query = query.or(`endpoint.ilike.%${filters.search}%,error_message.ilike.%${filters.search}%`);
  }
  
  // Pagination
  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);
  
  const { data, count, error } = await query;
  
  if (error) {
    console.error('Error fetching logs:', error);
    throw new Error('Failed to fetch logs');
  }
  
  const total = count || 0;
  
  return {
    logs: (data || []) as IntegrationLog[],
    total,
    hasMore: offset + limit < total,
  };
}

/**
 * Get a single log by ID
 */
export async function getLog(id: string): Promise<IntegrationLog | null> {
  const supabase = await getSupabaseAny();
  
  const { data, error } = await supabase
    .from('integration_logs')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching log:', error);
    throw new Error('Failed to fetch log');
  }
  
  return data as IntegrationLog;
}

/**
 * Get log statistics for a time period
 */
export async function getLogStats(
  periodDays: number = 7
): Promise<LogStats> {
  const supabase = await getSupabaseAny();
  
  const fromDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();
  
  const { data: logs } = await supabase
    .from('integration_logs')
    .select('status, provider, event_type')
    .gte('created_at', fromDate);
  
  const logList = (logs || []) as { status: string; provider: string; event_type: string }[];
  
  const byProvider: Record<string, number> = {};
  const byEventType: Record<string, number> = {};
  
  let success = 0;
  let error = 0;
  let warning = 0;
  
  for (const log of logList) {
    // Count by status
    if (log.status === 'success') success++;
    else if (log.status === 'error') error++;
    else if (log.status === 'warning') warning++;
    
    // Count by provider
    byProvider[log.provider] = (byProvider[log.provider] || 0) + 1;
    
    // Count by event type
    byEventType[log.event_type] = (byEventType[log.event_type] || 0) + 1;
  }
  
  return {
    total: logList.length,
    success,
    error,
    warning,
    by_provider: byProvider,
    by_event_type: byEventType,
  };
}

/**
 * Get recent errors for a connection
 */
export async function getRecentErrors(
  connectionId: string,
  limit: number = 10
): Promise<IntegrationLog[]> {
  const supabase = await getSupabaseAny();
  
  const { data, error } = await supabase
    .from('integration_logs')
    .select('*')
    .eq('connection_id', connectionId)
    .eq('status', 'error')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Error fetching recent errors:', error);
    throw new Error('Failed to fetch recent errors');
  }
  
  return (data || []) as IntegrationLog[];
}

/**
 * Delete old logs (cleanup)
 */
export async function deleteOldLogs(retentionDays: number = 30): Promise<number> {
  const supabase = await getSupabaseAny();
  
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  
  const { count, error } = await supabase
    .from('integration_logs')
    .delete({ count: 'exact' })
    .lt('created_at', cutoffDate);
  
  if (error) {
    console.error('Error deleting old logs:', error);
    throw new Error('Failed to delete old logs');
  }
  
  return count || 0;
}

// ============================================================================
// Helper Functions for Common Logging Scenarios
// ============================================================================

/**
 * Log an API call
 */
export async function logApiCall(params: {
  connection_id?: string;
  provider: IntegrationProvider | string;
  method: string;
  endpoint: string;
  request_body?: Record<string, unknown>;
  response_body?: Record<string, unknown>;
  response_status: number;
  duration_ms?: number;
  entity_type?: string;
  entity_id?: string;
}): Promise<IntegrationLog> {
  const isError = params.response_status >= 400;
  
  return createLog({
    connection_id: params.connection_id,
    event_type: 'api_call',
    provider: params.provider,
    direction: 'outbound',
    method: params.method,
    endpoint: params.endpoint,
    request_body: params.request_body,
    response_body: params.response_body,
    response_status: params.response_status,
    status: isError ? 'error' : 'success',
    error_message: isError ? `API call failed with status ${params.response_status}` : undefined,
    duration_ms: params.duration_ms,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
  });
}

/**
 * Log a webhook received
 */
export async function logWebhookReceived(params: {
  connection_id?: string;
  provider: IntegrationProvider | string;
  event_type_detail: string;
  payload: Record<string, unknown>;
  status?: LogStatus;
  error_message?: string;
  entity_type?: string;
  entity_id?: string;
}): Promise<IntegrationLog> {
  return createLog({
    connection_id: params.connection_id,
    event_type: 'webhook_received',
    provider: params.provider,
    direction: 'inbound',
    request_body: params.payload,
    status: params.status || 'success',
    error_message: params.error_message,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    metadata: { webhook_event: params.event_type_detail },
  });
}

/**
 * Log a sync operation
 */
export async function logSyncEvent(params: {
  connection_id: string;
  provider: IntegrationProvider | string;
  event_type: 'sync_started' | 'sync_completed' | 'sync_failed';
  items_processed?: number;
  items_created?: number;
  items_updated?: number;
  items_failed?: number;
  duration_ms?: number;
  error_message?: string;
}): Promise<IntegrationLog> {
  return createLog({
    connection_id: params.connection_id,
    event_type: params.event_type,
    provider: params.provider,
    direction: 'internal',
    status: params.event_type === 'sync_failed' ? 'error' : 'success',
    error_message: params.error_message,
    duration_ms: params.duration_ms,
    metadata: {
      items_processed: params.items_processed,
      items_created: params.items_created,
      items_updated: params.items_updated,
      items_failed: params.items_failed,
    },
  });
}

/**
 * Log an authentication event
 */
export async function logAuthEvent(params: {
  connection_id: string;
  provider: IntegrationProvider | string;
  event_type: 'auth_refresh' | 'auth_expired';
  success: boolean;
  error_message?: string;
}): Promise<IntegrationLog> {
  return createLog({
    connection_id: params.connection_id,
    event_type: params.event_type,
    provider: params.provider,
    direction: 'internal',
    status: params.success ? 'success' : 'error',
    error_message: params.error_message,
  });
}

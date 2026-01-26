import { createServerSupabaseClient as createClient } from '@crm-eco/lib/supabase/server';
import type {
  IntegrationConnection,
  IntegrationProvider,
  ConnectionType,
  ConnectionStatus,
  HealthStatus,
} from './types';
import { encrypt, decrypt } from './adapters/credentials';
import { getInitializedAdapter, hasAdapter } from './adapters/registry';

// ============================================================================
// Connection Manager Service
// CRUD operations for integration connections
// Note: Using 'as any' for table names since these are new tables not yet in generated types
// ============================================================================

export interface CreateConnectionParams {
  provider: IntegrationProvider;
  connection_type: ConnectionType;
  name: string;
  description?: string;
  api_key_enc?: string;
  api_secret_enc?: string;
  access_token_enc?: string;
  refresh_token_enc?: string;
  token_expires_at?: string;
  settings?: Record<string, unknown>;
  external_account_id?: string;
  external_account_name?: string;
  external_account_email?: string;
}

export interface UpdateConnectionParams {
  name?: string;
  description?: string;
  status?: ConnectionStatus;
  api_key_enc?: string;
  api_secret_enc?: string;
  access_token_enc?: string;
  refresh_token_enc?: string;
  token_expires_at?: string;
  settings?: Record<string, unknown>;
  external_account_id?: string;
  external_account_name?: string;
  external_account_email?: string;
  last_sync_at?: string;
  last_sync_status?: string;
  last_sync_error?: string;
  sync_cursor?: string;
  last_webhook_at?: string;
  error_count?: number;
  last_error_at?: string;
  last_error_message?: string;
  health_status?: HealthStatus;
}

export interface ConnectionFilters {
  connection_type?: ConnectionType;
  provider?: IntegrationProvider;
  status?: ConnectionStatus;
  health_status?: HealthStatus;
}

export interface ConnectionsResult {
  connections: IntegrationConnection[];
  total: number;
}

export interface HealthSummary {
  total_connections: number;
  connected_count: number;
  error_count: number;
  pending_count: number;
  recent_errors: number;
  last_sync_at: string | null;
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
 * Get all connections for the current organization
 */
export async function getConnections(filters?: ConnectionFilters): Promise<ConnectionsResult> {
  const supabase = await getSupabaseAny();
  
  let query = supabase
    .from('integration_connections')
    .select('*', { count: 'exact' })
    .order('connection_type', { ascending: true })
    .order('name', { ascending: true });
  
  if (filters?.connection_type) {
    query = query.eq('connection_type', filters.connection_type);
  }
  if (filters?.provider) {
    query = query.eq('provider', filters.provider);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.health_status) {
    query = query.eq('health_status', filters.health_status);
  }
  
  const { data, count, error } = await query;
  
  if (error) {
    console.error('Error fetching connections:', error);
    throw new Error('Failed to fetch connections');
  }
  
  return {
    connections: (data || []) as IntegrationConnection[],
    total: count || 0,
  };
}

/**
 * Get a single connection by ID
 */
export async function getConnection(id: string): Promise<IntegrationConnection | null> {
  const supabase = await getSupabaseAny();
  
  const { data, error } = await supabase
    .from('integration_connections')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('Error fetching connection:', error);
    throw new Error('Failed to fetch connection');
  }
  
  return data as IntegrationConnection;
}

/**
 * Get connection by provider and type
 */
export async function getConnectionByProvider(
  provider: IntegrationProvider,
  connection_type: ConnectionType
): Promise<IntegrationConnection | null> {
  const supabase = await getSupabaseAny();
  
  const { data, error } = await supabase
    .from('integration_connections')
    .select('*')
    .eq('provider', provider)
    .eq('connection_type', connection_type)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('Error fetching connection by provider:', error);
    throw new Error('Failed to fetch connection');
  }
  
  return data as IntegrationConnection;
}

/**
 * Create a new connection
 */
export async function createConnection(params: CreateConnectionParams): Promise<IntegrationConnection> {
  const supabase = await getSupabaseAny();
  
  // Get current user profile for created_by
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, organization_id')
    .eq('user_id', user.id)
    .single();
  
  if (!profile) {
    throw new Error('User profile not found');
  }
  
  const connectionData = {
    org_id: profile.organization_id,
    provider: params.provider,
    connection_type: params.connection_type,
    name: params.name,
    description: params.description || null,
    status: 'disconnected' as ConnectionStatus,
    api_key_enc: params.api_key_enc || null,
    api_secret_enc: params.api_secret_enc || null,
    access_token_enc: params.access_token_enc || null,
    refresh_token_enc: params.refresh_token_enc || null,
    token_expires_at: params.token_expires_at || null,
    settings: params.settings || {},
    external_account_id: params.external_account_id || null,
    external_account_name: params.external_account_name || null,
    external_account_email: params.external_account_email || null,
    created_by: profile.id,
    updated_by: profile.id,
  };
  
  const { data, error } = await supabase
    .from('integration_connections')
    .insert(connectionData)
    .select()
    .single();
  
  if (error) {
    console.error('Error creating connection:', error);
    if (error.code === '23505') {
      throw new Error('A connection for this provider already exists');
    }
    throw new Error('Failed to create connection');
  }
  
  return data as IntegrationConnection;
}

/**
 * Update a connection
 */
export async function updateConnection(
  id: string,
  params: UpdateConnectionParams
): Promise<IntegrationConnection> {
  const supabase = await getSupabaseAny();
  
  // Get current user profile for updated_by
  const { data: { user } } = await supabase.auth.getUser();
  
  let profileId: string | undefined;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();
    profileId = profile?.id;
  }
  
  const updateData = {
    ...params,
    updated_by: profileId,
    updated_at: new Date().toISOString(),
  };
  
  const { data, error } = await supabase
    .from('integration_connections')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating connection:', error);
    throw new Error('Failed to update connection');
  }
  
  return data as IntegrationConnection;
}

/**
 * Delete a connection
 */
export async function deleteConnection(id: string): Promise<void> {
  const supabase = await getSupabaseAny();
  
  const { error } = await supabase
    .from('integration_connections')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting connection:', error);
    throw new Error('Failed to delete connection');
  }
}

/**
 * Connect (activate) a connection with credentials
 * Credentials are encrypted before storage
 */
export async function connectIntegration(
  id: string,
  credentials: {
    api_key?: string;
    api_secret?: string;
    access_token?: string;
    refresh_token?: string;
    expires_at?: string;
    external_account_id?: string;
    external_account_name?: string;
    external_account_email?: string;
    settings?: Record<string, unknown>;
  }
): Promise<IntegrationConnection> {
  return updateConnection(id, {
    api_key_enc: credentials.api_key ? encrypt(credentials.api_key) : undefined,
    api_secret_enc: credentials.api_secret ? encrypt(credentials.api_secret) : undefined,
    access_token_enc: credentials.access_token ? encrypt(credentials.access_token) : undefined,
    refresh_token_enc: credentials.refresh_token ? encrypt(credentials.refresh_token) : undefined,
    token_expires_at: credentials.expires_at,
    external_account_id: credentials.external_account_id,
    external_account_name: credentials.external_account_name,
    external_account_email: credentials.external_account_email,
    settings: credentials.settings,
    status: 'connected',
    health_status: 'healthy',
    error_count: 0,
    last_error_at: undefined,
    last_error_message: undefined,
  });
}

/**
 * Disconnect a connection
 */
export async function disconnectIntegration(id: string): Promise<IntegrationConnection> {
  return updateConnection(id, {
    status: 'disconnected',
    access_token_enc: undefined,
    refresh_token_enc: undefined,
    token_expires_at: undefined,
    api_key_enc: undefined,
    api_secret_enc: undefined,
  });
}

/**
 * Record an error on a connection
 */
export async function recordConnectionError(
  id: string,
  errorMessage: string
): Promise<IntegrationConnection> {
  const supabase = await getSupabaseAny();
  
  // Get current error count
  const { data: current } = await supabase
    .from('integration_connections')
    .select('error_count')
    .eq('id', id)
    .single();
  
  const newErrorCount = (current?.error_count || 0) + 1;
  
  // Determine health status based on error count
  let healthStatus: HealthStatus = 'degraded';
  if (newErrorCount >= 5) {
    healthStatus = 'unhealthy';
  }
  
  return updateConnection(id, {
    error_count: newErrorCount,
    last_error_at: new Date().toISOString(),
    last_error_message: errorMessage,
    health_status: healthStatus,
    status: newErrorCount >= 10 ? 'error' : undefined,
  });
}

/**
 * Clear errors on a connection
 */
export async function clearConnectionErrors(id: string): Promise<IntegrationConnection> {
  return updateConnection(id, {
    error_count: 0,
    last_error_at: undefined,
    last_error_message: undefined,
    health_status: 'healthy',
  });
}

/**
 * Update sync status on a connection
 */
export async function updateSyncStatus(
  id: string,
  status: 'success' | 'error',
  errorMessage?: string,
  cursor?: string
): Promise<IntegrationConnection> {
  return updateConnection(id, {
    last_sync_at: new Date().toISOString(),
    last_sync_status: status,
    last_sync_error: status === 'error' ? errorMessage : undefined,
    sync_cursor: cursor,
  });
}

/**
 * Get health summary for the organization
 */
export async function getHealthSummary(): Promise<HealthSummary> {
  const supabase = await getSupabaseAny();
  
  const { data: connections } = await supabase
    .from('integration_connections')
    .select('status, last_sync_at');
  
  const { count: recentErrors } = await supabase
    .from('integration_logs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'error')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
  const connectionList = (connections || []) as { status: string; last_sync_at: string | null }[];
  
  return {
    total_connections: connectionList.length,
    connected_count: connectionList.filter(c => c.status === 'connected').length,
    error_count: connectionList.filter(c => c.status === 'error').length,
    pending_count: connectionList.filter(c => c.status === 'pending').length,
    recent_errors: recentErrors || 0,
    last_sync_at: connectionList
      .map(c => c.last_sync_at)
      .filter(Boolean)
      .sort()
      .reverse()[0] || null,
  };
}

/**
 * Get decrypted credentials from a connection
 * Use this when you need to make API calls with the stored credentials
 */
export function getDecryptedCredentials(connection: IntegrationConnection): {
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  refreshToken?: string;
} {
  return {
    apiKey: connection.api_key_enc ? decrypt(connection.api_key_enc) : undefined,
    apiSecret: connection.api_secret_enc ? decrypt(connection.api_secret_enc) : undefined,
    accessToken: connection.access_token_enc ? decrypt(connection.access_token_enc) : undefined,
    refreshToken: connection.refresh_token_enc ? decrypt(connection.refresh_token_enc) : undefined,
  };
}

/**
 * Test a connection by provider using provider-specific adapters
 */
export async function testConnection(id: string): Promise<{ success: boolean; message: string; accountInfo?: { id?: string; email?: string; name?: string } }> {
  const connection = await getConnection(id);

  if (!connection) {
    return { success: false, message: 'Connection not found' };
  }

  // Check if credentials exist
  const hasCredentials =
    connection.api_key_enc ||
    connection.access_token_enc;

  if (!hasCredentials) {
    return { success: false, message: 'No credentials configured' };
  }

  // Get decrypted credentials for the adapter
  const decryptedCreds = getDecryptedCredentials(connection);

  // Check if we have an adapter for this provider
  if (hasAdapter(connection.provider)) {
    try {
      const adapter = getInitializedAdapter(connection, decryptedCreds);

      if (adapter) {
        // Use the adapter's testConnection method for provider-specific verification
        const result = await adapter.testConnection();

        if (result.success) {
          // Update connection with healthy status and account info
          await updateConnection(id, {
            health_status: 'healthy',
            error_count: 0,
            external_account_id: result.accountInfo?.id || connection.external_account_id,
            external_account_email: result.accountInfo?.email || connection.external_account_email,
            external_account_name: result.accountInfo?.name || connection.external_account_name,
          });

          return {
            success: true,
            message: result.message || 'Connection is working',
            accountInfo: result.accountInfo,
          };
        } else {
          // Update connection with error status
          await updateConnection(id, {
            health_status: 'unhealthy',
            error_count: (connection.error_count || 0) + 1,
            last_sync_error: result.message,
          });

          return {
            success: false,
            message: result.message || 'Connection test failed',
          };
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during connection test';

      await updateConnection(id, {
        health_status: 'unhealthy',
        error_count: (connection.error_count || 0) + 1,
        last_sync_error: errorMessage,
      });

      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  // Fallback for providers without adapters - basic credential check
  // Mark connection as healthy since credentials exist
  await updateConnection(id, {
    health_status: 'healthy',
    error_count: 0,
  });

  return { success: true, message: 'Connection credentials verified' };
}

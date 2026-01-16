-- ============================================================================
-- PHASE W20: SECURITY HARDENING + SYNC RELIABILITY
-- Proper encryption for tokens and robust sync error handling
-- ============================================================================

-- ============================================================================
-- ENCRYPTED TOKENS MIGRATION
-- Add secure token columns for future encryption migration
-- ============================================================================

-- Add secure token columns to integration_connections
ALTER TABLE integration_connections
  ADD COLUMN IF NOT EXISTS access_token_secure bytea,
  ADD COLUMN IF NOT EXISTS refresh_token_secure bytea,
  ADD COLUMN IF NOT EXISTS api_key_secure bytea,
  ADD COLUMN IF NOT EXISTS api_secret_secure bytea;

-- Add secure token columns to email_connections
ALTER TABLE email_connections
  ADD COLUMN IF NOT EXISTS access_token_secure bytea,
  ADD COLUMN IF NOT EXISTS refresh_token_secure bytea;

-- Add secure token columns to calendar_connections
ALTER TABLE calendar_connections
  ADD COLUMN IF NOT EXISTS access_token_secure bytea,
  ADD COLUMN IF NOT EXISTS refresh_token_secure bytea;

-- Add secure token columns to slack_connections
ALTER TABLE slack_connections
  ADD COLUMN IF NOT EXISTS access_token_secure bytea,
  ADD COLUMN IF NOT EXISTS bot_access_token_secure bytea;

-- Add secure token columns to esign_connections
ALTER TABLE esign_connections
  ADD COLUMN IF NOT EXISTS access_token_secure bytea,
  ADD COLUMN IF NOT EXISTS refresh_token_secure bytea;

-- ============================================================================
-- SYNC RELIABILITY TABLES
-- Track sync state and errors
-- ============================================================================

CREATE TABLE IF NOT EXISTS sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Connection reference
  connection_type text NOT NULL, -- integration, email, calendar, slack
  connection_id uuid NOT NULL,
  
  -- Sync cursor
  cursor_value text,
  cursor_updated_at timestamptz,
  
  -- Full sync tracking
  last_full_sync_at timestamptz,
  next_full_sync_at timestamptz,
  
  -- Incremental sync tracking
  last_incremental_sync_at timestamptz,
  incremental_sync_cursor text,
  
  -- Stats
  items_synced_total bigint DEFAULT 0,
  items_synced_last_run int DEFAULT 0,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(connection_type, connection_id)
);

CREATE INDEX idx_sync_state_connection ON sync_state(connection_type, connection_id);

-- ============================================================================
-- SYNC ERRORS TABLE
-- Detailed error tracking for sync failures
-- ============================================================================

CREATE TABLE IF NOT EXISTS sync_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Connection reference
  connection_type text NOT NULL,
  connection_id uuid NOT NULL,
  
  -- Error details
  error_type text NOT NULL, -- auth, api, parsing, timeout, rate_limit, unknown
  error_code text,
  error_message text NOT NULL,
  error_details jsonb,
  
  -- Context
  operation text, -- sync, fetch, update, delete
  entity_type text,
  entity_id text,
  
  -- Retry info
  retry_count int DEFAULT 0,
  will_retry boolean DEFAULT true,
  next_retry_at timestamptz,
  
  -- Resolution
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolution_notes text,
  
  -- Timestamps
  occurred_at timestamptz DEFAULT now()
);

CREATE INDEX idx_sync_errors_connection ON sync_errors(connection_type, connection_id);
CREATE INDEX idx_sync_errors_unresolved ON sync_errors(org_id, occurred_at DESC) WHERE NOT resolved;
CREATE INDEX idx_sync_errors_type ON sync_errors(error_type);

-- ============================================================================
-- TOKEN REFRESH LOG
-- Track token refresh attempts and failures
-- ============================================================================

CREATE TABLE IF NOT EXISTS token_refresh_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Connection reference
  connection_type text NOT NULL,
  connection_id uuid NOT NULL,
  provider text NOT NULL,
  
  -- Refresh details
  status text NOT NULL, -- success, failed
  error_message text,
  
  -- Token info (not the actual token!)
  old_token_expires_at timestamptz,
  new_token_expires_at timestamptz,
  
  -- Timestamps
  attempted_at timestamptz DEFAULT now()
);

CREATE INDEX idx_token_refresh_connection ON token_refresh_log(connection_type, connection_id);
CREATE INDEX idx_token_refresh_recent ON token_refresh_log(attempted_at DESC);

-- ============================================================================
-- API RATE LIMIT TRACKING
-- Track rate limits for external APIs
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- API reference
  provider text NOT NULL,
  endpoint_pattern text NOT NULL,
  
  -- Current state
  requests_remaining int,
  requests_limit int,
  reset_at timestamptz,
  
  -- Last hit
  last_request_at timestamptz,
  was_rate_limited boolean DEFAULT false,
  
  -- Timestamps
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(org_id, provider, endpoint_pattern)
);

CREATE INDEX idx_rate_limits_provider ON api_rate_limits(provider);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if token needs refresh
CREATE OR REPLACE FUNCTION should_refresh_token(
  p_expires_at timestamptz,
  p_buffer_minutes int DEFAULT 5
) RETURNS boolean AS $$
BEGIN
  RETURN p_expires_at IS NULL 
    OR p_expires_at <= (now() + (p_buffer_minutes || ' minutes')::interval);
END;
$$ LANGUAGE plpgsql;

-- Function to record sync error with exponential backoff
CREATE OR REPLACE FUNCTION record_sync_error(
  p_org_id uuid,
  p_connection_type text,
  p_connection_id uuid,
  p_error_type text,
  p_error_message text,
  p_operation text DEFAULT NULL,
  p_error_details jsonb DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_error_id uuid;
  v_retry_count int;
  v_next_retry timestamptz;
BEGIN
  -- Get current retry count for this connection
  SELECT COUNT(*) INTO v_retry_count
  FROM sync_errors
  WHERE connection_type = p_connection_type
    AND connection_id = p_connection_id
    AND NOT resolved
    AND occurred_at > now() - interval '24 hours';
  
  -- Calculate next retry with exponential backoff (max 4 hours)
  v_next_retry := now() + LEAST(
    ((2 ^ LEAST(v_retry_count, 8)) || ' minutes')::interval,
    interval '4 hours'
  );
  
  INSERT INTO sync_errors (
    org_id, connection_type, connection_id, error_type, error_message,
    operation, error_details, retry_count, next_retry_at
  ) VALUES (
    p_org_id, p_connection_type, p_connection_id, p_error_type, p_error_message,
    p_operation, p_error_details, v_retry_count + 1, v_next_retry
  )
  RETURNING id INTO v_error_id;
  
  RETURN v_error_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS
ALTER TABLE sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_refresh_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sync state for their org"
  ON sync_state FOR SELECT USING (org_id = get_user_organization_id());

CREATE POLICY "Users can view sync errors for their org"
  ON sync_errors FOR SELECT USING (org_id = get_user_organization_id());

CREATE POLICY "Users can view token refresh log for their org"
  ON token_refresh_log FOR SELECT USING (org_id = get_user_organization_id());

CREATE POLICY "Users can view rate limits for their org"
  ON api_rate_limits FOR SELECT USING (org_id = get_user_organization_id());

-- Triggers
CREATE TRIGGER update_sync_state_updated_at
  BEFORE UPDATE ON sync_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

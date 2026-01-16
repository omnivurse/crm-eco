-- ============================================================================
-- PHASE W11: INTEGRATION COMMAND CENTER
-- Centralized hub for all integration connections, health monitoring, and logs
-- ============================================================================

-- ============================================================================
-- INTEGRATION CONNECTIONS
-- Master table for all third-party provider connections
-- ============================================================================

CREATE TABLE IF NOT EXISTS integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Provider identification
  provider text NOT NULL,
  -- Providers: sendgrid, resend, twilio, ringcentral, goto, zoom, google, microsoft, slack, stripe, square, shopify, woocommerce, docusign, pandadoc, zoho
  
  connection_type text NOT NULL,
  -- Types: email, sms, phone, video, calendar, chat, commerce, payments, esign, crm_sync
  
  -- Display info
  name text NOT NULL,
  description text,
  
  -- Connection status
  status text NOT NULL DEFAULT 'disconnected',
  -- Status: connected, disconnected, error, pending, expired
  
  -- OAuth tokens (encrypted - will be properly encrypted in W20)
  access_token_enc text,
  refresh_token_enc text,
  token_expires_at timestamptz,
  
  -- API keys (for non-OAuth integrations)
  api_key_enc text,
  api_secret_enc text,
  
  -- Provider-specific settings
  settings jsonb DEFAULT '{}'::jsonb,
  -- e.g., { "default_from_email": "...", "webhook_url": "...", "calendar_id": "..." }
  
  -- Connection metadata
  external_account_id text,
  external_account_name text,
  external_account_email text,
  
  -- Sync tracking
  last_sync_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  sync_cursor text,
  
  -- Webhook tracking
  last_webhook_at timestamptz,
  webhook_secret text,
  
  -- Health monitoring
  error_count int DEFAULT 0,
  last_error_at timestamptz,
  last_error_message text,
  health_status text DEFAULT 'unknown',
  -- Health: healthy, degraded, unhealthy, unknown
  
  -- Ownership
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  UNIQUE(org_id, provider, connection_type)
);

CREATE INDEX IF NOT EXISTS idx_integration_connections_org ON integration_connections(org_id);
CREATE INDEX IF NOT EXISTS idx_integration_connections_provider ON integration_connections(provider);
CREATE INDEX IF NOT EXISTS idx_integration_connections_type ON integration_connections(connection_type);
CREATE INDEX IF NOT EXISTS idx_integration_connections_status ON integration_connections(status);
CREATE INDEX IF NOT EXISTS idx_integration_connections_health ON integration_connections(health_status);

COMMENT ON TABLE integration_connections IS 'Master table for all third-party integration connections';
COMMENT ON COLUMN integration_connections.provider IS 'Third-party provider: sendgrid, twilio, google, microsoft, slack, etc.';
COMMENT ON COLUMN integration_connections.connection_type IS 'Integration category: email, sms, phone, video, calendar, chat, commerce, payments';
COMMENT ON COLUMN integration_connections.status IS 'Connection status: connected, disconnected, error, pending, expired';
COMMENT ON COLUMN integration_connections.health_status IS 'Health indicator: healthy, degraded, unhealthy, unknown';

-- ============================================================================
-- INTEGRATION LOGS
-- Unified logging for all integration events and API calls
-- ============================================================================

CREATE TABLE IF NOT EXISTS integration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES integration_connections(id) ON DELETE SET NULL,
  
  -- Event identification
  event_type text NOT NULL,
  -- Types: api_call, webhook_received, sync_started, sync_completed, sync_failed, 
  --        auth_refresh, auth_expired, error, warning, info
  
  provider text NOT NULL,
  direction text NOT NULL DEFAULT 'outbound',
  -- Direction: inbound (webhook), outbound (api call), internal
  
  -- Request/Response details
  method text,
  endpoint text,
  request_body jsonb,
  response_body jsonb,
  response_status int,
  
  -- Status
  status text NOT NULL DEFAULT 'success',
  -- Status: success, error, warning, pending
  
  -- Error details
  error_code text,
  error_message text,
  error_details jsonb,
  
  -- Context
  entity_type text,
  entity_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Performance
  duration_ms int,
  
  -- Timestamps
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_logs_org ON integration_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_connection ON integration_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_provider ON integration_logs(provider);
CREATE INDEX IF NOT EXISTS idx_integration_logs_type ON integration_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_integration_logs_status ON integration_logs(status);
CREATE INDEX IF NOT EXISTS idx_integration_logs_created ON integration_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_logs_entity ON integration_logs(entity_type, entity_id);

-- Index for error logs (used for filtering errors quickly)
CREATE INDEX IF NOT EXISTS idx_integration_logs_errors ON integration_logs(org_id, created_at DESC)
  WHERE status = 'error';

COMMENT ON TABLE integration_logs IS 'Unified log table for all integration events and API calls';
COMMENT ON COLUMN integration_logs.event_type IS 'Event type: api_call, webhook_received, sync_started, sync_completed, etc.';
COMMENT ON COLUMN integration_logs.direction IS 'Event direction: inbound (webhook), outbound (api call), internal';

-- ============================================================================
-- INTEGRATION WEBHOOKS
-- Registered webhook endpoints for inbound events
-- ============================================================================

CREATE TABLE IF NOT EXISTS integration_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES integration_connections(id) ON DELETE CASCADE,
  
  -- Webhook config
  provider text NOT NULL,
  event_types text[] NOT NULL DEFAULT '{}',
  endpoint_path text NOT NULL,
  secret_key text,
  
  -- Status
  is_active boolean DEFAULT true,
  verified_at timestamptz,
  
  -- Stats
  last_received_at timestamptz,
  received_count int DEFAULT 0,
  error_count int DEFAULT 0,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_webhooks_org ON integration_webhooks(org_id);
CREATE INDEX IF NOT EXISTS idx_integration_webhooks_connection ON integration_webhooks(connection_id);
CREATE INDEX IF NOT EXISTS idx_integration_webhooks_provider ON integration_webhooks(provider);

COMMENT ON TABLE integration_webhooks IS 'Registered webhook endpoints for receiving inbound events';

-- ============================================================================
-- INTEGRATION SYNC JOBS
-- Track sync job status and history
-- ============================================================================

CREATE TABLE IF NOT EXISTS integration_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  
  -- Job details
  job_type text NOT NULL,
  -- Types: full_sync, incremental_sync, webhook_replay, manual_sync
  
  -- Status
  status text NOT NULL DEFAULT 'pending',
  -- Status: pending, running, completed, failed, cancelled
  
  -- Progress
  started_at timestamptz,
  completed_at timestamptz,
  progress_pct int DEFAULT 0,
  items_processed int DEFAULT 0,
  items_total int,
  items_created int DEFAULT 0,
  items_updated int DEFAULT 0,
  items_failed int DEFAULT 0,
  
  -- Error handling
  error_message text,
  error_details jsonb,
  retry_count int DEFAULT 0,
  max_retries int DEFAULT 3,
  next_retry_at timestamptz,
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_sync_jobs_org ON integration_sync_jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_integration_sync_jobs_connection ON integration_sync_jobs(connection_id);
CREATE INDEX IF NOT EXISTS idx_integration_sync_jobs_status ON integration_sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_integration_sync_jobs_created ON integration_sync_jobs(created_at DESC);

COMMENT ON TABLE integration_sync_jobs IS 'Track sync job status and history for all integrations';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_sync_jobs ENABLE ROW LEVEL SECURITY;

-- Integration Connections Policies
DROP POLICY IF EXISTS "Users can view integration connections for their org" ON integration_connections;
CREATE POLICY "Users can view integration connections for their org"
  ON integration_connections FOR SELECT
  USING (org_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage integration connections" ON integration_connections;
CREATE POLICY "Admins can manage integration connections"
  ON integration_connections FOR ALL
  USING (
    org_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- Integration Logs Policies
DROP POLICY IF EXISTS "Users can view integration logs for their org" ON integration_logs;
CREATE POLICY "Users can view integration logs for their org"
  ON integration_logs FOR SELECT
  USING (org_id = get_user_organization_id());

DROP POLICY IF EXISTS "System can insert integration logs" ON integration_logs;
CREATE POLICY "System can insert integration logs"
  ON integration_logs FOR INSERT
  WITH CHECK (org_id = get_user_organization_id());

-- Integration Webhooks Policies
DROP POLICY IF EXISTS "Users can view integration webhooks for their org" ON integration_webhooks;
CREATE POLICY "Users can view integration webhooks for their org"
  ON integration_webhooks FOR SELECT
  USING (org_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage integration webhooks" ON integration_webhooks;
CREATE POLICY "Admins can manage integration webhooks"
  ON integration_webhooks FOR ALL
  USING (
    org_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- Integration Sync Jobs Policies
DROP POLICY IF EXISTS "Users can view sync jobs for their org" ON integration_sync_jobs;
CREATE POLICY "Users can view sync jobs for their org"
  ON integration_sync_jobs FOR SELECT
  USING (org_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage sync jobs" ON integration_sync_jobs;
CREATE POLICY "Admins can manage sync jobs"
  ON integration_sync_jobs FOR ALL
  USING (
    org_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated_at triggers (idempotent)
DROP TRIGGER IF EXISTS update_integration_connections_updated_at ON integration_connections;
CREATE TRIGGER update_integration_connections_updated_at
  BEFORE UPDATE ON integration_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_integration_webhooks_updated_at ON integration_webhooks;
CREATE TRIGGER update_integration_webhooks_updated_at
  BEFORE UPDATE ON integration_webhooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_integration_sync_jobs_updated_at ON integration_sync_jobs;
CREATE TRIGGER update_integration_sync_jobs_updated_at
  BEFORE UPDATE ON integration_sync_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get connection health summary for an org
CREATE OR REPLACE FUNCTION get_integration_health_summary(p_org_id uuid)
RETURNS TABLE (
  total_connections int,
  connected_count int,
  error_count int,
  pending_count int,
  recent_errors int,
  last_sync_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::int as total_connections,
    COUNT(*) FILTER (WHERE status = 'connected')::int as connected_count,
    COUNT(*) FILTER (WHERE status = 'error')::int as error_count,
    COUNT(*) FILTER (WHERE status = 'pending')::int as pending_count,
    (SELECT COUNT(*)::int FROM integration_logs 
     WHERE org_id = p_org_id AND status = 'error' 
     AND created_at > now() - interval '24 hours') as recent_errors,
    MAX(last_sync_at) as last_sync_at
  FROM integration_connections
  WHERE org_id = p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log an integration event
CREATE OR REPLACE FUNCTION log_integration_event(
  p_org_id uuid,
  p_connection_id uuid,
  p_event_type text,
  p_provider text,
  p_direction text DEFAULT 'outbound',
  p_status text DEFAULT 'success',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO integration_logs (
    org_id, connection_id, event_type, provider, direction, status, metadata
  ) VALUES (
    p_org_id, p_connection_id, p_event_type, p_provider, p_direction, p_status, p_metadata
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SEED DATA: DEFAULT PROVIDER CONFIGURATIONS
-- ============================================================================

-- This is documentation of supported providers, not actual data insertion
COMMENT ON TABLE integration_connections IS '
Supported Providers:
- Email: sendgrid, resend, mailgun
- SMS/Phone: twilio, ringcentral, goto
- Video: zoom, google_meet, microsoft_teams, goto_meeting
- Calendar: google_calendar, microsoft_outlook
- Chat: slack, whatsapp
- Commerce: shopify, woocommerce, bigcommerce
- Payments: stripe, square, authorize_net
- E-Sign: docusign, pandadoc, hellosign
- CRM Sync: zoho, salesforce, hubspot
';

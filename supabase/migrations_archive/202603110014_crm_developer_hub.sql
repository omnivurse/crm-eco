-- ============================================================================
-- MODULE 10: Developer Hub — API Keys, Webhooks & Request Logging
-- Creates developer-facing API key management, outbound webhook subscriptions,
-- and request audit logging for CRM API consumers
-- Complements existing: integration_connections, integration_logs,
--   integration_webhooks (provider-facing), crm_permissions (api.manage, api.webhooks)
-- ============================================================================

-- ============================================================================
-- 1. CRM API KEYS — Scoped developer API keys
-- Org-scoped keys for programmatic CRM access with permission scopes
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_api_keys (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Key identity
  name            text         NOT NULL,
  description     text,
  -- Key material (prefix is stored in clear; hash for lookup)
  key_prefix      text         NOT NULL,  -- First 8 chars for display (e.g., "dhh_k_ab")
  key_hash        text         NOT NULL,  -- SHA-256 hash of full key for authentication
  -- Scoping
  scopes          text[]       NOT NULL DEFAULT '{crm.read}' CHECK (
                    scopes <@ ARRAY[
                      'crm.read', 'crm.write', 'crm.admin',
                      'records.read', 'records.write', 'records.delete',
                      'contacts.read', 'contacts.write',
                      'pipelines.read', 'pipelines.write',
                      'automations.read', 'automations.write',
                      'analytics.read',
                      'import.execute', 'export.execute',
                      'webhooks.manage',
                      'extensions.read', 'extensions.manage'
                    ]
                  ),
  -- Access control
  allowed_ips     text[]       DEFAULT '{}',  -- IP whitelist (empty = all)
  allowed_origins text[]       DEFAULT '{}',  -- CORS origins (empty = all)
  rate_limit_rpm  int          DEFAULT 60,    -- Requests per minute
  -- Status
  status          text         NOT NULL DEFAULT 'active' CHECK (status IN (
                    'active', 'disabled', 'revoked', 'expired'
                  )),
  -- Expiry
  expires_at      timestamptz,
  -- Usage tracking
  last_used_at    timestamptz,
  last_used_ip    text,
  usage_count     bigint       NOT NULL DEFAULT 0,
  -- Environment
  environment     text         NOT NULL DEFAULT 'production' CHECK (environment IN (
                    'production', 'staging', 'development', 'test'
                  )),
  -- Audit
  created_by      uuid         REFERENCES profiles(id) ON DELETE SET NULL,
  revoked_by      uuid         REFERENCES profiles(id) ON DELETE SET NULL,
  revoked_at      timestamptz,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_api_keys_hash
  ON crm_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_crm_api_keys_org
  ON crm_api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_api_keys_prefix
  ON crm_api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_crm_api_keys_active
  ON crm_api_keys(organization_id, status)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_crm_api_keys_env
  ON crm_api_keys(organization_id, environment);

COMMENT ON TABLE crm_api_keys IS 'Developer API keys with scoped permissions for programmatic CRM access';
COMMENT ON COLUMN crm_api_keys.key_prefix IS 'First 8 chars of key for safe display (e.g., "dhh_k_ab")';
COMMENT ON COLUMN crm_api_keys.key_hash IS 'SHA-256 hash of full API key for authentication lookup';
COMMENT ON COLUMN crm_api_keys.scopes IS 'Permission scopes: crm.read, crm.write, crm.admin, records.*, pipelines.*, etc.';
COMMENT ON COLUMN crm_api_keys.allowed_ips IS 'IP whitelist — empty array means all IPs allowed';

-- ============================================================================
-- 2. CRM WEBHOOKS — Outbound webhook subscriptions
-- Org-managed webhook endpoints that fire on CRM events (record created, etc.)
-- Different from integration_webhooks (inbound provider webhooks)
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_webhooks (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Webhook identity
  name            text         NOT NULL,
  description     text,
  -- Target
  url             text         NOT NULL,  -- POST target URL
  -- Events to subscribe to
  events          text[]       NOT NULL DEFAULT '{}' CHECK (
                    events <@ ARRAY[
                      'record.created', 'record.updated', 'record.deleted',
                      'record.stage_changed',
                      'contact.created', 'contact.updated', 'contact.deleted',
                      'deal.created', 'deal.updated', 'deal.won', 'deal.lost',
                      'task.created', 'task.completed',
                      'note.created',
                      'import.completed', 'export.completed',
                      'pipeline.stage_changed',
                      'signal.fired', 'signal.resolved',
                      'extension.installed', 'extension.uninstalled',
                      'api_key.created', 'api_key.revoked'
                    ]
                  ),
  -- Authentication
  secret          text         NOT NULL,  -- HMAC signing secret
  auth_type       text         NOT NULL DEFAULT 'hmac_sha256' CHECK (auth_type IN (
                    'hmac_sha256', 'basic', 'bearer', 'none'
                  )),
  auth_value      text,        -- For basic/bearer auth (encrypted)
  -- Headers
  custom_headers  jsonb        DEFAULT '{}',  -- Additional headers to send
  -- Filtering
  module_id       uuid         REFERENCES crm_modules(id) ON DELETE SET NULL,  -- Scope to specific module
  filters         jsonb        DEFAULT '{}',  -- Additional event filters
  -- Delivery config
  timeout_ms      int          NOT NULL DEFAULT 10000,
  max_retries     int          NOT NULL DEFAULT 3,
  retry_interval_seconds int   NOT NULL DEFAULT 60,
  -- Status
  status          text         NOT NULL DEFAULT 'active' CHECK (status IN (
                    'active', 'disabled', 'failed', 'suspended'
                  )),
  is_verified     boolean      NOT NULL DEFAULT false,
  verified_at     timestamptz,
  -- Stats
  delivery_count  bigint       NOT NULL DEFAULT 0,
  success_count   bigint       NOT NULL DEFAULT 0,
  failure_count   bigint       NOT NULL DEFAULT 0,
  last_triggered_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error      text,
  consecutive_failures int     NOT NULL DEFAULT 0,
  -- Audit
  created_by      uuid         REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_webhooks_org
  ON crm_webhooks(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_webhooks_active
  ON crm_webhooks(organization_id, status)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_crm_webhooks_events
  ON crm_webhooks USING GIN (events);
CREATE INDEX IF NOT EXISTS idx_crm_webhooks_module
  ON crm_webhooks(module_id) WHERE module_id IS NOT NULL;

COMMENT ON TABLE crm_webhooks IS 'Outbound webhook subscriptions — fire HTTP POST on CRM events to developer-registered URLs';
COMMENT ON COLUMN crm_webhooks.events IS 'CRM events to subscribe to: record.created, deal.won, signal.fired, etc.';
COMMENT ON COLUMN crm_webhooks.secret IS 'HMAC signing secret for payload verification (X-Webhook-Signature header)';
COMMENT ON COLUMN crm_webhooks.consecutive_failures IS 'Auto-suspends webhook after 10 consecutive failures';

-- ============================================================================
-- 3. CRM WEBHOOK DELIVERIES — Delivery log for outbound webhooks
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_webhook_deliveries (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id      uuid         NOT NULL REFERENCES crm_webhooks(id) ON DELETE CASCADE,
  organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Event
  event_type      text         NOT NULL,
  event_id        text,        -- Source event identifier
  -- Request
  request_url     text         NOT NULL,
  request_headers jsonb        DEFAULT '{}',
  request_body    jsonb        NOT NULL DEFAULT '{}',
  -- Response
  response_status int,
  response_headers jsonb       DEFAULT '{}',
  response_body   text,
  -- Timing
  duration_ms     int,
  -- Status
  status          text         NOT NULL DEFAULT 'pending' CHECK (status IN (
                    'pending', 'success', 'failed', 'retrying'
                  )),
  error_message   text,
  -- Retry
  attempt         int          NOT NULL DEFAULT 1,
  max_attempts    int          NOT NULL DEFAULT 4,  -- 1 original + 3 retries
  next_retry_at   timestamptz,
  -- Timestamps
  delivered_at    timestamptz,
  created_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_webhook_deliveries_webhook
  ON crm_webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_crm_webhook_deliveries_org
  ON crm_webhook_deliveries(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_webhook_deliveries_status
  ON crm_webhook_deliveries(status)
  WHERE status IN ('pending', 'retrying');
CREATE INDEX IF NOT EXISTS idx_crm_webhook_deliveries_created
  ON crm_webhook_deliveries(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_webhook_deliveries_retry
  ON crm_webhook_deliveries(next_retry_at)
  WHERE status = 'retrying' AND next_retry_at IS NOT NULL;

COMMENT ON TABLE crm_webhook_deliveries IS 'Delivery log for outbound webhook events with retry tracking';

-- ============================================================================
-- 4. CRM API LOGS — Request-level audit log for CRM API
-- Tracks every authenticated API request for debugging and analytics
-- Complements integration_logs (for provider calls)
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_api_logs (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Request identity
  api_key_id      uuid         REFERENCES crm_api_keys(id) ON DELETE SET NULL,
  user_id         uuid         REFERENCES profiles(id) ON DELETE SET NULL,
  -- Request
  method          text         NOT NULL,
  path            text         NOT NULL,
  query_params    jsonb        DEFAULT '{}',
  request_body    jsonb,       -- Redacted for sensitive fields
  request_headers jsonb        DEFAULT '{}',  -- Select headers only
  -- Response
  response_status int          NOT NULL,
  response_body_size int,      -- Bytes
  -- Context
  ip_address      text,
  user_agent      text,
  -- Timing
  duration_ms     int,
  -- Scoping
  resource_type   text,        -- e.g., 'records', 'contacts', 'pipelines'
  resource_id     text,        -- ID of the affected resource
  action          text,        -- e.g., 'list', 'get', 'create', 'update', 'delete'
  -- Error
  error_code      text,
  error_message   text,
  -- Rate limiting
  rate_limited    boolean      NOT NULL DEFAULT false,
  -- Timestamps
  created_at      timestamptz  NOT NULL DEFAULT now()
);

-- Partitioning-ready index for time-based queries
CREATE INDEX IF NOT EXISTS idx_crm_api_logs_org_time
  ON crm_api_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_api_logs_key
  ON crm_api_logs(api_key_id) WHERE api_key_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_api_logs_user
  ON crm_api_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_api_logs_status
  ON crm_api_logs(response_status);
CREATE INDEX IF NOT EXISTS idx_crm_api_logs_path
  ON crm_api_logs(path);
CREATE INDEX IF NOT EXISTS idx_crm_api_logs_errors
  ON crm_api_logs(organization_id, created_at DESC)
  WHERE response_status >= 400;
CREATE INDEX IF NOT EXISTS idx_crm_api_logs_rate_limited
  ON crm_api_logs(organization_id, created_at DESC)
  WHERE rate_limited = true;

COMMENT ON TABLE crm_api_logs IS 'Request-level audit log for CRM API calls — tracks method, path, status, timing, and errors';
COMMENT ON COLUMN crm_api_logs.request_body IS 'Request body with sensitive fields redacted';

-- ============================================================================
-- 5. API KEY MANAGEMENT FUNCTIONS
-- ============================================================================

-- Authenticate an API key (returns key record if valid)
CREATE OR REPLACE FUNCTION fn_authenticate_api_key(p_key_hash text)
RETURNS TABLE(
  key_id uuid,
  org_id uuid,
  key_name text,
  scopes text[],
  allowed_ips text[],
  rate_limit_rpm int,
  environment text
) AS $$
DECLARE
  v_key RECORD;
BEGIN
  SELECT * INTO v_key
  FROM crm_api_keys
  WHERE crm_api_keys.key_hash = p_key_hash
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now());

  IF v_key IS NULL THEN
    RETURN;
  END IF;

  -- Update last used
  UPDATE crm_api_keys
  SET last_used_at = now(),
      usage_count = usage_count + 1
  WHERE id = v_key.id;

  key_id := v_key.id;
  org_id := v_key.organization_id;
  key_name := v_key.name;
  scopes := v_key.scopes;
  allowed_ips := v_key.allowed_ips;
  rate_limit_rpm := v_key.rate_limit_rpm;
  environment := v_key.environment;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION fn_authenticate_api_key IS
  'Authenticates an API key by hash, updates usage stats, returns key metadata with scopes';

-- Check if a key has a specific scope
CREATE OR REPLACE FUNCTION fn_check_api_scope(p_key_id uuid, p_scope text)
RETURNS boolean AS $$
DECLARE
  v_scopes text[];
BEGIN
  SELECT scopes INTO v_scopes
  FROM crm_api_keys
  WHERE id = p_key_id AND status = 'active';

  IF v_scopes IS NULL THEN
    RETURN false;
  END IF;

  -- crm.admin grants all scopes
  IF 'crm.admin' = ANY(v_scopes) THEN
    RETURN true;
  END IF;

  -- crm.write grants crm.read
  IF p_scope = 'crm.read' AND 'crm.write' = ANY(v_scopes) THEN
    RETURN true;
  END IF;

  -- Direct scope match
  RETURN p_scope = ANY(v_scopes);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION fn_check_api_scope IS
  'Checks if an API key has a specific scope (crm.admin grants all, crm.write grants crm.read)';

-- ============================================================================
-- 6. WEBHOOK DELIVERY HELPERS
-- ============================================================================

-- Record a webhook delivery attempt
CREATE OR REPLACE FUNCTION fn_record_webhook_delivery(
  p_webhook_id uuid,
  p_event_type text,
  p_status text,
  p_response_status int DEFAULT NULL,
  p_duration_ms int DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- Update webhook stats
  UPDATE crm_webhooks
  SET delivery_count = delivery_count + 1,
      last_triggered_at = now(),
      success_count = CASE WHEN p_status = 'success' THEN success_count + 1 ELSE success_count END,
      failure_count = CASE WHEN p_status = 'failed' THEN failure_count + 1 ELSE failure_count END,
      last_success_at = CASE WHEN p_status = 'success' THEN now() ELSE last_success_at END,
      last_failure_at = CASE WHEN p_status = 'failed' THEN now() ELSE last_failure_at END,
      last_error = CASE WHEN p_status = 'failed' THEN p_error ELSE last_error END,
      consecutive_failures = CASE
        WHEN p_status = 'success' THEN 0
        WHEN p_status = 'failed' THEN consecutive_failures + 1
        ELSE consecutive_failures
      END,
      -- Auto-suspend after 10 consecutive failures
      status = CASE
        WHEN p_status = 'failed' AND consecutive_failures >= 9 THEN 'suspended'
        ELSE status
      END,
      updated_at = now()
  WHERE id = p_webhook_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION fn_record_webhook_delivery IS
  'Records a webhook delivery attempt, updates stats, and auto-suspends after 10 consecutive failures';

-- Get webhooks matching an event for an org
CREATE OR REPLACE FUNCTION fn_get_matching_webhooks(
  p_org_id uuid,
  p_event_type text,
  p_module_id uuid DEFAULT NULL
)
RETURNS SETOF crm_webhooks AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM crm_webhooks
  WHERE organization_id = p_org_id
    AND status = 'active'
    AND p_event_type = ANY(events)
    AND (module_id IS NULL OR module_id = p_module_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION fn_get_matching_webhooks IS
  'Returns active webhooks subscribed to a specific event for an organization';

-- ============================================================================
-- 7. API LOG CLEANUP — Retain 90 days by default
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_cleanup_api_logs(p_retain_days int DEFAULT 90)
RETURNS int AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM crm_api_logs
  WHERE created_at < now() - (p_retain_days || ' days')::interval;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Also clean old webhook deliveries
  DELETE FROM crm_webhook_deliveries
  WHERE created_at < now() - (p_retain_days || ' days')::interval;

  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION fn_cleanup_api_logs IS
  'Removes API logs and webhook deliveries older than N days (default 90)';

-- ============================================================================
-- 8. AUDIT TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_audit_developer_hub_changes()
RETURNS trigger AS $$
BEGIN
  INSERT INTO unified_audit_logs (
    organization_id, app_source, actor_id,
    action, action_category, risk_level, details, changes
  ) VALUES (
    COALESCE(NEW.organization_id, OLD.organization_id),
    'crm',
    COALESCE(
      (SELECT id FROM profiles WHERE user_id = (SELECT auth.uid()) LIMIT 1),
      NULL
    ),
    TG_TABLE_NAME || '.' || lower(TG_OP),
    'developer',
    CASE
      WHEN TG_TABLE_NAME = 'crm_api_keys' AND TG_OP = 'DELETE' THEN 'critical'
      WHEN TG_TABLE_NAME = 'crm_api_keys' THEN 'high'
      WHEN TG_TABLE_NAME = 'crm_webhooks' THEN 'medium'
      ELSE 'low'
    END,
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'entity_name', CASE
        WHEN TG_TABLE_NAME = 'crm_api_keys' THEN COALESCE(NEW.name, OLD.name)
        WHEN TG_TABLE_NAME = 'crm_webhooks' THEN COALESCE(NEW.name, OLD.name)
        ELSE NULL
      END,
      'scopes', CASE
        WHEN TG_TABLE_NAME = 'crm_api_keys' THEN to_jsonb(COALESCE(NEW.scopes, OLD.scopes))
        ELSE NULL
      END
    ),
    CASE TG_OP
      WHEN 'INSERT' THEN jsonb_build_object('new', to_jsonb(NEW))
      WHEN 'UPDATE' THEN jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
      WHEN 'DELETE' THEN jsonb_build_object('old', to_jsonb(OLD))
    END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_audit_crm_api_keys
  AFTER INSERT OR UPDATE OR DELETE ON crm_api_keys
  FOR EACH ROW EXECUTE FUNCTION fn_audit_developer_hub_changes();

CREATE TRIGGER trg_audit_crm_webhooks
  AFTER INSERT OR UPDATE OR DELETE ON crm_webhooks
  FOR EACH ROW EXECUTE FUNCTION fn_audit_developer_hub_changes();

-- ============================================================================
-- 9. UPDATED_AT TRIGGERS
-- ============================================================================
CREATE TRIGGER update_crm_api_keys_updated_at
  BEFORE UPDATE ON crm_api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_webhooks_updated_at
  BEFORE UPDATE ON crm_webhooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 10. ROW LEVEL SECURITY
-- ============================================================================

-- ── crm_api_keys ────────────────────────────────────────────────────
ALTER TABLE crm_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_keys_select" ON crm_api_keys;
CREATE POLICY "api_keys_select" ON crm_api_keys
  FOR SELECT TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "api_keys_insert" ON crm_api_keys;
CREATE POLICY "api_keys_insert" ON crm_api_keys
  FOR INSERT TO authenticated
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "api_keys_update" ON crm_api_keys;
CREATE POLICY "api_keys_update" ON crm_api_keys
  FOR UPDATE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "api_keys_delete" ON crm_api_keys;
CREATE POLICY "api_keys_delete" ON crm_api_keys
  FOR DELETE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "api_keys_service" ON crm_api_keys;
CREATE POLICY "api_keys_service" ON crm_api_keys
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── crm_webhooks ────────────────────────────────────────────────────
ALTER TABLE crm_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_webhooks_select" ON crm_webhooks;
CREATE POLICY "crm_webhooks_select" ON crm_webhooks
  FOR SELECT TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "crm_webhooks_insert" ON crm_webhooks;
CREATE POLICY "crm_webhooks_insert" ON crm_webhooks
  FOR INSERT TO authenticated
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "crm_webhooks_update" ON crm_webhooks;
CREATE POLICY "crm_webhooks_update" ON crm_webhooks
  FOR UPDATE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "crm_webhooks_delete" ON crm_webhooks;
CREATE POLICY "crm_webhooks_delete" ON crm_webhooks
  FOR DELETE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "crm_webhooks_service" ON crm_webhooks;
CREATE POLICY "crm_webhooks_service" ON crm_webhooks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── crm_webhook_deliveries ──────────────────────────────────────────
ALTER TABLE crm_webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_deliveries_select" ON crm_webhook_deliveries;
CREATE POLICY "webhook_deliveries_select" ON crm_webhook_deliveries
  FOR SELECT TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "webhook_deliveries_service" ON crm_webhook_deliveries;
CREATE POLICY "webhook_deliveries_service" ON crm_webhook_deliveries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── crm_api_logs ────────────────────────────────────────────────────
ALTER TABLE crm_api_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_logs_select" ON crm_api_logs;
CREATE POLICY "api_logs_select" ON crm_api_logs
  FOR SELECT TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "api_logs_insert" ON crm_api_logs;
CREATE POLICY "api_logs_insert" ON crm_api_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);  -- Any authenticated request can create logs

DROP POLICY IF EXISTS "api_logs_service" ON crm_api_logs;
CREATE POLICY "api_logs_service" ON crm_api_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- END MODULE 10
-- ============================================================================

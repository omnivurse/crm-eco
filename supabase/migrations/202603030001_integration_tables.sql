-- ============================================================================
-- Integration Command Center: Full Table Schema
-- Creates integration_logs, integration_webhooks, integration_sync_jobs
-- and augments integration_connections with missing columns.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Augment integration_connections
--    The table was created in 202601170010_oauth_foundation.sql with a
--    minimal schema (organization_id, user_id, etc.).  The application code
--    expects many additional columns.  We add them idempotently.
-- --------------------------------------------------------------------------

DO $$
BEGIN
  -- org_id alias (code writes org_id, DB has organization_id)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='integration_connections' AND column_name='org_id') THEN
    ALTER TABLE integration_connections ADD COLUMN org_id uuid;
    -- backfill from existing column
    UPDATE integration_connections SET org_id = organization_id WHERE org_id IS NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='integration_connections' AND column_name='name') THEN
    ALTER TABLE integration_connections ADD COLUMN name text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='integration_connections' AND column_name='description') THEN
    ALTER TABLE integration_connections ADD COLUMN description text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='integration_connections' AND column_name='api_key_enc') THEN
    ALTER TABLE integration_connections ADD COLUMN api_key_enc text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='integration_connections' AND column_name='api_secret_enc') THEN
    ALTER TABLE integration_connections ADD COLUMN api_secret_enc text;
  END IF;

  -- Canonical token columns (code uses _enc suffix)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='integration_connections' AND column_name='access_token_enc') THEN
    ALTER TABLE integration_connections ADD COLUMN access_token_enc text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='integration_connections' AND column_name='refresh_token_enc') THEN
    ALTER TABLE integration_connections ADD COLUMN refresh_token_enc text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='integration_connections' AND column_name='settings') THEN
    ALTER TABLE integration_connections ADD COLUMN settings jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='integration_connections' AND column_name='external_account_id') THEN
    ALTER TABLE integration_connections ADD COLUMN external_account_id text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='integration_connections' AND column_name='external_account_name') THEN
    ALTER TABLE integration_connections ADD COLUMN external_account_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='integration_connections' AND column_name='external_account_email') THEN
    ALTER TABLE integration_connections ADD COLUMN external_account_email text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='integration_connections' AND column_name='last_sync_at') THEN
    ALTER TABLE integration_connections ADD COLUMN last_sync_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='integration_connections' AND column_name='last_sync_status') THEN
    ALTER TABLE integration_connections ADD COLUMN last_sync_status text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='integration_connections' AND column_name='last_sync_error') THEN
    ALTER TABLE integration_connections ADD COLUMN last_sync_error text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='integration_connections' AND column_name='sync_cursor') THEN
    ALTER TABLE integration_connections ADD COLUMN sync_cursor text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='integration_connections' AND column_name='last_webhook_at') THEN
    ALTER TABLE integration_connections ADD COLUMN last_webhook_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='integration_connections' AND column_name='webhook_secret') THEN
    ALTER TABLE integration_connections ADD COLUMN webhook_secret text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='integration_connections' AND column_name='error_count') THEN
    ALTER TABLE integration_connections ADD COLUMN error_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='integration_connections' AND column_name='last_error_at') THEN
    ALTER TABLE integration_connections ADD COLUMN last_error_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='integration_connections' AND column_name='last_error_message') THEN
    ALTER TABLE integration_connections ADD COLUMN last_error_message text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='integration_connections' AND column_name='health_status') THEN
    ALTER TABLE integration_connections ADD COLUMN health_status text DEFAULT 'unknown';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='integration_connections' AND column_name='created_by') THEN
    ALTER TABLE integration_connections ADD COLUMN created_by uuid;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='integration_connections' AND column_name='updated_by') THEN
    ALTER TABLE integration_connections ADD COLUMN updated_by uuid;
  END IF;
END $$;

-- Keep org_id in sync with organization_id
CREATE OR REPLACE FUNCTION sync_integration_conn_org_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.org_id IS NOT NULL AND NEW.organization_id IS NULL THEN
    NEW.organization_id := NEW.org_id;
  ELSIF NEW.organization_id IS NOT NULL AND NEW.org_id IS NULL THEN
    NEW.org_id := NEW.organization_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_integration_conn_org_id ON integration_connections;
CREATE TRIGGER trg_sync_integration_conn_org_id
  BEFORE INSERT OR UPDATE ON integration_connections
  FOR EACH ROW EXECUTE FUNCTION sync_integration_conn_org_id();

-- Additional indexes
CREATE INDEX IF NOT EXISTS idx_integration_connections_org_id ON integration_connections(org_id);
CREATE INDEX IF NOT EXISTS idx_integration_connections_type ON integration_connections(connection_type);
CREATE INDEX IF NOT EXISTS idx_integration_connections_status ON integration_connections(status);
CREATE INDEX IF NOT EXISTS idx_integration_connections_health ON integration_connections(health_status);

-- RLS (table should already have RLS enabled, but ensure it)
ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own org connections" ON integration_connections;
CREATE POLICY "Users can view own org connections" ON integration_connections
  FOR SELECT USING (
    org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
    OR organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can manage org connections" ON integration_connections;
CREATE POLICY "Admins can manage org connections" ON integration_connections
  FOR ALL USING (
    org_id IN (
      SELECT organization_id FROM profiles
      WHERE user_id = auth.uid()
      AND (crm_role IN ('crm_admin', 'crm_manager') OR role IN ('owner', 'admin'))
    )
    OR organization_id IN (
      SELECT organization_id FROM profiles
      WHERE user_id = auth.uid()
      AND (crm_role IN ('crm_admin', 'crm_manager') OR role IN ('owner', 'admin'))
    )
  );

DROP POLICY IF EXISTS "Service role full access to connections" ON integration_connections;
CREATE POLICY "Service role full access to connections" ON integration_connections
  FOR ALL USING (auth.role() = 'service_role');

-- --------------------------------------------------------------------------
-- 2. Create integration_logs
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS integration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES integration_connections(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  provider text NOT NULL,
  direction text NOT NULL DEFAULT 'outbound',
  method text,
  endpoint text,
  request_body jsonb,
  response_body jsonb,
  response_status integer,
  status text NOT NULL DEFAULT 'success',
  error_code text,
  error_message text,
  error_details jsonb,
  entity_type text,
  entity_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  duration_ms integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_logs_org ON integration_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_connection ON integration_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_provider ON integration_logs(provider);
CREATE INDEX IF NOT EXISTS idx_integration_logs_status ON integration_logs(status);
CREATE INDEX IF NOT EXISTS idx_integration_logs_event_type ON integration_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_integration_logs_created ON integration_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_logs_entity ON integration_logs(entity_type, entity_id);

ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org logs" ON integration_logs
  FOR SELECT USING (
    org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can insert logs" ON integration_logs
  FOR INSERT WITH CHECK (
    org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role full access to logs" ON integration_logs
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE integration_logs IS 'Audit log for all integration API calls, webhooks, and sync events';

-- --------------------------------------------------------------------------
-- 3. Create integration_webhooks
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS integration_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES integration_connections(id) ON DELETE SET NULL,
  provider text NOT NULL,
  event_types text[] NOT NULL DEFAULT '{}',
  endpoint_path text NOT NULL,
  secret_key text,
  is_active boolean DEFAULT true,
  verified_at timestamptz,
  last_received_at timestamptz,
  received_count integer DEFAULT 0,
  error_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_webhooks_org ON integration_webhooks(org_id);
CREATE INDEX IF NOT EXISTS idx_integration_webhooks_provider ON integration_webhooks(provider);
CREATE INDEX IF NOT EXISTS idx_integration_webhooks_active ON integration_webhooks(is_active);

ALTER TABLE integration_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org webhooks" ON integration_webhooks
  FOR SELECT USING (
    org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage org webhooks" ON integration_webhooks
  FOR ALL USING (
    org_id IN (
      SELECT organization_id FROM profiles
      WHERE user_id = auth.uid()
      AND (crm_role IN ('crm_admin', 'crm_manager') OR role IN ('owner', 'admin'))
    )
  );

CREATE POLICY "Service role full access to webhooks" ON integration_webhooks
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE integration_webhooks IS 'Registered webhook endpoints for inbound integration events';

-- --------------------------------------------------------------------------
-- 4. Create integration_sync_jobs
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS integration_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  job_type text NOT NULL DEFAULT 'full_sync',
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  progress_pct integer DEFAULT 0,
  items_processed integer DEFAULT 0,
  items_total integer,
  items_created integer DEFAULT 0,
  items_updated integer DEFAULT 0,
  items_failed integer DEFAULT 0,
  error_message text,
  error_details jsonb,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  next_retry_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_sync_jobs_org ON integration_sync_jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_integration_sync_jobs_connection ON integration_sync_jobs(connection_id);
CREATE INDEX IF NOT EXISTS idx_integration_sync_jobs_status ON integration_sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_integration_sync_jobs_created ON integration_sync_jobs(created_at DESC);

ALTER TABLE integration_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org sync jobs" ON integration_sync_jobs
  FOR SELECT USING (
    org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage org sync jobs" ON integration_sync_jobs
  FOR ALL USING (
    org_id IN (
      SELECT organization_id FROM profiles
      WHERE user_id = auth.uid()
      AND (crm_role IN ('crm_admin', 'crm_manager') OR role IN ('owner', 'admin'))
    )
  );

CREATE POLICY "Service role full access to sync jobs" ON integration_sync_jobs
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE integration_sync_jobs IS 'Track long-running data synchronisation jobs between integrations';

-- --------------------------------------------------------------------------
-- 5. Auto-update updated_at triggers
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_integration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_integration_webhooks_updated ON integration_webhooks;
CREATE TRIGGER trg_integration_webhooks_updated
  BEFORE UPDATE ON integration_webhooks
  FOR EACH ROW EXECUTE FUNCTION update_integration_updated_at();

DROP TRIGGER IF EXISTS trg_integration_sync_jobs_updated ON integration_sync_jobs;
CREATE TRIGGER trg_integration_sync_jobs_updated
  BEFORE UPDATE ON integration_sync_jobs
  FOR EACH ROW EXECUTE FUNCTION update_integration_updated_at();

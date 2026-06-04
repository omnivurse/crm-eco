-- ============================================================================
-- AUTOMATION ENGINE RUNTIME TABLES
--
-- Promotes the additive parts of supabase/migrations_temp/202699999003_automation_rules_engine.sql:
--   * integration_events, integration_jobs, automation_rule_runs (+ indexes, RLS)
--   * emit_integration_event, queue_integration_job, get_pending_jobs, complete_job
--
-- Excluded from promotion (already applied or unsafe):
--   * automation_rules table + its trigger/policies — already created in
--     202603070009_missing_tables_and_rpcs.sql with identical shape
--   * emit_record_created_event / emit_record_updated_event triggers on crm_records —
--     draft references NEW.organization_id and NEW.record_name, but the live
--     crm_records table uses org_id and title. Including them would break writes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- integration_events
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS integration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,

  payload jsonb NOT NULL,
  previous_state jsonb,

  processed boolean DEFAULT false,
  processed_at timestamptz,
  processing_attempts int DEFAULT 0,

  triggered_rules uuid[] DEFAULT '{}',

  source text DEFAULT 'internal',

  occurred_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_events_org ON integration_events(org_id);
CREATE INDEX IF NOT EXISTS idx_integration_events_type ON integration_events(event_type);
CREATE INDEX IF NOT EXISTS idx_integration_events_entity ON integration_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_integration_events_unprocessed ON integration_events(org_id, created_at)
  WHERE NOT processed;
CREATE INDEX IF NOT EXISTS idx_integration_events_occurred ON integration_events(org_id, occurred_at DESC);

COMMENT ON TABLE integration_events IS 'Raw events from all sources for automation processing';

-- ----------------------------------------------------------------------------
-- integration_jobs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS integration_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  job_type text NOT NULL,

  payload jsonb NOT NULL,

  run_at timestamptz NOT NULL DEFAULT now(),
  priority int DEFAULT 0,

  status text NOT NULL DEFAULT 'pending',

  started_at timestamptz,
  completed_at timestamptz,

  attempts int DEFAULT 0,
  max_attempts int DEFAULT 3,
  last_error text,
  next_retry_at timestamptz,

  source_event_id uuid REFERENCES integration_events(id) ON DELETE SET NULL,
  source_rule_id uuid,

  idempotency_key text,

  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_jobs_org ON integration_jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_integration_jobs_status ON integration_jobs(status);
CREATE INDEX IF NOT EXISTS idx_integration_jobs_run_at ON integration_jobs(run_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_integration_jobs_type ON integration_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_integration_jobs_idempotency ON integration_jobs(idempotency_key);

COMMENT ON TABLE integration_jobs IS 'Scheduled and queued jobs for automation';

-- ----------------------------------------------------------------------------
-- automation_rule_runs
-- (automation_rules itself already exists from 202603070009)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automation_rule_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,

  event_id uuid REFERENCES integration_events(id) ON DELETE SET NULL,
  trigger_data jsonb,

  status text NOT NULL DEFAULT 'pending',

  started_at timestamptz,
  completed_at timestamptz,
  duration_ms int,

  actions_executed jsonb DEFAULT '[]'::jsonb,

  error_message text,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_rule_runs_org ON automation_rule_runs(org_id);
CREATE INDEX IF NOT EXISTS idx_automation_rule_runs_rule ON automation_rule_runs(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_rule_runs_status ON automation_rule_runs(status);
CREATE INDEX IF NOT EXISTS idx_automation_rule_runs_created ON automation_rule_runs(created_at DESC);

COMMENT ON TABLE automation_rule_runs IS 'Log of automation rule executions';

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rule_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'integration_events' AND policyname = 'Users can view events for their org'
  ) THEN
    CREATE POLICY "Users can view events for their org"
      ON integration_events FOR SELECT
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'integration_events' AND policyname = 'System can manage events'
  ) THEN
    CREATE POLICY "System can manage events"
      ON integration_events FOR ALL
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'integration_jobs' AND policyname = 'Users can view jobs for their org'
  ) THEN
    CREATE POLICY "Users can view jobs for their org"
      ON integration_jobs FOR SELECT
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'integration_jobs' AND policyname = 'System can manage jobs'
  ) THEN
    CREATE POLICY "System can manage jobs"
      ON integration_jobs FOR ALL
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'automation_rule_runs' AND policyname = 'Users can view rule runs for their org'
  ) THEN
    CREATE POLICY "Users can view rule runs for their org"
      ON automation_rule_runs FOR SELECT
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Triggers
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_integration_jobs_updated_at') THEN
    CREATE TRIGGER update_integration_jobs_updated_at
      BEFORE UPDATE ON integration_jobs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Helper functions
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION emit_integration_event(
  p_org_id uuid,
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_payload jsonb,
  p_previous_state jsonb DEFAULT NULL,
  p_source text DEFAULT 'internal'
) RETURNS uuid AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO integration_events (
    org_id, event_type, entity_type, entity_id, payload, previous_state, source
  ) VALUES (
    p_org_id, p_event_type, p_entity_type, p_entity_id, p_payload, p_previous_state, p_source
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION queue_integration_job(
  p_org_id uuid,
  p_job_type text,
  p_payload jsonb,
  p_run_at timestamptz DEFAULT now(),
  p_source_event_id uuid DEFAULT NULL,
  p_source_rule_id uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_job_id uuid;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_job_id
    FROM integration_jobs
    WHERE idempotency_key = p_idempotency_key
      AND status NOT IN ('failed', 'cancelled');

    IF v_job_id IS NOT NULL THEN
      RETURN v_job_id;
    END IF;
  END IF;

  INSERT INTO integration_jobs (
    org_id, job_type, payload, run_at, source_event_id, source_rule_id, idempotency_key
  ) VALUES (
    p_org_id, p_job_type, p_payload, p_run_at, p_source_event_id, p_source_rule_id, p_idempotency_key
  )
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_pending_jobs(
  p_limit int DEFAULT 100
) RETURNS SETOF integration_jobs AS $$
BEGIN
  RETURN QUERY
  UPDATE integration_jobs
  SET status = 'running', started_at = now(), attempts = attempts + 1
  WHERE id IN (
    SELECT id FROM integration_jobs
    WHERE status = 'pending'
      AND run_at <= now()
    ORDER BY priority DESC, run_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION complete_job(
  p_job_id uuid,
  p_status text,
  p_error text DEFAULT NULL
) RETURNS void AS $$
BEGIN
  UPDATE integration_jobs
  SET
    completed_at = now(),
    last_error = p_error,
    next_retry_at = CASE
      WHEN p_status = 'failed' AND attempts < max_attempts
      THEN now() + (attempts * interval '5 minutes')
      ELSE NULL
    END,
    status = CASE
      WHEN p_status = 'failed' AND attempts < max_attempts THEN 'pending'
      ELSE p_status
    END
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

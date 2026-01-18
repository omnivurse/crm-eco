-- ============================================================================
-- PHASE W14: AUTOMATION RULES ENGINE
-- Event-driven automation with integration events and rule execution
-- ============================================================================

-- ============================================================================
-- INTEGRATION EVENTS TABLE
-- Raw events from all sources for automation processing
-- ============================================================================

CREATE TABLE IF NOT EXISTS integration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Event identification
  event_type text NOT NULL,
  -- Types: lead.created, lead.updated, lead.converted,
  --        deal.created, deal.updated, deal.stage_changed, deal.won, deal.lost,
  --        contact.created, contact.updated,
  --        task.created, task.completed, task.overdue,
  --        message.received, message.sent,
  --        invoice.created, invoice.paid,
  --        quote.sent, quote.accepted
  
  -- Entity info
  entity_type text NOT NULL,
  -- Types: lead, deal, contact, task, email, sms, invoice, quote
  entity_id uuid NOT NULL,
  
  -- Event data
  payload jsonb NOT NULL,
  previous_state jsonb,
  
  -- Processing status
  processed boolean DEFAULT false,
  processed_at timestamptz,
  processing_attempts int DEFAULT 0,
  
  -- Triggered rules
  triggered_rules uuid[] DEFAULT '{}',
  
  -- Source
  source text DEFAULT 'internal',
  -- Sources: internal, webhook, api, sync
  
  -- Timestamps
  occurred_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_integration_events_org ON integration_events(org_id);
CREATE INDEX idx_integration_events_type ON integration_events(event_type);
CREATE INDEX idx_integration_events_entity ON integration_events(entity_type, entity_id);
CREATE INDEX idx_integration_events_unprocessed ON integration_events(org_id, created_at)
  WHERE NOT processed;
CREATE INDEX idx_integration_events_occurred ON integration_events(org_id, occurred_at DESC);

COMMENT ON TABLE integration_events IS 'Raw events from all sources for automation processing';

-- ============================================================================
-- INTEGRATION JOBS TABLE
-- Scheduled and queued jobs for automation
-- ============================================================================

CREATE TABLE IF NOT EXISTS integration_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Job details
  job_type text NOT NULL,
  -- Types: send_email, send_sms, create_task, update_record, webhook_call,
  --        slack_message, approval_request, sync_run, scheduled_action
  
  -- Job data
  payload jsonb NOT NULL,
  
  -- Scheduling
  run_at timestamptz NOT NULL DEFAULT now(),
  priority int DEFAULT 0,
  
  -- Status
  status text NOT NULL DEFAULT 'pending',
  -- Status: pending, running, completed, failed, cancelled
  
  -- Execution
  started_at timestamptz,
  completed_at timestamptz,
  
  -- Retries
  attempts int DEFAULT 0,
  max_attempts int DEFAULT 3,
  last_error text,
  next_retry_at timestamptz,
  
  -- Reference
  source_event_id uuid REFERENCES integration_events(id) ON DELETE SET NULL,
  source_rule_id uuid,
  
  -- Idempotency
  idempotency_key text,
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_integration_jobs_org ON integration_jobs(org_id);
CREATE INDEX idx_integration_jobs_status ON integration_jobs(status);
CREATE INDEX idx_integration_jobs_run_at ON integration_jobs(run_at) WHERE status = 'pending';
CREATE INDEX idx_integration_jobs_type ON integration_jobs(job_type);
CREATE INDEX idx_integration_jobs_idempotency ON integration_jobs(idempotency_key);

COMMENT ON TABLE integration_jobs IS 'Scheduled and queued jobs for automation';

-- ============================================================================
-- AUTOMATION RULES TABLE
-- User-defined automation rules
-- ============================================================================

CREATE TABLE IF NOT EXISTS automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Rule details
  name text NOT NULL,
  description text,
  
  -- Trigger configuration
  trigger_type text NOT NULL,
  -- Types: event, schedule, webhook
  
  trigger_config jsonb NOT NULL,
  -- For event: { event_type: 'lead.created', entity_type: 'lead' }
  -- For schedule: { cron: '0 9 * * 1', timezone: 'America/New_York' }
  -- For webhook: { path: '/custom/hook' }
  
  -- Conditions (evaluated before actions run)
  conditions jsonb DEFAULT '{"match": "all", "rules": []}'::jsonb,
  -- { match: 'all'|'any', rules: [{ field, operator, value }] }
  
  -- Actions to execute
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{ type: 'send_email', config: {...} }, { type: 'create_task', config: {...} }]
  
  -- Status
  is_active boolean DEFAULT true,
  
  -- Stats
  run_count int DEFAULT 0,
  last_run_at timestamptz,
  last_run_status text,
  error_count int DEFAULT 0,
  
  -- Ownership
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_automation_rules_org ON automation_rules(org_id);
CREATE INDEX idx_automation_rules_active ON automation_rules(org_id, is_active) WHERE is_active;
CREATE INDEX idx_automation_rules_trigger ON automation_rules(trigger_type);

COMMENT ON TABLE automation_rules IS 'User-defined automation rules';

-- ============================================================================
-- AUTOMATION RULE RUNS TABLE
-- Log of automation rule executions
-- ============================================================================

CREATE TABLE IF NOT EXISTS automation_rule_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  
  -- Trigger info
  event_id uuid REFERENCES integration_events(id) ON DELETE SET NULL,
  trigger_data jsonb,
  
  -- Execution
  status text NOT NULL DEFAULT 'pending',
  -- Status: pending, running, completed, failed, skipped
  
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms int,
  
  -- Results
  actions_executed jsonb DEFAULT '[]'::jsonb,
  -- [{ action_type, status, result, error }]
  
  error_message text,
  
  -- Timestamps
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_automation_rule_runs_org ON automation_rule_runs(org_id);
CREATE INDEX idx_automation_rule_runs_rule ON automation_rule_runs(rule_id);
CREATE INDEX idx_automation_rule_runs_status ON automation_rule_runs(status);
CREATE INDEX idx_automation_rule_runs_created ON automation_rule_runs(created_at DESC);

COMMENT ON TABLE automation_rule_runs IS 'Log of automation rule executions';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rule_runs ENABLE ROW LEVEL SECURITY;

-- Integration Events Policies
CREATE POLICY "Users can view events for their org"
  ON integration_events FOR SELECT
  USING (org_id = get_user_organization_id());

CREATE POLICY "System can manage events"
  ON integration_events FOR ALL
  USING (org_id = get_user_organization_id());

-- Integration Jobs Policies
CREATE POLICY "Users can view jobs for their org"
  ON integration_jobs FOR SELECT
  USING (org_id = get_user_organization_id());

CREATE POLICY "System can manage jobs"
  ON integration_jobs FOR ALL
  USING (org_id = get_user_organization_id());

-- Automation Rules Policies
CREATE POLICY "Users can view rules for their org"
  ON automation_rules FOR SELECT
  USING (org_id = get_user_organization_id());

CREATE POLICY "Admins can manage rules"
  ON automation_rules FOR ALL
  USING (
    org_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- Rule Runs Policies
CREATE POLICY "Users can view rule runs for their org"
  ON automation_rule_runs FOR SELECT
  USING (org_id = get_user_organization_id());

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER update_integration_jobs_updated_at
  BEFORE UPDATE ON integration_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_rules_updated_at
  BEFORE UPDATE ON automation_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- EVENT EMITTER FUNCTIONS
-- ============================================================================

-- Function to emit an integration event
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

-- Function to queue a job
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
  -- Check for duplicate if idempotency key provided
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

-- ============================================================================
-- CRM EVENT TRIGGERS
-- Auto-emit events when CRM records change
-- ============================================================================

-- Lead/Contact/Deal created trigger
CREATE OR REPLACE FUNCTION emit_record_created_event()
RETURNS TRIGGER AS $$
DECLARE
  v_module_key text;
  v_event_type text;
BEGIN
  -- Get module key
  SELECT module_key INTO v_module_key
  FROM crm_modules WHERE id = NEW.module_id;
  
  -- Determine event type
  v_event_type := lower(v_module_key) || '.created';
  
  -- Emit event
  PERFORM emit_integration_event(
    NEW.organization_id,
    v_event_type,
    lower(v_module_key),
    NEW.id,
    jsonb_build_object(
      'record_id', NEW.id,
      'module_key', v_module_key,
      'record_name', NEW.record_name,
      'data', NEW.data
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_emit_record_created') THEN
    CREATE TRIGGER trigger_emit_record_created
      AFTER INSERT ON crm_records
      FOR EACH ROW EXECUTE FUNCTION emit_record_created_event();
  END IF;
END $$;

-- Record updated trigger
CREATE OR REPLACE FUNCTION emit_record_updated_event()
RETURNS TRIGGER AS $$
DECLARE
  v_module_key text;
  v_event_type text;
BEGIN
  -- Get module key
  SELECT module_key INTO v_module_key
  FROM crm_modules WHERE id = NEW.module_id;
  
  -- Determine event type
  v_event_type := lower(v_module_key) || '.updated';
  
  -- Check for stage change
  IF OLD.data->>'Stage' IS DISTINCT FROM NEW.data->>'Stage' THEN
    v_event_type := lower(v_module_key) || '.stage_changed';
  END IF;
  
  -- Emit event
  PERFORM emit_integration_event(
    NEW.organization_id,
    v_event_type,
    lower(v_module_key),
    NEW.id,
    jsonb_build_object(
      'record_id', NEW.id,
      'module_key', v_module_key,
      'record_name', NEW.record_name,
      'data', NEW.data,
      'changes', jsonb_build_object(
        'old_data', OLD.data,
        'new_data', NEW.data
      )
    ),
    jsonb_build_object('data', OLD.data)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_emit_record_updated') THEN
    CREATE TRIGGER trigger_emit_record_updated
      AFTER UPDATE ON crm_records
      FOR EACH ROW 
      WHEN (OLD.data IS DISTINCT FROM NEW.data)
      EXECUTE FUNCTION emit_record_updated_event();
  END IF;
END $$;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get pending jobs for processing
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

-- Complete a job
CREATE OR REPLACE FUNCTION complete_job(
  p_job_id uuid,
  p_status text,
  p_error text DEFAULT NULL
) RETURNS void AS $$
BEGIN
  UPDATE integration_jobs
  SET 
    status = p_status,
    completed_at = now(),
    last_error = p_error,
    next_retry_at = CASE 
      WHEN p_status = 'failed' AND attempts < max_attempts 
      THEN now() + (attempts * interval '5 minutes')
      ELSE NULL
    END,
    -- Reset to pending if failed and retries remaining
    status = CASE
      WHEN p_status = 'failed' AND attempts < max_attempts THEN 'pending'
      ELSE p_status
    END
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

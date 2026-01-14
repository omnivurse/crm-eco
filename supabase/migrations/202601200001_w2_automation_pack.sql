-- ============================================================================
-- W2: Automation Pack - Workflows + Macros + Schedulers
-- Implements multi-step workflows with delays, macros, scheduler jobs, 
-- webhook triggers, and enhanced run logging
-- ============================================================================

-- ============================================================================
-- EXTEND WORKFLOW TRIGGER TYPES
-- Add on_stage_change and inbound_webhook triggers
-- ============================================================================

-- Drop and recreate the trigger_type check constraint to add new values
ALTER TABLE crm_workflows 
  DROP CONSTRAINT IF EXISTS crm_workflows_trigger_type_check;

ALTER TABLE crm_workflows 
  ADD CONSTRAINT crm_workflows_trigger_type_check 
  CHECK (trigger_type IN ('on_create', 'on_update', 'on_stage_change', 'scheduled', 'webform', 'inbound_webhook'));

-- Add webhook_secret column for inbound webhook validation
ALTER TABLE crm_workflows 
  ADD COLUMN IF NOT EXISTS webhook_secret text;

COMMENT ON COLUMN crm_workflows.webhook_secret IS 'Secret token for validating inbound webhook requests';

-- ============================================================================
-- CRM WORKFLOW STEPS
-- Multi-step workflows with delays/waits between actions
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES crm_workflows(id) ON DELETE CASCADE,
  step_order int NOT NULL DEFAULT 0,
  name text,
  action_type text NOT NULL,
  action_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  delay_seconds int DEFAULT 0,
  delay_type text DEFAULT 'immediate' CHECK (delay_type IN ('immediate', 'fixed', 'relative')),
  delay_field text, -- For relative delays based on record date field
  conditions jsonb DEFAULT '[]'::jsonb, -- Step-level conditions
  is_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(workflow_id, step_order)
);

CREATE INDEX idx_crm_workflow_steps_workflow ON crm_workflow_steps(workflow_id);
CREATE INDEX idx_crm_workflow_steps_order ON crm_workflow_steps(workflow_id, step_order);

COMMENT ON TABLE crm_workflow_steps IS 'Individual steps within a workflow, executed in order with optional delays';
COMMENT ON COLUMN crm_workflow_steps.delay_seconds IS 'Seconds to wait before executing this step (0 = immediate)';
COMMENT ON COLUMN crm_workflow_steps.delay_type IS 'immediate: no delay, fixed: wait delay_seconds, relative: delay from date field';
COMMENT ON COLUMN crm_workflow_steps.delay_field IS 'Record date field to calculate relative delay from';

-- ============================================================================
-- CRM WORKFLOW RUN LOGS
-- Detailed step-by-step execution logs for each workflow run
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_workflow_run_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES crm_automation_runs(id) ON DELETE CASCADE,
  step_id uuid REFERENCES crm_workflow_steps(id) ON DELETE SET NULL,
  step_order int NOT NULL DEFAULT 0,
  action_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed', 'skipped', 'waiting')),
  started_at timestamptz,
  completed_at timestamptz,
  scheduled_for timestamptz, -- For delayed steps
  input jsonb DEFAULT '{}'::jsonb,
  output jsonb DEFAULT '{}'::jsonb,
  error text,
  retry_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_workflow_run_logs_run ON crm_workflow_run_logs(run_id);
CREATE INDEX idx_crm_workflow_run_logs_step ON crm_workflow_run_logs(step_id);
CREATE INDEX idx_crm_workflow_run_logs_status ON crm_workflow_run_logs(status);
CREATE INDEX idx_crm_workflow_run_logs_scheduled ON crm_workflow_run_logs(scheduled_for) 
  WHERE status = 'waiting' AND scheduled_for IS NOT NULL;

COMMENT ON TABLE crm_workflow_run_logs IS 'Detailed execution log for each step in a workflow run';
COMMENT ON COLUMN crm_workflow_run_logs.scheduled_for IS 'When this step is scheduled to execute (for delayed steps)';

-- ============================================================================
-- CRM MACROS
-- One-click action bundles for quick record operations
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_macros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES crm_modules(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  icon text DEFAULT 'zap',
  color text DEFAULT 'teal',
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_enabled boolean DEFAULT true,
  display_order int DEFAULT 100,
  -- Access control
  allowed_roles text[] DEFAULT ARRAY['crm_admin', 'crm_manager', 'crm_agent'],
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_macros_org ON crm_macros(org_id);
CREATE INDEX idx_crm_macros_module ON crm_macros(module_id);
CREATE INDEX idx_crm_macros_enabled ON crm_macros(org_id, module_id, is_enabled);

COMMENT ON TABLE crm_macros IS 'One-click action bundles that can be executed from record pages';
COMMENT ON COLUMN crm_macros.actions IS 'JSON array of actions to execute: [{type, config}]';
COMMENT ON COLUMN crm_macros.allowed_roles IS 'CRM roles that can execute this macro';

-- ============================================================================
-- CRM SCHEDULER JOBS
-- Queue for delayed workflow steps and scheduled executions
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_scheduler_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (job_type IN ('workflow_step', 'scheduled_workflow', 'retry', 'cadence_step', 'sla_escalation')),
  -- Reference to the entity being processed
  entity_type text NOT NULL, -- 'workflow', 'run', 'step', 'enrollment', etc.
  entity_id uuid NOT NULL,
  record_id uuid REFERENCES crm_records(id) ON DELETE CASCADE,
  -- Scheduling
  run_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  -- Retry handling
  attempts int DEFAULT 0,
  max_attempts int DEFAULT 3,
  last_error text,
  last_attempt_at timestamptz,
  -- Job data
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  -- Idempotency
  idempotency_key text,
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_crm_scheduler_jobs_org ON crm_scheduler_jobs(org_id);
CREATE INDEX idx_crm_scheduler_jobs_pending ON crm_scheduler_jobs(run_at, status) 
  WHERE status = 'pending';
CREATE INDEX idx_crm_scheduler_jobs_type ON crm_scheduler_jobs(job_type, status);
CREATE INDEX idx_crm_scheduler_jobs_entity ON crm_scheduler_jobs(entity_type, entity_id);
CREATE INDEX idx_crm_scheduler_jobs_record ON crm_scheduler_jobs(record_id) WHERE record_id IS NOT NULL;
CREATE INDEX idx_crm_scheduler_jobs_idempotency ON crm_scheduler_jobs(idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

COMMENT ON TABLE crm_scheduler_jobs IS 'Queue for delayed and scheduled automation jobs';
COMMENT ON COLUMN crm_scheduler_jobs.job_type IS 'Type of job: workflow_step, scheduled_workflow, retry, cadence_step, sla_escalation';
COMMENT ON COLUMN crm_scheduler_jobs.run_at IS 'When this job should be executed';
COMMENT ON COLUMN crm_scheduler_jobs.payload IS 'Job-specific data needed for execution';

-- ============================================================================
-- CRM MACRO RUNS
-- Audit log for macro executions
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_macro_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  macro_id uuid NOT NULL REFERENCES crm_macros(id) ON DELETE SET NULL,
  record_id uuid NOT NULL REFERENCES crm_records(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed', 'partial')),
  executed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  actions_executed jsonb DEFAULT '[]'::jsonb,
  error text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_crm_macro_runs_org ON crm_macro_runs(org_id);
CREATE INDEX idx_crm_macro_runs_macro ON crm_macro_runs(macro_id);
CREATE INDEX idx_crm_macro_runs_record ON crm_macro_runs(record_id);
CREATE INDEX idx_crm_macro_runs_user ON crm_macro_runs(executed_by);
CREATE INDEX idx_crm_macro_runs_created ON crm_macro_runs(started_at DESC);

COMMENT ON TABLE crm_macro_runs IS 'Audit log of macro executions';

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================
CREATE TRIGGER update_crm_workflow_steps_updated_at 
  BEFORE UPDATE ON crm_workflow_steps 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_macros_updated_at 
  BEFORE UPDATE ON crm_macros 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE crm_workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_workflow_run_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_macros ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_scheduler_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_macro_runs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- WORKFLOW STEPS POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view workflow steps"
  ON crm_workflow_steps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM crm_workflows w 
      WHERE w.id = workflow_id AND is_crm_member(w.org_id)
    )
  );

CREATE POLICY "CRM admins and managers can manage workflow steps"
  ON crm_workflow_steps FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM crm_workflows w 
      WHERE w.id = workflow_id AND has_crm_role(w.org_id, ARRAY['crm_admin', 'crm_manager'])
    )
  );

-- ============================================================================
-- WORKFLOW RUN LOGS POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view run logs"
  ON crm_workflow_run_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM crm_automation_runs r 
      WHERE r.id = run_id AND is_crm_member(r.org_id)
    )
  );

CREATE POLICY "CRM admins and managers can manage run logs"
  ON crm_workflow_run_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM crm_automation_runs r 
      WHERE r.id = run_id AND has_crm_role(r.org_id, ARRAY['crm_admin', 'crm_manager'])
    )
  );

-- ============================================================================
-- MACROS POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view macros"
  ON crm_macros FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM admins and managers can manage macros"
  ON crm_macros FOR ALL
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']));

-- ============================================================================
-- SCHEDULER JOBS POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view scheduler jobs"
  ON crm_scheduler_jobs FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM admins and managers can manage scheduler jobs"
  ON crm_scheduler_jobs FOR ALL
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']));

-- ============================================================================
-- MACRO RUNS POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view macro runs"
  ON crm_macro_runs FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM agents can create macro runs"
  ON crm_macro_runs FOR INSERT
  WITH CHECK (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

CREATE POLICY "CRM admins and managers can manage macro runs"
  ON crm_macro_runs FOR ALL
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']));

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get pending scheduler jobs for processing
CREATE OR REPLACE FUNCTION get_pending_scheduler_jobs(
  p_limit int DEFAULT 100,
  p_job_types text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  job_type text,
  entity_type text,
  entity_id uuid,
  record_id uuid,
  run_at timestamptz,
  attempts int,
  max_attempts int,
  payload jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id,
    j.org_id,
    j.job_type,
    j.entity_type,
    j.entity_id,
    j.record_id,
    j.run_at,
    j.attempts,
    j.max_attempts,
    j.payload
  FROM crm_scheduler_jobs j
  WHERE j.status = 'pending'
    AND j.run_at <= now()
    AND (p_job_types IS NULL OR j.job_type = ANY(p_job_types))
  ORDER BY j.run_at ASC
  LIMIT p_limit
  FOR UPDATE SKIP LOCKED;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Function to mark job as processing
CREATE OR REPLACE FUNCTION claim_scheduler_job(p_job_id uuid)
RETURNS boolean AS $$
DECLARE
  v_claimed boolean;
BEGIN
  UPDATE crm_scheduler_jobs
  SET status = 'processing',
      attempts = attempts + 1,
      last_attempt_at = now()
  WHERE id = p_job_id
    AND status = 'pending'
  RETURNING true INTO v_claimed;
  
  RETURN COALESCE(v_claimed, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Function to complete a scheduler job
CREATE OR REPLACE FUNCTION complete_scheduler_job(
  p_job_id uuid,
  p_status text,
  p_result jsonb DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE crm_scheduler_jobs
  SET status = p_status,
      result = COALESCE(p_result, result),
      last_error = p_error,
      completed_at = CASE WHEN p_status IN ('completed', 'failed', 'cancelled') THEN now() ELSE NULL END
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Function to generate webhook secret
CREATE OR REPLACE FUNCTION generate_webhook_secret()
RETURNS text AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE sql;

-- ============================================================================
-- COMPLETE
-- ============================================================================
SELECT 'W2 Automation Pack migration complete!' as status;

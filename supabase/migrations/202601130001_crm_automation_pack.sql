-- ============================================================================
-- CRM-ECO: Automation Pack Migration
-- Implements workflow rules, assignment rules, scoring, SLAs, cadences,
-- webforms, notifications, and automation run logging
-- ============================================================================

-- ============================================================================
-- CRM WORKFLOWS
-- Workflow rule definitions with triggers, conditions, and actions
-- ============================================================================
CREATE TABLE crm_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES crm_modules(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_enabled boolean DEFAULT true,
  trigger_type text NOT NULL CHECK (trigger_type IN ('on_create', 'on_update', 'scheduled', 'webform')),
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  priority int DEFAULT 100,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_workflows_org ON crm_workflows(org_id);
CREATE INDEX idx_crm_workflows_module ON crm_workflows(module_id);
CREATE INDEX idx_crm_workflows_enabled ON crm_workflows(org_id, module_id, is_enabled);
CREATE INDEX idx_crm_workflows_trigger ON crm_workflows(trigger_type) WHERE is_enabled = true;

COMMENT ON TABLE crm_workflows IS 'Workflow automation rules that trigger on record events';
COMMENT ON COLUMN crm_workflows.trigger_type IS 'When the workflow triggers: on_create, on_update, scheduled, or webform';
COMMENT ON COLUMN crm_workflows.trigger_config IS 'Trigger-specific config: schedule cron, field change filters, etc.';
COMMENT ON COLUMN crm_workflows.conditions IS 'JSON array of condition groups with AND/OR logic';
COMMENT ON COLUMN crm_workflows.actions IS 'JSON array of actions to execute when conditions match';

-- ============================================================================
-- CRM ASSIGNMENT RULES
-- Owner assignment strategies with per-rule rotation state
-- ============================================================================
CREATE TABLE crm_assignment_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES crm_modules(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_enabled boolean DEFAULT true,
  strategy text NOT NULL CHECK (strategy IN ('round_robin', 'territory', 'least_loaded', 'fixed')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  conditions jsonb DEFAULT '[]'::jsonb,
  priority int DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_assignment_rules_org ON crm_assignment_rules(org_id);
CREATE INDEX idx_crm_assignment_rules_module ON crm_assignment_rules(module_id);
CREATE INDEX idx_crm_assignment_rules_enabled ON crm_assignment_rules(org_id, module_id, is_enabled);

COMMENT ON TABLE crm_assignment_rules IS 'Rules for automatic owner assignment';
COMMENT ON COLUMN crm_assignment_rules.strategy IS 'Assignment strategy: round_robin, territory, least_loaded, or fixed';
COMMENT ON COLUMN crm_assignment_rules.config IS 'Strategy config including users list, territory mapping, rotation cursor, etc.';

-- ============================================================================
-- CRM SCORING RULES
-- Point-based lead/record scoring
-- ============================================================================
CREATE TABLE crm_scoring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES crm_modules(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_enabled boolean DEFAULT true,
  rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  score_field_key text DEFAULT 'score',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_scoring_rules_org ON crm_scoring_rules(org_id);
CREATE INDEX idx_crm_scoring_rules_module ON crm_scoring_rules(module_id);

COMMENT ON TABLE crm_scoring_rules IS 'Scoring rules to compute record scores based on field values';
COMMENT ON COLUMN crm_scoring_rules.rules IS 'JSON array of scoring rules: {field, operator, value, points}';
COMMENT ON COLUMN crm_scoring_rules.score_field_key IS 'Field key in record data where score is stored';

-- ============================================================================
-- CRM CADENCES
-- Multi-step engagement sequences
-- ============================================================================
CREATE TABLE crm_cadences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES crm_modules(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_enabled boolean DEFAULT true,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_cadences_org ON crm_cadences(org_id);
CREATE INDEX idx_crm_cadences_module ON crm_cadences(module_id);

COMMENT ON TABLE crm_cadences IS 'Multi-step engagement sequences (tasks, emails, calls)';
COMMENT ON COLUMN crm_cadences.steps IS 'JSON array of steps: {type, delay_days, config}';

-- ============================================================================
-- CRM CADENCE ENROLLMENTS
-- Track record enrollment in cadences
-- ============================================================================
CREATE TABLE crm_cadence_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cadence_id uuid NOT NULL REFERENCES crm_cadences(id) ON DELETE CASCADE,
  record_id uuid NOT NULL REFERENCES crm_records(id) ON DELETE CASCADE,
  status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  current_step int DEFAULT 0,
  next_step_at timestamptz,
  state jsonb DEFAULT '{}'::jsonb,
  enrolled_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(cadence_id, record_id)
);

CREATE INDEX idx_crm_cadence_enrollments_org ON crm_cadence_enrollments(org_id);
CREATE INDEX idx_crm_cadence_enrollments_cadence ON crm_cadence_enrollments(cadence_id);
CREATE INDEX idx_crm_cadence_enrollments_record ON crm_cadence_enrollments(record_id);
CREATE INDEX idx_crm_cadence_enrollments_next_step ON crm_cadence_enrollments(next_step_at) 
  WHERE status = 'active' AND next_step_at IS NOT NULL;

COMMENT ON TABLE crm_cadence_enrollments IS 'Tracks records enrolled in cadences';
COMMENT ON COLUMN crm_cadence_enrollments.current_step IS '0-based index of current step';
COMMENT ON COLUMN crm_cadence_enrollments.next_step_at IS 'When the next step should execute';

-- ============================================================================
-- CRM SLA POLICIES
-- Service level agreement definitions
-- ============================================================================
CREATE TABLE crm_sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES crm_modules(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_enabled boolean DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_sla_policies_org ON crm_sla_policies(org_id);
CREATE INDEX idx_crm_sla_policies_module ON crm_sla_policies(module_id);

COMMENT ON TABLE crm_sla_policies IS 'SLA policies with response times and escalation rules';
COMMENT ON COLUMN crm_sla_policies.config IS 'SLA config: {response_hours, escalation_hours, conditions, escalate_to}';

-- ============================================================================
-- CRM WEBFORMS
-- Public form definitions
-- ============================================================================
CREATE TABLE crm_webforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES crm_modules(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  layout jsonb NOT NULL DEFAULT '{}'::jsonb,
  hidden_fields jsonb DEFAULT '{}'::jsonb,
  dedupe_config jsonb DEFAULT '{}'::jsonb,
  success_message text DEFAULT 'Thank you for your submission!',
  redirect_url text,
  is_enabled boolean DEFAULT true,
  submit_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, slug)
);

CREATE INDEX idx_crm_webforms_org ON crm_webforms(org_id);
CREATE INDEX idx_crm_webforms_module ON crm_webforms(module_id);
CREATE INDEX idx_crm_webforms_slug ON crm_webforms(org_id, slug) WHERE is_enabled = true;

COMMENT ON TABLE crm_webforms IS 'Public webform definitions for lead capture';
COMMENT ON COLUMN crm_webforms.slug IS 'URL-safe identifier, unique per org';
COMMENT ON COLUMN crm_webforms.layout IS 'Form layout config: {fields, sections}';
COMMENT ON COLUMN crm_webforms.hidden_fields IS 'Hidden field values to inject';
COMMENT ON COLUMN crm_webforms.dedupe_config IS 'Deduplication rules: {fields, strategy}';

-- ============================================================================
-- CRM NOTIFICATIONS
-- In-app notifications
-- ============================================================================
CREATE TABLE crm_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  href text,
  icon text DEFAULT 'bell',
  is_read boolean DEFAULT false,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_notifications_user ON crm_notifications(user_id);
CREATE INDEX idx_crm_notifications_unread ON crm_notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_crm_notifications_created ON crm_notifications(user_id, created_at DESC);

COMMENT ON TABLE crm_notifications IS 'In-app notifications for CRM users';

-- ============================================================================
-- CRM AUTOMATION RUNS
-- Execution audit log for all automation types
-- ============================================================================
CREATE TABLE crm_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_id uuid REFERENCES crm_workflows(id) ON DELETE SET NULL,
  source text NOT NULL CHECK (source IN ('workflow', 'assignment', 'scoring', 'cadence', 'sla', 'webform')),
  trigger text NOT NULL,
  module_id uuid REFERENCES crm_modules(id) ON DELETE SET NULL,
  record_id uuid REFERENCES crm_records(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed', 'skipped', 'dry_run')),
  is_dry_run boolean DEFAULT false,
  input jsonb DEFAULT '{}'::jsonb,
  output jsonb DEFAULT '{}'::jsonb,
  actions_executed jsonb DEFAULT '[]'::jsonb,
  error text,
  idempotency_key text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_crm_automation_runs_org ON crm_automation_runs(org_id);
CREATE INDEX idx_crm_automation_runs_workflow ON crm_automation_runs(workflow_id);
CREATE INDEX idx_crm_automation_runs_record ON crm_automation_runs(record_id);
CREATE INDEX idx_crm_automation_runs_status ON crm_automation_runs(status);
CREATE INDEX idx_crm_automation_runs_created ON crm_automation_runs(started_at DESC);
CREATE INDEX idx_crm_automation_runs_idempotency ON crm_automation_runs(idempotency_key) WHERE idempotency_key IS NOT NULL;

COMMENT ON TABLE crm_automation_runs IS 'Audit log of all automation executions';
COMMENT ON COLUMN crm_automation_runs.source IS 'Type of automation that ran';
COMMENT ON COLUMN crm_automation_runs.actions_executed IS 'Array of action results: {type, status, output}';
COMMENT ON COLUMN crm_automation_runs.idempotency_key IS 'For deduplicating webhook/webform triggers';

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================
CREATE TRIGGER update_crm_workflows_updated_at 
  BEFORE UPDATE ON crm_workflows 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_assignment_rules_updated_at 
  BEFORE UPDATE ON crm_assignment_rules 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_scoring_rules_updated_at 
  BEFORE UPDATE ON crm_scoring_rules 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_cadences_updated_at 
  BEFORE UPDATE ON crm_cadences 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_cadence_enrollments_updated_at 
  BEFORE UPDATE ON crm_cadence_enrollments 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_sla_policies_updated_at 
  BEFORE UPDATE ON crm_sla_policies 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_webforms_updated_at 
  BEFORE UPDATE ON crm_webforms 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE crm_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_assignment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_cadences ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_cadence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_webforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_automation_runs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- WORKFLOWS POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view workflows"
  ON crm_workflows FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM admins and managers can manage workflows"
  ON crm_workflows FOR ALL
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']));

-- ============================================================================
-- ASSIGNMENT RULES POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view assignment rules"
  ON crm_assignment_rules FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM admins and managers can manage assignment rules"
  ON crm_assignment_rules FOR ALL
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']));

-- ============================================================================
-- SCORING RULES POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view scoring rules"
  ON crm_scoring_rules FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM admins and managers can manage scoring rules"
  ON crm_scoring_rules FOR ALL
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']));

-- ============================================================================
-- CADENCES POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view cadences"
  ON crm_cadences FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM admins and managers can manage cadences"
  ON crm_cadences FOR ALL
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']));

-- ============================================================================
-- CADENCE ENROLLMENTS POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view cadence enrollments"
  ON crm_cadence_enrollments FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM agents can manage cadence enrollments"
  ON crm_cadence_enrollments FOR ALL
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

-- ============================================================================
-- SLA POLICIES POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view SLA policies"
  ON crm_sla_policies FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM admins and managers can manage SLA policies"
  ON crm_sla_policies FOR ALL
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']));

-- ============================================================================
-- WEBFORMS POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view webforms"
  ON crm_webforms FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM admins and managers can manage webforms"
  ON crm_webforms FOR ALL
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']));

-- ============================================================================
-- NOTIFICATIONS POLICIES
-- ============================================================================
CREATE POLICY "Users can view their own notifications"
  ON crm_notifications FOR SELECT
  USING (user_id = current_profile_id());

CREATE POLICY "Users can update their own notifications"
  ON crm_notifications FOR UPDATE
  USING (user_id = current_profile_id());

CREATE POLICY "System can create notifications"
  ON crm_notifications FOR INSERT
  WITH CHECK (is_crm_member(org_id));

CREATE POLICY "Users can delete their own notifications"
  ON crm_notifications FOR DELETE
  USING (user_id = current_profile_id() OR has_crm_role(org_id, ARRAY['crm_admin']));

-- ============================================================================
-- AUTOMATION RUNS POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view automation runs"
  ON crm_automation_runs FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM admins and managers can manage automation runs"
  ON crm_automation_runs FOR ALL
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']));

-- ============================================================================
-- HELPER FUNCTION: Increment webform submit count
-- ============================================================================
CREATE OR REPLACE FUNCTION increment_webform_submit_count(p_webform_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE crm_webforms 
  SET submit_count = submit_count + 1
  WHERE id = p_webform_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- ============================================================================
-- HELPER FUNCTION: Get org by slug (for public webform endpoint)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_org_by_slug(p_slug text)
RETURNS uuid AS $$
  SELECT id FROM organizations WHERE slug = p_slug LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION get_org_by_slug(text) TO anon, authenticated;

-- ============================================================================
-- COMPLETE
-- ============================================================================
SELECT 'CRM Automation Pack migration complete!' as status;

-- ============================================================================
-- CRM-ECO: Communications, Blueprints & Approvals Migration
-- Enterprise layer: Email/SMS orchestration, stage gating, multi-step approvals
-- ============================================================================

-- ============================================================================
-- SECTION A1: MESSAGE PROVIDERS
-- Stores provider configurations per org (secrets in env vars, not DB)
-- ============================================================================
CREATE TABLE crm_message_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('sendgrid', 'twilio')),
  name text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,  -- from_email, from_name, from_phone (no secrets)
  is_default boolean DEFAULT false,
  is_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_message_providers_org ON crm_message_providers(org_id);
CREATE INDEX idx_crm_message_providers_type ON crm_message_providers(org_id, type);
CREATE INDEX idx_crm_message_providers_default ON crm_message_providers(org_id, is_default) WHERE is_default = true;

COMMENT ON TABLE crm_message_providers IS 'Email/SMS provider configurations per org';
COMMENT ON COLUMN crm_message_providers.config IS 'Provider config: from_email, from_name, from_phone. Secrets stored in env vars.';

-- ============================================================================
-- SECTION A1: MESSAGE TEMPLATES
-- Reusable templates with merge field support
-- ============================================================================
CREATE TABLE crm_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid REFERENCES crm_modules(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms')),
  name text NOT NULL,
  subject text,  -- email only
  body text NOT NULL,  -- supports {{merge.fields}}
  meta jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_message_templates_org ON crm_message_templates(org_id);
CREATE INDEX idx_crm_message_templates_module ON crm_message_templates(module_id);
CREATE INDEX idx_crm_message_templates_channel ON crm_message_templates(org_id, channel);

COMMENT ON TABLE crm_message_templates IS 'Email/SMS templates with merge field support';
COMMENT ON COLUMN crm_message_templates.body IS 'Template body with merge fields: {{system.field}}, {{data.key}}, {{owner.name}}';

-- ============================================================================
-- SECTION A1: MESSAGE THREADS
-- Conversation threads per record
-- ============================================================================
CREATE TABLE crm_message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  record_id uuid NOT NULL REFERENCES crm_records(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'sms')),
  external_thread_id text,  -- provider thread/conversation id
  subject text,  -- for email threads
  participant_address text NOT NULL,  -- email or phone of contact
  message_count int DEFAULT 0,
  last_message_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_message_threads_org ON crm_message_threads(org_id);
CREATE INDEX idx_crm_message_threads_record ON crm_message_threads(record_id);
CREATE INDEX idx_crm_message_threads_channel ON crm_message_threads(record_id, channel);
CREATE INDEX idx_crm_message_threads_external ON crm_message_threads(external_thread_id) WHERE external_thread_id IS NOT NULL;

COMMENT ON TABLE crm_message_threads IS 'Conversation threads grouping messages per record';

-- ============================================================================
-- SECTION A1: MESSAGES
-- Individual messages with full status lifecycle
-- ============================================================================
CREATE TABLE crm_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  record_id uuid NOT NULL REFERENCES crm_records(id) ON DELETE CASCADE,
  thread_id uuid REFERENCES crm_message_threads(id) ON DELETE SET NULL,
  template_id uuid REFERENCES crm_message_templates(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms')),
  direction text NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  to_address text NOT NULL,
  from_address text,
  subject text,  -- email only
  body text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued', 'sending', 'sent', 'delivered', 'failed', 
    'bounced', 'unsubscribed', 'blocked', 'spam'
  )),
  provider text,
  provider_message_id text,
  error text,
  retry_count int DEFAULT 0,
  next_retry_at timestamptz,
  meta jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_messages_org ON crm_messages(org_id);
CREATE INDEX idx_crm_messages_record ON crm_messages(record_id);
CREATE INDEX idx_crm_messages_thread ON crm_messages(thread_id);
CREATE INDEX idx_crm_messages_status ON crm_messages(status);
CREATE INDEX idx_crm_messages_queued ON crm_messages(status, next_retry_at) 
  WHERE status IN ('queued', 'failed') AND next_retry_at IS NOT NULL;
CREATE INDEX idx_crm_messages_provider_id ON crm_messages(provider_message_id) 
  WHERE provider_message_id IS NOT NULL;
CREATE INDEX idx_crm_messages_created ON crm_messages(created_at DESC);

COMMENT ON TABLE crm_messages IS 'All email/SMS messages with delivery status tracking';
COMMENT ON COLUMN crm_messages.status IS 'Lifecycle: queued -> sending -> sent -> delivered (or failed/bounced/blocked)';

-- ============================================================================
-- SECTION A1: MESSAGE EVENTS
-- Webhook delivery events from providers
-- ============================================================================
CREATE TABLE crm_message_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES crm_messages(id) ON DELETE CASCADE,
  event text NOT NULL,  -- sent, delivered, bounce, spamreport, open, click, etc
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_message_events_message ON crm_message_events(message_id);
CREATE INDEX idx_crm_message_events_event ON crm_message_events(event);
CREATE INDEX idx_crm_message_events_created ON crm_message_events(created_at DESC);

COMMENT ON TABLE crm_message_events IS 'Webhook events for message delivery tracking';

-- ============================================================================
-- SECTION A2: CONTACT PREFERENCES
-- Compliance controls for email/SMS communication
-- ============================================================================
CREATE TABLE crm_contact_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  record_id uuid NOT NULL REFERENCES crm_records(id) ON DELETE CASCADE,
  do_not_email boolean DEFAULT false,
  do_not_sms boolean DEFAULT false,
  do_not_call boolean DEFAULT false,
  unsubscribed_at timestamptz,
  unsubscribe_reason text,
  preferred_channel text CHECK (preferred_channel IS NULL OR preferred_channel IN ('email', 'sms', 'phone')),
  email_frequency text CHECK (email_frequency IS NULL OR email_frequency IN ('all', 'important', 'none')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, record_id)
);

CREATE INDEX idx_crm_contact_preferences_org ON crm_contact_preferences(org_id);
CREATE INDEX idx_crm_contact_preferences_record ON crm_contact_preferences(record_id);
CREATE INDEX idx_crm_contact_preferences_dnc ON crm_contact_preferences(org_id, do_not_email, do_not_sms);

COMMENT ON TABLE crm_contact_preferences IS 'Contact communication preferences and compliance flags';

-- ============================================================================
-- SECTION A3: BLUEPRINTS
-- Stage gating definitions with transitions and required fields
-- ============================================================================
CREATE TABLE crm_blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES crm_modules(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_enabled boolean DEFAULT true,
  is_default boolean DEFAULT false,
  stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- stages: [{key, label, order, color?}]
  transitions jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- transitions: [{from, to, required_fields[], actions[], requires_approval?, require_reason?}]
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, module_id, name)
);

CREATE INDEX idx_crm_blueprints_org ON crm_blueprints(org_id);
CREATE INDEX idx_crm_blueprints_module ON crm_blueprints(module_id);
CREATE INDEX idx_crm_blueprints_enabled ON crm_blueprints(org_id, module_id, is_enabled);
CREATE INDEX idx_crm_blueprints_default ON crm_blueprints(module_id, is_default) WHERE is_default = true;

COMMENT ON TABLE crm_blueprints IS 'Blueprint definitions for stage gating and transitions';
COMMENT ON COLUMN crm_blueprints.stages IS 'JSON array: [{key, label, order, color?}]';
COMMENT ON COLUMN crm_blueprints.transitions IS 'JSON array: [{from, to, required_fields, actions, requires_approval, require_reason}]';

-- ============================================================================
-- SECTION A3: STAGE HISTORY
-- Immutable audit log of stage transitions
-- ============================================================================
CREATE TABLE crm_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  record_id uuid NOT NULL REFERENCES crm_records(id) ON DELETE CASCADE,
  blueprint_id uuid REFERENCES crm_blueprints(id) ON DELETE SET NULL,
  from_stage text,
  to_stage text NOT NULL,
  reason text,
  transition_data jsonb DEFAULT '{}'::jsonb,  -- fields filled during transition
  changed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approval_id uuid,  -- filled if transition required approval
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_stage_history_org ON crm_stage_history(org_id);
CREATE INDEX idx_crm_stage_history_record ON crm_stage_history(record_id);
CREATE INDEX idx_crm_stage_history_blueprint ON crm_stage_history(blueprint_id);
CREATE INDEX idx_crm_stage_history_created ON crm_stage_history(created_at DESC);

COMMENT ON TABLE crm_stage_history IS 'Immutable audit log of all stage transitions';

-- ============================================================================
-- SECTION A4: APPROVAL PROCESSES
-- Multi-step approval process definitions
-- ============================================================================
CREATE TABLE crm_approval_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES crm_modules(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_enabled boolean DEFAULT true,
  trigger_type text NOT NULL CHECK (trigger_type IN ('stage_transition', 'field_change', 'record_create', 'manual')),
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- trigger_config: {stage_from?, stage_to?, field?, condition?}
  conditions jsonb DEFAULT '[]'::jsonb,
  -- conditions: [{field, operator, value}] - additional conditions
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- steps: [{type: 'role'|'user'|'manager', value, require_comment?, can_delegate?}]
  on_approve_actions jsonb DEFAULT '[]'::jsonb,
  on_reject_actions jsonb DEFAULT '[]'::jsonb,
  auto_approve_after_hours int,  -- optional auto-approve timeout
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_approval_processes_org ON crm_approval_processes(org_id);
CREATE INDEX idx_crm_approval_processes_module ON crm_approval_processes(module_id);
CREATE INDEX idx_crm_approval_processes_enabled ON crm_approval_processes(org_id, module_id, is_enabled);
CREATE INDEX idx_crm_approval_processes_trigger ON crm_approval_processes(trigger_type);

COMMENT ON TABLE crm_approval_processes IS 'Approval process definitions with multi-step workflows';
COMMENT ON COLUMN crm_approval_processes.steps IS 'JSON array: [{type, value, require_comment, can_delegate}]';

-- ============================================================================
-- SECTION A4: APPROVALS
-- Active approval requests
-- ============================================================================
CREATE TABLE crm_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  process_id uuid NOT NULL REFERENCES crm_approval_processes(id) ON DELETE CASCADE,
  record_id uuid NOT NULL REFERENCES crm_records(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'changes_requested', 'cancelled', 'expired'
  )),
  current_step int DEFAULT 0,
  context jsonb DEFAULT '{}'::jsonb,
  -- context: {action_type, stage_from?, stage_to?, field_changes?, etc}
  requested_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_approvals_org ON crm_approvals(org_id);
CREATE INDEX idx_crm_approvals_process ON crm_approvals(process_id);
CREATE INDEX idx_crm_approvals_record ON crm_approvals(record_id);
CREATE INDEX idx_crm_approvals_status ON crm_approvals(status);
CREATE INDEX idx_crm_approvals_pending ON crm_approvals(org_id, status) WHERE status = 'pending';
CREATE INDEX idx_crm_approvals_requested_by ON crm_approvals(requested_by);
CREATE INDEX idx_crm_approvals_created ON crm_approvals(created_at DESC);

COMMENT ON TABLE crm_approvals IS 'Active and historical approval requests';

-- ============================================================================
-- SECTION A4: APPROVAL ACTIONS
-- Individual approve/reject/comment actions per step
-- ============================================================================
CREATE TABLE crm_approval_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  approval_id uuid NOT NULL REFERENCES crm_approvals(id) ON DELETE CASCADE,
  step_index int NOT NULL,
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('approve', 'reject', 'request_changes', 'comment', 'delegate', 'reassign')),
  comment text,
  delegate_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_approval_actions_approval ON crm_approval_actions(approval_id);
CREATE INDEX idx_crm_approval_actions_actor ON crm_approval_actions(actor_id);
CREATE INDEX idx_crm_approval_actions_created ON crm_approval_actions(created_at DESC);

COMMENT ON TABLE crm_approval_actions IS 'Immutable audit log of approval actions';

-- ============================================================================
-- SECTION A5: UPDATED_AT TRIGGERS
-- ============================================================================
CREATE TRIGGER update_crm_message_providers_updated_at 
  BEFORE UPDATE ON crm_message_providers 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_message_templates_updated_at 
  BEFORE UPDATE ON crm_message_templates 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_message_threads_updated_at 
  BEFORE UPDATE ON crm_message_threads 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_messages_updated_at 
  BEFORE UPDATE ON crm_messages 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_contact_preferences_updated_at 
  BEFORE UPDATE ON crm_contact_preferences 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_blueprints_updated_at 
  BEFORE UPDATE ON crm_blueprints 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_approval_processes_updated_at 
  BEFORE UPDATE ON crm_approval_processes 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_approvals_updated_at 
  BEFORE UPDATE ON crm_approvals 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SECTION A5: ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE crm_message_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_message_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contact_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_approval_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_approval_actions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- MESSAGE PROVIDERS POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view message providers"
  ON crm_message_providers FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM admins and managers can manage message providers"
  ON crm_message_providers FOR ALL
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']));

-- ============================================================================
-- MESSAGE TEMPLATES POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view message templates"
  ON crm_message_templates FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM admins and managers can manage message templates"
  ON crm_message_templates FOR ALL
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']));

-- ============================================================================
-- MESSAGE THREADS POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view message threads"
  ON crm_message_threads FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM agents can create message threads"
  ON crm_message_threads FOR INSERT
  WITH CHECK (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

CREATE POLICY "CRM agents can update message threads"
  ON crm_message_threads FOR UPDATE
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

-- ============================================================================
-- MESSAGES POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view messages"
  ON crm_messages FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM agents can create messages"
  ON crm_messages FOR INSERT
  WITH CHECK (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

CREATE POLICY "CRM agents can update messages"
  ON crm_messages FOR UPDATE
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

-- ============================================================================
-- MESSAGE EVENTS POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view message events"
  ON crm_message_events FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "System can insert message events"
  ON crm_message_events FOR INSERT
  WITH CHECK (is_crm_member(org_id));

-- ============================================================================
-- CONTACT PREFERENCES POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view contact preferences"
  ON crm_contact_preferences FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM agents can manage contact preferences"
  ON crm_contact_preferences FOR ALL
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

-- ============================================================================
-- BLUEPRINTS POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view blueprints"
  ON crm_blueprints FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM admins and managers can manage blueprints"
  ON crm_blueprints FOR ALL
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']));

-- ============================================================================
-- STAGE HISTORY POLICIES (immutable audit - insert only via system)
-- ============================================================================
CREATE POLICY "CRM members can view stage history"
  ON crm_stage_history FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM agents can insert stage history"
  ON crm_stage_history FOR INSERT
  WITH CHECK (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

-- ============================================================================
-- APPROVAL PROCESSES POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view approval processes"
  ON crm_approval_processes FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM admins and managers can manage approval processes"
  ON crm_approval_processes FOR ALL
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']));

-- ============================================================================
-- APPROVALS POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view approvals"
  ON crm_approvals FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM agents can create approvals"
  ON crm_approvals FOR INSERT
  WITH CHECK (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

CREATE POLICY "CRM agents can update approvals"
  ON crm_approvals FOR UPDATE
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

-- ============================================================================
-- APPROVAL ACTIONS POLICIES (immutable audit)
-- ============================================================================
CREATE POLICY "CRM members can view approval actions"
  ON crm_approval_actions FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM agents can insert approval actions"
  ON crm_approval_actions FOR INSERT
  WITH CHECK (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get pending approval count for a user
CREATE OR REPLACE FUNCTION get_pending_approvals_count(p_user_id uuid)
RETURNS int AS $$
DECLARE
  v_profile_id uuid;
  v_crm_role text;
  v_count int;
BEGIN
  -- Get profile info
  SELECT id, crm_role INTO v_profile_id, v_crm_role
  FROM profiles 
  WHERE user_id = p_user_id 
  LIMIT 1;
  
  IF v_profile_id IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Count pending approvals where user is an approver
  SELECT COUNT(*) INTO v_count
  FROM crm_approvals a
  JOIN crm_approval_processes p ON a.process_id = p.id
  WHERE a.status = 'pending'
    AND (
      -- User is explicitly in the current step
      (p.steps->a.current_step->>'type' = 'user' AND p.steps->a.current_step->>'value' = v_profile_id::text)
      OR
      -- User's role matches the current step
      (p.steps->a.current_step->>'type' = 'role' AND p.steps->a.current_step->>'value' = v_crm_role)
    );
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION get_pending_approvals_count(uuid) TO authenticated;

-- Check if a record has a pending approval
CREATE OR REPLACE FUNCTION has_pending_approval(p_record_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM crm_approvals 
    WHERE record_id = p_record_id 
    AND status = 'pending'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION has_pending_approval(uuid) TO authenticated;

-- Get blueprint for a module
CREATE OR REPLACE FUNCTION get_module_blueprint(p_module_id uuid)
RETURNS crm_blueprints AS $$
  SELECT * FROM crm_blueprints 
  WHERE module_id = p_module_id 
    AND is_enabled = true
    AND is_default = true
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION get_module_blueprint(uuid) TO authenticated;

-- ============================================================================
-- THREAD MANAGEMENT TRIGGERS
-- ============================================================================

-- Update thread message count and last_message_at on message insert
CREATE OR REPLACE FUNCTION update_thread_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.thread_id IS NOT NULL THEN
    UPDATE crm_message_threads
    SET 
      message_count = message_count + 1,
      last_message_at = NEW.created_at
    WHERE id = NEW.thread_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_thread_stats_on_message
  AFTER INSERT ON crm_messages
  FOR EACH ROW EXECUTE FUNCTION update_thread_stats();

-- ============================================================================
-- EXTEND AUTOMATION RUNS SOURCE ENUM
-- ============================================================================
ALTER TABLE crm_automation_runs 
  DROP CONSTRAINT IF EXISTS crm_automation_runs_source_check;

ALTER TABLE crm_automation_runs
  ADD CONSTRAINT crm_automation_runs_source_check
  CHECK (source IN ('workflow', 'assignment', 'scoring', 'cadence', 'sla', 'webform', 'blueprint', 'approval', 'comms'));

-- ============================================================================
-- EXTEND AUDIT LOG ACTION ENUM
-- ============================================================================
ALTER TABLE crm_audit_log 
  DROP CONSTRAINT IF EXISTS crm_audit_log_action_check;

ALTER TABLE crm_audit_log
  ADD CONSTRAINT crm_audit_log_action_check
  CHECK (action IN ('create', 'update', 'delete', 'import', 'export', 'bulk_update', 'stage_change', 'approval_request', 'approval_action', 'message_sent'));

-- ============================================================================
-- COMPLETE
-- ============================================================================
SELECT 'CRM Communications, Blueprints & Approvals migration complete!' as status;

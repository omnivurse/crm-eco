-- ============================================================================
-- W4: Approvals - Multi-step Approval Processes + Inbox + Rules Engine
-- Implements rule-based approval triggering, enhanced inbox, and audit trail
-- ============================================================================

-- ============================================================================
-- SECTION 1: APPROVAL RULES
-- Configurable rules that determine when approvals are required
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_approval_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES crm_modules(id) ON DELETE CASCADE,
  process_id uuid NOT NULL REFERENCES crm_approval_processes(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  -- Trigger type determines what action triggers approval check
  trigger_type text NOT NULL CHECK (trigger_type IN (
    'field_change',      -- Triggered when specific field changes
    'stage_transition',  -- Triggered on stage change
    'record_delete',     -- Triggered on record deletion
    'record_create',     -- Triggered on record creation
    'field_threshold'    -- Triggered when field exceeds threshold
  )),
  -- Trigger configuration (field name, stage from/to, etc.)
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Conditions that must be met for rule to apply (rule DSL)
  -- Format: {logic: 'AND'|'OR', conditions: [{field, operator, value}]}
  conditions jsonb NOT NULL DEFAULT '{"logic": "AND", "conditions": []}'::jsonb,
  -- Execution order (lower runs first)
  priority int DEFAULT 100,
  is_enabled boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_approval_rules_org ON crm_approval_rules(org_id);
CREATE INDEX idx_crm_approval_rules_module ON crm_approval_rules(module_id);
CREATE INDEX idx_crm_approval_rules_process ON crm_approval_rules(process_id);
CREATE INDEX idx_crm_approval_rules_enabled ON crm_approval_rules(org_id, module_id, is_enabled);
CREATE INDEX idx_crm_approval_rules_trigger ON crm_approval_rules(trigger_type);
CREATE INDEX idx_crm_approval_rules_priority ON crm_approval_rules(priority);

COMMENT ON TABLE crm_approval_rules IS 'Rules that determine when approval processes are triggered';
COMMENT ON COLUMN crm_approval_rules.trigger_type IS 'What action triggers the approval check';
COMMENT ON COLUMN crm_approval_rules.trigger_config IS 'Trigger-specific config: {field?, stage_from?, stage_to?, threshold?}';
COMMENT ON COLUMN crm_approval_rules.conditions IS 'Rule DSL: {logic: AND|OR, conditions: [{field, operator, value}]}';

-- ============================================================================
-- SECTION 2: EXTEND CRM_APPROVALS
-- Add fields for action payload storage and idempotent execution
-- ============================================================================

-- Add action_payload to store the blocked action data
ALTER TABLE crm_approvals 
  ADD COLUMN IF NOT EXISTS action_payload jsonb DEFAULT NULL;

-- Add applied_at to track when approved action was executed
ALTER TABLE crm_approvals 
  ADD COLUMN IF NOT EXISTS applied_at timestamptz DEFAULT NULL;

-- Add idempotency_key to prevent duplicate execution
ALTER TABLE crm_approvals 
  ADD COLUMN IF NOT EXISTS idempotency_key text DEFAULT NULL;

-- Add rule_id to track which rule triggered the approval
ALTER TABLE crm_approvals 
  ADD COLUMN IF NOT EXISTS rule_id uuid REFERENCES crm_approval_rules(id) ON DELETE SET NULL;

-- Add entity_snapshot to store record state at request time
ALTER TABLE crm_approvals 
  ADD COLUMN IF NOT EXISTS entity_snapshot jsonb DEFAULT NULL;

-- Create unique index on idempotency_key to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_approvals_idempotency 
  ON crm_approvals(idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- Index for finding applied/unapplied approvals
CREATE INDEX IF NOT EXISTS idx_crm_approvals_applied 
  ON crm_approvals(status, applied_at) 
  WHERE status = 'approved';

COMMENT ON COLUMN crm_approvals.action_payload IS 'JSONB storing blocked action data: {type, record_id, module_id, data?, stage_from?, stage_to?}';
COMMENT ON COLUMN crm_approvals.applied_at IS 'When the approved action was executed';
COMMENT ON COLUMN crm_approvals.idempotency_key IS 'Unique key to prevent duplicate action execution';
COMMENT ON COLUMN crm_approvals.entity_snapshot IS 'Record data snapshot at time of approval request';

-- ============================================================================
-- SECTION 3: APPROVAL DECISIONS (Extended audit)
-- Detailed decision tracking beyond crm_approval_actions
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_approval_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  approval_id uuid NOT NULL REFERENCES crm_approvals(id) ON DELETE CASCADE,
  step_index int NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approve', 'reject', 'request_changes', 'delegate', 'escalate')),
  decided_by uuid NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  comment text,
  -- Additional context
  delegated_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  decision_context jsonb DEFAULT '{}'::jsonb,
  -- Timing
  decided_at timestamptz DEFAULT now(),
  time_to_decision_seconds int,  -- Seconds from step assignment to decision
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_approval_decisions_org ON crm_approval_decisions(org_id);
CREATE INDEX idx_crm_approval_decisions_approval ON crm_approval_decisions(approval_id);
CREATE INDEX idx_crm_approval_decisions_decided_by ON crm_approval_decisions(decided_by);
CREATE INDEX idx_crm_approval_decisions_decision ON crm_approval_decisions(decision);
CREATE INDEX idx_crm_approval_decisions_created ON crm_approval_decisions(created_at DESC);

COMMENT ON TABLE crm_approval_decisions IS 'Detailed audit trail of all approval decisions';
COMMENT ON COLUMN crm_approval_decisions.time_to_decision_seconds IS 'Time taken to make decision from step assignment';

-- ============================================================================
-- SECTION 4: UPDATED_AT TRIGGERS
-- ============================================================================
CREATE TRIGGER update_crm_approval_rules_updated_at 
  BEFORE UPDATE ON crm_approval_rules 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SECTION 5: ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS
ALTER TABLE crm_approval_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_approval_decisions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- APPROVAL RULES POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view approval rules"
  ON crm_approval_rules FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM admins and managers can manage approval rules"
  ON crm_approval_rules FOR ALL
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']));

-- ============================================================================
-- APPROVAL DECISIONS POLICIES (append-only audit)
-- ============================================================================
CREATE POLICY "CRM members can view approval decisions"
  ON crm_approval_decisions FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM agents can insert approval decisions"
  ON crm_approval_decisions FOR INSERT
  WITH CHECK (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

-- No UPDATE or DELETE policies - decisions are immutable

-- ============================================================================
-- SECTION 6: HELPER FUNCTIONS
-- ============================================================================

-- Get approval rules for a module and trigger type
CREATE OR REPLACE FUNCTION get_approval_rules_for_module(
  p_module_id uuid,
  p_trigger_type text DEFAULT NULL
)
RETURNS SETOF crm_approval_rules AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM crm_approval_rules
  WHERE module_id = p_module_id
    AND is_enabled = true
    AND (p_trigger_type IS NULL OR trigger_type = p_trigger_type)
  ORDER BY priority ASC, created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION get_approval_rules_for_module(uuid, text) TO authenticated;

-- Check if any approval rule matches for a given trigger
CREATE OR REPLACE FUNCTION check_approval_required(
  p_org_id uuid,
  p_module_id uuid,
  p_trigger_type text,
  p_record_data jsonb,
  p_trigger_context jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  rule_id uuid,
  process_id uuid,
  rule_name text
) AS $$
DECLARE
  v_rule RECORD;
  v_conditions jsonb;
  v_condition RECORD;
  v_logic text;
  v_matches boolean;
  v_field_value jsonb;
BEGIN
  FOR v_rule IN
    SELECT * FROM crm_approval_rules
    WHERE org_id = p_org_id
      AND module_id = p_module_id
      AND trigger_type = p_trigger_type
      AND is_enabled = true
    ORDER BY priority ASC
  LOOP
    v_conditions := v_rule.conditions;
    v_logic := COALESCE(v_conditions->>'logic', 'AND');
    
    -- If no conditions, rule matches
    IF v_conditions->'conditions' IS NULL OR jsonb_array_length(v_conditions->'conditions') = 0 THEN
      rule_id := v_rule.id;
      process_id := v_rule.process_id;
      rule_name := v_rule.name;
      RETURN NEXT;
      CONTINUE;
    END IF;
    
    -- Evaluate conditions
    IF v_logic = 'AND' THEN
      v_matches := true;
      FOR v_condition IN SELECT * FROM jsonb_array_elements(v_conditions->'conditions')
      LOOP
        v_field_value := p_record_data->(v_condition.value->>'field');
        
        -- Evaluate operator
        CASE v_condition.value->>'operator'
          WHEN 'eq' THEN
            v_matches := v_matches AND (v_field_value = v_condition.value->'value');
          WHEN 'neq' THEN
            v_matches := v_matches AND (v_field_value != v_condition.value->'value');
          WHEN 'gt' THEN
            v_matches := v_matches AND ((v_field_value)::numeric > (v_condition.value->'value')::numeric);
          WHEN 'gte' THEN
            v_matches := v_matches AND ((v_field_value)::numeric >= (v_condition.value->'value')::numeric);
          WHEN 'lt' THEN
            v_matches := v_matches AND ((v_field_value)::numeric < (v_condition.value->'value')::numeric);
          WHEN 'lte' THEN
            v_matches := v_matches AND ((v_field_value)::numeric <= (v_condition.value->'value')::numeric);
          WHEN 'contains' THEN
            v_matches := v_matches AND (v_field_value::text ILIKE '%' || (v_condition.value->>'value') || '%');
          WHEN 'in' THEN
            v_matches := v_matches AND (v_field_value <@ v_condition.value->'value');
          ELSE
            v_matches := false;
        END CASE;
        
        IF NOT v_matches THEN
          EXIT;
        END IF;
      END LOOP;
    ELSE -- OR logic
      v_matches := false;
      FOR v_condition IN SELECT * FROM jsonb_array_elements(v_conditions->'conditions')
      LOOP
        v_field_value := p_record_data->(v_condition.value->>'field');
        
        CASE v_condition.value->>'operator'
          WHEN 'eq' THEN
            v_matches := v_matches OR (v_field_value = v_condition.value->'value');
          WHEN 'neq' THEN
            v_matches := v_matches OR (v_field_value != v_condition.value->'value');
          WHEN 'gt' THEN
            v_matches := v_matches OR ((v_field_value)::numeric > (v_condition.value->'value')::numeric);
          WHEN 'gte' THEN
            v_matches := v_matches OR ((v_field_value)::numeric >= (v_condition.value->'value')::numeric);
          WHEN 'lt' THEN
            v_matches := v_matches OR ((v_field_value)::numeric < (v_condition.value->'value')::numeric);
          WHEN 'lte' THEN
            v_matches := v_matches OR ((v_field_value)::numeric <= (v_condition.value->'value')::numeric);
          WHEN 'contains' THEN
            v_matches := v_matches OR (v_field_value::text ILIKE '%' || (v_condition.value->>'value') || '%');
          WHEN 'in' THEN
            v_matches := v_matches OR (v_field_value <@ v_condition.value->'value');
          ELSE
            NULL;
        END CASE;
        
        IF v_matches THEN
          EXIT;
        END IF;
      END LOOP;
    END IF;
    
    IF v_matches THEN
      rule_id := v_rule.id;
      process_id := v_rule.process_id;
      rule_name := v_rule.name;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION check_approval_required(uuid, uuid, text, jsonb, jsonb) TO authenticated;

-- Get approval requests for inbox with filters
CREATE OR REPLACE FUNCTION get_approval_inbox(
  p_org_id uuid,
  p_profile_id uuid,
  p_user_role text,
  p_status text DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_assigned_to_me boolean DEFAULT false,
  p_requested_by_me boolean DEFAULT false,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  process_id uuid,
  process_name text,
  record_id uuid,
  record_title text,
  module_key text,
  module_name text,
  status text,
  current_step int,
  total_steps int,
  context jsonb,
  requested_by uuid,
  requested_by_name text,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.process_id,
    p.name as process_name,
    a.record_id,
    r.title as record_title,
    m.key as module_key,
    m.name as module_name,
    a.status,
    a.current_step,
    jsonb_array_length(p.steps) as total_steps,
    a.context,
    a.requested_by,
    pr.full_name as requested_by_name,
    a.created_at,
    a.updated_at
  FROM crm_approvals a
  JOIN crm_approval_processes p ON a.process_id = p.id
  JOIN crm_records r ON a.record_id = r.id
  JOIN crm_modules m ON r.module_id = m.id
  LEFT JOIN profiles pr ON a.requested_by = pr.id
  WHERE a.org_id = p_org_id
    AND (p_status IS NULL OR a.status = p_status)
    AND (p_entity_type IS NULL OR m.key = p_entity_type)
    AND (
      NOT p_requested_by_me 
      OR a.requested_by = p_profile_id
    )
    AND (
      NOT p_assigned_to_me 
      OR (
        a.status = 'pending'
        AND (
          -- User is explicitly in the current step
          (p.steps->a.current_step->>'type' = 'user' AND p.steps->a.current_step->>'value' = p_profile_id::text)
          OR
          -- User's role matches the current step
          (p.steps->a.current_step->>'type' = 'role' AND p.steps->a.current_step->>'value' = p_user_role)
          OR
          -- Record owner step and user is owner
          (p.steps->a.current_step->>'type' = 'record_owner' AND r.owner_id = p_profile_id)
        )
      )
    )
  ORDER BY 
    CASE WHEN a.status = 'pending' THEN 0 ELSE 1 END,
    a.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION get_approval_inbox(uuid, uuid, text, text, text, boolean, boolean, int, int) TO authenticated;

-- Get approval with full details for detail page
CREATE OR REPLACE FUNCTION get_approval_detail(p_approval_id uuid)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  process_id uuid,
  process_name text,
  process_description text,
  process_steps jsonb,
  record_id uuid,
  record_title text,
  record_data jsonb,
  module_id uuid,
  module_key text,
  module_name text,
  status text,
  current_step int,
  context jsonb,
  action_payload jsonb,
  entity_snapshot jsonb,
  requested_by uuid,
  requested_by_name text,
  resolved_by uuid,
  resolved_by_name text,
  resolved_at timestamptz,
  applied_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.org_id,
    a.process_id,
    p.name as process_name,
    p.description as process_description,
    p.steps as process_steps,
    a.record_id,
    r.title as record_title,
    r.data as record_data,
    m.id as module_id,
    m.key as module_key,
    m.name as module_name,
    a.status,
    a.current_step,
    a.context,
    a.action_payload,
    a.entity_snapshot,
    a.requested_by,
    pr.full_name as requested_by_name,
    a.resolved_by,
    pres.full_name as resolved_by_name,
    a.resolved_at,
    a.applied_at,
    a.expires_at,
    a.created_at,
    a.updated_at
  FROM crm_approvals a
  JOIN crm_approval_processes p ON a.process_id = p.id
  JOIN crm_records r ON a.record_id = r.id
  JOIN crm_modules m ON r.module_id = m.id
  LEFT JOIN profiles pr ON a.requested_by = pr.id
  LEFT JOIN profiles pres ON a.resolved_by = pres.id
  WHERE a.id = p_approval_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION get_approval_detail(uuid) TO authenticated;

-- ============================================================================
-- SECTION 7: EXTEND AUDIT LOG ACTION ENUM
-- ============================================================================
ALTER TABLE crm_audit_log 
  DROP CONSTRAINT IF EXISTS crm_audit_log_action_check;

ALTER TABLE crm_audit_log
  ADD CONSTRAINT crm_audit_log_action_check
  CHECK (action IN (
    'create', 'update', 'delete', 'import', 'export', 'bulk_update', 
    'stage_change', 'approval_request', 'approval_action', 'approval_apply',
    'message_sent', 'rule_triggered'
  ));

-- ============================================================================
-- COMPLETE
-- ============================================================================
SELECT 'W4 Approvals migration complete!' as status;

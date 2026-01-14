-- ============================================================================
-- W3: Blueprints + Validation Rules (Stage Gating)
-- Implements configurable validation rules and blueprint enforcement
-- ============================================================================

-- ============================================================================
-- SECTION 1: VALIDATION RULES
-- Configurable field-level and cross-field validation rules
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_validation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES crm_modules(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  -- Rule type determines validation logic
  rule_type text NOT NULL CHECK (rule_type IN (
    'required_if',  -- Field required when condition met
    'format',       -- Regex/email/url/phone format validation
    'range',        -- Min/max for numbers/dates
    'comparison',   -- Compare to another field
    'unique',       -- Must be unique within module
    'custom'        -- Custom expression/function
  )),
  -- Target field being validated
  target_field text NOT NULL,
  -- When this rule applies (conditions like stage, field values)
  conditions jsonb NOT NULL DEFAULT '{"logic": "AND", "conditions": []}'::jsonb,
  -- Rule-specific configuration
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Custom error message shown when validation fails
  error_message text NOT NULL DEFAULT 'Validation failed',
  -- When to run this validation
  applies_on text[] NOT NULL DEFAULT ARRAY['create', 'update', 'stage_change'],
  -- Stage-specific: only run when transitioning to/from specific stages
  stage_triggers jsonb DEFAULT NULL,
  -- Execution order (lower runs first)
  priority int DEFAULT 100,
  is_enabled boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_validation_rules_org ON crm_validation_rules(org_id);
CREATE INDEX idx_crm_validation_rules_module ON crm_validation_rules(module_id);
CREATE INDEX idx_crm_validation_rules_enabled ON crm_validation_rules(org_id, module_id, is_enabled);
CREATE INDEX idx_crm_validation_rules_type ON crm_validation_rules(rule_type);
CREATE INDEX idx_crm_validation_rules_target ON crm_validation_rules(module_id, target_field);

COMMENT ON TABLE crm_validation_rules IS 'Configurable field-level and cross-field validation rules';
COMMENT ON COLUMN crm_validation_rules.rule_type IS 'Type: required_if, format, range, comparison, unique, custom';
COMMENT ON COLUMN crm_validation_rules.target_field IS 'Field key being validated';
COMMENT ON COLUMN crm_validation_rules.conditions IS 'JSONB conditions determining when rule applies';
COMMENT ON COLUMN crm_validation_rules.config IS 'Rule-specific config: pattern, min, max, compare_field, etc.';
COMMENT ON COLUMN crm_validation_rules.applies_on IS 'Triggers: create, update, stage_change';
COMMENT ON COLUMN crm_validation_rules.stage_triggers IS 'Optional: {from_stages: [], to_stages: []} for stage-specific rules';

-- ============================================================================
-- SECTION 2: VALIDATION RULE RUNS
-- Audit log of validation executions
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_validation_rule_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES crm_validation_rules(id) ON DELETE SET NULL,
  record_id uuid REFERENCES crm_records(id) ON DELETE CASCADE,
  -- What triggered this validation
  trigger text NOT NULL CHECK (trigger IN ('create', 'update', 'stage_change', 'manual')),
  -- Result of validation
  result text NOT NULL CHECK (result IN ('pass', 'fail', 'skip')),
  -- Field value at time of validation
  field_value jsonb,
  -- Error details if failed
  errors jsonb DEFAULT '[]'::jsonb,
  -- Context: stage transition info, etc.
  context jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_validation_rule_runs_org ON crm_validation_rule_runs(org_id);
CREATE INDEX idx_crm_validation_rule_runs_rule ON crm_validation_rule_runs(rule_id);
CREATE INDEX idx_crm_validation_rule_runs_record ON crm_validation_rule_runs(record_id);
CREATE INDEX idx_crm_validation_rule_runs_result ON crm_validation_rule_runs(result);
CREATE INDEX idx_crm_validation_rule_runs_created ON crm_validation_rule_runs(created_at DESC);
CREATE INDEX idx_crm_validation_rule_runs_trigger ON crm_validation_rule_runs(trigger, result);

COMMENT ON TABLE crm_validation_rule_runs IS 'Audit log of validation rule executions';
COMMENT ON COLUMN crm_validation_rule_runs.trigger IS 'What triggered validation: create, update, stage_change, manual';
COMMENT ON COLUMN crm_validation_rule_runs.result IS 'Outcome: pass, fail, skip';
COMMENT ON COLUMN crm_validation_rule_runs.errors IS 'Array of error messages if failed';

-- ============================================================================
-- SECTION 3: UPDATED_AT TRIGGERS
-- ============================================================================
CREATE TRIGGER update_crm_validation_rules_updated_at 
  BEFORE UPDATE ON crm_validation_rules 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SECTION 4: ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS
ALTER TABLE crm_validation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_validation_rule_runs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VALIDATION RULES POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view validation rules"
  ON crm_validation_rules FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM admins and managers can manage validation rules"
  ON crm_validation_rules FOR ALL
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']));

-- ============================================================================
-- VALIDATION RULE RUNS POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view validation rule runs"
  ON crm_validation_rule_runs FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM agents can insert validation rule runs"
  ON crm_validation_rule_runs FOR INSERT
  WITH CHECK (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

-- ============================================================================
-- SECTION 5: HELPER FUNCTIONS
-- ============================================================================

-- Get validation rules for a module and trigger type
CREATE OR REPLACE FUNCTION get_validation_rules_for_module(
  p_module_id uuid,
  p_trigger text DEFAULT NULL
)
RETURNS SETOF crm_validation_rules AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM crm_validation_rules
  WHERE module_id = p_module_id
    AND is_enabled = true
    AND (p_trigger IS NULL OR p_trigger = ANY(applies_on))
  ORDER BY priority ASC, created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION get_validation_rules_for_module(uuid, text) TO authenticated;

-- Get validation rules for stage transitions
CREATE OR REPLACE FUNCTION get_stage_validation_rules(
  p_module_id uuid,
  p_from_stage text,
  p_to_stage text
)
RETURNS SETOF crm_validation_rules AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM crm_validation_rules
  WHERE module_id = p_module_id
    AND is_enabled = true
    AND 'stage_change' = ANY(applies_on)
    AND (
      -- No stage triggers = applies to all stage changes
      stage_triggers IS NULL
      OR
      -- From stage matches (or empty from_stages = any)
      (
        (stage_triggers->>'from_stages' IS NULL OR stage_triggers->'from_stages' = '[]'::jsonb OR 
         p_from_stage = ANY(SELECT jsonb_array_elements_text(stage_triggers->'from_stages')))
        AND
        (stage_triggers->>'to_stages' IS NULL OR stage_triggers->'to_stages' = '[]'::jsonb OR 
         p_to_stage = ANY(SELECT jsonb_array_elements_text(stage_triggers->'to_stages')))
      )
    )
  ORDER BY priority ASC, created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION get_stage_validation_rules(uuid, text, text) TO authenticated;

-- Log validation rule run
CREATE OR REPLACE FUNCTION log_validation_run(
  p_org_id uuid,
  p_rule_id uuid,
  p_record_id uuid,
  p_trigger text,
  p_result text,
  p_field_value jsonb DEFAULT NULL,
  p_errors jsonb DEFAULT '[]'::jsonb,
  p_context jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  v_run_id uuid;
BEGIN
  INSERT INTO crm_validation_rule_runs (
    org_id, rule_id, record_id, trigger, result, field_value, errors, context
  ) VALUES (
    p_org_id, p_rule_id, p_record_id, p_trigger, p_result, p_field_value, p_errors, p_context
  )
  RETURNING id INTO v_run_id;
  
  RETURN v_run_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION log_validation_run(uuid, uuid, uuid, text, text, jsonb, jsonb, jsonb) TO authenticated;

-- ============================================================================
-- SECTION 6: EXTEND BLUEPRINT TRANSITIONS
-- Add pre_validations field to blueprint transitions for inline validation
-- ============================================================================

-- Note: The crm_blueprints table already stores transitions as JSONB
-- We'll extend the transition schema to include pre-check validations
-- This is handled in the application layer by reading validation_rules

-- ============================================================================
-- COMPLETE
-- ============================================================================
SELECT 'W3 Blueprints + Validation Rules migration complete!' as status;

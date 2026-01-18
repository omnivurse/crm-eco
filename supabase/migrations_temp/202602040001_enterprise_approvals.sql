-- ============================================================================
-- PHASE W18: ENTERPRISE APPROVALS + DISCOUNT GUARDS
-- Approval gates for discounts, refunds, and deal closures
-- ============================================================================

-- ============================================================================
-- APPROVAL GUARD RULES
-- Specific configurations for automatic approval triggers
-- ============================================================================

CREATE TABLE IF NOT EXISTS approval_guard_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Rule info
  name text NOT NULL,
  description text,
  
  -- Guard type
  guard_type text NOT NULL,
  -- Types: discount_threshold, refund_required, stage_gate, amount_threshold, field_change
  
  -- Trigger conditions
  entity_type text NOT NULL, -- deal, quote, invoice, record
  trigger_conditions jsonb NOT NULL,
  -- { field: 'discount_percent', operator: 'greater_than', value: 20 }
  
  -- Approval requirements
  approval_type text DEFAULT 'single', -- single, sequential, parallel
  approvers jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{ type: 'role', value: 'manager' }, { type: 'user', value: 'uuid' }]
  
  -- Options
  auto_approve_below_threshold boolean DEFAULT false,
  threshold_amount numeric,
  
  -- Status
  is_active boolean DEFAULT true,
  priority int DEFAULT 0,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_approval_guard_rules_org ON approval_guard_rules(org_id);
CREATE INDEX idx_approval_guard_rules_type ON approval_guard_rules(guard_type);
CREATE INDEX idx_approval_guard_rules_entity ON approval_guard_rules(entity_type);

-- ============================================================================
-- PENDING APPROVAL BLOCKS
-- Records blocked pending approval
-- ============================================================================

CREATE TABLE IF NOT EXISTS approval_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Rule reference
  rule_id uuid NOT NULL REFERENCES approval_guard_rules(id) ON DELETE CASCADE,
  
  -- Entity being blocked
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  
  -- Block details
  blocked_action text NOT NULL, -- update, stage_change, close, create
  blocked_data jsonb NOT NULL, -- The attempted change
  
  -- Approval reference
  approval_id uuid REFERENCES crm_approvals(id) ON DELETE SET NULL,
  
  -- Status
  status text DEFAULT 'pending', -- pending, approved, rejected, expired
  
  -- Resolution
  resolved_by uuid REFERENCES profiles(id),
  resolved_at timestamptz,
  resolution_notes text,
  
  -- Timestamps
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_approval_blocks_org ON approval_blocks(org_id);
CREATE INDEX idx_approval_blocks_entity ON approval_blocks(entity_type, entity_id);
CREATE INDEX idx_approval_blocks_status ON approval_blocks(status) WHERE status = 'pending';

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if action requires approval
CREATE OR REPLACE FUNCTION check_approval_required(
  p_org_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_data jsonb
) RETURNS TABLE (
  required boolean,
  rule_id uuid,
  rule_name text
) AS $$
DECLARE
  v_rule record;
BEGIN
  FOR v_rule IN 
    SELECT agr.id, agr.name, agr.trigger_conditions
    FROM approval_guard_rules agr
    WHERE agr.org_id = p_org_id
      AND agr.entity_type = p_entity_type
      AND agr.is_active = true
    ORDER BY agr.priority DESC
  LOOP
    -- Simple condition check (can be expanded)
    IF p_data ? (v_rule.trigger_conditions->>'field') THEN
      required := true;
      rule_id := v_rule.id;
      rule_name := v_rule.name;
      RETURN NEXT;
      RETURN;
    END IF;
  END LOOP;
  
  required := false;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS
ALTER TABLE approval_guard_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view approval guard rules for their org"
  ON approval_guard_rules FOR SELECT USING (org_id = get_user_organization_id());

CREATE POLICY "Admins can manage approval guard rules"
  ON approval_guard_rules FOR ALL USING (org_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

CREATE POLICY "Users can view approval blocks for their org"
  ON approval_blocks FOR SELECT USING (org_id = get_user_organization_id());

CREATE POLICY "System can manage approval blocks"
  ON approval_blocks FOR ALL USING (org_id = get_user_organization_id());

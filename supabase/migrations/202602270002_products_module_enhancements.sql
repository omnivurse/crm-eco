-- ============================================================================
-- PRODUCTS MODULE ENHANCEMENTS
-- Features library, eligibility rules, and permissions
-- ============================================================================

-- ============================================================================
-- PRODUCT FEATURES LIBRARY (Global features that can be assigned to products)
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_features_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  icon text,
  is_highlighted boolean DEFAULT false,
  is_system boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_product_features_library_org ON product_features_library(organization_id);
CREATE INDEX IF NOT EXISTS idx_product_features_library_category ON product_features_library(category);

-- ============================================================================
-- PRODUCT FEATURE MAPPINGS (Which features are assigned to which products)
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_feature_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  feature_id uuid NOT NULL REFERENCES product_features_library(id) ON DELETE CASCADE,
  is_included boolean DEFAULT true,
  custom_value text,
  custom_description text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(plan_id, feature_id)
);

CREATE INDEX IF NOT EXISTS idx_product_feature_mappings_plan ON product_feature_mappings(plan_id);
CREATE INDEX IF NOT EXISTS idx_product_feature_mappings_feature ON product_feature_mappings(feature_id);

-- ============================================================================
-- PRODUCT ELIGIBILITY RULES
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_eligibility_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  rule_type text NOT NULL, -- 'age', 'state', 'pre_existing', 'waiting_period', 'household', 'custom'
  rule_name text NOT NULL,
  description text,
  config jsonb NOT NULL DEFAULT '{}',
  is_blocking boolean DEFAULT true, -- If true, prevents enrollment when rule fails
  error_message text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_eligibility_rules_plan ON product_eligibility_rules(plan_id);
CREATE INDEX IF NOT EXISTS idx_product_eligibility_rules_type ON product_eligibility_rules(rule_type);

-- ============================================================================
-- PRODUCT AUDIT LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES plans(id) ON DELETE SET NULL,
  action text NOT NULL, -- 'create', 'update', 'delete', 'pricing_update', 'feature_update', 'eligibility_update', 'bulk_import'
  entity_type text NOT NULL, -- 'product', 'pricing', 'feature', 'eligibility'
  entity_id uuid,
  changes jsonb,
  user_id uuid REFERENCES auth.users(id),
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_audit_log_org ON product_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_product_audit_log_plan ON product_audit_log(plan_id);
CREATE INDEX IF NOT EXISTS idx_product_audit_log_action ON product_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_product_audit_log_created ON product_audit_log(created_at DESC);

-- ============================================================================
-- ADD PRODUCT PERMISSIONS
-- ============================================================================
INSERT INTO permissions (name, description, category)
VALUES
  ('products.read', 'View products and pricing', 'products'),
  ('products.write', 'Create and edit products', 'products'),
  ('products.admin', 'Full product management including delete and bulk operations', 'products')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE product_features_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_feature_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_eligibility_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_audit_log ENABLE ROW LEVEL SECURITY;

-- Product Features Library policies
DROP POLICY IF EXISTS "Users can view features in their organization" ON product_features_library;
CREATE POLICY "Users can view features in their organization"
  ON product_features_library FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage features" ON product_features_library;
CREATE POLICY "Admins can manage features"
  ON product_features_library FOR ALL
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

-- Product Feature Mappings policies
DROP POLICY IF EXISTS "Users can view feature mappings" ON product_feature_mappings;
CREATE POLICY "Users can view feature mappings"
  ON product_feature_mappings FOR SELECT
  USING (plan_id IN (SELECT id FROM plans WHERE organization_id = get_user_organization_id()));

DROP POLICY IF EXISTS "Admins can manage feature mappings" ON product_feature_mappings;
CREATE POLICY "Admins can manage feature mappings"
  ON product_feature_mappings FOR ALL
  USING (plan_id IN (SELECT id FROM plans WHERE organization_id = get_user_organization_id()) AND get_user_role() IN ('owner', 'admin'));

-- Product Eligibility Rules policies
DROP POLICY IF EXISTS "Users can view eligibility rules" ON product_eligibility_rules;
CREATE POLICY "Users can view eligibility rules"
  ON product_eligibility_rules FOR SELECT
  USING (plan_id IN (SELECT id FROM plans WHERE organization_id = get_user_organization_id()));

DROP POLICY IF EXISTS "Admins can manage eligibility rules" ON product_eligibility_rules;
CREATE POLICY "Admins can manage eligibility rules"
  ON product_eligibility_rules FOR ALL
  USING (plan_id IN (SELECT id FROM plans WHERE organization_id = get_user_organization_id()) AND get_user_role() IN ('owner', 'admin'));

-- Product Audit Log policies
DROP POLICY IF EXISTS "Users can view product audit logs" ON product_audit_log;
CREATE POLICY "Users can view product audit logs"
  ON product_audit_log FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "System can insert audit logs" ON product_audit_log;
CREATE POLICY "System can insert audit logs"
  ON product_audit_log FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

-- ============================================================================
-- AUDIT TRIGGER FUNCTIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION log_product_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id uuid;
  v_changes jsonb;
BEGIN
  -- Get organization_id
  IF TG_OP = 'DELETE' THEN
    v_org_id := OLD.organization_id;
  ELSE
    v_org_id := NEW.organization_id;
  END IF;

  -- Build changes object
  IF TG_OP = 'INSERT' THEN
    v_changes := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_changes := jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    );
  ELSE
    v_changes := to_jsonb(OLD);
  END IF;

  INSERT INTO product_audit_log (
    organization_id,
    plan_id,
    action,
    entity_type,
    entity_id,
    changes,
    user_id
  ) VALUES (
    v_org_id,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    lower(TG_OP),
    'product',
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    v_changes,
    auth.uid()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_pricing_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id uuid;
  v_plan_id uuid;
  v_changes jsonb;
BEGIN
  -- Get plan_id and then organization_id
  IF TG_OP = 'DELETE' THEN
    v_plan_id := OLD.plan_id;
  ELSE
    v_plan_id := NEW.plan_id;
  END IF;

  SELECT organization_id INTO v_org_id FROM plans WHERE id = v_plan_id;

  -- Build changes object
  IF TG_OP = 'INSERT' THEN
    v_changes := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_changes := jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    );
  ELSE
    v_changes := to_jsonb(OLD);
  END IF;

  INSERT INTO product_audit_log (
    organization_id,
    plan_id,
    action,
    entity_type,
    entity_id,
    changes,
    user_id
  ) VALUES (
    v_org_id,
    v_plan_id,
    'pricing_' || lower(TG_OP),
    'pricing',
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    v_changes,
    auth.uid()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_feature_mapping_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id uuid;
  v_plan_id uuid;
  v_changes jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_plan_id := OLD.plan_id;
  ELSE
    v_plan_id := NEW.plan_id;
  END IF;

  SELECT organization_id INTO v_org_id FROM plans WHERE id = v_plan_id;

  IF TG_OP = 'INSERT' THEN
    v_changes := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_changes := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSE
    v_changes := to_jsonb(OLD);
  END IF;

  INSERT INTO product_audit_log (
    organization_id, plan_id, action, entity_type, entity_id, changes, user_id
  ) VALUES (
    v_org_id, v_plan_id, 'feature_' || lower(TG_OP), 'feature',
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    v_changes, auth.uid()
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_eligibility_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id uuid;
  v_plan_id uuid;
  v_changes jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_plan_id := OLD.plan_id;
  ELSE
    v_plan_id := NEW.plan_id;
  END IF;

  SELECT organization_id INTO v_org_id FROM plans WHERE id = v_plan_id;

  IF TG_OP = 'INSERT' THEN
    v_changes := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_changes := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSE
    v_changes := to_jsonb(OLD);
  END IF;

  INSERT INTO product_audit_log (
    organization_id, plan_id, action, entity_type, entity_id, changes, user_id
  ) VALUES (
    v_org_id, v_plan_id, 'eligibility_' || lower(TG_OP), 'eligibility',
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    v_changes, auth.uid()
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CREATE AUDIT TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS plans_audit_trigger ON plans;
CREATE TRIGGER plans_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON plans
  FOR EACH ROW EXECUTE FUNCTION log_product_changes();

DROP TRIGGER IF EXISTS product_iua_audit_trigger ON product_iua;
CREATE TRIGGER product_iua_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON product_iua
  FOR EACH ROW EXECUTE FUNCTION log_pricing_changes();

DROP TRIGGER IF EXISTS product_age_brackets_audit_trigger ON product_age_brackets;
CREATE TRIGGER product_age_brackets_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON product_age_brackets
  FOR EACH ROW EXECUTE FUNCTION log_pricing_changes();

DROP TRIGGER IF EXISTS product_feature_mappings_audit_trigger ON product_feature_mappings;
CREATE TRIGGER product_feature_mappings_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON product_feature_mappings
  FOR EACH ROW EXECUTE FUNCTION log_feature_mapping_changes();

DROP TRIGGER IF EXISTS product_eligibility_rules_audit_trigger ON product_eligibility_rules;
CREATE TRIGGER product_eligibility_rules_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON product_eligibility_rules
  FOR EACH ROW EXECUTE FUNCTION log_eligibility_changes();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if member is eligible for a product
CREATE OR REPLACE FUNCTION check_product_eligibility(
  p_plan_id uuid,
  p_member_age integer,
  p_member_state text DEFAULT NULL,
  p_household_size integer DEFAULT 1
)
RETURNS TABLE (
  is_eligible boolean,
  failed_rules jsonb
) AS $$
DECLARE
  v_rule record;
  v_failed_rules jsonb := '[]'::jsonb;
  v_is_eligible boolean := true;
  v_rule_passed boolean;
BEGIN
  FOR v_rule IN
    SELECT * FROM product_eligibility_rules
    WHERE plan_id = p_plan_id AND is_active = true
    ORDER BY sort_order
  LOOP
    v_rule_passed := true;

    CASE v_rule.rule_type
      WHEN 'age' THEN
        IF p_member_age < (v_rule.config->>'min_age')::integer OR
           p_member_age > (v_rule.config->>'max_age')::integer THEN
          v_rule_passed := false;
        END IF;

      WHEN 'state' THEN
        IF p_member_state IS NOT NULL THEN
          IF v_rule.config->>'mode' = 'include' THEN
            IF NOT (v_rule.config->'states') ? p_member_state THEN
              v_rule_passed := false;
            END IF;
          ELSIF v_rule.config->>'mode' = 'exclude' THEN
            IF (v_rule.config->'states') ? p_member_state THEN
              v_rule_passed := false;
            END IF;
          END IF;
        END IF;

      WHEN 'household' THEN
        IF p_household_size > (v_rule.config->>'max_size')::integer THEN
          v_rule_passed := false;
        END IF;

      ELSE
        -- Custom rules would need application logic
        NULL;
    END CASE;

    IF NOT v_rule_passed THEN
      IF v_rule.is_blocking THEN
        v_is_eligible := false;
      END IF;
      v_failed_rules := v_failed_rules || jsonb_build_object(
        'rule_id', v_rule.id,
        'rule_name', v_rule.rule_name,
        'rule_type', v_rule.rule_type,
        'error_message', COALESCE(v_rule.error_message, 'Eligibility requirement not met'),
        'is_blocking', v_rule.is_blocking
      );
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_is_eligible, v_failed_rules;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get product features with custom values
CREATE OR REPLACE FUNCTION get_product_features(p_plan_id uuid)
RETURNS TABLE (
  feature_id uuid,
  name text,
  description text,
  category text,
  icon text,
  is_included boolean,
  custom_value text,
  custom_description text,
  is_highlighted boolean,
  sort_order integer
) AS $$
  SELECT
    f.id as feature_id,
    f.name,
    COALESCE(m.custom_description, f.description) as description,
    f.category,
    f.icon,
    COALESCE(m.is_included, true) as is_included,
    m.custom_value,
    m.custom_description,
    f.is_highlighted,
    COALESCE(m.sort_order, f.sort_order) as sort_order
  FROM product_features_library f
  JOIN product_feature_mappings m ON m.feature_id = f.id
  WHERE m.plan_id = p_plan_id
  ORDER BY COALESCE(m.sort_order, f.sort_order);
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- SEED DEFAULT FEATURE CATEGORIES
-- ============================================================================
-- Note: Organization-specific features will be created via the UI
-- This just documents the expected categories
COMMENT ON TABLE product_features_library IS
'Feature categories: general, medical, prescription, preventive, emergency, mental_health, maternity, dental, vision, wellness';

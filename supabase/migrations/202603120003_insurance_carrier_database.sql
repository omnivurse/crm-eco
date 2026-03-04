-- ============================================================================
-- MODULE: Insurance Carrier Database
-- Carrier lookup, plan catalog, and state availability for insurance search
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Table — insurance_carriers
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS insurance_carriers (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  carrier_name     text         NOT NULL,
  naic_code        text,
  website          text,
  logo_url         text,
  carrier_type     text         NOT NULL DEFAULT 'insurance'
    CHECK (carrier_type IN ('insurance', 'healthshare', 'medicaid', 'short_term')),
  phone            text,
  email            text,
  is_active        boolean      NOT NULL DEFAULT true,
  metadata         jsonb        NOT NULL DEFAULT '{}',
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT uq_carrier_org_name
    UNIQUE (organization_id, carrier_name)
);

COMMENT ON TABLE  insurance_carriers IS 'Insurance and healthshare carrier directory';
COMMENT ON COLUMN insurance_carriers.naic_code IS 'National Association of Insurance Commissioners code';
COMMENT ON COLUMN insurance_carriers.carrier_type IS 'insurance | healthshare | medicaid | short_term';

-- ----------------------------------------------------------------------------
-- 2. Table — insurance_plans
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS insurance_plans (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  carrier_id       uuid         NOT NULL REFERENCES insurance_carriers(id) ON DELETE CASCADE,
  plan_name        text         NOT NULL,
  plan_type        text         NOT NULL DEFAULT 'insurance'
    CHECK (plan_type IN ('insurance', 'healthshare', 'medicaid', 'short_term')),
  metal_level      text
    CHECK (metal_level IS NULL OR metal_level IN (
      'catastrophic', 'bronze', 'silver', 'gold', 'platinum'
    )),
  base_premium     numeric(10,2),
  tax_credit_estimate numeric(10,2) DEFAULT 0,
  deductible       numeric(10,2),
  max_out_of_pocket numeric(10,2),
  copay_primary    numeric(10,2),
  copay_specialist numeric(10,2),
  rx_coverage      boolean      DEFAULT true,
  dental_included  boolean      DEFAULT false,
  vision_included  boolean      DEFAULT false,
  hsa_eligible     boolean      DEFAULT false,
  plan_year        int,
  summary_url      text,
  is_active        boolean      NOT NULL DEFAULT true,
  metadata         jsonb        NOT NULL DEFAULT '{}',
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  insurance_plans IS 'Insurance and healthshare plan catalog with premium details';
COMMENT ON COLUMN insurance_plans.metal_level IS 'ACA metal tier (null for healthshare/medicaid)';
COMMENT ON COLUMN insurance_plans.base_premium IS 'Monthly gross premium before subsidies';
COMMENT ON COLUMN insurance_plans.tax_credit_estimate IS 'Estimated monthly APTC (Advance Premium Tax Credit)';

-- ----------------------------------------------------------------------------
-- 3. Table — carrier_state_availability
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS carrier_state_availability (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id       uuid         NOT NULL REFERENCES insurance_carriers(id) ON DELETE CASCADE,
  organization_id  uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  state            text         NOT NULL CHECK (length(state) = 2),
  rating_area      text,
  marketplace_id   text,
  effective_date   date,
  expiration_date  date,
  is_active        boolean      NOT NULL DEFAULT true,
  created_at       timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT uq_carrier_state_area
    UNIQUE (carrier_id, state, rating_area)
);

COMMENT ON TABLE  carrier_state_availability IS 'Which carriers operate in which states and rating areas';
COMMENT ON COLUMN carrier_state_availability.rating_area IS 'Geographic rating area within the state';

-- ----------------------------------------------------------------------------
-- 4. Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_carriers_org
  ON insurance_carriers (organization_id);

CREATE INDEX IF NOT EXISTS idx_carriers_type
  ON insurance_carriers (organization_id, carrier_type);

CREATE INDEX IF NOT EXISTS idx_carriers_naic
  ON insurance_carriers (naic_code) WHERE naic_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_plans_org
  ON insurance_plans (organization_id);

CREATE INDEX IF NOT EXISTS idx_plans_carrier
  ON insurance_plans (carrier_id);

CREATE INDEX IF NOT EXISTS idx_plans_metal
  ON insurance_plans (organization_id, metal_level) WHERE metal_level IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_plans_type
  ON insurance_plans (organization_id, plan_type);

CREATE INDEX IF NOT EXISTS idx_state_avail_carrier
  ON carrier_state_availability (carrier_id);

CREATE INDEX IF NOT EXISTS idx_state_avail_state
  ON carrier_state_availability (organization_id, state);

-- Full-text search on carrier + plan names
CREATE INDEX IF NOT EXISTS idx_carriers_name_trgm
  ON insurance_carriers USING gin (carrier_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_plans_name_trgm
  ON insurance_plans USING gin (plan_name gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- 5. Auto-update triggers
-- ----------------------------------------------------------------------------
CREATE TRIGGER update_insurance_carriers_updated_at
  BEFORE UPDATE ON insurance_carriers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_insurance_plans_updated_at
  BEFORE UPDATE ON insurance_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 6. Audit trigger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_insurance_carriers()
RETURNS trigger AS $$
BEGIN
  INSERT INTO unified_audit_logs (
    organization_id, app_source, actor_id,
    action, action_category, risk_level, details, changes
  ) VALUES (
    COALESCE(NEW.organization_id, OLD.organization_id),
    'crm', NULL,
    CASE TG_OP
      WHEN 'INSERT' THEN 'carrier_created'
      WHEN 'UPDATE' THEN 'carrier_updated'
      WHEN 'DELETE' THEN 'carrier_deleted'
    END,
    'carrier_management', 'low',
    jsonb_build_object(
      'carrier_name', COALESCE(NEW.carrier_name, OLD.carrier_name),
      'carrier_type', COALESCE(NEW.carrier_type, OLD.carrier_type)
    ),
    CASE TG_OP
      WHEN 'INSERT' THEN jsonb_build_object('new', row_to_json(NEW))
      WHEN 'UPDATE' THEN jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW))
      WHEN 'DELETE' THEN jsonb_build_object('old', row_to_json(OLD))
    END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_audit_insurance_carriers
  AFTER INSERT OR UPDATE OR DELETE ON insurance_carriers
  FOR EACH ROW EXECUTE FUNCTION fn_audit_insurance_carriers();

-- ----------------------------------------------------------------------------
-- 7. RLS — insurance_carriers
-- ----------------------------------------------------------------------------
ALTER TABLE insurance_carriers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "carriers_select_member" ON insurance_carriers;
CREATE POLICY "carriers_select_member" ON insurance_carriers
  FOR SELECT TO authenticated
  USING (is_crm_member(organization_id));

DROP POLICY IF EXISTS "carriers_insert_manager" ON insurance_carriers;
CREATE POLICY "carriers_insert_manager" ON insurance_carriers
  FOR INSERT TO authenticated
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "carriers_update_manager" ON insurance_carriers;
CREATE POLICY "carriers_update_manager" ON insurance_carriers
  FOR UPDATE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']))
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "carriers_delete_admin" ON insurance_carriers;
CREATE POLICY "carriers_delete_admin" ON insurance_carriers
  FOR DELETE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "carriers_service" ON insurance_carriers;
CREATE POLICY "carriers_service" ON insurance_carriers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 8. RLS — insurance_plans
-- ----------------------------------------------------------------------------
ALTER TABLE insurance_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plans_select_member" ON insurance_plans;
CREATE POLICY "plans_select_member" ON insurance_plans
  FOR SELECT TO authenticated
  USING (is_crm_member(organization_id));

DROP POLICY IF EXISTS "plans_insert_manager" ON insurance_plans;
CREATE POLICY "plans_insert_manager" ON insurance_plans
  FOR INSERT TO authenticated
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "plans_update_manager" ON insurance_plans;
CREATE POLICY "plans_update_manager" ON insurance_plans
  FOR UPDATE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']))
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "plans_delete_admin" ON insurance_plans;
CREATE POLICY "plans_delete_admin" ON insurance_plans
  FOR DELETE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "plans_service" ON insurance_plans;
CREATE POLICY "plans_service" ON insurance_plans
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 9. RLS — carrier_state_availability
-- ----------------------------------------------------------------------------
ALTER TABLE carrier_state_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "state_avail_select_member" ON carrier_state_availability;
CREATE POLICY "state_avail_select_member" ON carrier_state_availability
  FOR SELECT TO authenticated
  USING (is_crm_member(organization_id));

DROP POLICY IF EXISTS "state_avail_insert_manager" ON carrier_state_availability;
CREATE POLICY "state_avail_insert_manager" ON carrier_state_availability
  FOR INSERT TO authenticated
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "state_avail_update_manager" ON carrier_state_availability;
CREATE POLICY "state_avail_update_manager" ON carrier_state_availability
  FOR UPDATE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']))
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "state_avail_delete_admin" ON carrier_state_availability;
CREATE POLICY "state_avail_delete_admin" ON carrier_state_availability
  FOR DELETE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "state_avail_service" ON carrier_state_availability;
CREATE POLICY "state_avail_service" ON carrier_state_availability
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- END MODULE: Insurance Carrier Database
-- ============================================================================

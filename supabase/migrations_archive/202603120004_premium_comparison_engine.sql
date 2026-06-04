-- ============================================================================
-- MODULE: Premium + Tax Credit Comparison Engine
-- Net premium calculation and plan-vs-plan comparison
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Table — premium_comparisons
-- Stores saved comparisons for contacts (e.g. Sarah Whelden case)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS premium_comparisons (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  record_id        uuid         REFERENCES crm_records(id) ON DELETE SET NULL,
  comparison_name  text         NOT NULL,
  notes            text,
  created_by       uuid         REFERENCES profiles(id),
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE premium_comparisons IS 'Saved premium comparison sessions tied to contact records';

-- ----------------------------------------------------------------------------
-- 2. Table — premium_comparison_items
-- Each row is one plan option in a comparison
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS premium_comparison_items (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  comparison_id    uuid         NOT NULL REFERENCES premium_comparisons(id) ON DELETE CASCADE,
  plan_id          uuid         REFERENCES insurance_plans(id) ON DELETE SET NULL,
  label            text         NOT NULL,
  plan_type        text         NOT NULL
    CHECK (plan_type IN ('insurance', 'healthshare', 'medicaid', 'short_term')),
  full_premium     numeric(10,2) NOT NULL DEFAULT 0,
  tax_credit       numeric(10,2) NOT NULL DEFAULT 0,
  net_premium      numeric(10,2) GENERATED ALWAYS AS (full_premium - tax_credit) STORED,
  deductible       numeric(10,2),
  max_oop          numeric(10,2),
  metal_level      text,
  display_order    int          NOT NULL DEFAULT 0,
  metadata         jsonb        NOT NULL DEFAULT '{}',
  created_at       timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  premium_comparison_items IS 'Individual plan line items in a comparison';
COMMENT ON COLUMN premium_comparison_items.full_premium IS 'Gross monthly premium before subsidies';
COMMENT ON COLUMN premium_comparison_items.tax_credit IS 'Monthly APTC or subsidy amount';
COMMENT ON COLUMN premium_comparison_items.net_premium IS 'Auto-calculated: full_premium - tax_credit';

-- ----------------------------------------------------------------------------
-- 3. Function — calculate_net_premium
-- Reusable scalar function for ad-hoc calculations
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_net_premium(
  p_full_premium numeric,
  p_tax_credit   numeric
)
RETURNS TABLE (
  gross_premium numeric,
  tax_credit    numeric,
  net_premium   numeric
)
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT
    p_full_premium                                  AS gross_premium,
    p_tax_credit                                    AS tax_credit,
    GREATEST(p_full_premium - p_tax_credit, 0)      AS net_premium;
$$;

COMMENT ON FUNCTION calculate_net_premium IS 'Returns gross, credit, and net premium for display';

-- ----------------------------------------------------------------------------
-- 4. View — comparison_summary
-- Quick lookup of comparisons with plan counts and best net premium
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW comparison_summary AS
SELECT
  c.id               AS comparison_id,
  c.organization_id,
  c.record_id,
  c.comparison_name,
  c.created_by,
  c.created_at,
  COUNT(ci.id)        AS plan_count,
  MIN(ci.net_premium)  AS best_net_premium,
  MAX(ci.net_premium)  AS worst_net_premium,
  AVG(ci.net_premium)  AS avg_net_premium
FROM premium_comparisons c
LEFT JOIN premium_comparison_items ci ON ci.comparison_id = c.id
GROUP BY c.id, c.organization_id, c.record_id, c.comparison_name, c.created_by, c.created_at;

COMMENT ON VIEW comparison_summary IS 'Aggregated comparison stats with best/worst net premium';

-- ----------------------------------------------------------------------------
-- 5. Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_comparisons_org
  ON premium_comparisons (organization_id);

CREATE INDEX IF NOT EXISTS idx_comparisons_record
  ON premium_comparisons (record_id) WHERE record_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comparison_items_comp
  ON premium_comparison_items (comparison_id);

CREATE INDEX IF NOT EXISTS idx_comparison_items_plan
  ON premium_comparison_items (plan_id) WHERE plan_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 6. Auto-update trigger
-- ----------------------------------------------------------------------------
CREATE TRIGGER update_premium_comparisons_updated_at
  BEFORE UPDATE ON premium_comparisons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 7. RLS — premium_comparisons
-- ----------------------------------------------------------------------------
ALTER TABLE premium_comparisons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comparisons_select_member" ON premium_comparisons;
CREATE POLICY "comparisons_select_member" ON premium_comparisons
  FOR SELECT TO authenticated
  USING (is_crm_member(organization_id));

DROP POLICY IF EXISTS "comparisons_insert_agent" ON premium_comparisons;
CREATE POLICY "comparisons_insert_agent" ON premium_comparisons
  FOR INSERT TO authenticated
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

DROP POLICY IF EXISTS "comparisons_update_agent" ON premium_comparisons;
CREATE POLICY "comparisons_update_agent" ON premium_comparisons
  FOR UPDATE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']))
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

DROP POLICY IF EXISTS "comparisons_delete_manager" ON premium_comparisons;
CREATE POLICY "comparisons_delete_manager" ON premium_comparisons
  FOR DELETE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "comparisons_service" ON premium_comparisons;
CREATE POLICY "comparisons_service" ON premium_comparisons
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 8. RLS — premium_comparison_items
-- ----------------------------------------------------------------------------
ALTER TABLE premium_comparison_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comp_items_select_member" ON premium_comparison_items;
CREATE POLICY "comp_items_select_member" ON premium_comparison_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM premium_comparisons c
    WHERE c.id = comparison_id AND is_crm_member(c.organization_id)
  ));

DROP POLICY IF EXISTS "comp_items_insert_agent" ON premium_comparison_items;
CREATE POLICY "comp_items_insert_agent" ON premium_comparison_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM premium_comparisons c
    WHERE c.id = comparison_id
      AND has_crm_role(c.organization_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent'])
  ));

DROP POLICY IF EXISTS "comp_items_update_agent" ON premium_comparison_items;
CREATE POLICY "comp_items_update_agent" ON premium_comparison_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM premium_comparisons c
    WHERE c.id = comparison_id
      AND has_crm_role(c.organization_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent'])
  ));

DROP POLICY IF EXISTS "comp_items_delete_manager" ON premium_comparison_items;
CREATE POLICY "comp_items_delete_manager" ON premium_comparison_items
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM premium_comparisons c
    WHERE c.id = comparison_id
      AND has_crm_role(c.organization_id, ARRAY['crm_admin', 'crm_manager'])
  ));

DROP POLICY IF EXISTS "comp_items_service" ON premium_comparison_items;
CREATE POLICY "comp_items_service" ON premium_comparison_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- END MODULE: Premium + Tax Credit Comparison Engine
-- ============================================================================

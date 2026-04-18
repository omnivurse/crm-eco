-- ============================================================================
-- PHASE A + B + C: DHH Enterprise Product Catalog
-- Core plans extension, health share config, traditional insurance config
-- ============================================================================

-- ============================================================================
-- A.1  Extend existing plans table with enterprise catalog columns
-- ============================================================================
ALTER TABLE plans ADD COLUMN IF NOT EXISTS plan_code text;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS brand_name text;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS internal_name text;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS category text;  -- healthshare | traditional
ALTER TABLE plans ADD COLUMN IF NOT EXISTS metal_tier text; -- bronze | silver | gold | platinum
ALTER TABLE plans ADD COLUMN IF NOT EXISTS effective_year integer;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS public_visible boolean DEFAULT true;

-- Back-fill plan_code from existing code column where missing
UPDATE plans SET plan_code = code WHERE plan_code IS NULL AND code IS NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_plans_plan_code ON plans(plan_code);
CREATE INDEX IF NOT EXISTS idx_plans_category ON plans(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plans_effective_year ON plans(effective_year) WHERE effective_year IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plans_public_visible ON plans(public_visible) WHERE public_visible = true;

COMMENT ON COLUMN plans.plan_code IS 'Unique plan identifier (e.g. PIFH-ESS-2026)';
COMMENT ON COLUMN plans.brand_name IS 'Public-facing plan name (e.g. PIFH Essentials)';
COMMENT ON COLUMN plans.category IS 'Plan category: healthshare or traditional';
COMMENT ON COLUMN plans.metal_tier IS 'ACA metal tier for traditional plans';
COMMENT ON COLUMN plans.effective_year IS 'Plan effective year for rate versioning';

-- ============================================================================
-- B.1  Health Share Plan Configuration
-- ============================================================================
CREATE TABLE IF NOT EXISTS plan_healthshare_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  individual_share_amount numeric(12,2),
  family_share_amount numeric(12,2),
  annual_unshared_amount numeric(12,2),
  max_sharing_limit numeric(12,2),
  telehealth_included boolean DEFAULT false,
  maternity_included boolean DEFAULT false,
  rx_discount_included boolean DEFAULT false,
  preventive_included boolean DEFAULT false,
  mental_health_included boolean DEFAULT false,
  vision_included boolean DEFAULT false,
  dental_included boolean DEFAULT false,
  network_type text,           -- PPO, open, hybrid
  waiting_period_days integer DEFAULT 0,
  pre_existing_waiting_days integer DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(plan_id)
);

CREATE INDEX IF NOT EXISTS idx_plan_healthshare_config_plan ON plan_healthshare_config(plan_id);

COMMENT ON TABLE plan_healthshare_config IS 'Health share plan benefit configuration';

-- ============================================================================
-- B.2  Seed PIFH Health Share Plans
-- ============================================================================
DO $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Get the primary organization
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  IF v_org_id IS NULL THEN RETURN; END IF;

  -- PIFH Essentials
  INSERT INTO plans (organization_id, name, code, plan_code, brand_name, internal_name, category, effective_year, is_active, public_visible, description)
  VALUES (v_org_id, 'PIFH Essentials', 'PIFH-ESS-2025', 'PIFH-ESS-2025', 'PIFH Essentials', 'pifh_essentials', 'healthshare', 2025, true, true,
    'Affordable health sharing for individuals and families. Basic coverage with telehealth and preventive care.')
  ON CONFLICT (organization_id, code) DO NOTHING;

  -- PIFH Direct
  INSERT INTO plans (organization_id, name, code, plan_code, brand_name, internal_name, category, effective_year, is_active, public_visible, description)
  VALUES (v_org_id, 'PIFH Direct', 'PIFH-DIR-2025', 'PIFH-DIR-2025', 'PIFH Direct', 'pifh_direct', 'healthshare', 2025, true, true,
    'Direct primary care sharing with enhanced doctor access and lower share amounts.')
  ON CONFLICT (organization_id, code) DO NOTHING;

  -- PIFH Care Plus
  INSERT INTO plans (organization_id, name, code, plan_code, brand_name, internal_name, category, effective_year, is_active, public_visible, description)
  VALUES (v_org_id, 'PIFH Care Plus', 'PIFH-CP-2025', 'PIFH-CP-2025', 'PIFH Care Plus', 'pifh_care_plus', 'healthshare', 2025, true, true,
    'Comprehensive sharing with maternity, mental health, and expanded provider network.')
  ON CONFLICT (organization_id, code) DO NOTHING;

  -- PIFH Secure HSA
  INSERT INTO plans (organization_id, name, code, plan_code, brand_name, internal_name, category, effective_year, is_active, public_visible, description)
  VALUES (v_org_id, 'PIFH Secure HSA', 'PIFH-SHSA-2025', 'PIFH-SHSA-2025', 'PIFH Secure HSA', 'pifh_secure_hsa', 'healthshare', 2025, true, true,
    'HSA-compatible health sharing with higher annual unshared amounts and tax-advantaged savings.')
  ON CONFLICT (organization_id, code) DO NOTHING;

  -- PIFH Premium Care
  INSERT INTO plans (organization_id, name, code, plan_code, brand_name, internal_name, category, effective_year, is_active, public_visible, description)
  VALUES (v_org_id, 'PIFH Premium Care', 'PIFH-PREM-2025', 'PIFH-PREM-2025', 'PIFH Premium Care', 'pifh_premium_care', 'healthshare', 2025, true, true,
    'Premium-tier sharing with lowest unshared amounts, full maternity, and concierge support.')
  ON CONFLICT (organization_id, code) DO NOTHING;

  -- PIFH Premium HSA
  INSERT INTO plans (organization_id, name, code, plan_code, brand_name, internal_name, category, effective_year, is_active, public_visible, description)
  VALUES (v_org_id, 'PIFH Premium HSA', 'PIFH-PHSA-2025', 'PIFH-PHSA-2025', 'PIFH Premium HSA', 'pifh_premium_hsa', 'healthshare', 2025, true, true,
    'Top-tier HSA-compatible sharing with premium benefits and maximum flexibility.')
  ON CONFLICT (organization_id, code) DO NOTHING;

  -- Seed health share configs
  INSERT INTO plan_healthshare_config (plan_id, individual_share_amount, family_share_amount, annual_unshared_amount, max_sharing_limit, telehealth_included, maternity_included, rx_discount_included, preventive_included, network_type, waiting_period_days, pre_existing_waiting_days)
  SELECT p.id, 250, 500, 5000, 1000000, true, false, true, true, 'open', 30, 365
  FROM plans p WHERE p.code = 'PIFH-ESS-2025' AND NOT EXISTS (SELECT 1 FROM plan_healthshare_config WHERE plan_id = p.id);

  INSERT INTO plan_healthshare_config (plan_id, individual_share_amount, family_share_amount, annual_unshared_amount, max_sharing_limit, telehealth_included, maternity_included, rx_discount_included, preventive_included, network_type, waiting_period_days, pre_existing_waiting_days)
  SELECT p.id, 200, 400, 3500, 1000000, true, false, true, true, 'PPO', 30, 365
  FROM plans p WHERE p.code = 'PIFH-DIR-2025' AND NOT EXISTS (SELECT 1 FROM plan_healthshare_config WHERE plan_id = p.id);

  INSERT INTO plan_healthshare_config (plan_id, individual_share_amount, family_share_amount, annual_unshared_amount, max_sharing_limit, telehealth_included, maternity_included, rx_discount_included, preventive_included, mental_health_included, network_type, waiting_period_days, pre_existing_waiting_days)
  SELECT p.id, 300, 600, 2500, 1500000, true, true, true, true, true, 'PPO', 30, 180
  FROM plans p WHERE p.code = 'PIFH-CP-2025' AND NOT EXISTS (SELECT 1 FROM plan_healthshare_config WHERE plan_id = p.id);

  INSERT INTO plan_healthshare_config (plan_id, individual_share_amount, family_share_amount, annual_unshared_amount, max_sharing_limit, telehealth_included, maternity_included, rx_discount_included, preventive_included, network_type, waiting_period_days, pre_existing_waiting_days)
  SELECT p.id, 275, 550, 6350, 1000000, true, false, true, true, 'open', 30, 365
  FROM plans p WHERE p.code = 'PIFH-SHSA-2025' AND NOT EXISTS (SELECT 1 FROM plan_healthshare_config WHERE plan_id = p.id);

  INSERT INTO plan_healthshare_config (plan_id, individual_share_amount, family_share_amount, annual_unshared_amount, max_sharing_limit, telehealth_included, maternity_included, rx_discount_included, preventive_included, mental_health_included, vision_included, dental_included, network_type, waiting_period_days, pre_existing_waiting_days)
  SELECT p.id, 350, 700, 1500, 2000000, true, true, true, true, true, true, true, 'PPO', 0, 90
  FROM plans p WHERE p.code = 'PIFH-PREM-2025' AND NOT EXISTS (SELECT 1 FROM plan_healthshare_config WHERE plan_id = p.id);

  INSERT INTO plan_healthshare_config (plan_id, individual_share_amount, family_share_amount, annual_unshared_amount, max_sharing_limit, telehealth_included, maternity_included, rx_discount_included, preventive_included, mental_health_included, vision_included, dental_included, network_type, waiting_period_days, pre_existing_waiting_days)
  SELECT p.id, 375, 750, 7000, 2000000, true, true, true, true, true, true, true, 'PPO', 0, 90
  FROM plans p WHERE p.code = 'PIFH-PHSA-2025' AND NOT EXISTS (SELECT 1 FROM plan_healthshare_config WHERE plan_id = p.id);

END $$;

-- ============================================================================
-- C.1  Traditional Insurance Plan Configuration
-- ============================================================================
CREATE TABLE IF NOT EXISTS plan_traditional_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  deductible_individual numeric(12,2),
  deductible_family numeric(12,2),
  oop_max_individual numeric(12,2),
  oop_max_family numeric(12,2),
  coinsurance_percent numeric(5,2),
  primary_care_copay numeric(10,2),
  specialist_copay numeric(10,2),
  er_copay numeric(10,2),
  urgent_care_copay numeric(10,2),
  rx_generic_copay numeric(10,2),
  rx_brand_copay numeric(10,2),
  rx_specialty_copay numeric(10,2),
  rx_mail_order_discount numeric(5,2),
  telehealth_copay numeric(10,2),
  mental_health_copay numeric(10,2),
  lab_copay numeric(10,2),
  imaging_copay numeric(10,2),
  hsa_eligible boolean DEFAULT false,
  preventive_care_covered boolean DEFAULT true,
  maternity_covered boolean DEFAULT true,
  pediatric_dental_covered boolean DEFAULT true,
  pediatric_vision_covered boolean DEFAULT true,
  network_type text,           -- HMO, PPO, EPO, POS
  formulary_tier_count integer DEFAULT 4,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(plan_id)
);

CREATE INDEX IF NOT EXISTS idx_plan_traditional_config_plan ON plan_traditional_config(plan_id);

COMMENT ON TABLE plan_traditional_config IS 'ACA-style traditional insurance plan configuration';

-- ============================================================================
-- C.2  Seed PIFH Traditional Insurance Plans
-- ============================================================================
DO $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  IF v_org_id IS NULL THEN RETURN; END IF;

  -- PIFH Bronze 5000
  INSERT INTO plans (organization_id, name, code, plan_code, brand_name, internal_name, category, metal_tier, effective_year, is_active, public_visible, description)
  VALUES (v_org_id, 'PIFH Bronze 5000', 'PIFH-BRZ-5000', 'PIFH-BRZ-5000', 'PIFH Bronze 5000', 'pifh_bronze_5000', 'traditional', 'bronze', 2025, true, true,
    'High-deductible bronze plan with lower monthly premiums. HSA eligible.')
  ON CONFLICT (organization_id, code) DO NOTHING;

  -- PIFH Silver 4000
  INSERT INTO plans (organization_id, name, code, plan_code, brand_name, internal_name, category, metal_tier, effective_year, is_active, public_visible, description)
  VALUES (v_org_id, 'PIFH Silver 4000', 'PIFH-SLV-4000', 'PIFH-SLV-4000', 'PIFH Silver 4000', 'pifh_silver_4000', 'traditional', 'silver', 2025, true, true,
    'Balanced silver plan with moderate deductible and broad network coverage.')
  ON CONFLICT (organization_id, code) DO NOTHING;

  -- PIFH Gold 2000
  INSERT INTO plans (organization_id, name, code, plan_code, brand_name, internal_name, category, metal_tier, effective_year, is_active, public_visible, description)
  VALUES (v_org_id, 'PIFH Gold 2000', 'PIFH-GLD-2000', 'PIFH-GLD-2000', 'PIFH Gold 2000', 'pifh_gold_2000', 'traditional', 'gold', 2025, true, true,
    'Lower deductible gold plan with enhanced benefits and predictable copays.')
  ON CONFLICT (organization_id, code) DO NOTHING;

  -- PIFH Platinum 0
  INSERT INTO plans (organization_id, name, code, plan_code, brand_name, internal_name, category, metal_tier, effective_year, is_active, public_visible, description)
  VALUES (v_org_id, 'PIFH Platinum 0', 'PIFH-PLT-0', 'PIFH-PLT-0', 'PIFH Platinum 0', 'pifh_platinum_0', 'traditional', 'platinum', 2025, true, true,
    'Zero deductible platinum plan with comprehensive coverage and minimal out-of-pocket costs.')
  ON CONFLICT (organization_id, code) DO NOTHING;

  -- Seed traditional configs
  INSERT INTO plan_traditional_config (plan_id, deductible_individual, deductible_family, oop_max_individual, oop_max_family, coinsurance_percent, primary_care_copay, specialist_copay, er_copay, urgent_care_copay, rx_generic_copay, rx_brand_copay, rx_specialty_copay, telehealth_copay, mental_health_copay, hsa_eligible, network_type)
  SELECT p.id, 5000, 10000, 8700, 17400, 40, 40, 80, 350, 75, 15, 50, 250, 0, 40, true, 'PPO'
  FROM plans p WHERE p.code = 'PIFH-BRZ-5000' AND NOT EXISTS (SELECT 1 FROM plan_traditional_config WHERE plan_id = p.id);

  INSERT INTO plan_traditional_config (plan_id, deductible_individual, deductible_family, oop_max_individual, oop_max_family, coinsurance_percent, primary_care_copay, specialist_copay, er_copay, urgent_care_copay, rx_generic_copay, rx_brand_copay, rx_specialty_copay, telehealth_copay, mental_health_copay, hsa_eligible, network_type)
  SELECT p.id, 4000, 8000, 7900, 15800, 30, 30, 60, 300, 50, 10, 40, 200, 0, 30, false, 'PPO'
  FROM plans p WHERE p.code = 'PIFH-SLV-4000' AND NOT EXISTS (SELECT 1 FROM plan_traditional_config WHERE plan_id = p.id);

  INSERT INTO plan_traditional_config (plan_id, deductible_individual, deductible_family, oop_max_individual, oop_max_family, coinsurance_percent, primary_care_copay, specialist_copay, er_copay, urgent_care_copay, rx_generic_copay, rx_brand_copay, rx_specialty_copay, telehealth_copay, mental_health_copay, hsa_eligible, network_type)
  SELECT p.id, 2000, 4000, 6500, 13000, 20, 20, 40, 250, 35, 10, 35, 150, 0, 25, false, 'PPO'
  FROM plans p WHERE p.code = 'PIFH-GLD-2000' AND NOT EXISTS (SELECT 1 FROM plan_traditional_config WHERE plan_id = p.id);

  INSERT INTO plan_traditional_config (plan_id, deductible_individual, deductible_family, oop_max_individual, oop_max_family, coinsurance_percent, primary_care_copay, specialist_copay, er_copay, urgent_care_copay, rx_generic_copay, rx_brand_copay, rx_specialty_copay, telehealth_copay, mental_health_copay, hsa_eligible, network_type)
  SELECT p.id, 0, 0, 4000, 8000, 10, 10, 25, 150, 25, 5, 25, 100, 0, 15, false, 'EPO'
  FROM plans p WHERE p.code = 'PIFH-PLT-0' AND NOT EXISTS (SELECT 1 FROM plan_traditional_config WHERE plan_id = p.id);

END $$;

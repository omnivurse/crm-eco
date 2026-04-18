-- ============================================================================
-- PHASE F + G + K: Admin Plan Builder, CRM Sync, Benefit Tier Matrix
-- plan_versions, quote_snapshots, benefit_tiers, plan_benefit_matrix
-- ============================================================================

-- ============================================================================
-- F.1  Plan Versions — draft/active/archived lifecycle
-- ============================================================================
CREATE TABLE IF NOT EXISTS plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  version_label text NOT NULL,
  effective_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),
  changes_summary text,
  rate_snapshot jsonb,          -- optional: full rate table snapshot
  created_by uuid REFERENCES profiles(id),
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_versions_plan ON plan_versions(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_versions_status ON plan_versions(status);
CREATE INDEX IF NOT EXISTS idx_plan_versions_effective ON plan_versions(effective_date);

COMMENT ON TABLE plan_versions IS 'Plan versioning for admin plan builder — draft, active, archived lifecycle';

-- ============================================================================
-- G.1  Add quoted_plan_id to CRM opportunities (via enrollments)
-- ============================================================================
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS quoted_plan_id uuid REFERENCES plans(id);
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS benefit_tier_id uuid;  -- FK added after benefit_tiers created

CREATE INDEX IF NOT EXISTS idx_enrollments_quoted_plan ON enrollments(quoted_plan_id) WHERE quoted_plan_id IS NOT NULL;

-- ============================================================================
-- G.2  Quote Snapshots — immutable pricing records
-- ============================================================================
CREATE TABLE IF NOT EXISTS quote_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES enrollments(id) ON DELETE SET NULL,
  plan_id uuid NOT NULL REFERENCES plans(id),
  benefit_tier_id uuid,         -- FK added after benefit_tiers created
  advisor_id uuid REFERENCES advisors(id),
  contact_record_id uuid,       -- crm_records ID for the contact/lead
  recipient_name text,
  recipient_email text,
  recipient_age integer,
  recipient_state text,
  recipient_tobacco boolean DEFAULT false,
  -- Pricing snapshot (immutable)
  base_rate numeric(10,2) NOT NULL,
  tier_modifier numeric(6,4) DEFAULT 1.0000,
  tier_adjustment numeric(10,2) DEFAULT 0,
  tobacco_multiplier numeric(6,4) DEFAULT 1.0000,
  final_monthly_premium numeric(10,2) NOT NULL,
  annual_premium numeric(12,2) NOT NULL,
  -- Plan snapshot
  plan_code text,
  plan_name text,
  plan_category text,
  metal_tier text,
  benefit_tier_name text,
  effective_year integer,
  rating_area_code text,
  -- Full benefit breakdown
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Metadata
  quote_number text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'expired', 'accepted', 'declined')),
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_snapshots_org ON quote_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_quote_snapshots_plan ON quote_snapshots(plan_id);
CREATE INDEX IF NOT EXISTS idx_quote_snapshots_enrollment ON quote_snapshots(enrollment_id) WHERE enrollment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quote_snapshots_advisor ON quote_snapshots(advisor_id) WHERE advisor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quote_snapshots_contact ON quote_snapshots(contact_record_id) WHERE contact_record_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quote_snapshots_created ON quote_snapshots(created_at DESC);

COMMENT ON TABLE quote_snapshots IS 'Immutable pricing quote records — never updated, only status changed';

-- Auto-generate quote number
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.quote_number IS NULL THEN
    NEW.quote_number := 'Q-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(
      (SELECT COALESCE(COUNT(*), 0) + 1 FROM quote_snapshots
       WHERE organization_id = NEW.organization_id
         AND created_at::date = CURRENT_DATE)::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quote_number ON quote_snapshots;
CREATE TRIGGER trg_quote_number
  BEFORE INSERT ON quote_snapshots
  FOR EACH ROW EXECUTE FUNCTION generate_quote_number();

-- ============================================================================
-- K.1  Benefit Tiers — reusable tier definitions
-- ============================================================================
CREATE TABLE IF NOT EXISTS benefit_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE benefit_tiers IS 'Reusable benefit tier definitions (BASIC, PLUS, PREMIUM)';

-- Seed tiers
INSERT INTO benefit_tiers (tier_code, display_name, description, sort_order) VALUES
  ('BASIC',   'Basic',   'Standard coverage with essential benefits',                    1),
  ('PLUS',    'Plus',    'Enhanced coverage with expanded benefits and lower copays',     2),
  ('PREMIUM', 'Premium', 'Comprehensive coverage with maximum benefits and lowest costs', 3)
ON CONFLICT (tier_code) DO NOTHING;

-- ============================================================================
-- K.2  Plan ↔ Benefit Tier Matrix — modifier engine
-- ============================================================================
CREATE TABLE IF NOT EXISTS plan_benefit_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  benefit_tier_id uuid NOT NULL REFERENCES benefit_tiers(id) ON DELETE CASCADE,
  premium_modifier numeric(6,4) NOT NULL DEFAULT 1.0000,
  fixed_adjustment numeric(10,2) NOT NULL DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(plan_id, benefit_tier_id)
);

CREATE INDEX IF NOT EXISTS idx_plan_benefit_matrix_plan ON plan_benefit_matrix(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_benefit_matrix_tier ON plan_benefit_matrix(benefit_tier_id);
CREATE INDEX IF NOT EXISTS idx_plan_benefit_matrix_active ON plan_benefit_matrix(plan_id, benefit_tier_id) WHERE active = true;

COMMENT ON TABLE plan_benefit_matrix IS 'Plan × Tier pricing modifiers: final = base × modifier + adjustment';

-- ============================================================================
-- K.3  Health Share Tier Config — per-tier benefit overrides
-- ============================================================================
CREATE TABLE IF NOT EXISTS plan_healthshare_tier_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_benefit_matrix_id uuid NOT NULL REFERENCES plan_benefit_matrix(id) ON DELETE CASCADE,
  annual_unshared_amount numeric(12,2),
  max_sharing_limit numeric(12,2),
  telehealth boolean DEFAULT true,
  maternity boolean DEFAULT false,
  rx_program boolean DEFAULT true,
  urgent_care_limit numeric(10,2),
  mental_health boolean DEFAULT false,
  vision boolean DEFAULT false,
  dental boolean DEFAULT false,
  preventive boolean DEFAULT true,
  network_upgrade text,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(plan_benefit_matrix_id)
);

CREATE INDEX IF NOT EXISTS idx_hs_tier_config_matrix ON plan_healthshare_tier_config(plan_benefit_matrix_id);

COMMENT ON TABLE plan_healthshare_tier_config IS 'Per-tier health share benefit overrides';

-- ============================================================================
-- K.4  Traditional Insurance Tier Config — per-tier benefit overrides
-- ============================================================================
CREATE TABLE IF NOT EXISTS plan_traditional_tier_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_benefit_matrix_id uuid NOT NULL REFERENCES plan_benefit_matrix(id) ON DELETE CASCADE,
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
  network_upgrade text,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(plan_benefit_matrix_id)
);

CREATE INDEX IF NOT EXISTS idx_trad_tier_config_matrix ON plan_traditional_tier_config(plan_benefit_matrix_id);

COMMENT ON TABLE plan_traditional_tier_config IS 'Per-tier traditional insurance benefit overrides';

-- ============================================================================
-- K.5  Seed Benefit Tier Matrix for all PIF plans
-- ============================================================================
DO $$
DECLARE
  v_plan record;
  v_basic_id uuid;
  v_plus_id uuid;
  v_premium_id uuid;
BEGIN
  SELECT id INTO v_basic_id FROM benefit_tiers WHERE tier_code = 'BASIC';
  SELECT id INTO v_plus_id FROM benefit_tiers WHERE tier_code = 'PLUS';
  SELECT id INTO v_premium_id FROM benefit_tiers WHERE tier_code = 'PREMIUM';

  FOR v_plan IN
    SELECT id, code, category FROM plans
    WHERE code IN ('DHH-ESS-2025','DHH-DIR-2025','DHH-CP-2025','DHH-SHSA-2025','DHH-PREM-2025','DHH-PHSA-2025',
                   'DHH-BRZ-5000','DHH-SLV-4000','DHH-GLD-2000','DHH-PLT-0')
  LOOP
    -- BASIC tier: 1.0x modifier (base rate)
    INSERT INTO plan_benefit_matrix (plan_id, benefit_tier_id, premium_modifier, fixed_adjustment, active)
    VALUES (v_plan.id, v_basic_id, 1.0000, 0, true)
    ON CONFLICT (plan_id, benefit_tier_id) DO NOTHING;

    -- PLUS tier: 1.15x modifier
    INSERT INTO plan_benefit_matrix (plan_id, benefit_tier_id, premium_modifier, fixed_adjustment, active)
    VALUES (v_plan.id, v_plus_id, 1.1500, 0, true)
    ON CONFLICT (plan_id, benefit_tier_id) DO NOTHING;

    -- PREMIUM tier: 1.35x modifier
    INSERT INTO plan_benefit_matrix (plan_id, benefit_tier_id, premium_modifier, fixed_adjustment, active)
    VALUES (v_plan.id, v_premium_id, 1.3500, 0, true)
    ON CONFLICT (plan_id, benefit_tier_id) DO NOTHING;
  END LOOP;
END $$;

-- ============================================================================
-- K.6  Now add FK from enrollments and quote_snapshots to benefit_tiers
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'enrollments_benefit_tier_id_fkey' AND table_name = 'enrollments'
  ) THEN
    ALTER TABLE enrollments
      ADD CONSTRAINT enrollments_benefit_tier_id_fkey
      FOREIGN KEY (benefit_tier_id) REFERENCES benefit_tiers(id);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'quote_snapshots_benefit_tier_id_fkey' AND table_name = 'quote_snapshots'
  ) THEN
    ALTER TABLE quote_snapshots
      ADD CONSTRAINT quote_snapshots_benefit_tier_id_fkey
      FOREIGN KEY (benefit_tier_id) REFERENCES benefit_tiers(id);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_enrollments_benefit_tier ON enrollments(benefit_tier_id) WHERE benefit_tier_id IS NOT NULL;

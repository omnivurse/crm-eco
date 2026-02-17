-- ============================================================
-- E123 Rate Tables Migration
-- Adds rating_model to plans, creates plan_rate_sets,
-- plan_rate_entries, plan_fees, and seeds active_rate_set setting
-- ============================================================

-- 1. Add rating_model column to plans table
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS rating_model text DEFAULT 'tiered_household'
  CHECK (rating_model IN ('tiered_household', 'additive_person'));

COMMENT ON COLUMN plans.rating_model IS 'E123 pricing model: tiered_household or additive_person';

-- 2. plan_rate_sets: one row per plan × rate set key
CREATE TABLE IF NOT EXISTS plan_rate_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  rate_set_key text NOT NULL CHECK (rate_set_key IN ('current', 'rates_2026')),
  label text NOT NULL DEFAULT '',
  effective_date date NOT NULL,
  rating_model text NOT NULL DEFAULT 'tiered_household'
    CHECK (rating_model IN ('tiered_household', 'additive_person')),
  age_bands jsonb NOT NULL DEFAULT '[]'::jsonb,
  tobacco_config jsonb DEFAULT '{"enabled": false}'::jsonb,
  max_dependents_priced integer DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(plan_id, rate_set_key)
);

COMMENT ON TABLE plan_rate_sets IS 'E123 rate set per plan — current and rates_2026';

CREATE INDEX IF NOT EXISTS idx_plan_rate_sets_plan_id ON plan_rate_sets(plan_id);

-- 3. plan_rate_entries: individual rate values
CREATE TABLE IF NOT EXISTS plan_rate_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_set_id uuid NOT NULL REFERENCES plan_rate_sets(id) ON DELETE CASCADE,
  coverage_tier text NOT NULL CHECK (coverage_tier IN (
    'member', 'member_spouse', 'member_children', 'family',
    'subscriber', 'spouse_adder', 'dependent_adder'
  )),
  age_band_id text NOT NULL DEFAULT '_flat',
  person_type text NOT NULL DEFAULT 'primary'
    CHECK (person_type IN ('primary', 'subscriber', 'spouse_adder', 'dependent_adder')),
  rate_type text NOT NULL DEFAULT 'banded'
    CHECK (rate_type IN ('banded', 'flat')),
  amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  created_at timestamptz DEFAULT now(),
  UNIQUE(rate_set_id, coverage_tier, age_band_id, person_type)
);

COMMENT ON TABLE plan_rate_entries IS 'Individual rate values keyed by tier/band/person type';

CREATE INDEX IF NOT EXISTS idx_plan_rate_entries_rate_set ON plan_rate_entries(rate_set_id);

-- 4. plan_fees: fee lines associated with a rate set
CREATE TABLE IF NOT EXISTS plan_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_set_id uuid NOT NULL REFERENCES plan_rate_sets(id) ON DELETE CASCADE,
  label text NOT NULL,
  fee_type text NOT NULL CHECK (fee_type IN ('flat_monthly', 'flat_one_time', 'percent')),
  amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  applies_to text NOT NULL DEFAULT 'quote'
    CHECK (applies_to IN ('quote', 'enrollment', 'checkout')),
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE plan_fees IS 'Fee lines (admin, enrollment, checkout) per rate set';

CREATE INDEX IF NOT EXISTS idx_plan_fees_rate_set ON plan_fees(rate_set_id);

-- 5. Seed active_rate_set into system_settings
-- Only insert if not already present
INSERT INTO system_settings (
  organization_id,
  setting_key,
  setting_value,
  setting_type,
  category,
  subcategory,
  label,
  description,
  placeholder,
  is_required,
  allowed_values,
  is_active
)
SELECT
  o.id,
  'active_rate_set',
  NULL,
  'string',
  'rates',
  'engine',
  'Active Rate Set Override',
  'Force the rate engine to use a specific rate set. Leave empty for automatic date-based selection.',
  'Auto (date-based)',
  false,
  '["current", "rates_2026"]'::jsonb,
  true
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM system_settings ss
  WHERE ss.organization_id = o.id AND ss.setting_key = 'active_rate_set'
);

-- 6. RLS policies (match existing org-scoped pattern)
ALTER TABLE plan_rate_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_rate_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_fees ENABLE ROW LEVEL SECURITY;

-- plan_rate_sets: access via plan → organization_id
CREATE POLICY "plan_rate_sets_org_access" ON plan_rate_sets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM plans p
      JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE p.id = plan_rate_sets.plan_id
        AND pr.user_id = auth.uid()
    )
  );

-- plan_rate_entries: access via rate_set → plan → org
CREATE POLICY "plan_rate_entries_org_access" ON plan_rate_entries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM plan_rate_sets rs
      JOIN plans p ON p.id = rs.plan_id
      JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE rs.id = plan_rate_entries.rate_set_id
        AND pr.user_id = auth.uid()
    )
  );

-- plan_fees: access via rate_set → plan → org
CREATE POLICY "plan_fees_org_access" ON plan_fees
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM plan_rate_sets rs
      JOIN plans p ON p.id = rs.plan_id
      JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE rs.id = plan_fees.rate_set_id
        AND pr.user_id = auth.uid()
    )
  );

-- 7. Updated_at trigger for plan_rate_sets
CREATE OR REPLACE FUNCTION update_plan_rate_sets_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_plan_rate_sets_updated_at ON plan_rate_sets;
CREATE TRIGGER trg_plan_rate_sets_updated_at
  BEFORE UPDATE ON plan_rate_sets
  FOR EACH ROW EXECUTE FUNCTION update_plan_rate_sets_updated_at();

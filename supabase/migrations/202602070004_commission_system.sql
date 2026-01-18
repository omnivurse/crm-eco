-- ============================================================================
-- COMMISSION CALCULATION SYSTEM
-- Multi-tier commission structure with agent levels, rates, and override commissions
-- ============================================================================

-- ============================================================================
-- AGENT LEVELS (Tier structure for commissions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  description text,
  level_rank integer NOT NULL,
  min_active_members integer DEFAULT 0,
  max_active_members integer,
  min_monthly_enrollments integer DEFAULT 0,
  min_downline_agents integer DEFAULT 0,
  base_commission_multiplier numeric(5,2) DEFAULT 1.0,
  is_active boolean DEFAULT true,
  color text,
  icon text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_agent_levels_organization_id ON agent_levels(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_levels_level_rank ON agent_levels(level_rank);

-- ============================================================================
-- COMMISSION RATES (Rates per product/plan type/agent level)
-- ============================================================================
CREATE TABLE IF NOT EXISTS commission_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  benefit_type_id uuid,
  agent_level_id uuid REFERENCES agent_levels(id) ON DELETE CASCADE,
  signup_commission numeric(10,2) DEFAULT 0,
  monthly_commission numeric(10,2) DEFAULT 0,
  annual_commission numeric(10,2) DEFAULT 0,
  signup_commission_percent numeric(5,2) DEFAULT 0,
  monthly_commission_percent numeric(5,2) DEFAULT 0,
  override_commission numeric(10,2) DEFAULT 0,
  override_commission_percent numeric(5,2) DEFAULT 0,
  override_levels_deep integer DEFAULT 1,
  effective_date date DEFAULT CURRENT_DATE,
  end_date date,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_rates_organization_id ON commission_rates(organization_id);
CREATE INDEX IF NOT EXISTS idx_commission_rates_product_id ON commission_rates(product_id);
CREATE INDEX IF NOT EXISTS idx_commission_rates_agent_level_id ON commission_rates(agent_level_id);
CREATE INDEX IF NOT EXISTS idx_commission_rates_effective_date ON commission_rates(effective_date);

-- ============================================================================
-- COMMISSIONS (Calculated commission records)
-- ============================================================================
CREATE TABLE IF NOT EXISTS commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  advisor_id uuid NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES enrollments(id) ON DELETE SET NULL,
  member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  billing_id uuid,
  commission_type text NOT NULL,
  source_advisor_id uuid REFERENCES advisors(id) ON DELETE SET NULL,
  override_level integer,
  base_amount numeric(10,2) NOT NULL,
  commission_rate numeric(10,2),
  commission_rate_type text,
  commission_amount numeric(10,2) NOT NULL,
  vendor_cost numeric(10,2) DEFAULT 0,
  net_amount numeric(10,2),
  commission_period date NOT NULL,
  status text DEFAULT 'pending',
  status_reason text,
  payment_batch_id uuid,
  paid_at timestamptz,
  payment_method text,
  payment_reference text,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commissions_organization_id ON commissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_commissions_advisor_id ON commissions(advisor_id);
CREATE INDEX IF NOT EXISTS idx_commissions_enrollment_id ON commissions(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_commissions_commission_type ON commissions(commission_type);
CREATE INDEX IF NOT EXISTS idx_commissions_commission_period ON commissions(commission_period);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);
CREATE INDEX IF NOT EXISTS idx_commissions_payment_batch_id ON commissions(payment_batch_id);

-- ============================================================================
-- COMMISSION PAYMENT BATCHES (Batch payments to advisors)
-- ============================================================================
CREATE TABLE IF NOT EXISTS commission_payment_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  batch_number text NOT NULL,
  description text,
  period_start date NOT NULL,
  period_end date NOT NULL,
  payment_date date NOT NULL,
  total_commissions integer DEFAULT 0,
  total_amount numeric(12,2) DEFAULT 0,
  total_advisors integer DEFAULT 0,
  status text DEFAULT 'draft',
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  processed_by uuid REFERENCES profiles(id),
  processed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_commission_payment_batches_organization_id ON commission_payment_batches(organization_id);
CREATE INDEX IF NOT EXISTS idx_commission_payment_batches_status ON commission_payment_batches(status);
CREATE INDEX IF NOT EXISTS idx_commission_payment_batches_payment_date ON commission_payment_batches(payment_date);

-- ============================================================================
-- COMMISSION ADJUSTMENTS (Manual adjustments, bonuses, clawbacks)
-- ============================================================================
CREATE TABLE IF NOT EXISTS commission_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  advisor_id uuid NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
  adjustment_type text NOT NULL,
  amount numeric(10,2) NOT NULL,
  description text NOT NULL,
  enrollment_id uuid REFERENCES enrollments(id) ON DELETE SET NULL,
  commission_id uuid REFERENCES commissions(id) ON DELETE SET NULL,
  effective_period date NOT NULL,
  status text DEFAULT 'pending',
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  rejection_reason text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_adjustments_organization_id ON commission_adjustments(organization_id);
CREATE INDEX IF NOT EXISTS idx_commission_adjustments_advisor_id ON commission_adjustments(advisor_id);
CREATE INDEX IF NOT EXISTS idx_commission_adjustments_status ON commission_adjustments(status);
CREATE INDEX IF NOT EXISTS idx_commission_adjustments_effective_period ON commission_adjustments(effective_period);

-- ============================================================================
-- ADVISOR COMMISSION SUMMARY (Denormalized summary for quick reporting)
-- ============================================================================
CREATE TABLE IF NOT EXISTS advisor_commission_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  advisor_id uuid NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  total_enrollments integer DEFAULT 0,
  active_members integer DEFAULT 0,
  signup_commissions numeric(12,2) DEFAULT 0,
  monthly_commissions numeric(12,2) DEFAULT 0,
  override_commissions numeric(12,2) DEFAULT 0,
  bonus_commissions numeric(12,2) DEFAULT 0,
  adjustments numeric(12,2) DEFAULT 0,
  clawbacks numeric(12,2) DEFAULT 0,
  gross_commissions numeric(12,2) DEFAULT 0,
  net_commissions numeric(12,2) DEFAULT 0,
  amount_paid numeric(12,2) DEFAULT 0,
  amount_pending numeric(12,2) DEFAULT 0,
  calculated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(advisor_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_advisor_commission_summary_organization_id ON advisor_commission_summary(organization_id);
CREATE INDEX IF NOT EXISTS idx_advisor_commission_summary_advisor_id ON advisor_commission_summary(advisor_id);
CREATE INDEX IF NOT EXISTS idx_advisor_commission_summary_period_month ON advisor_commission_summary(period_month);

-- ============================================================================
-- UPDATE ADVISORS TABLE WITH COMMISSION FIELDS
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'advisors' AND column_name = 'agent_level_id') THEN
    ALTER TABLE advisors ADD COLUMN agent_level_id uuid REFERENCES agent_levels(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'advisors' AND column_name = 'commission_eligible') THEN
    ALTER TABLE advisors ADD COLUMN commission_eligible boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'advisors' AND column_name = 'commission_hold') THEN
    ALTER TABLE advisors ADD COLUMN commission_hold boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'advisors' AND column_name = 'commission_hold_reason') THEN
    ALTER TABLE advisors ADD COLUMN commission_hold_reason text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'advisors' AND column_name = 'enrollment_code') THEN
    ALTER TABLE advisors ADD COLUMN enrollment_code text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'advisors' AND column_name = 'total_lifetime_commissions') THEN
    ALTER TABLE advisors ADD COLUMN total_lifetime_commissions numeric(12,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'advisors' AND column_name = 'current_month_commissions') THEN
    ALTER TABLE advisors ADD COLUMN current_month_commissions numeric(12,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'advisors' AND column_name = 'pending_commissions') THEN
    ALTER TABLE advisors ADD COLUMN pending_commissions numeric(12,2) DEFAULT 0;
  END IF;
END $$;

-- Generate unique enrollment code if not set
CREATE OR REPLACE FUNCTION generate_advisor_enrollment_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.enrollment_code IS NULL THEN
    NEW.enrollment_code := upper(substring(md5(random()::text) from 1 for 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS advisor_enrollment_code_trigger ON advisors;
CREATE TRIGGER advisor_enrollment_code_trigger
  BEFORE INSERT ON advisors
  FOR EACH ROW EXECUTE FUNCTION generate_advisor_enrollment_code();

CREATE UNIQUE INDEX IF NOT EXISTS idx_advisors_enrollment_code
  ON advisors(enrollment_code) WHERE enrollment_code IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE agent_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_payment_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE advisor_commission_summary ENABLE ROW LEVEL SECURITY;

-- Agent Levels policies
DROP POLICY IF EXISTS "Users can view agent levels" ON agent_levels;
CREATE POLICY "Users can view agent levels"
  ON agent_levels FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage agent levels" ON agent_levels;
CREATE POLICY "Admins can manage agent levels"
  ON agent_levels FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- Commission Rates policies
DROP POLICY IF EXISTS "Users can view commission rates" ON commission_rates;
CREATE POLICY "Users can view commission rates"
  ON commission_rates FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage commission rates" ON commission_rates;
CREATE POLICY "Admins can manage commission rates"
  ON commission_rates FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- Commissions policies
DROP POLICY IF EXISTS "Admins can view all commissions" ON commissions;
CREATE POLICY "Admins can view all commissions"
  ON commissions FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

DROP POLICY IF EXISTS "Advisors can view their own commissions" ON commissions;
CREATE POLICY "Advisors can view their own commissions"
  ON commissions FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() = 'advisor'
    AND advisor_id = get_user_advisor_id()
  );

DROP POLICY IF EXISTS "Admins can manage commissions" ON commissions;
CREATE POLICY "Admins can manage commissions"
  ON commissions FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- Commission Payment Batches policies
DROP POLICY IF EXISTS "Admins can view payment batches" ON commission_payment_batches;
CREATE POLICY "Admins can view payment batches"
  ON commission_payment_batches FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "Admins can manage payment batches" ON commission_payment_batches;
CREATE POLICY "Admins can manage payment batches"
  ON commission_payment_batches FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- Commission Adjustments policies
DROP POLICY IF EXISTS "Admins can view adjustments" ON commission_adjustments;
CREATE POLICY "Admins can view adjustments"
  ON commission_adjustments FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

DROP POLICY IF EXISTS "Advisors can view their adjustments" ON commission_adjustments;
CREATE POLICY "Advisors can view their adjustments"
  ON commission_adjustments FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() = 'advisor'
    AND advisor_id = get_user_advisor_id()
  );

DROP POLICY IF EXISTS "Admins can manage adjustments" ON commission_adjustments;
CREATE POLICY "Admins can manage adjustments"
  ON commission_adjustments FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- Advisor Commission Summary policies
DROP POLICY IF EXISTS "Admins can view all summaries" ON advisor_commission_summary;
CREATE POLICY "Admins can view all summaries"
  ON advisor_commission_summary FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

DROP POLICY IF EXISTS "Advisors can view their summaries" ON advisor_commission_summary;
CREATE POLICY "Advisors can view their summaries"
  ON advisor_commission_summary FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() = 'advisor'
    AND advisor_id = get_user_advisor_id()
  );

DROP POLICY IF EXISTS "Admins can manage summaries" ON advisor_commission_summary;
CREATE POLICY "Admins can manage summaries"
  ON advisor_commission_summary FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to calculate commission for an enrollment
CREATE OR REPLACE FUNCTION calculate_enrollment_commission(
  p_enrollment_id uuid,
  p_commission_type text DEFAULT 'signup'
)
RETURNS numeric AS $$
DECLARE
  v_enrollment enrollments%ROWTYPE;
  v_advisor advisors%ROWTYPE;
  v_rate commission_rates%ROWTYPE;
  v_vendor_cost numeric;
  v_net_amount numeric;
  v_commission numeric;
BEGIN
  -- Get enrollment
  SELECT * INTO v_enrollment FROM enrollments WHERE id = p_enrollment_id;
  IF v_enrollment IS NULL THEN RETURN 0; END IF;

  -- Get advisor
  SELECT * INTO v_advisor FROM advisors WHERE id = v_enrollment.advisor_id;
  IF v_advisor IS NULL OR NOT v_advisor.commission_eligible THEN RETURN 0; END IF;

  -- Get applicable commission rate
  SELECT * INTO v_rate
  FROM commission_rates
  WHERE organization_id = v_enrollment.organization_id
    AND (product_id IS NULL OR product_id = v_enrollment.product_id)
    AND (benefit_type_id IS NULL OR benefit_type_id = v_enrollment.benefit_type_id)
    AND (agent_level_id IS NULL OR agent_level_id = v_advisor.agent_level_id)
    AND is_active = true
    AND effective_date <= CURRENT_DATE
    AND (end_date IS NULL OR end_date > CURRENT_DATE)
  ORDER BY
    CASE WHEN product_id IS NOT NULL THEN 0 ELSE 1 END,
    CASE WHEN benefit_type_id IS NOT NULL THEN 0 ELSE 1 END,
    CASE WHEN agent_level_id IS NOT NULL THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_rate IS NULL THEN RETURN 0; END IF;

  -- Get vendor cost (use function if exists, otherwise default to 0)
  v_vendor_cost := 0;

  -- Calculate net amount
  v_net_amount := COALESCE(v_enrollment.total_monthly_cost, 0) - v_vendor_cost;

  -- Calculate commission based on type
  CASE p_commission_type
    WHEN 'signup' THEN
      IF v_rate.signup_commission_percent > 0 THEN
        v_commission := v_net_amount * (v_rate.signup_commission_percent / 100);
      ELSE
        v_commission := v_rate.signup_commission;
      END IF;
    WHEN 'monthly' THEN
      IF v_rate.monthly_commission_percent > 0 THEN
        v_commission := v_net_amount * (v_rate.monthly_commission_percent / 100);
      ELSE
        v_commission := v_rate.monthly_commission;
      END IF;
    ELSE
      v_commission := 0;
  END CASE;

  RETURN COALESCE(v_commission, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get advisor's upline chain
CREATE OR REPLACE FUNCTION get_advisor_upline(p_advisor_id uuid, p_max_levels integer DEFAULT 5)
RETURNS TABLE(
  advisor_id uuid,
  level integer
) AS $$
WITH RECURSIVE upline AS (
  SELECT
    a.parent_advisor_id AS advisor_id,
    1 AS level
  FROM advisors a
  WHERE a.id = p_advisor_id AND a.parent_advisor_id IS NOT NULL

  UNION ALL

  SELECT
    a.parent_advisor_id,
    u.level + 1
  FROM advisors a
  JOIN upline u ON a.id = u.advisor_id
  WHERE a.parent_advisor_id IS NOT NULL AND u.level < p_max_levels
)
SELECT * FROM upline;
$$ LANGUAGE sql STABLE;

-- Function to get advisor's downline count
CREATE OR REPLACE FUNCTION get_advisor_downline_count(p_advisor_id uuid)
RETURNS integer AS $$
WITH RECURSIVE downline AS (
  SELECT id FROM advisors WHERE parent_advisor_id = p_advisor_id

  UNION ALL

  SELECT a.id
  FROM advisors a
  JOIN downline d ON a.parent_advisor_id = d.id
)
SELECT COUNT(*)::integer FROM downline;
$$ LANGUAGE sql STABLE;

COMMENT ON TABLE agent_levels IS 'Commission tier levels for advisors (Advisor, Leader, Director, etc.)';
COMMENT ON TABLE commission_rates IS 'Commission rate configurations per product/level';
COMMENT ON TABLE commissions IS 'Individual commission records for advisors';
COMMENT ON TABLE commission_payment_batches IS 'Batch payment processing for commissions';
COMMENT ON TABLE commission_adjustments IS 'Manual commission adjustments, bonuses, and clawbacks';
COMMENT ON TABLE advisor_commission_summary IS 'Denormalized monthly commission summaries for quick reporting';

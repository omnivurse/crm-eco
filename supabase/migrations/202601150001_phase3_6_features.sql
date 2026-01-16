-- ============================================================================
-- Phase 3-6 Features Migration
-- - Phase 3: AI Pricing for Needs
-- - Phase 5: Commission Trees & Billing
-- - Phase 6: Advanced Analytics
-- ============================================================================

-- ============================================================================
-- PHASE 3: AI PRICING TABLES
-- ============================================================================

-- Procedure pricing reference data
CREATE TABLE IF NOT EXISTS procedure_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  cpt_code text NOT NULL,
  procedure_name text NOT NULL,
  category text, -- medical, dental, vision, pharmacy, etc.
  -- Pricing tiers
  low_estimate numeric(12,2) NOT NULL DEFAULT 0,
  avg_estimate numeric(12,2) NOT NULL DEFAULT 0,
  high_estimate numeric(12,2) NOT NULL DEFAULT 0,
  -- Geographic adjustments
  state text,
  region text,
  -- Sharing guidelines
  typical_member_share_pct numeric(5,2) DEFAULT 0,
  max_eligible_amount numeric(12,2),
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_procedure_pricing_org ON procedure_pricing(organization_id);
CREATE INDEX idx_procedure_pricing_cpt ON procedure_pricing(cpt_code);
CREATE INDEX idx_procedure_pricing_category ON procedure_pricing(category);
CREATE INDEX idx_procedure_pricing_state ON procedure_pricing(state);

-- Need pricing estimates (AI-generated)
CREATE TABLE IF NOT EXISTS need_pricing_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  need_id uuid NOT NULL REFERENCES needs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Estimate details
  estimated_low numeric(12,2),
  estimated_avg numeric(12,2),
  estimated_high numeric(12,2),
  estimated_member_share numeric(12,2),
  estimated_eligible_amount numeric(12,2),
  -- AI reasoning
  pricing_method text, -- 'cpt_lookup', 'ml_estimate', 'historical_avg', 'manual'
  confidence_score numeric(5,2), -- 0-100
  reasoning jsonb, -- AI explanation
  -- Input factors
  procedure_codes text[],
  facility_type text, -- hospital, urgent_care, clinic, etc.
  in_network boolean,
  member_state text,
  -- Status
  is_approved boolean DEFAULT false,
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_need_pricing_need ON need_pricing_estimates(need_id);
CREATE INDEX idx_need_pricing_org ON need_pricing_estimates(organization_id);

-- ============================================================================
-- PHASE 5: COMMISSION TREES & BILLING
-- ============================================================================

-- Commission tiers/levels definition
CREATE TABLE IF NOT EXISTS commission_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  level int NOT NULL DEFAULT 1, -- Hierarchy level (1 = top)
  -- Commission rates
  base_rate_pct numeric(5,2) NOT NULL DEFAULT 0, -- Base commission %
  bonus_rate_pct numeric(5,2) DEFAULT 0,
  override_rate_pct numeric(5,2) DEFAULT 0, -- Override on downline
  -- Qualification thresholds
  min_personal_production numeric(12,2) DEFAULT 0,
  min_team_production numeric(12,2) DEFAULT 0,
  min_active_members int DEFAULT 0,
  -- Config
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, code)
);

CREATE INDEX idx_commission_tiers_org ON commission_tiers(organization_id);

-- Advisor commission assignments
ALTER TABLE advisors 
  ADD COLUMN IF NOT EXISTS commission_tier_id uuid REFERENCES commission_tiers(id),
  ADD COLUMN IF NOT EXISTS override_rate_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS personal_production numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS team_production numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_production numeric(12,2) DEFAULT 0;

-- Commission transactions
CREATE TABLE IF NOT EXISTS commission_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  advisor_id uuid NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
  -- Source of commission
  enrollment_id uuid REFERENCES enrollments(id),
  member_id uuid REFERENCES members(id),
  -- Transaction details
  transaction_type text NOT NULL, -- 'new_business', 'renewal', 'override', 'bonus', 'chargeback'
  period_start date NOT NULL,
  period_end date NOT NULL,
  -- Amounts
  gross_amount numeric(12,2) NOT NULL DEFAULT 0,
  rate_pct numeric(5,2) NOT NULL DEFAULT 0,
  commission_amount numeric(12,2) NOT NULL DEFAULT 0,
  -- Override chain
  source_advisor_id uuid REFERENCES advisors(id), -- For overrides, who generated
  override_level int, -- 1 = direct, 2 = second level, etc.
  -- Status
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'held', 'reversed')),
  paid_at timestamptz,
  payout_id uuid, -- Link to payout batch
  notes text,
  meta jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_commission_transactions_org ON commission_transactions(organization_id);
CREATE INDEX idx_commission_transactions_advisor ON commission_transactions(advisor_id);
CREATE INDEX idx_commission_transactions_period ON commission_transactions(period_start, period_end);
CREATE INDEX idx_commission_transactions_status ON commission_transactions(status);
CREATE INDEX idx_commission_transactions_enrollment ON commission_transactions(enrollment_id);

-- Commission payouts
CREATE TABLE IF NOT EXISTS commission_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  advisor_id uuid NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
  -- Payout period
  period_start date NOT NULL,
  period_end date NOT NULL,
  -- Amounts
  total_commissions numeric(12,2) NOT NULL DEFAULT 0,
  total_overrides numeric(12,2) DEFAULT 0,
  total_bonuses numeric(12,2) DEFAULT 0,
  total_chargebacks numeric(12,2) DEFAULT 0,
  net_payout numeric(12,2) NOT NULL DEFAULT 0,
  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'processing', 'paid', 'failed')),
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  paid_at timestamptz,
  -- Payment info
  payment_method text, -- 'ach', 'check', 'wire'
  payment_reference text,
  notes text,
  meta jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_commission_payouts_org ON commission_payouts(organization_id);
CREATE INDEX idx_commission_payouts_advisor ON commission_payouts(advisor_id);
CREATE INDEX idx_commission_payouts_status ON commission_payouts(status);
CREATE INDEX idx_commission_payouts_period ON commission_payouts(period_start, period_end);

-- ============================================================================
-- PHASE 6: ADVANCED ANALYTICS
-- ============================================================================

-- Analytics snapshots (daily rollups)
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  metric_type text NOT NULL, -- 'daily', 'weekly', 'monthly'
  -- Core metrics
  total_members int DEFAULT 0,
  active_members int DEFAULT 0,
  new_members int DEFAULT 0,
  churned_members int DEFAULT 0,
  total_leads int DEFAULT 0,
  new_leads int DEFAULT 0,
  converted_leads int DEFAULT 0,
  total_enrollments int DEFAULT 0,
  pending_enrollments int DEFAULT 0,
  approved_enrollments int DEFAULT 0,
  -- Financial metrics
  total_mrr numeric(12,2) DEFAULT 0,
  new_mrr numeric(12,2) DEFAULT 0,
  churned_mrr numeric(12,2) DEFAULT 0,
  net_mrr_change numeric(12,2) DEFAULT 0,
  -- Needs metrics
  total_needs int DEFAULT 0,
  open_needs int DEFAULT 0,
  needs_amount_submitted numeric(12,2) DEFAULT 0,
  needs_amount_approved numeric(12,2) DEFAULT 0,
  needs_amount_paid numeric(12,2) DEFAULT 0,
  -- Advisor metrics
  total_advisors int DEFAULT 0,
  active_advisors int DEFAULT 0,
  commissions_earned numeric(12,2) DEFAULT 0,
  commissions_paid numeric(12,2) DEFAULT 0,
  -- Raw data for custom analysis
  metrics_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, snapshot_date, metric_type)
);

CREATE INDEX idx_analytics_snapshots_org ON analytics_snapshots(organization_id);
CREATE INDEX idx_analytics_snapshots_date ON analytics_snapshots(snapshot_date);
CREATE INDEX idx_analytics_snapshots_type ON analytics_snapshots(metric_type);

-- Pipeline stages for funnel analysis
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  stage_order int NOT NULL,
  stage_type text NOT NULL DEFAULT 'lead' CHECK (stage_type IN ('lead', 'enrollment', 'member')),
  -- Conversion tracking
  expected_conversion_rate numeric(5,2),
  expected_days_in_stage int,
  -- UI
  color text DEFAULT '#3b82f6',
  icon text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, code)
);

CREATE INDEX idx_pipeline_stages_org ON pipeline_stages(organization_id);

-- Advisor performance scorecards
CREATE TABLE IF NOT EXISTS advisor_scorecards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  advisor_id uuid NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
  period_type text NOT NULL DEFAULT 'monthly', -- 'weekly', 'monthly', 'quarterly', 'yearly'
  period_start date NOT NULL,
  period_end date NOT NULL,
  -- Production metrics
  new_enrollments int DEFAULT 0,
  total_premium numeric(12,2) DEFAULT 0,
  personal_production numeric(12,2) DEFAULT 0,
  team_production numeric(12,2) DEFAULT 0,
  -- Pipeline metrics
  leads_generated int DEFAULT 0,
  leads_contacted int DEFAULT 0,
  leads_converted int DEFAULT 0,
  conversion_rate numeric(5,2) DEFAULT 0,
  avg_days_to_close numeric(8,2) DEFAULT 0,
  -- Retention metrics
  member_retention_rate numeric(5,2) DEFAULT 0,
  members_retained int DEFAULT 0,
  members_churned int DEFAULT 0,
  -- Activity metrics
  calls_made int DEFAULT 0,
  emails_sent int DEFAULT 0,
  tasks_completed int DEFAULT 0,
  -- Compensation
  commissions_earned numeric(12,2) DEFAULT 0,
  overrides_earned numeric(12,2) DEFAULT 0,
  bonuses_earned numeric(12,2) DEFAULT 0,
  -- Rankings
  org_rank int,
  tier_rank int,
  -- Score
  overall_score numeric(5,2) DEFAULT 0,
  score_breakdown jsonb DEFAULT '{}',
  meta jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, advisor_id, period_type, period_start)
);

CREATE INDEX idx_advisor_scorecards_org ON advisor_scorecards(organization_id);
CREATE INDEX idx_advisor_scorecards_advisor ON advisor_scorecards(advisor_id);
CREATE INDEX idx_advisor_scorecards_period ON advisor_scorecards(period_start, period_end);

-- Custom report definitions
CREATE TABLE IF NOT EXISTS custom_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES profiles(id),
  name text NOT NULL,
  description text,
  report_type text NOT NULL, -- 'dashboard', 'table', 'chart', 'export'
  -- Report configuration
  data_source text NOT NULL, -- 'members', 'leads', 'enrollments', 'needs', 'advisors', 'commissions'
  filters jsonb DEFAULT '[]',
  columns jsonb DEFAULT '[]',
  grouping jsonb,
  sorting jsonb,
  -- Visualization
  chart_type text, -- 'bar', 'line', 'pie', 'funnel', 'table'
  chart_config jsonb DEFAULT '{}',
  -- Sharing
  is_public boolean DEFAULT false,
  shared_with uuid[] DEFAULT '{}',
  -- Scheduling
  schedule_enabled boolean DEFAULT false,
  schedule_cron text,
  schedule_recipients text[],
  last_run_at timestamptz,
  meta jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_custom_reports_org ON custom_reports(organization_id);
CREATE INDEX idx_custom_reports_creator ON custom_reports(created_by);

-- ============================================================================
-- PHASE 4: ENROLLMENT LANDING PAGES
-- ============================================================================

-- Landing page configurations
CREATE TABLE IF NOT EXISTS landing_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES profiles(id),
  name text NOT NULL,
  slug text NOT NULL,
  -- Page configuration
  page_type text NOT NULL DEFAULT 'enrollment', -- 'enrollment', 'lead_capture', 'info'
  is_published boolean DEFAULT false,
  published_at timestamptz,
  -- Content
  headline text,
  subheadline text,
  hero_image_url text,
  logo_url text,
  -- Theming
  primary_color text DEFAULT '#0d9488',
  secondary_color text DEFAULT '#1e3a5f',
  background_style text DEFAULT 'gradient', -- 'gradient', 'solid', 'image'
  -- Form configuration
  form_fields jsonb DEFAULT '[]',
  required_fields text[] DEFAULT ARRAY['first_name', 'last_name', 'email', 'phone'],
  -- Plans to show
  plan_ids uuid[] DEFAULT '{}',
  default_plan_id uuid REFERENCES plans(id),
  -- Advisor assignment
  default_advisor_id uuid REFERENCES advisors(id),
  advisor_selection_enabled boolean DEFAULT false,
  -- Tracking
  utm_source text,
  utm_campaign text,
  -- Stats
  views_count int DEFAULT 0,
  submissions_count int DEFAULT 0,
  conversion_rate numeric(5,2) DEFAULT 0,
  meta jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, slug)
);

CREATE INDEX idx_landing_pages_org ON landing_pages(organization_id);
CREATE INDEX idx_landing_pages_slug ON landing_pages(slug);
CREATE INDEX idx_landing_pages_published ON landing_pages(is_published);

-- Landing page analytics events
CREATE TABLE IF NOT EXISTS landing_page_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id uuid NOT NULL REFERENCES landing_pages(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- 'view', 'start', 'step_complete', 'submit', 'abandon'
  step_name text,
  -- Visitor info
  visitor_id text, -- Anonymous tracking ID
  session_id text,
  ip_address text,
  user_agent text,
  referrer text,
  -- UTM tracking
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  -- Result
  lead_id uuid REFERENCES leads(id),
  enrollment_id uuid REFERENCES enrollments(id),
  meta jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_landing_page_events_page ON landing_page_events(landing_page_id);
CREATE INDEX idx_landing_page_events_type ON landing_page_events(event_type);
CREATE INDEX idx_landing_page_events_created ON landing_page_events(created_at);

-- ============================================================================
-- SEED DEFAULT PIPELINE STAGES
-- ============================================================================

INSERT INTO pipeline_stages (organization_id, name, code, stage_order, stage_type, expected_conversion_rate, color)
SELECT 
  o.id,
  stage.name,
  stage.code,
  stage.stage_order,
  stage.stage_type,
  stage.rate,
  stage.color
FROM organizations o
CROSS JOIN (VALUES
  ('New Lead', 'new', 1, 'lead', 100, '#6366f1'),
  ('Contacted', 'contacted', 2, 'lead', 80, '#8b5cf6'),
  ('Qualified', 'qualified', 3, 'lead', 60, '#a855f7'),
  ('Proposal', 'proposal', 4, 'lead', 40, '#d946ef'),
  ('Enrolled', 'enrolled', 5, 'enrollment', 25, '#ec4899'),
  ('Active Member', 'active', 6, 'member', 20, '#10b981')
) AS stage(name, code, stage_order, stage_type, rate, color)
ON CONFLICT (organization_id, code) DO NOTHING;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Procedure pricing
ALTER TABLE procedure_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view procedure pricing for their org"
  ON procedure_pricing FOR SELECT
  USING (organization_id = get_user_organization_id() OR organization_id IS NULL);

-- Need pricing estimates
ALTER TABLE need_pricing_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pricing estimates for their org"
  ON need_pricing_estimates FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Staff can insert pricing estimates"
  ON need_pricing_estimates FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Staff can update pricing estimates"
  ON need_pricing_estimates FOR UPDATE
  USING (organization_id = get_user_organization_id());

-- Commission tiers
ALTER TABLE commission_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view commission tiers for their org"
  ON commission_tiers FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Commission transactions
ALTER TABLE commission_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all commission transactions"
  ON commission_transactions FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND (
      get_user_role() IN ('owner', 'admin')
      OR advisor_id IN (
        SELECT a.id FROM advisors a 
        JOIN profiles p ON p.id = a.profile_id 
        WHERE p.user_id = auth.uid()
      )
    )
  );

-- Commission payouts
ALTER TABLE commission_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all payouts"
  ON commission_payouts FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND (
      get_user_role() IN ('owner', 'admin')
      OR advisor_id IN (
        SELECT a.id FROM advisors a 
        JOIN profiles p ON p.id = a.profile_id 
        WHERE p.user_id = auth.uid()
      )
    )
  );

-- Analytics snapshots
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view analytics for their org"
  ON analytics_snapshots FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Pipeline stages
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pipeline stages for their org"
  ON pipeline_stages FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Advisor scorecards
ALTER TABLE advisor_scorecards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view scorecards for their org"
  ON advisor_scorecards FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND (
      get_user_role() IN ('owner', 'admin')
      OR advisor_id IN (
        SELECT a.id FROM advisors a 
        JOIN profiles p ON p.id = a.profile_id 
        WHERE p.user_id = auth.uid()
      )
    )
  );

-- Custom reports
ALTER TABLE custom_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reports for their org"
  ON custom_reports FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND (
      is_public = true 
      OR created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      OR auth.uid() = ANY(shared_with)
    )
  );

-- Landing pages
ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view landing pages for their org"
  ON landing_pages FOR SELECT
  USING (organization_id = get_user_organization_id() OR is_published = true);

CREATE POLICY "Staff can manage landing pages"
  ON landing_pages FOR ALL
  USING (organization_id = get_user_organization_id());

-- Landing page events
ALTER TABLE landing_page_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view landing page events for their org"
  ON landing_page_events FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Anyone can insert landing page events"
  ON landing_page_events FOR INSERT
  WITH CHECK (true);

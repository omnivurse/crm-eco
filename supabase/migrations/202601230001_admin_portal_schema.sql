-- Admin Portal Schema Extensions
-- Extends existing tables and adds new tables for the Admin Portal

-- ============================================================================
-- EXTEND ADVISORS TABLE (Agent Branding & Enrollment Code)
-- ============================================================================

-- Add enrollment code (unique 6-digit code for agent referrals)
ALTER TABLE public.advisors 
  ADD COLUMN IF NOT EXISTS enrollment_code text UNIQUE;

-- Add branding fields
ALTER TABLE public.advisors
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS logo_size text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#1e40af',
  ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#3b82f6',
  ADD COLUMN IF NOT EXISTS header_bg_color text DEFAULT '#1e3a8a',
  ADD COLUMN IF NOT EXISTS header_text_color text DEFAULT '#ffffff';

-- Add address fields for agents
ALTER TABLE public.advisors
  ADD COLUMN IF NOT EXISTS street_address text,
  ADD COLUMN IF NOT EXISTS apartment text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'USA';

-- Add commission eligibility flag
ALTER TABLE public.advisors
  ADD COLUMN IF NOT EXISTS commission_eligible boolean DEFAULT true;

-- Add role field for agent types
ALTER TABLE public.advisors
  ADD COLUMN IF NOT EXISTS agent_role text DEFAULT 'Agent' 
    CHECK (agent_role IN ('Agent', 'Agency'));

-- Function to generate 6-digit enrollment code
CREATE OR REPLACE FUNCTION generate_enrollment_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code text;
  code_exists boolean;
BEGIN
  IF NEW.enrollment_code IS NULL THEN
    LOOP
      new_code := LPAD(FLOOR(RANDOM() * 900000 + 100000)::text, 6, '0');
      SELECT EXISTS(SELECT 1 FROM advisors WHERE enrollment_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    NEW.enrollment_code := new_code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate enrollment code
DROP TRIGGER IF EXISTS trg_advisors_enrollment_code ON public.advisors;
CREATE TRIGGER trg_advisors_enrollment_code
  BEFORE INSERT ON public.advisors
  FOR EACH ROW EXECUTE FUNCTION generate_enrollment_code();

-- Index for enrollment code lookups
CREATE INDEX IF NOT EXISTS idx_advisors_enrollment_code ON public.advisors(enrollment_code);

-- ============================================================================
-- EXTEND MEMBERS TABLE
-- ============================================================================

-- Add gender field
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('Male', 'Female', 'Other'));

-- Add pre-existing condition fields
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS existing_condition boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS existing_condition_description text;

-- Add communication preferences
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS receive_emails boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS additional_info text;

-- Add Authorize.Net integration fields (for future payment processing)
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS customer_profile_id text,
  ADD COLUMN IF NOT EXISTS payment_profile_id text;

-- Add smoker status
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS is_smoker boolean DEFAULT false;

-- ============================================================================
-- CREATE DEPENDENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dependents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date NOT NULL,
  gender text CHECK (gender IN ('Male', 'Female', 'Other')),
  relationship text NOT NULL CHECK (relationship IN ('Spouse', 'Child', 'Dependent')),
  
  is_smoker boolean DEFAULT false,
  existing_condition boolean DEFAULT false,
  existing_condition_description text,
  
  -- Address (optional - can differ from member)
  same_address_as_member boolean DEFAULT true,
  street_address text,
  apartment text,
  city text,
  state text,
  zip_code text,
  
  -- Contact (optional)
  phone text,
  email text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for dependents
CREATE INDEX IF NOT EXISTS idx_dependents_organization ON public.dependents(organization_id);
CREATE INDEX IF NOT EXISTS idx_dependents_member ON public.dependents(member_id);
CREATE INDEX IF NOT EXISTS idx_dependents_relationship ON public.dependents(relationship);

-- Updated_at trigger for dependents
CREATE TRIGGER update_dependents_updated_at
  BEFORE UPDATE ON public.dependents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- EXTEND PLANS TABLE (Product Features)
-- ============================================================================

-- Add provider and category
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS category text;

-- Add IUA and pricing control fields
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS default_iua numeric(12,2),
  ADD COLUMN IF NOT EXISTS require_dependent_info boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_dependent_address_match boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_from_public boolean DEFAULT false;

-- Add label for display purposes
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS label text;

-- ============================================================================
-- CREATE PRODUCT IUA LEVELS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.product_iua (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  label text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_iua_plan ON public.product_iua(plan_id);

-- ============================================================================
-- CREATE PRODUCT AGE BRACKETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.product_age_brackets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  min_age integer NOT NULL,
  max_age integer NOT NULL,
  label text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_age_brackets_plan ON public.product_age_brackets(plan_id);

-- ============================================================================
-- CREATE BENEFIT TYPES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.product_benefit_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_benefit_types_org ON public.product_benefit_types(organization_id);

-- ============================================================================
-- CREATE PRODUCT PRICING MATRIX TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.product_pricing_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  benefit_type_id uuid REFERENCES public.product_benefit_types(id) ON DELETE SET NULL,
  iua_id uuid REFERENCES public.product_iua(id) ON DELETE SET NULL,
  age_bracket_id uuid REFERENCES public.product_age_brackets(id) ON DELETE SET NULL,
  price numeric(12,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_pricing_matrix_plan ON public.product_pricing_matrix(plan_id);
CREATE INDEX IF NOT EXISTS idx_product_pricing_matrix_lookup 
  ON public.product_pricing_matrix(plan_id, benefit_type_id, iua_id, age_bracket_id);

-- Updated_at trigger for pricing matrix
CREATE TRIGGER update_product_pricing_matrix_updated_at
  BEFORE UPDATE ON public.product_pricing_matrix
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- CREATE PRODUCT BENEFITS TABLE (Feature Descriptions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.product_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  benefit_name text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_benefits_plan ON public.product_benefits(plan_id);

-- ============================================================================
-- CREATE PRODUCT EXTRA COSTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.product_extra_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric(12,2) NOT NULL,
  frequency text CHECK (frequency IN ('Monthly', 'Yearly', 'One-time')),
  condition text,
  description text,
  is_commissional boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_extra_costs_plan ON public.product_extra_costs(plan_id);

-- ============================================================================
-- ROW LEVEL SECURITY FOR NEW TABLES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.dependents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_iua ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_age_brackets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_benefit_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_pricing_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_extra_costs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DEPENDENTS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view all dependents" ON public.dependents;
CREATE POLICY "Admins can view all dependents"
  ON public.dependents FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

DROP POLICY IF EXISTS "Advisors can view their members dependents" ON public.dependents;
CREATE POLICY "Advisors can view their members dependents"
  ON public.dependents FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() = 'advisor'
    AND member_id IN (SELECT id FROM members WHERE advisor_id = get_user_advisor_id())
  );

DROP POLICY IF EXISTS "Admins can manage dependents" ON public.dependents;
CREATE POLICY "Admins can manage dependents"
  ON public.dependents FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

-- ============================================================================
-- PRODUCT IUA POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view product IUA levels" ON public.product_iua;
CREATE POLICY "Users can view product IUA levels"
  ON public.product_iua FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage product IUA levels" ON public.product_iua;
CREATE POLICY "Admins can manage product IUA levels"
  ON public.product_iua FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- ============================================================================
-- PRODUCT AGE BRACKETS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view product age brackets" ON public.product_age_brackets;
CREATE POLICY "Users can view product age brackets"
  ON public.product_age_brackets FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage product age brackets" ON public.product_age_brackets;
CREATE POLICY "Admins can manage product age brackets"
  ON public.product_age_brackets FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- ============================================================================
-- BENEFIT TYPES POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view benefit types" ON public.product_benefit_types;
CREATE POLICY "Users can view benefit types"
  ON public.product_benefit_types FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage benefit types" ON public.product_benefit_types;
CREATE POLICY "Admins can manage benefit types"
  ON public.product_benefit_types FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- ============================================================================
-- PRICING MATRIX POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view pricing matrix" ON public.product_pricing_matrix;
CREATE POLICY "Users can view pricing matrix"
  ON public.product_pricing_matrix FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage pricing matrix" ON public.product_pricing_matrix;
CREATE POLICY "Admins can manage pricing matrix"
  ON public.product_pricing_matrix FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- ============================================================================
-- PRODUCT BENEFITS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view product benefits" ON public.product_benefits;
CREATE POLICY "Users can view product benefits"
  ON public.product_benefits FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage product benefits" ON public.product_benefits;
CREATE POLICY "Admins can manage product benefits"
  ON public.product_benefits FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- ============================================================================
-- EXTRA COSTS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view product extra costs" ON public.product_extra_costs;
CREATE POLICY "Users can view product extra costs"
  ON public.product_extra_costs FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage product extra costs" ON public.product_extra_costs;
CREATE POLICY "Admins can manage product extra costs"
  ON public.product_extra_costs FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

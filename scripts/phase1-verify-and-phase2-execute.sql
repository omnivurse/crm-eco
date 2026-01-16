-- ============================================================================
-- PHASE 1 VERIFICATION + PHASE 2 EXECUTION
-- Run this entire script in Supabase SQL Editor
-- ============================================================================

-- ############################################################################
-- PHASE 1: VERIFICATION & COMPLETION
-- ############################################################################

-- ============================================================================
-- PHASE 1A: ADVISORS TABLE EXTENSIONS
-- ============================================================================

ALTER TABLE public.advisors 
  ADD COLUMN IF NOT EXISTS enrollment_code text UNIQUE;

ALTER TABLE public.advisors
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS logo_size text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#1e40af',
  ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#3b82f6',
  ADD COLUMN IF NOT EXISTS header_bg_color text DEFAULT '#1e3a8a',
  ADD COLUMN IF NOT EXISTS header_text_color text DEFAULT '#ffffff';

ALTER TABLE public.advisors
  ADD COLUMN IF NOT EXISTS street_address text,
  ADD COLUMN IF NOT EXISTS apartment text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'USA';

ALTER TABLE public.advisors
  ADD COLUMN IF NOT EXISTS commission_eligible boolean DEFAULT true;

ALTER TABLE public.advisors
  ADD COLUMN IF NOT EXISTS agent_role text DEFAULT 'Agent';

-- Enrollment code generator function
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

DROP TRIGGER IF EXISTS trg_advisors_enrollment_code ON public.advisors;
CREATE TRIGGER trg_advisors_enrollment_code
  BEFORE INSERT ON public.advisors
  FOR EACH ROW EXECUTE FUNCTION generate_enrollment_code();

CREATE INDEX IF NOT EXISTS idx_advisors_enrollment_code ON public.advisors(enrollment_code);

-- ============================================================================
-- PHASE 1B: MEMBERS TABLE EXTENSIONS
-- ============================================================================

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS gender text;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS existing_condition boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS existing_condition_description text;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS receive_emails boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS additional_info text;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS customer_profile_id text,
  ADD COLUMN IF NOT EXISTS payment_profile_id text;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS is_smoker boolean DEFAULT false;

-- ============================================================================
-- PHASE 1C: DEPENDENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dependents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date NOT NULL,
  gender text,
  relationship text NOT NULL,
  is_smoker boolean DEFAULT false,
  existing_condition boolean DEFAULT false,
  existing_condition_description text,
  same_address_as_member boolean DEFAULT true,
  street_address text,
  apartment text,
  city text,
  state text,
  zip_code text,
  phone text,
  email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dependents_organization ON public.dependents(organization_id);
CREATE INDEX IF NOT EXISTS idx_dependents_member ON public.dependents(member_id);
CREATE INDEX IF NOT EXISTS idx_dependents_relationship ON public.dependents(relationship);

-- Dependent enrollment linkage fields
ALTER TABLE public.dependents
  ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS coverage_role text,
  ADD COLUMN IF NOT EXISTS included_in_enrollment boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS external_ref text;

CREATE INDEX IF NOT EXISTS idx_dependents_included ON public.dependents(included_in_enrollment) 
  WHERE included_in_enrollment = true;

-- ============================================================================
-- PHASE 1D: PLANS TABLE EXTENSIONS
-- ============================================================================

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS category text;

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS default_iua numeric(12,2),
  ADD COLUMN IF NOT EXISTS require_dependent_info boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_dependent_address_match boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_from_public boolean DEFAULT false;

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS label text;

-- ============================================================================
-- PHASE 1E: PRODUCT PRICING TABLES
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

CREATE TABLE IF NOT EXISTS public.product_benefit_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_benefit_types_org ON public.product_benefit_types(organization_id);

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

-- Pricing matrix temporal + household columns
ALTER TABLE public.product_pricing_matrix
  ADD COLUMN IF NOT EXISTS household_tier text,
  ADD COLUMN IF NOT EXISTS effective_date date,
  ADD COLUMN IF NOT EXISTS end_date date;

CREATE INDEX IF NOT EXISTS idx_product_pricing_matrix_effective 
  ON public.product_pricing_matrix(plan_id, effective_date, end_date);
CREATE INDEX IF NOT EXISTS idx_product_pricing_matrix_household 
  ON public.product_pricing_matrix(plan_id, household_tier);

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

CREATE TABLE IF NOT EXISTS public.product_extra_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric(12,2) NOT NULL,
  frequency text,
  condition text,
  description text,
  is_commissional boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_extra_costs_plan ON public.product_extra_costs(plan_id);

-- ============================================================================
-- PHASE 1F: ENROLLMENTS WORKFLOW EXTENSIONS
-- ============================================================================

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_reason text,
  ADD COLUMN IF NOT EXISTS last_status_change_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_enrollments_submitted_at ON public.enrollments(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrollments_approved_at ON public.enrollments(approved_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrollments_approved_by ON public.enrollments(approved_by);

-- Enrollment status change trigger
CREATE OR REPLACE FUNCTION update_enrollment_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.last_status_change_at := now();
    CASE NEW.status
      WHEN 'submitted' THEN
        IF NEW.submitted_at IS NULL THEN NEW.submitted_at := now(); END IF;
      WHEN 'approved' THEN
        IF NEW.approved_at IS NULL THEN NEW.approved_at := now(); END IF;
      WHEN 'rejected' THEN
        IF NEW.rejected_at IS NULL THEN NEW.rejected_at := now(); END IF;
      WHEN 'cancelled' THEN
        IF NEW.cancelled_at IS NULL THEN NEW.cancelled_at := now(); END IF;
      ELSE NULL;
    END CASE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enrollment_status_change ON public.enrollments;
CREATE TRIGGER trg_enrollment_status_change
  BEFORE UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION update_enrollment_status_change();

-- ============================================================================
-- PHASE 1G: ADMIN ACTIVITY LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_org ON public.admin_activity_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_actor ON public.admin_activity_log(actor_profile_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_entity ON public.admin_activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_action ON public.admin_activity_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_created ON public.admin_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_feed ON public.admin_activity_log(organization_id, created_at DESC);

-- ============================================================================
-- PHASE 1H: ADMIN SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  default_primary_color text DEFAULT '#1e40af',
  default_secondary_color text DEFAULT '#3b82f6',
  default_logo_url text,
  company_name text,
  enrollment_auto_approve boolean DEFAULT false,
  require_payment_before_activation boolean DEFAULT true,
  send_welcome_emails boolean DEFAULT true,
  send_renewal_reminders boolean DEFAULT true,
  current_rate_version text DEFAULT '2026',
  rate_effective_date date,
  admin_notification_email text,
  billing_notification_email text,
  enable_self_enrollment boolean DEFAULT true,
  enable_agent_enrollment boolean DEFAULT true,
  enable_dependent_management boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_settings_org ON public.admin_settings(organization_id);

-- ============================================================================
-- PHASE 1I: ENABLE RLS ON NEW TABLES
-- ============================================================================

ALTER TABLE public.dependents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_iua ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_age_brackets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_benefit_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_pricing_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_extra_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PHASE 1 VERIFICATION QUERY
-- ============================================================================

SELECT 'PHASE 1 VERIFICATION' as phase, 
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'advisors' AND column_name = 'enrollment_code') > 0 as advisors_extended,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'gender') > 0 as members_extended,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'dependents') > 0 as dependents_table,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'product_pricing_matrix') > 0 as pricing_matrix_table,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'admin_activity_log') > 0 as activity_log_table,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'admin_settings') > 0 as settings_table,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'enrollments' AND column_name = 'submitted_at') > 0 as enrollments_workflow;

-- ############################################################################
-- PHASE 2: BILLING & PAYMENTS
-- ############################################################################

-- ============================================================================
-- PHASE 2A: PAYMENT PROFILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payment_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  authorize_customer_profile_id text NOT NULL,
  authorize_payment_profile_id text NOT NULL,
  payment_type text NOT NULL CHECK (payment_type IN ('credit_card', 'bank_account')),
  card_type text,
  last_four text NOT NULL,
  expiration_date text,
  account_type text,
  bank_name text,
  billing_first_name text,
  billing_last_name text,
  billing_address text,
  billing_city text,
  billing_state text,
  billing_zip text,
  billing_country text DEFAULT 'US',
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  nickname text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_profiles_org ON public.payment_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_profiles_member ON public.payment_profiles(member_id);
CREATE INDEX IF NOT EXISTS idx_payment_profiles_authorize_customer ON public.payment_profiles(authorize_customer_profile_id);
CREATE INDEX IF NOT EXISTS idx_payment_profiles_active ON public.payment_profiles(member_id) WHERE is_active = true;

-- ============================================================================
-- PHASE 2B: BILLING SCHEDULES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.billing_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  payment_profile_id uuid REFERENCES public.payment_profiles(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL,
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly', 'quarterly', 'annual')),
  billing_day integer NOT NULL CHECK (billing_day >= 1 AND billing_day <= 28),
  start_date date NOT NULL,
  end_date date,
  next_billing_date date NOT NULL,
  last_billed_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'completed')),
  pause_reason text,
  paused_at timestamptz,
  cancelled_at timestamptz,
  cancelled_reason text,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_schedules_org ON public.billing_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_schedules_enrollment ON public.billing_schedules(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_billing_schedules_member ON public.billing_schedules(member_id);
CREATE INDEX IF NOT EXISTS idx_billing_schedules_next_billing ON public.billing_schedules(next_billing_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_billing_schedules_status ON public.billing_schedules(status);

-- ============================================================================
-- PHASE 2C: BILLING TRANSACTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.billing_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  billing_schedule_id uuid REFERENCES public.billing_schedules(id) ON DELETE SET NULL,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES public.enrollments(id) ON DELETE SET NULL,
  payment_profile_id uuid REFERENCES public.payment_profiles(id) ON DELETE SET NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('charge', 'refund', 'void', 'adjustment')),
  amount numeric(12,2) NOT NULL,
  processing_fee numeric(12,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed', 'voided', 'refunded')),
  authorize_transaction_id text,
  authorize_response_code text,
  authorize_response_reason text,
  authorize_auth_code text,
  avs_response text,
  cvv_response text,
  error_code text,
  error_message text,
  submitted_at timestamptz,
  processed_at timestamptz,
  settled_at timestamptz,
  billing_period_start date,
  billing_period_end date,
  description text,
  invoice_number text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_transactions_org ON public.billing_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_schedule ON public.billing_transactions(billing_schedule_id);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_member ON public.billing_transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_enrollment ON public.billing_transactions(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_status ON public.billing_transactions(status);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_authorize ON public.billing_transactions(authorize_transaction_id);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_created ON public.billing_transactions(created_at DESC);

-- ============================================================================
-- PHASE 2D: BILLING FAILURES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.billing_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  billing_schedule_id uuid NOT NULL REFERENCES public.billing_schedules(id) ON DELETE CASCADE,
  billing_transaction_id uuid NOT NULL REFERENCES public.billing_transactions(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  failure_reason text NOT NULL,
  failure_code text,
  amount numeric(12,2) NOT NULL,
  retry_attempt integer NOT NULL DEFAULT 1,
  next_retry_date date,
  retry_scheduled boolean DEFAULT true,
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolution_notes text,
  resolution_type text,
  member_notified boolean DEFAULT false,
  member_notified_at timestamptz,
  notification_count integer DEFAULT 0,
  last_notification_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_failures_org ON public.billing_failures(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_failures_schedule ON public.billing_failures(billing_schedule_id);
CREATE INDEX IF NOT EXISTS idx_billing_failures_member ON public.billing_failures(member_id);
CREATE INDEX IF NOT EXISTS idx_billing_failures_unresolved ON public.billing_failures(organization_id) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_billing_failures_retry ON public.billing_failures(next_retry_date) WHERE retry_scheduled = true AND resolved = false;

-- ============================================================================
-- PHASE 2E: INVOICES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES public.enrollments(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  due_date date NOT NULL,
  subtotal numeric(12,2) NOT NULL,
  processing_fee numeric(12,2) DEFAULT 0,
  adjustments numeric(12,2) DEFAULT 0,
  total numeric(12,2) NOT NULL,
  amount_paid numeric(12,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled', 'void')),
  line_items jsonb DEFAULT '[]',
  sent_at timestamptz,
  paid_at timestamptz,
  pdf_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(organization_id, invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON public.invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_member ON public.invoices(member_id);
CREATE INDEX IF NOT EXISTS idx_invoices_enrollment ON public.invoices(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date) WHERE status NOT IN ('paid', 'cancelled', 'void');

-- Invoice number generator
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  year_prefix text;
  next_number integer;
BEGIN
  IF NEW.invoice_number IS NULL THEN
    year_prefix := TO_CHAR(NOW(), 'YYYY');
    SELECT COALESCE(MAX(
      NULLIF(REGEXP_REPLACE(invoice_number, '^INV-' || year_prefix || '-', ''), '')::integer
    ), 0) + 1
    INTO next_number
    FROM invoices
    WHERE organization_id = NEW.organization_id
      AND invoice_number LIKE 'INV-' || year_prefix || '-%';
    NEW.invoice_number := 'INV-' || year_prefix || '-' || LPAD(next_number::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoices_number ON public.invoices;
CREATE TRIGGER trg_invoices_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION generate_invoice_number();

-- ============================================================================
-- PHASE 2F: ENABLE RLS ON BILLING TABLES
-- ============================================================================

ALTER TABLE public.payment_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PHASE 2G: RLS POLICIES FOR BILLING TABLES
-- ============================================================================

-- Payment Profiles
DROP POLICY IF EXISTS "Admins can view payment profiles" ON public.payment_profiles;
CREATE POLICY "Admins can view payment profiles"
  ON public.payment_profiles FOR SELECT
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin', 'staff'));

DROP POLICY IF EXISTS "Admins can manage payment profiles" ON public.payment_profiles;
CREATE POLICY "Admins can manage payment profiles"
  ON public.payment_profiles FOR ALL
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin', 'staff'));

DROP POLICY IF EXISTS "Super admins payment profiles" ON public.payment_profiles;
CREATE POLICY "Super admins payment profiles"
  ON public.payment_profiles FOR ALL
  USING (is_super_admin() = true);

-- Billing Schedules
DROP POLICY IF EXISTS "Admins can view billing schedules" ON public.billing_schedules;
CREATE POLICY "Admins can view billing schedules"
  ON public.billing_schedules FOR SELECT
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin', 'staff'));

DROP POLICY IF EXISTS "Admins can manage billing schedules" ON public.billing_schedules;
CREATE POLICY "Admins can manage billing schedules"
  ON public.billing_schedules FOR ALL
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

DROP POLICY IF EXISTS "Super admins billing schedules" ON public.billing_schedules;
CREATE POLICY "Super admins billing schedules"
  ON public.billing_schedules FOR ALL
  USING (is_super_admin() = true);

-- Billing Transactions
DROP POLICY IF EXISTS "Admins can view billing transactions" ON public.billing_transactions;
CREATE POLICY "Admins can view billing transactions"
  ON public.billing_transactions FOR SELECT
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin', 'staff'));

DROP POLICY IF EXISTS "System can insert billing transactions" ON public.billing_transactions;
CREATE POLICY "System can insert billing transactions"
  ON public.billing_transactions FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can update billing transactions" ON public.billing_transactions;
CREATE POLICY "Admins can update billing transactions"
  ON public.billing_transactions FOR UPDATE
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

DROP POLICY IF EXISTS "Super admins billing transactions" ON public.billing_transactions;
CREATE POLICY "Super admins billing transactions"
  ON public.billing_transactions FOR ALL
  USING (is_super_admin() = true);

-- Billing Failures
DROP POLICY IF EXISTS "Admins can view billing failures" ON public.billing_failures;
CREATE POLICY "Admins can view billing failures"
  ON public.billing_failures FOR SELECT
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin', 'staff'));

DROP POLICY IF EXISTS "Admins can manage billing failures" ON public.billing_failures;
CREATE POLICY "Admins can manage billing failures"
  ON public.billing_failures FOR ALL
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

DROP POLICY IF EXISTS "Super admins billing failures" ON public.billing_failures;
CREATE POLICY "Super admins billing failures"
  ON public.billing_failures FOR ALL
  USING (is_super_admin() = true);

-- Invoices
DROP POLICY IF EXISTS "Admins can view invoices" ON public.invoices;
CREATE POLICY "Admins can view invoices"
  ON public.invoices FOR SELECT
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin', 'staff'));

DROP POLICY IF EXISTS "Admins can manage invoices" ON public.invoices;
CREATE POLICY "Admins can manage invoices"
  ON public.invoices FOR ALL
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

DROP POLICY IF EXISTS "Super admins invoices" ON public.invoices;
CREATE POLICY "Super admins invoices"
  ON public.invoices FOR ALL
  USING (is_super_admin() = true);

-- ============================================================================
-- PHASE 2H: HELPER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_next_billing_date(
  p_current_date date,
  p_frequency text,
  p_billing_day integer
)
RETURNS date AS $$
DECLARE
  next_date date;
  target_day integer;
BEGIN
  target_day := LEAST(p_billing_day, 28);
  CASE p_frequency
    WHEN 'monthly' THEN
      next_date := DATE_TRUNC('month', p_current_date) + INTERVAL '1 month' + (target_day - 1) * INTERVAL '1 day';
      IF next_date <= p_current_date THEN
        next_date := DATE_TRUNC('month', p_current_date) + INTERVAL '2 months' + (target_day - 1) * INTERVAL '1 day';
      END IF;
    WHEN 'quarterly' THEN
      next_date := DATE_TRUNC('month', p_current_date) + INTERVAL '3 months' + (target_day - 1) * INTERVAL '1 day';
    WHEN 'annual' THEN
      next_date := DATE_TRUNC('year', p_current_date) + INTERVAL '1 year' + (target_day - 1) * INTERVAL '1 day';
    ELSE
      next_date := p_current_date + INTERVAL '1 month';
  END CASE;
  RETURN next_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- PHASE 2 VERIFICATION QUERY
-- ============================================================================

SELECT 'PHASE 2 VERIFICATION' as phase, 
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'payment_profiles') > 0 as payment_profiles,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'billing_schedules') > 0 as billing_schedules,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'billing_transactions') > 0 as billing_transactions,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'billing_failures') > 0 as billing_failures,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'invoices') > 0 as invoices;

-- ============================================================================
-- FINAL STATUS
-- ============================================================================

SELECT 'MIGRATION COMPLETE' as status,
  'Phase 1: Admin Portal Schema + Phase 2: Billing & Payments' as completed,
  now() as executed_at;

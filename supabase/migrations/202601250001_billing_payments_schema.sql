-- Phase 2: Billing & Payments Schema
-- Provides the database foundation for Authorize.Net integration,
-- payment profiles, billing schedules, and transaction tracking.

-- ============================================================================
-- PAYMENT PROFILES TABLE
-- Stores tokenized payment methods from Authorize.Net (never store actual card/bank data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payment_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  
  -- Authorize.Net references (tokenized - never store actual card/bank numbers)
  authorize_customer_profile_id text NOT NULL,
  authorize_payment_profile_id text NOT NULL,
  
  -- Payment method type
  payment_type text NOT NULL CHECK (payment_type IN ('credit_card', 'bank_account')),
  
  -- Masked display info (safe to store)
  card_type text, -- 'Visa', 'Mastercard', 'Amex', 'Discover'
  last_four text NOT NULL, -- Last 4 digits of card/account
  expiration_date text, -- MM/YY for cards (null for bank accounts)
  account_type text, -- 'checking', 'savings' for bank accounts
  bank_name text, -- For bank accounts
  
  -- Billing address
  billing_first_name text,
  billing_last_name text,
  billing_address text,
  billing_city text,
  billing_state text,
  billing_zip text,
  billing_country text DEFAULT 'US',
  
  -- Status
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  
  -- Metadata
  nickname text, -- User-friendly name like "Personal Visa" or "Business Checking"
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payment_profiles_org ON public.payment_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_profiles_member ON public.payment_profiles(member_id);
CREATE INDEX IF NOT EXISTS idx_payment_profiles_authorize_customer ON public.payment_profiles(authorize_customer_profile_id);
CREATE INDEX IF NOT EXISTS idx_payment_profiles_active ON public.payment_profiles(member_id) WHERE is_active = true;

-- Ensure only one default per member
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_profiles_default 
  ON public.payment_profiles(member_id) WHERE is_default = true AND is_active = true;

-- Updated_at trigger
CREATE TRIGGER update_payment_profiles_updated_at
  BEFORE UPDATE ON public.payment_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- BILLING SCHEDULES TABLE
-- Defines recurring billing for enrollments
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.billing_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  payment_profile_id uuid REFERENCES public.payment_profiles(id) ON DELETE SET NULL,
  
  -- Billing configuration
  amount numeric(12,2) NOT NULL,
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly', 'quarterly', 'annual')),
  billing_day integer NOT NULL CHECK (billing_day >= 1 AND billing_day <= 28),
  
  -- Schedule dates
  start_date date NOT NULL,
  end_date date, -- null = ongoing
  next_billing_date date NOT NULL,
  last_billed_date date,
  
  -- Status
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'completed')),
  pause_reason text,
  paused_at timestamptz,
  cancelled_at timestamptz,
  cancelled_reason text,
  
  -- Retry configuration
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  
  -- Metadata
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_billing_schedules_org ON public.billing_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_schedules_enrollment ON public.billing_schedules(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_billing_schedules_member ON public.billing_schedules(member_id);
CREATE INDEX IF NOT EXISTS idx_billing_schedules_next_billing ON public.billing_schedules(next_billing_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_billing_schedules_status ON public.billing_schedules(status);

-- Updated_at trigger
CREATE TRIGGER update_billing_schedules_updated_at
  BEFORE UPDATE ON public.billing_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- BILLING TRANSACTIONS TABLE
-- Records all payment attempts and results
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.billing_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  billing_schedule_id uuid REFERENCES public.billing_schedules(id) ON DELETE SET NULL,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES public.enrollments(id) ON DELETE SET NULL,
  payment_profile_id uuid REFERENCES public.payment_profiles(id) ON DELETE SET NULL,
  
  -- Transaction details
  transaction_type text NOT NULL CHECK (transaction_type IN ('charge', 'refund', 'void', 'adjustment')),
  amount numeric(12,2) NOT NULL,
  processing_fee numeric(12,2) DEFAULT 0,
  net_amount numeric(12,2) GENERATED ALWAYS AS (amount - processing_fee) STORED,
  
  -- Status
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed', 'voided', 'refunded')),
  
  -- Authorize.Net response data
  authorize_transaction_id text,
  authorize_response_code text,
  authorize_response_reason text,
  authorize_auth_code text,
  avs_response text,
  cvv_response text,
  
  -- Error handling
  error_code text,
  error_message text,
  
  -- Timing
  submitted_at timestamptz,
  processed_at timestamptz,
  settled_at timestamptz,
  
  -- Reference
  billing_period_start date,
  billing_period_end date,
  description text,
  invoice_number text,
  
  -- Metadata
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_billing_transactions_org ON public.billing_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_schedule ON public.billing_transactions(billing_schedule_id);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_member ON public.billing_transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_enrollment ON public.billing_transactions(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_status ON public.billing_transactions(status);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_authorize ON public.billing_transactions(authorize_transaction_id);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_created ON public.billing_transactions(created_at DESC);

-- Updated_at trigger
CREATE TRIGGER update_billing_transactions_updated_at
  BEFORE UPDATE ON public.billing_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- BILLING FAILURES TABLE
-- Tracks failed payment attempts for retry logic and member notification
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.billing_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  billing_schedule_id uuid NOT NULL REFERENCES public.billing_schedules(id) ON DELETE CASCADE,
  billing_transaction_id uuid NOT NULL REFERENCES public.billing_transactions(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  
  -- Failure details
  failure_reason text NOT NULL,
  failure_code text,
  amount numeric(12,2) NOT NULL,
  
  -- Retry tracking
  retry_attempt integer NOT NULL DEFAULT 1,
  next_retry_date date,
  retry_scheduled boolean DEFAULT true,
  
  -- Resolution
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolution_notes text,
  resolution_type text CHECK (resolution_type IN ('payment_succeeded', 'payment_method_updated', 'manually_resolved', 'cancelled', 'waived')),
  
  -- Member notification tracking
  member_notified boolean DEFAULT false,
  member_notified_at timestamptz,
  notification_count integer DEFAULT 0,
  last_notification_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_billing_failures_org ON public.billing_failures(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_failures_schedule ON public.billing_failures(billing_schedule_id);
CREATE INDEX IF NOT EXISTS idx_billing_failures_member ON public.billing_failures(member_id);
CREATE INDEX IF NOT EXISTS idx_billing_failures_unresolved ON public.billing_failures(organization_id) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_billing_failures_retry ON public.billing_failures(next_retry_date) WHERE retry_scheduled = true AND resolved = false;

-- Updated_at trigger
CREATE TRIGGER update_billing_failures_updated_at
  BEFORE UPDATE ON public.billing_failures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INVOICES TABLE
-- Generated invoices for billing periods
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES public.enrollments(id) ON DELETE SET NULL,
  
  -- Invoice identification
  invoice_number text NOT NULL,
  
  -- Period
  period_start date NOT NULL,
  period_end date NOT NULL,
  due_date date NOT NULL,
  
  -- Amounts
  subtotal numeric(12,2) NOT NULL,
  processing_fee numeric(12,2) DEFAULT 0,
  adjustments numeric(12,2) DEFAULT 0,
  total numeric(12,2) NOT NULL,
  amount_paid numeric(12,2) DEFAULT 0,
  balance_due numeric(12,2) GENERATED ALWAYS AS (total - amount_paid) STORED,
  
  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled', 'void')),
  
  -- Line items stored as JSONB
  line_items jsonb DEFAULT '[]',
  
  -- Dates
  sent_at timestamptz,
  paid_at timestamptz,
  
  -- PDF storage
  pdf_url text,
  
  -- Metadata
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Unique invoice number per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(organization_id, invoice_number);

-- Other indexes
CREATE INDEX IF NOT EXISTS idx_invoices_org ON public.invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_member ON public.invoices(member_id);
CREATE INDEX IF NOT EXISTS idx_invoices_enrollment ON public.invoices(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date) WHERE status NOT IN ('paid', 'cancelled', 'void');

-- Updated_at trigger
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INVOICE NUMBER GENERATOR
-- ============================================================================

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

CREATE TRIGGER trg_invoices_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION generate_invoice_number();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.payment_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PAYMENT PROFILES POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view all payment profiles" ON public.payment_profiles;
CREATE POLICY "Admins can view all payment profiles"
  ON public.payment_profiles FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

DROP POLICY IF EXISTS "Admins can manage payment profiles" ON public.payment_profiles;
CREATE POLICY "Admins can manage payment profiles"
  ON public.payment_profiles FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

-- ============================================================================
-- BILLING SCHEDULES POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view billing schedules" ON public.billing_schedules;
CREATE POLICY "Admins can view billing schedules"
  ON public.billing_schedules FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

DROP POLICY IF EXISTS "Admins can manage billing schedules" ON public.billing_schedules;
CREATE POLICY "Admins can manage billing schedules"
  ON public.billing_schedules FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- ============================================================================
-- BILLING TRANSACTIONS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view billing transactions" ON public.billing_transactions;
CREATE POLICY "Admins can view billing transactions"
  ON public.billing_transactions FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

DROP POLICY IF EXISTS "System can insert billing transactions" ON public.billing_transactions;
CREATE POLICY "System can insert billing transactions"
  ON public.billing_transactions FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
  );

DROP POLICY IF EXISTS "Admins can update billing transactions" ON public.billing_transactions;
CREATE POLICY "Admins can update billing transactions"
  ON public.billing_transactions FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- ============================================================================
-- BILLING FAILURES POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view billing failures" ON public.billing_failures;
CREATE POLICY "Admins can view billing failures"
  ON public.billing_failures FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

DROP POLICY IF EXISTS "Admins can manage billing failures" ON public.billing_failures;
CREATE POLICY "Admins can manage billing failures"
  ON public.billing_failures FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- ============================================================================
-- INVOICES POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view invoices" ON public.invoices;
CREATE POLICY "Admins can view invoices"
  ON public.invoices FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

DROP POLICY IF EXISTS "Admins can manage invoices" ON public.invoices;
CREATE POLICY "Admins can manage invoices"
  ON public.invoices FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Calculate next billing date based on frequency
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
      IF next_date <= p_current_date THEN
        next_date := DATE_TRUNC('month', p_current_date) + INTERVAL '6 months' + (target_day - 1) * INTERVAL '1 day';
      END IF;
    WHEN 'annual' THEN
      next_date := DATE_TRUNC('year', p_current_date) + INTERVAL '1 year' + (EXTRACT(MONTH FROM p_current_date) - 1) * INTERVAL '1 month' + (target_day - 1) * INTERVAL '1 day';
      IF next_date <= p_current_date THEN
        next_date := next_date + INTERVAL '1 year';
      END IF;
    ELSE
      next_date := p_current_date + INTERVAL '1 month';
  END CASE;
  
  RETURN next_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.payment_profiles IS 'Tokenized payment methods stored via Authorize.Net - never contains actual card/bank numbers';
COMMENT ON TABLE public.billing_schedules IS 'Recurring billing configuration for active enrollments';
COMMENT ON TABLE public.billing_transactions IS 'All payment transaction records and Authorize.Net responses';
COMMENT ON TABLE public.billing_failures IS 'Failed payment tracking for retry logic and member notification';
COMMENT ON TABLE public.invoices IS 'Generated invoices for billing periods';

COMMENT ON COLUMN public.payment_profiles.authorize_customer_profile_id IS 'Authorize.Net Customer Profile ID';
COMMENT ON COLUMN public.payment_profiles.authorize_payment_profile_id IS 'Authorize.Net Payment Profile ID';
COMMENT ON COLUMN public.payment_profiles.last_four IS 'Last 4 digits of card/account number (safe to store)';

COMMENT ON COLUMN public.billing_transactions.authorize_transaction_id IS 'Authorize.Net Transaction ID';
COMMENT ON COLUMN public.billing_transactions.authorize_response_code IS 'Authorize.Net response code (1=Approved, 2=Declined, 3=Error, 4=Held)';

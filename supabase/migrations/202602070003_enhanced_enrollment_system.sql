-- ============================================================================
-- ENHANCED ENROLLMENT SYSTEM
-- Extends existing enrollment tables with additional fields for full lifecycle
-- ============================================================================

-- ============================================================================
-- DEPENDENTS TABLE (Extend existing or create new)
-- ============================================================================
CREATE TABLE IF NOT EXISTS dependents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date NOT NULL,
  relationship text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add additional columns to dependents if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'dependents' AND column_name = 'gender') THEN
    ALTER TABLE dependents ADD COLUMN gender text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'dependents' AND column_name = 'is_smoker') THEN
    ALTER TABLE dependents ADD COLUMN is_smoker boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'dependents' AND column_name = 'tobacco_use_date') THEN
    ALTER TABLE dependents ADD COLUMN tobacco_use_date date;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'dependents' AND column_name = 'has_existing_condition') THEN
    ALTER TABLE dependents ADD COLUMN has_existing_condition boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'dependents' AND column_name = 'existing_condition_description') THEN
    ALTER TABLE dependents ADD COLUMN existing_condition_description text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'dependents' AND column_name = 'same_address_as_member') THEN
    ALTER TABLE dependents ADD COLUMN same_address_as_member boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'dependents' AND column_name = 'address_line1') THEN
    ALTER TABLE dependents ADD COLUMN address_line1 text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'dependents' AND column_name = 'address_line2') THEN
    ALTER TABLE dependents ADD COLUMN address_line2 text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'dependents' AND column_name = 'city') THEN
    ALTER TABLE dependents ADD COLUMN city text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'dependents' AND column_name = 'state') THEN
    ALTER TABLE dependents ADD COLUMN state text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'dependents' AND column_name = 'zip_code') THEN
    ALTER TABLE dependents ADD COLUMN zip_code text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'dependents' AND column_name = 'country') THEN
    ALTER TABLE dependents ADD COLUMN country text DEFAULT 'US';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'dependents' AND column_name = 'phone') THEN
    ALTER TABLE dependents ADD COLUMN phone text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'dependents' AND column_name = 'email') THEN
    ALTER TABLE dependents ADD COLUMN email text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'dependents' AND column_name = 'status') THEN
    ALTER TABLE dependents ADD COLUMN status text DEFAULT 'active';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'dependents' AND column_name = 'ssn_last4') THEN
    ALTER TABLE dependents ADD COLUMN ssn_last4 text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dependents_organization_id ON dependents(organization_id);
CREATE INDEX IF NOT EXISTS idx_dependents_member_id ON dependents(member_id);

-- ============================================================================
-- EXTEND EXISTING ENROLLMENTS TABLE
-- ============================================================================
DO $$
BEGIN
  -- Product/Plan references
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'product_id') THEN
    ALTER TABLE enrollments ADD COLUMN product_id uuid REFERENCES products(id) ON DELETE SET NULL;
  END IF;

  -- Advisor snapshot (in case advisor changes)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'advisor_first_name') THEN
    ALTER TABLE enrollments ADD COLUMN advisor_first_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'advisor_last_name') THEN
    ALTER TABLE enrollments ADD COLUMN advisor_last_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'advisor_email') THEN
    ALTER TABLE enrollments ADD COLUMN advisor_email text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'advisor_level') THEN
    ALTER TABLE enrollments ADD COLUMN advisor_level text;
  END IF;

  -- Plan selection
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'benefit_type_id') THEN
    ALTER TABLE enrollments ADD COLUMN benefit_type_id uuid;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'iua_id') THEN
    ALTER TABLE enrollments ADD COLUMN iua_id uuid;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'pricing_matrix_id') THEN
    ALTER TABLE enrollments ADD COLUMN pricing_matrix_id uuid;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'plan_type') THEN
    ALTER TABLE enrollments ADD COLUMN plan_type text;
  END IF;

  -- Health declarations
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'primary_is_smoker') THEN
    ALTER TABLE enrollments ADD COLUMN primary_is_smoker boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'primary_tobacco_date') THEN
    ALTER TABLE enrollments ADD COLUMN primary_tobacco_date date;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'has_pre_existing_conditions') THEN
    ALTER TABLE enrollments ADD COLUMN has_pre_existing_conditions boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'pre_existing_conditions_details') THEN
    ALTER TABLE enrollments ADD COLUMN pre_existing_conditions_details text;
  END IF;

  -- Pricing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'base_monthly_cost') THEN
    ALTER TABLE enrollments ADD COLUMN base_monthly_cost numeric(10,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'tobacco_surcharge') THEN
    ALTER TABLE enrollments ADD COLUMN tobacco_surcharge numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'total_monthly_cost') THEN
    ALTER TABLE enrollments ADD COLUMN total_monthly_cost numeric(10,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'setup_fee') THEN
    ALTER TABLE enrollments ADD COLUMN setup_fee numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'annual_fee') THEN
    ALTER TABLE enrollments ADD COLUMN annual_fee numeric(10,2) DEFAULT 0;
  END IF;

  -- Dates
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'enrollment_date') THEN
    ALTER TABLE enrollments ADD COLUMN enrollment_date date DEFAULT CURRENT_DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'start_date') THEN
    ALTER TABLE enrollments ADD COLUMN start_date date;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'end_date') THEN
    ALTER TABLE enrollments ADD COLUMN end_date date;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'termination_date') THEN
    ALTER TABLE enrollments ADD COLUMN termination_date date;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'status_reason') THEN
    ALTER TABLE enrollments ADD COLUMN status_reason text;
  END IF;

  -- Payment tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'initial_payment_amount') THEN
    ALTER TABLE enrollments ADD COLUMN initial_payment_amount numeric(10,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'initial_payment_paid') THEN
    ALTER TABLE enrollments ADD COLUMN initial_payment_paid boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'initial_payment_date') THEN
    ALTER TABLE enrollments ADD COLUMN initial_payment_date timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'initial_transaction_id') THEN
    ALTER TABLE enrollments ADD COLUMN initial_transaction_id text;
  END IF;

  -- Agreement tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'agreed_to_terms') THEN
    ALTER TABLE enrollments ADD COLUMN agreed_to_terms boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'terms_agreed_at') THEN
    ALTER TABLE enrollments ADD COLUMN terms_agreed_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'agreed_to_privacy') THEN
    ALTER TABLE enrollments ADD COLUMN agreed_to_privacy boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'privacy_agreed_at') THEN
    ALTER TABLE enrollments ADD COLUMN privacy_agreed_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'agreed_to_guidelines') THEN
    ALTER TABLE enrollments ADD COLUMN agreed_to_guidelines boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'guidelines_agreed_at') THEN
    ALTER TABLE enrollments ADD COLUMN guidelines_agreed_at timestamptz;
  END IF;

  -- Signature
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'signature_data') THEN
    ALTER TABLE enrollments ADD COLUMN signature_data text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'signature_ip_address') THEN
    ALTER TABLE enrollments ADD COLUMN signature_ip_address text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'signature_timestamp') THEN
    ALTER TABLE enrollments ADD COLUMN signature_timestamp timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'signature_user_agent') THEN
    ALTER TABLE enrollments ADD COLUMN signature_user_agent text;
  END IF;

  -- Source tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'source') THEN
    ALTER TABLE enrollments ADD COLUMN source text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'source_url') THEN
    ALTER TABLE enrollments ADD COLUMN source_url text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'utm_source') THEN
    ALTER TABLE enrollments ADD COLUMN utm_source text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'utm_medium') THEN
    ALTER TABLE enrollments ADD COLUMN utm_medium text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'utm_campaign') THEN
    ALTER TABLE enrollments ADD COLUMN utm_campaign text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'utm_term') THEN
    ALTER TABLE enrollments ADD COLUMN utm_term text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'utm_content') THEN
    ALTER TABLE enrollments ADD COLUMN utm_content text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'referrer_url') THEN
    ALTER TABLE enrollments ADD COLUMN referrer_url text;
  END IF;

  -- Metadata
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'notes') THEN
    ALTER TABLE enrollments ADD COLUMN notes text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'enrollments' AND column_name = 'metadata') THEN
    ALTER TABLE enrollments ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_enrollments_product_id ON enrollments(product_id) WHERE product_id IS NOT NULL;

-- ============================================================================
-- ENROLLMENT DEPENDENTS (Links dependents to specific enrollments)
-- ============================================================================
CREATE TABLE IF NOT EXISTS enrollment_dependents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  dependent_id uuid NOT NULL REFERENCES dependents(id) ON DELETE CASCADE,
  relationship text NOT NULL,
  is_primary boolean DEFAULT false,
  is_smoker boolean DEFAULT false,
  has_pre_existing_conditions boolean DEFAULT false,
  additional_cost numeric(10,2) DEFAULT 0,
  status text DEFAULT 'active',
  coverage_start_date date,
  coverage_end_date date,
  removal_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(enrollment_id, dependent_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollment_dependents_enrollment_id ON enrollment_dependents(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_dependents_dependent_id ON enrollment_dependents(dependent_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_dependents_status ON enrollment_dependents(status);

-- ============================================================================
-- ENROLLMENT CONTRACTS (Generated contract documents)
-- ============================================================================
CREATE TABLE IF NOT EXISTS enrollment_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  contract_type text NOT NULL,
  contract_number text,
  file_url text,
  file_path text,
  file_size integer,
  status text DEFAULT 'pending',
  generated_at timestamptz,
  signed_at timestamptz,
  executed_at timestamptz,
  expires_at timestamptz,
  signature_data text,
  signature_ip text,
  signer_name text,
  signer_email text,
  template_version text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enrollment_contracts_organization_id ON enrollment_contracts(organization_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_contracts_enrollment_id ON enrollment_contracts(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_contracts_member_id ON enrollment_contracts(member_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_contracts_status ON enrollment_contracts(status);

-- ============================================================================
-- ENROLLMENT LOGS (Additional audit trail for enrollments)
-- ============================================================================
CREATE TABLE IF NOT EXISTS enrollment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES enrollments(id) ON DELETE SET NULL,
  member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  advisor_id uuid REFERENCES advisors(id) ON DELETE SET NULL,
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  action_category text,
  status_before text,
  status_after text,
  description text,
  details jsonb DEFAULT '{}'::jsonb,
  is_error boolean DEFAULT false,
  error_code text,
  error_message text,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enrollment_logs_organization_id ON enrollment_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_logs_enrollment_id ON enrollment_logs(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_logs_member_id ON enrollment_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_logs_action ON enrollment_logs(action);
CREATE INDEX IF NOT EXISTS idx_enrollment_logs_created_at ON enrollment_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrollment_logs_is_error ON enrollment_logs(is_error) WHERE is_error = true;

-- ============================================================================
-- ENROLLMENT WIZARD STATE (For saving multi-step form progress)
-- ============================================================================
CREATE TABLE IF NOT EXISTS enrollment_wizard_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  advisor_id uuid REFERENCES advisors(id) ON DELETE SET NULL,
  member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  enrollment_id uuid REFERENCES enrollments(id) ON DELETE SET NULL,
  current_step integer DEFAULT 1,
  completed_steps integer[] DEFAULT '{}',
  step1_data jsonb DEFAULT '{}'::jsonb,
  step2_data jsonb DEFAULT '{}'::jsonb,
  step3_data jsonb DEFAULT '{}'::jsonb,
  step4_data jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'in_progress',
  started_at timestamptz DEFAULT now(),
  last_activity_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '24 hours'),
  source_url text,
  utm_params jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enrollment_wizard_state_session_id ON enrollment_wizard_state(session_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_wizard_state_advisor_id ON enrollment_wizard_state(advisor_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_wizard_state_status ON enrollment_wizard_state(status);
CREATE INDEX IF NOT EXISTS idx_enrollment_wizard_state_expires_at ON enrollment_wizard_state(expires_at) WHERE status = 'in_progress';

-- ============================================================================
-- PROMO CODES
-- ============================================================================
CREATE TABLE IF NOT EXISTS promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text,
  discount_type text NOT NULL,
  discount_value numeric(10,2) NOT NULL,
  discount_target text DEFAULT 'monthly',
  max_uses integer,
  max_uses_per_member integer DEFAULT 1,
  current_uses integer DEFAULT 0,
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz,
  min_enrollment_amount numeric(10,2),
  allowed_products uuid[],
  allowed_advisors uuid[],
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_organization_id ON promo_codes(organization_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_is_active ON promo_codes(is_active) WHERE is_active = true;

-- ============================================================================
-- PROMO CODE USES (Track usage)
-- ============================================================================
CREATE TABLE IF NOT EXISTS promo_code_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  discount_amount numeric(10,2) NOT NULL,
  used_at timestamptz DEFAULT now(),
  UNIQUE(promo_code_id, enrollment_id)
);

CREATE INDEX IF NOT EXISTS idx_promo_code_uses_promo_code_id ON promo_code_uses(promo_code_id);
CREATE INDEX IF NOT EXISTS idx_promo_code_uses_enrollment_id ON promo_code_uses(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_promo_code_uses_member_id ON promo_code_uses(member_id);

-- ============================================================================
-- UPDATE MEMBERS TABLE WITH ENROLLMENT FIELDS
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'members' AND column_name = 'gender') THEN
    ALTER TABLE members ADD COLUMN gender text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'members' AND column_name = 'is_smoker') THEN
    ALTER TABLE members ADD COLUMN is_smoker boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'members' AND column_name = 'tobacco_use_date') THEN
    ALTER TABLE members ADD COLUMN tobacco_use_date date;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'members' AND column_name = 'has_existing_condition') THEN
    ALTER TABLE members ADD COLUMN has_existing_condition boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'members' AND column_name = 'existing_condition_description') THEN
    ALTER TABLE members ADD COLUMN existing_condition_description text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'members' AND column_name = 'country') THEN
    ALTER TABLE members ADD COLUMN country text DEFAULT 'US';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'members' AND column_name = 'receive_emails') THEN
    ALTER TABLE members ADD COLUMN receive_emails boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'members' AND column_name = 'receive_sms') THEN
    ALTER TABLE members ADD COLUMN receive_sms boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'members' AND column_name = 'preferred_language') THEN
    ALTER TABLE members ADD COLUMN preferred_language text DEFAULT 'en';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'members' AND column_name = 'additional_info') THEN
    ALTER TABLE members ADD COLUMN additional_info text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'members' AND column_name = 'ssn_last4') THEN
    ALTER TABLE members ADD COLUMN ssn_last4 text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'members' AND column_name = 'primary_enrollment_id') THEN
    ALTER TABLE members ADD COLUMN primary_enrollment_id uuid;
  END IF;
END $$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to log enrollment status changes
CREATE OR REPLACE FUNCTION log_enrollment_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO enrollment_logs (
      organization_id, enrollment_id, member_id, advisor_id,
      action, action_category, status_before, status_after,
      description
    ) VALUES (
      NEW.organization_id, NEW.id,
      COALESCE(NEW.primary_member_id, (SELECT primary_member_id FROM enrollments WHERE id = NEW.id)),
      NEW.advisor_id,
      'status_changed', 'status', OLD.status, NEW.status,
      'Enrollment status changed from ' || COALESCE(OLD.status, 'null') || ' to ' || NEW.status
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enrollment_status_change_trigger ON enrollments;
CREATE TRIGGER enrollment_status_change_trigger
  AFTER UPDATE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION log_enrollment_status_change();

-- Trigger to increment promo code usage
CREATE OR REPLACE FUNCTION increment_promo_code_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE promo_codes
  SET current_uses = current_uses + 1
  WHERE id = NEW.promo_code_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS promo_code_use_trigger ON promo_code_uses;
CREATE TRIGGER promo_code_use_trigger
  AFTER INSERT ON promo_code_uses
  FOR EACH ROW EXECUTE FUNCTION increment_promo_code_usage();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE dependents ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollment_dependents ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollment_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollment_wizard_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_code_uses ENABLE ROW LEVEL SECURITY;

-- Dependents policies
DROP POLICY IF EXISTS "Users can view dependents in their organization" ON dependents;
CREATE POLICY "Users can view dependents in their organization"
  ON dependents FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage dependents" ON dependents;
CREATE POLICY "Admins can manage dependents"
  ON dependents FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

-- Enrollment Dependents policies
DROP POLICY IF EXISTS "Users can view enrollment dependents" ON enrollment_dependents;
CREATE POLICY "Users can view enrollment dependents"
  ON enrollment_dependents FOR SELECT
  USING (enrollment_id IN (
    SELECT id FROM enrollments WHERE organization_id = get_user_organization_id()
  ));

DROP POLICY IF EXISTS "Admins can manage enrollment dependents" ON enrollment_dependents;
CREATE POLICY "Admins can manage enrollment dependents"
  ON enrollment_dependents FOR ALL
  USING (enrollment_id IN (
    SELECT id FROM enrollments
    WHERE organization_id = get_user_organization_id()
  ) AND get_user_role() IN ('owner', 'admin', 'staff'));

-- Enrollment Contracts policies
DROP POLICY IF EXISTS "Users can view enrollment contracts" ON enrollment_contracts;
CREATE POLICY "Users can view enrollment contracts"
  ON enrollment_contracts FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage enrollment contracts" ON enrollment_contracts;
CREATE POLICY "Admins can manage enrollment contracts"
  ON enrollment_contracts FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

-- Enrollment Logs policies
DROP POLICY IF EXISTS "Users can view enrollment logs" ON enrollment_logs;
CREATE POLICY "Users can view enrollment logs"
  ON enrollment_logs FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "System can insert enrollment logs" ON enrollment_logs;
CREATE POLICY "System can insert enrollment logs"
  ON enrollment_logs FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

-- Enrollment Wizard State policies
DROP POLICY IF EXISTS "Users can view wizard state" ON enrollment_wizard_state;
CREATE POLICY "Users can view wizard state"
  ON enrollment_wizard_state FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can manage wizard state" ON enrollment_wizard_state;
CREATE POLICY "Users can manage wizard state"
  ON enrollment_wizard_state FOR ALL
  USING (organization_id = get_user_organization_id());

-- Promo Codes policies
DROP POLICY IF EXISTS "Users can view promo codes" ON promo_codes;
CREATE POLICY "Users can view promo codes"
  ON promo_codes FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage promo codes" ON promo_codes;
CREATE POLICY "Admins can manage promo codes"
  ON promo_codes FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- Promo Code Uses policies
DROP POLICY IF EXISTS "Users can view promo code uses" ON promo_code_uses;
CREATE POLICY "Users can view promo code uses"
  ON promo_code_uses FOR SELECT
  USING (promo_code_id IN (
    SELECT id FROM promo_codes WHERE organization_id = get_user_organization_id()
  ));

DROP POLICY IF EXISTS "System can insert promo code uses" ON promo_code_uses;
CREATE POLICY "System can insert promo code uses"
  ON promo_code_uses FOR INSERT
  WITH CHECK (promo_code_id IN (
    SELECT id FROM promo_codes WHERE organization_id = get_user_organization_id()
  ));

-- ============================================================================
-- ADD FOREIGN KEYS FOR BILLING TABLES (if they exist)
-- ============================================================================
DO $$
BEGIN
  -- Only add constraint if billing table exists and constraint doesn't exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'billing') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'fk_billing_enrollment' AND table_name = 'billing') THEN
      ALTER TABLE billing ADD CONSTRAINT fk_billing_enrollment
        FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE SET NULL;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'billing_schedules') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'fk_billing_schedules_enrollment' AND table_name = 'billing_schedules') THEN
      ALTER TABLE billing_schedules ADD CONSTRAINT fk_billing_schedules_enrollment
        FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE SET NULL;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'billing_failures') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'fk_billing_failures_enrollment' AND table_name = 'billing_failures') THEN
      ALTER TABLE billing_failures ADD CONSTRAINT fk_billing_failures_enrollment
        FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

COMMENT ON TABLE dependents IS 'Family members/dependents of primary members';
COMMENT ON TABLE enrollment_dependents IS 'Links dependents to specific enrollment coverage';
COMMENT ON TABLE enrollment_contracts IS 'Generated contract documents for enrollments';
COMMENT ON TABLE enrollment_logs IS 'Audit trail for all enrollment activities';
COMMENT ON TABLE enrollment_wizard_state IS 'Saves multi-step enrollment form progress';
COMMENT ON TABLE promo_codes IS 'Discount codes for enrollments';
COMMENT ON TABLE promo_code_uses IS 'Tracks promo code usage';

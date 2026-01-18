-- ============================================================================
-- PAYMENT & BILLING SYSTEM ENHANCEMENTS
-- Extends existing billing schema with additional features
-- ============================================================================

-- ============================================================================
-- EXTEND PAYMENT PROFILES TABLE
-- ============================================================================
DO $$
BEGIN
  -- Add customer_profile_id column if not exists (alias for authorize_customer_profile_id)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'payment_profiles' AND column_name = 'customer_profile_id') THEN
    ALTER TABLE payment_profiles ADD COLUMN customer_profile_id text;
  END IF;

  -- Add payment_profile_id column if not exists (alias for authorize_payment_profile_id)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'payment_profiles' AND column_name = 'payment_profile_id') THEN
    ALTER TABLE payment_profiles ADD COLUMN payment_profile_id text;
  END IF;

  -- Add card_last4 column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'payment_profiles' AND column_name = 'card_last4') THEN
    ALTER TABLE payment_profiles ADD COLUMN card_last4 text;
  END IF;

  -- Add account_last4 for ACH
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'payment_profiles' AND column_name = 'account_last4') THEN
    ALTER TABLE payment_profiles ADD COLUMN account_last4 text;
  END IF;

  -- Add status column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'payment_profiles' AND column_name = 'status') THEN
    ALTER TABLE payment_profiles ADD COLUMN status text DEFAULT 'active';
  END IF;

  -- Add billing address columns if not exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'payment_profiles' AND column_name = 'billing_address_line1') THEN
    ALTER TABLE payment_profiles ADD COLUMN billing_address_line1 text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'payment_profiles' AND column_name = 'billing_address_line2') THEN
    ALTER TABLE payment_profiles ADD COLUMN billing_address_line2 text;
  END IF;

  -- Sync values from existing columns
  UPDATE payment_profiles
  SET customer_profile_id = authorize_customer_profile_id
  WHERE customer_profile_id IS NULL AND authorize_customer_profile_id IS NOT NULL;

  UPDATE payment_profiles
  SET payment_profile_id = authorize_payment_profile_id
  WHERE payment_profile_id IS NULL AND authorize_payment_profile_id IS NOT NULL;

  UPDATE payment_profiles
  SET card_last4 = last_four
  WHERE card_last4 IS NULL AND last_four IS NOT NULL;
END $$;

-- ============================================================================
-- PAYMENT TRANSACTIONS LOG (Additional detail table)
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  billing_transaction_id uuid,
  payment_profile_id uuid REFERENCES payment_profiles(id) ON DELETE SET NULL,
  member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('auth_capture', 'auth_only', 'capture', 'void', 'refund', 'credit')),
  transaction_id text,
  ref_transaction_id text,
  auth_code text,
  response_code text,
  response_reason_code text,
  response_reason_text text,
  avs_result_code text,
  cvv_result_code text,
  cavv_result_code text,
  amount numeric(10,2) NOT NULL,
  status text NOT NULL CHECK (status IN ('approved', 'declined', 'error', 'held_for_review')),
  raw_request jsonb,
  raw_response jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_organization_id ON payment_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_member_id ON payment_transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_transaction_id ON payment_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at DESC);

-- ============================================================================
-- EXTEND MEMBERS TABLE WITH PAYMENT FIELDS
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'members' AND column_name = 'customer_profile_id') THEN
    ALTER TABLE members ADD COLUMN customer_profile_id text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'members' AND column_name = 'default_payment_profile_id') THEN
    ALTER TABLE members ADD COLUMN default_payment_profile_id uuid;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_members_customer_profile_id ON members(customer_profile_id);

-- ============================================================================
-- EXTEND BILLING_SCHEDULES WITH ADDITIONAL FIELDS
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'billing_schedules' AND column_name = 'billing_type') THEN
    ALTER TABLE billing_schedules ADD COLUMN billing_type text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'billing_schedules' AND column_name = 'subscription_id') THEN
    ALTER TABLE billing_schedules ADD COLUMN subscription_id text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'billing_schedules' AND column_name = 'day_of_month') THEN
    ALTER TABLE billing_schedules ADD COLUMN day_of_month integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'billing_schedules' AND column_name = 'total_billed') THEN
    ALTER TABLE billing_schedules ADD COLUMN total_billed numeric(12,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'billing_schedules' AND column_name = 'total_paid') THEN
    ALTER TABLE billing_schedules ADD COLUMN total_paid numeric(12,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'billing_schedules' AND column_name = 'consecutive_failures') THEN
    ALTER TABLE billing_schedules ADD COLUMN consecutive_failures integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'billing_schedules' AND column_name = 'last_billing_status') THEN
    ALTER TABLE billing_schedules ADD COLUMN last_billing_status text;
  END IF;

  -- Map existing frequency to billing_type
  UPDATE billing_schedules SET billing_type = frequency WHERE billing_type IS NULL AND frequency IS NOT NULL;
  UPDATE billing_schedules SET day_of_month = billing_day WHERE day_of_month IS NULL AND billing_day IS NOT NULL;
END $$;

-- ============================================================================
-- EXTEND BILLING_FAILURES WITH ADDITIONAL FIELDS
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'billing_failures' AND column_name = 'status') THEN
    ALTER TABLE billing_failures ADD COLUMN status text DEFAULT 'pending';
    UPDATE billing_failures SET status = CASE WHEN resolved THEN 'resolved' ELSE 'pending' END WHERE status IS NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'billing_failures' AND column_name = 'admin_notified_at') THEN
    ALTER TABLE billing_failures ADD COLUMN admin_notified_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'billing_failures' AND column_name = 'enrollment_id') THEN
    ALTER TABLE billing_failures ADD COLUMN enrollment_id uuid;
  END IF;
END $$;

-- ============================================================================
-- RLS FOR NEW TABLE
-- ============================================================================
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view payment transactions in their organization" ON payment_transactions;
CREATE POLICY "Users can view payment transactions in their organization"
  ON payment_transactions FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "System can insert payment transactions" ON payment_transactions;
CREATE POLICY "System can insert payment transactions"
  ON payment_transactions FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_next_retry_time(attempt_number integer)
RETURNS timestamptz AS $$
DECLARE
  retry_delays integer[] := ARRAY[1, 3, 5, 7];
  delay_days integer;
BEGIN
  IF attempt_number > array_length(retry_delays, 1) THEN
    RETURN NULL;
  END IF;
  delay_days := retry_delays[attempt_number];
  RETURN now() + (delay_days || ' days')::interval;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_member_default_payment_profile(p_member_id uuid)
RETURNS uuid AS $$
  SELECT id FROM payment_profiles
  WHERE member_id = p_member_id
    AND is_active = true
    AND is_default = true
  LIMIT 1;
$$ LANGUAGE sql STABLE;

COMMENT ON TABLE payment_transactions IS 'Detailed log of all payment gateway transactions';

-- ============================================================================
-- BILLING MODULE ENHANCEMENTS
-- Payment processors, permissions, and audit logging
-- ============================================================================

-- ============================================================================
-- PAYMENT PROCESSORS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_processors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  processor_type text NOT NULL, -- 'authorize_net', 'stripe', 'square', 'paypal', 'ach_direct'
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  environment text DEFAULT 'sandbox', -- 'sandbox', 'production'
  -- Encrypted credentials (stored as encrypted JSON)
  credentials jsonb NOT NULL DEFAULT '{}',
  -- Configuration settings
  config jsonb DEFAULT '{}',
  -- Supported payment methods
  supports_credit_card boolean DEFAULT true,
  supports_ach boolean DEFAULT false,
  supports_apple_pay boolean DEFAULT false,
  supports_google_pay boolean DEFAULT false,
  -- Fee configuration
  processing_fee_percent numeric(5,3) DEFAULT 0,
  processing_fee_fixed numeric(10,2) DEFAULT 0,
  ach_fee_fixed numeric(10,2) DEFAULT 0,
  -- Limits
  min_transaction_amount numeric(10,2) DEFAULT 1.00,
  max_transaction_amount numeric(10,2) DEFAULT 99999.99,
  daily_limit numeric(12,2),
  monthly_limit numeric(12,2),
  -- Metadata
  last_tested_at timestamptz,
  test_result text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  UNIQUE(organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_payment_processors_org ON payment_processors(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_processors_type ON payment_processors(processor_type);
CREATE INDEX IF NOT EXISTS idx_payment_processors_active ON payment_processors(organization_id, is_active) WHERE is_active = true;

-- ============================================================================
-- ADD BILLING PERMISSIONS
-- ============================================================================
INSERT INTO permissions (name, description, category)
VALUES
  ('billing.read', 'View billing transactions and invoices', 'billing'),
  ('billing.write', 'Create and modify billing records, process payments', 'billing'),
  ('billing.export', 'Export billing data and NACHA files', 'billing')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- BILLING AUDIT LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS billing_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  action text NOT NULL, -- 'payment_processed', 'payment_retry', 'payment_refund', 'nacha_export', 'nacha_import', 'processor_create', 'processor_update', 'processor_delete', 'schedule_change'
  entity_type text NOT NULL, -- 'transaction', 'processor', 'nacha_file', 'schedule', 'failure'
  entity_id uuid,
  member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  transaction_id uuid,
  amount numeric(10,2),
  details jsonb,
  user_id uuid REFERENCES auth.users(id),
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_audit_log_org ON billing_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_audit_log_action ON billing_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_billing_audit_log_entity ON billing_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_billing_audit_log_member ON billing_audit_log(member_id);
CREATE INDEX IF NOT EXISTS idx_billing_audit_log_created ON billing_audit_log(created_at DESC);

-- ============================================================================
-- EXTEND BILLING_TRANSACTIONS TABLE
-- ============================================================================
DO $$
BEGIN
  -- Add processor reference
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'billing_transactions' AND column_name = 'processor_id') THEN
    ALTER TABLE billing_transactions ADD COLUMN processor_id uuid REFERENCES payment_processors(id);
  END IF;

  -- Add decline code
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'billing_transactions' AND column_name = 'decline_code') THEN
    ALTER TABLE billing_transactions ADD COLUMN decline_code text;
  END IF;

  -- Add decline reason category
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'billing_transactions' AND column_name = 'decline_category') THEN
    ALTER TABLE billing_transactions ADD COLUMN decline_category text; -- 'insufficient_funds', 'card_expired', 'invalid_card', 'fraud', 'limit_exceeded', 'do_not_honor', 'other'
  END IF;

  -- Add retry count
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'billing_transactions' AND column_name = 'retry_count') THEN
    ALTER TABLE billing_transactions ADD COLUMN retry_count integer DEFAULT 0;
  END IF;

  -- Add original transaction reference for retries
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'billing_transactions' AND column_name = 'original_transaction_id') THEN
    ALTER TABLE billing_transactions ADD COLUMN original_transaction_id uuid REFERENCES billing_transactions(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_billing_transactions_processor ON billing_transactions(processor_id);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_decline ON billing_transactions(decline_category) WHERE status = 'failed';
CREATE INDEX IF NOT EXISTS idx_billing_transactions_retry ON billing_transactions(original_transaction_id) WHERE original_transaction_id IS NOT NULL;

-- ============================================================================
-- NACHA FILES TABLE (for tracking exports/imports)
-- ============================================================================
CREATE TABLE IF NOT EXISTS nacha_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  file_type text NOT NULL, -- 'export', 'import'
  file_name text NOT NULL,
  status text DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'partial'
  effective_date date NOT NULL,
  -- File details
  file_content text, -- Stored NACHA content for exports
  file_url text, -- Storage URL for uploaded imports
  file_size integer,
  -- Batch info
  batch_count integer DEFAULT 0,
  total_debit_amount numeric(12,2) DEFAULT 0,
  total_credit_amount numeric(12,2) DEFAULT 0,
  transaction_count integer DEFAULT 0,
  -- Processing results
  processed_count integer DEFAULT 0,
  success_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  return_count integer DEFAULT 0,
  -- Company info used
  company_name text,
  company_id text,
  odfi_id text,
  -- Metadata
  error_message text,
  processing_notes jsonb,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_nacha_files_org ON nacha_files(organization_id);
CREATE INDEX IF NOT EXISTS idx_nacha_files_type ON nacha_files(file_type);
CREATE INDEX IF NOT EXISTS idx_nacha_files_status ON nacha_files(status);
CREATE INDEX IF NOT EXISTS idx_nacha_files_date ON nacha_files(effective_date);
CREATE INDEX IF NOT EXISTS idx_nacha_files_created ON nacha_files(created_at DESC);

-- ============================================================================
-- NACHA TRANSACTIONS (link transactions to NACHA files)
-- ============================================================================
CREATE TABLE IF NOT EXISTS nacha_file_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nacha_file_id uuid NOT NULL REFERENCES nacha_files(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES billing_transactions(id) ON DELETE CASCADE,
  trace_number text,
  entry_status text DEFAULT 'pending', -- 'pending', 'settled', 'returned', 'corrected'
  return_code text,
  return_reason text,
  addenda_info text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(nacha_file_id, transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_nacha_file_transactions_file ON nacha_file_transactions(nacha_file_id);
CREATE INDEX IF NOT EXISTS idx_nacha_file_transactions_txn ON nacha_file_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_nacha_file_transactions_trace ON nacha_file_transactions(trace_number);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE payment_processors ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE nacha_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE nacha_file_transactions ENABLE ROW LEVEL SECURITY;

-- Payment Processors policies
DROP POLICY IF EXISTS "Users can view payment processors" ON payment_processors;
CREATE POLICY "Users can view payment processors"
  ON payment_processors FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage payment processors" ON payment_processors;
CREATE POLICY "Admins can manage payment processors"
  ON payment_processors FOR ALL
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

-- Billing Audit Log policies
DROP POLICY IF EXISTS "Users can view billing audit logs" ON billing_audit_log;
CREATE POLICY "Users can view billing audit logs"
  ON billing_audit_log FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "System can insert billing audit logs" ON billing_audit_log;
CREATE POLICY "System can insert billing audit logs"
  ON billing_audit_log FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

-- NACHA Files policies
DROP POLICY IF EXISTS "Users can view nacha files" ON nacha_files;
CREATE POLICY "Users can view nacha files"
  ON nacha_files FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage nacha files" ON nacha_files;
CREATE POLICY "Admins can manage nacha files"
  ON nacha_files FOR ALL
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

-- NACHA File Transactions policies
DROP POLICY IF EXISTS "Users can view nacha file transactions" ON nacha_file_transactions;
CREATE POLICY "Users can view nacha file transactions"
  ON nacha_file_transactions FOR SELECT
  USING (nacha_file_id IN (SELECT id FROM nacha_files WHERE organization_id = get_user_organization_id()));

DROP POLICY IF EXISTS "Admins can manage nacha file transactions" ON nacha_file_transactions;
CREATE POLICY "Admins can manage nacha file transactions"
  ON nacha_file_transactions FOR ALL
  USING (nacha_file_id IN (SELECT id FROM nacha_files WHERE organization_id = get_user_organization_id()) AND get_user_role() IN ('owner', 'admin'));

-- ============================================================================
-- AUDIT TRIGGER FUNCTIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION log_billing_transaction_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO billing_audit_log (
      organization_id, action, entity_type, entity_id, member_id, transaction_id,
      amount, details, user_id
    ) VALUES (
      NEW.organization_id,
      CASE
        WHEN NEW.status = 'success' AND OLD.status = 'pending' THEN 'payment_processed'
        WHEN NEW.status = 'success' AND OLD.status = 'failed' THEN 'payment_retry'
        WHEN NEW.status = 'refunded' THEN 'payment_refund'
        WHEN NEW.status = 'failed' THEN 'payment_declined'
        ELSE 'payment_status_change'
      END,
      'transaction',
      NEW.id,
      NEW.member_id,
      NEW.id,
      NEW.amount,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'decline_code', NEW.decline_code,
        'decline_category', NEW.decline_category
      ),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS billing_transaction_audit_trigger ON billing_transactions;
CREATE TRIGGER billing_transaction_audit_trigger
  AFTER UPDATE ON billing_transactions
  FOR EACH ROW EXECUTE FUNCTION log_billing_transaction_changes();

CREATE OR REPLACE FUNCTION log_processor_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO billing_audit_log (
    organization_id, action, entity_type, entity_id, details, user_id
  ) VALUES (
    COALESCE(NEW.organization_id, OLD.organization_id),
    CASE TG_OP
      WHEN 'INSERT' THEN 'processor_create'
      WHEN 'UPDATE' THEN 'processor_update'
      WHEN 'DELETE' THEN 'processor_delete'
    END,
    'processor',
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'name', COALESCE(NEW.name, OLD.name),
      'processor_type', COALESCE(NEW.processor_type, OLD.processor_type),
      'is_active', COALESCE(NEW.is_active, OLD.is_active),
      'environment', COALESCE(NEW.environment, OLD.environment)
    ),
    auth.uid()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS payment_processor_audit_trigger ON payment_processors;
CREATE TRIGGER payment_processor_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payment_processors
  FOR EACH ROW EXECUTE FUNCTION log_processor_changes();

CREATE OR REPLACE FUNCTION log_nacha_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO billing_audit_log (
      organization_id, action, entity_type, entity_id, amount, details, user_id
    ) VALUES (
      NEW.organization_id,
      CASE NEW.file_type WHEN 'export' THEN 'nacha_export' ELSE 'nacha_import' END,
      'nacha_file',
      NEW.id,
      NEW.total_debit_amount + NEW.total_credit_amount,
      jsonb_build_object(
        'file_name', NEW.file_name,
        'effective_date', NEW.effective_date,
        'transaction_count', NEW.transaction_count
      ),
      auth.uid()
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO billing_audit_log (
      organization_id, action, entity_type, entity_id, details, user_id
    ) VALUES (
      NEW.organization_id,
      'nacha_status_change',
      'nacha_file',
      NEW.id,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'success_count', NEW.success_count,
        'failed_count', NEW.failed_count
      ),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS nacha_file_audit_trigger ON nacha_files;
CREATE TRIGGER nacha_file_audit_trigger
  AFTER INSERT OR UPDATE ON nacha_files
  FOR EACH ROW EXECUTE FUNCTION log_nacha_changes();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get billing summary for a date range
CREATE OR REPLACE FUNCTION get_billing_summary(
  p_org_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS TABLE (
  total_collected numeric,
  total_refunded numeric,
  total_declined numeric,
  transaction_count bigint,
  success_count bigint,
  failed_count bigint,
  refund_count bigint,
  avg_transaction numeric,
  by_payment_method jsonb
) AS $$
BEGIN
  RETURN QUERY
  WITH txn_stats AS (
    SELECT
      COALESCE(SUM(CASE WHEN status = 'success' AND transaction_type = 'charge' THEN amount ELSE 0 END), 0) as collected,
      COALESCE(SUM(CASE WHEN transaction_type = 'refund' THEN amount ELSE 0 END), 0) as refunded,
      COALESCE(SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END), 0) as declined,
      COUNT(*) as total_count,
      COUNT(*) FILTER (WHERE status = 'success') as success_cnt,
      COUNT(*) FILTER (WHERE status = 'failed') as failed_cnt,
      COUNT(*) FILTER (WHERE transaction_type = 'refund') as refund_cnt,
      COALESCE(AVG(CASE WHEN status = 'success' AND transaction_type = 'charge' THEN amount END), 0) as avg_txn
    FROM billing_transactions
    WHERE organization_id = p_org_id
      AND created_at >= p_start_date
      AND created_at < p_end_date
  ),
  method_stats AS (
    SELECT jsonb_object_agg(
      COALESCE(payment_method, 'unknown'),
      jsonb_build_object(
        'count', COUNT(*),
        'amount', COALESCE(SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END), 0)
      )
    ) as by_method
    FROM billing_transactions
    WHERE organization_id = p_org_id
      AND created_at >= p_start_date
      AND created_at < p_end_date
    GROUP BY payment_method
  )
  SELECT
    ts.collected,
    ts.refunded,
    ts.declined,
    ts.total_count,
    ts.success_cnt,
    ts.failed_cnt,
    ts.refund_cnt,
    ts.avg_txn,
    COALESCE(ms.by_method, '{}'::jsonb)
  FROM txn_stats ts
  CROSS JOIN (SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb) as by_method FROM method_stats, jsonb_each(by_method)) ms;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get declined transactions for today
CREATE OR REPLACE FUNCTION get_declined_today(p_org_id uuid)
RETURNS TABLE (
  id uuid,
  member_id uuid,
  member_name text,
  member_email text,
  amount numeric,
  decline_code text,
  decline_category text,
  error_message text,
  payment_method text,
  last_four text,
  retry_count integer,
  created_at timestamptz
) AS $$
  SELECT
    t.id,
    t.member_id,
    m.first_name || ' ' || m.last_name as member_name,
    m.email as member_email,
    t.amount,
    t.decline_code,
    t.decline_category,
    t.error_message,
    pp.payment_type as payment_method,
    pp.last_four,
    t.retry_count,
    t.created_at
  FROM billing_transactions t
  LEFT JOIN members m ON m.id = t.member_id
  LEFT JOIN payment_profiles pp ON pp.id = t.payment_profile_id
  WHERE t.organization_id = p_org_id
    AND t.status = 'failed'
    AND t.created_at >= CURRENT_DATE
    AND t.created_at < CURRENT_DATE + INTERVAL '1 day'
  ORDER BY t.created_at DESC;
$$ LANGUAGE sql STABLE;

-- Get default payment processor for organization
CREATE OR REPLACE FUNCTION get_default_processor(p_org_id uuid)
RETURNS uuid AS $$
  SELECT id FROM payment_processors
  WHERE organization_id = p_org_id
    AND is_active = true
    AND is_default = true
  LIMIT 1;
$$ LANGUAGE sql STABLE;

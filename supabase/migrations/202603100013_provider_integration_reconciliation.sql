-- Migration: Phase A3 — Provider Integration + Reconciliation Layer
-- ===================================================================
-- 1. payment_providers table (org-level provider config)
-- 2. payout_provider_transactions table (per-item provider tracking)
-- 3. payout_reconciliation_logs table (expected vs actual)
-- 4. execute_payout_batch() SQL function
-- 5. record_provider_result() SQL function
-- 6. reconcile_payouts() SQL function
-- 7. RLS policies on all new tables
-- 8. Indexes + constraints for duplicate/fraud protection


-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. PAYMENT PROVIDERS (org-level configuration)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS payment_providers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider_type    text NOT NULL
                   CHECK (provider_type IN ('stripe_connect', 'ach', 'manual')),
  display_name     text NOT NULL DEFAULT '',
  is_active        boolean NOT NULL DEFAULT true,
  is_default       boolean NOT NULL DEFAULT false,
  -- Config: encrypted at rest via Supabase vault or service-only access.
  -- Contains provider-specific keys: stripe_account_id, routing_number, etc.
  -- NEVER exposed via RLS SELECT — only SECURITY DEFINER functions read this.
  config           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- One default provider per org
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_providers_org_default
  ON payment_providers (organization_id)
  WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_payment_providers_org_type
  ON payment_providers (organization_id, provider_type);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. PAYOUT PROVIDER TRANSACTIONS (per payout-item provider tracking)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS payout_provider_transactions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  payout_item_id          uuid NOT NULL REFERENCES commission_payouts(id) ON DELETE CASCADE,
  batch_id                uuid NOT NULL REFERENCES commission_payment_batches(id) ON DELETE CASCADE,
  provider_id             uuid REFERENCES payment_providers(id) ON DELETE SET NULL,
  provider_type           text NOT NULL
                          CHECK (provider_type IN ('stripe_connect', 'ach', 'manual')),
  -- Provider response
  provider_transaction_id text,          -- Stripe transfer ID, ACH trace, etc.
  idempotency_key         text NOT NULL, -- Prevents duplicate provider calls
  amount                  numeric(12,2) NOT NULL,
  currency                text NOT NULL DEFAULT 'usd',
  -- Status tracking
  status                  text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'submitted', 'succeeded', 'failed', 'reversed')),
  failure_reason          text,
  failure_code            text,
  -- Raw provider response (PII-safe: no bank details)
  raw_response            jsonb DEFAULT '{}'::jsonb,
  -- Timestamps
  submitted_at            timestamptz,
  completed_at            timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- CRITICAL: One provider transaction per payout item — prevents double execution
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_txn_payout_item
  ON payout_provider_transactions (payout_item_id)
  WHERE status <> 'failed';  -- Allow retry after failure

-- Prevent duplicate provider transaction IDs within an org
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_txn_provider_id
  ON payout_provider_transactions (organization_id, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

-- Idempotency key uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_txn_idempotency
  ON payout_provider_transactions (idempotency_key);

CREATE INDEX IF NOT EXISTS idx_provider_txn_batch
  ON payout_provider_transactions (batch_id);

CREATE INDEX IF NOT EXISTS idx_provider_txn_status
  ON payout_provider_transactions (status);

CREATE INDEX IF NOT EXISTS idx_provider_txn_org_created
  ON payout_provider_transactions (organization_id, created_at DESC);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. PAYOUT RECONCILIATION LOGS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS payout_reconciliation_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  batch_id          uuid NOT NULL REFERENCES commission_payment_batches(id) ON DELETE CASCADE,
  payout_item_id    uuid NOT NULL REFERENCES commission_payouts(id) ON DELETE CASCADE,
  provider_txn_id   uuid REFERENCES payout_provider_transactions(id) ON DELETE SET NULL,
  -- Amounts
  expected_amount   numeric(12,2) NOT NULL,
  actual_amount     numeric(12,2),
  -- Flags
  discrepancy_flag  boolean NOT NULL DEFAULT false,
  discrepancy_type  text CHECK (discrepancy_type IN (
    'amount_mismatch', 'missing_provider_txn', 'status_mismatch',
    'unexpected_reversal', 'timeout', NULL
  )),
  -- Status
  expected_status   text,
  actual_status     text,
  -- Resolution
  resolved          boolean NOT NULL DEFAULT false,
  resolved_by       uuid REFERENCES profiles(id),
  resolved_at       timestamptz,
  resolution_notes  text,
  -- Context
  details           jsonb DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_batch
  ON payout_reconciliation_logs (batch_id);

CREATE INDEX IF NOT EXISTS idx_reconciliation_discrepancy
  ON payout_reconciliation_logs (organization_id, discrepancy_flag)
  WHERE discrepancy_flag = true;

CREATE INDEX IF NOT EXISTS idx_reconciliation_org_created
  ON payout_reconciliation_logs (organization_id, created_at DESC);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. EXECUTE PAYOUT BATCH (DB-side orchestration)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Creates provider transaction records for each payout item in a batch.
-- The actual provider call happens in the service layer (TypeScript).
-- This function:
--   a) Validates batch state
--   b) Creates pending provider_transaction records
--   c) Returns the list of items to process
-- The service layer then calls each provider and updates via record_provider_result().

CREATE OR REPLACE FUNCTION execute_payout_batch(
  p_batch_id     uuid,
  p_provider_id  uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch           record;
  v_provider        record;
  v_payout_row      record;
  v_txn_id          uuid;
  v_items           jsonb := '[]'::jsonb;
  v_item_count      int := 0;
  v_already_exists  int;
BEGIN
  -- Lock the batch
  SELECT * INTO v_batch
  FROM commission_payment_batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF v_batch IS NULL THEN
    RETURN jsonb_build_object('error', 'Batch not found');
  END IF;

  -- Must be in processing state (approved)
  IF v_batch.status <> 'processing' THEN
    RETURN jsonb_build_object(
      'error', 'Batch must be in processing state. Current: ' || v_batch.status,
      'code', 'INVALID_STATE'
    );
  END IF;

  -- Check for already-completed execution (idempotency)
  IF v_batch.status = 'paid' THEN
    RETURN jsonb_build_object(
      'batch_id', p_batch_id,
      'status', 'paid',
      'already_completed', true
    );
  END IF;

  -- Resolve provider
  IF p_provider_id IS NOT NULL THEN
    SELECT * INTO v_provider
    FROM payment_providers
    WHERE id = p_provider_id
      AND organization_id = v_batch.organization_id
      AND is_active = true;
  ELSE
    -- Use org default provider
    SELECT * INTO v_provider
    FROM payment_providers
    WHERE organization_id = v_batch.organization_id
      AND is_default = true
      AND is_active = true;
  END IF;

  -- Fallback to manual if no provider configured
  IF v_provider IS NULL THEN
    -- Auto-create manual provider for this org
    INSERT INTO payment_providers (organization_id, provider_type, display_name, is_active, is_default)
    VALUES (v_batch.organization_id, 'manual', 'Manual Processing', true, true)
    ON CONFLICT DO NOTHING;

    SELECT * INTO v_provider
    FROM payment_providers
    WHERE organization_id = v_batch.organization_id
      AND is_default = true
      AND is_active = true;
  END IF;

  -- Create provider transaction records for each payout item
  FOR v_payout_row IN
    SELECT cp.id AS payout_id, cp.advisor_id, cp.net_payout
    FROM commission_payouts cp
    WHERE cp.id IN (
      SELECT DISTINCT payout_id FROM commission_ledger
      WHERE payout_batch_id = p_batch_id AND payout_id IS NOT NULL
    )
    AND cp.status = 'processing'
  LOOP
    -- Check if a non-failed transaction already exists (idempotency)
    SELECT count(*) INTO v_already_exists
    FROM payout_provider_transactions
    WHERE payout_item_id = v_payout_row.payout_id
      AND status <> 'failed';

    IF v_already_exists > 0 THEN
      CONTINUE; -- Skip — already has a pending/submitted/succeeded transaction
    END IF;

    -- Generate idempotency key: batch_id + payout_id + attempt
    INSERT INTO payout_provider_transactions (
      organization_id, payout_item_id, batch_id,
      provider_id, provider_type,
      idempotency_key, amount, currency, status
    ) VALUES (
      v_batch.organization_id,
      v_payout_row.payout_id,
      p_batch_id,
      v_provider.id,
      v_provider.provider_type,
      p_batch_id::text || ':' || v_payout_row.payout_id::text || ':' ||
        (SELECT count(*) + 1 FROM payout_provider_transactions WHERE payout_item_id = v_payout_row.payout_id),
      v_payout_row.net_payout,
      'usd',
      'pending'
    )
    RETURNING id INTO v_txn_id;

    v_items := v_items || jsonb_build_object(
      'txn_id', v_txn_id,
      'payout_item_id', v_payout_row.payout_id,
      'advisor_id', v_payout_row.advisor_id,
      'amount', v_payout_row.net_payout,
      'provider_type', v_provider.provider_type
    );

    v_item_count := v_item_count + 1;
  END LOOP;

  -- Log to payout_batch_logs
  INSERT INTO payout_batch_logs (
    organization_id, batch_id, action,
    actor_type, prev_status, new_status, details
  ) VALUES (
    v_batch.organization_id, p_batch_id, 'processing',
    'system', 'processing', 'processing',
    jsonb_build_object(
      'provider_type', v_provider.provider_type,
      'provider_id', v_provider.id,
      'items_to_process', v_item_count
    )
  );

  -- Audit log
  INSERT INTO payout_audit_log (
    organization_id, event_type, entity_type, entity_id,
    actor_type, amount, details
  ) VALUES (
    v_batch.organization_id, 'batch_processing', 'commission_payment_batch', p_batch_id,
    'system', v_batch.total_amount,
    jsonb_build_object(
      'provider_type', v_provider.provider_type,
      'items_to_process', v_item_count
    )
  );

  RETURN jsonb_build_object(
    'batch_id', p_batch_id,
    'provider_id', v_provider.id,
    'provider_type', v_provider.provider_type,
    'items', v_items,
    'item_count', v_item_count
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. RECORD PROVIDER RESULT (called from service layer after provider call)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION record_provider_result(
  p_txn_id                uuid,
  p_status                text,      -- 'submitted', 'succeeded', 'failed'
  p_provider_txn_id       text DEFAULT NULL,
  p_raw_response          jsonb DEFAULT '{}'::jsonb,
  p_failure_reason        text DEFAULT NULL,
  p_failure_code          text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_txn    record;
  v_batch  record;
BEGIN
  -- Lock the transaction row
  SELECT * INTO v_txn
  FROM payout_provider_transactions
  WHERE id = p_txn_id
  FOR UPDATE;

  IF v_txn IS NULL THEN
    RETURN jsonb_build_object('error', 'Provider transaction not found');
  END IF;

  -- Idempotency: already in terminal state
  IF v_txn.status IN ('succeeded', 'reversed') THEN
    RETURN jsonb_build_object(
      'txn_id', p_txn_id,
      'status', v_txn.status,
      'already_terminal', true
    );
  END IF;

  -- Update the provider transaction
  UPDATE payout_provider_transactions
  SET status = p_status,
      provider_transaction_id = COALESCE(p_provider_txn_id, provider_transaction_id),
      raw_response = p_raw_response,
      failure_reason = p_failure_reason,
      failure_code = p_failure_code,
      submitted_at = CASE WHEN p_status = 'submitted' THEN now() ELSE submitted_at END,
      completed_at = CASE WHEN p_status IN ('succeeded', 'failed') THEN now() ELSE completed_at END,
      updated_at = now()
  WHERE id = p_txn_id;

  -- If succeeded, update payout item status
  IF p_status = 'succeeded' THEN
    UPDATE commission_payouts
    SET payment_reference = p_provider_txn_id,
        payment_method = v_txn.provider_type,
        updated_at = now()
    WHERE id = v_txn.payout_item_id;
  END IF;

  -- If failed, update payout item
  IF p_status = 'failed' THEN
    UPDATE commission_payouts
    SET notes = COALESCE(notes || '; ', '') || 'Provider error: ' || COALESCE(p_failure_reason, 'unknown'),
        updated_at = now()
    WHERE id = v_txn.payout_item_id;
  END IF;

  -- Check if all items in the batch are now terminal
  SELECT * INTO v_batch
  FROM commission_payment_batches
  WHERE id = v_txn.batch_id;

  DECLARE
    v_total     int;
    v_succeeded int;
    v_failed    int;
  BEGIN
    SELECT
      count(*),
      count(*) FILTER (WHERE status = 'succeeded'),
      count(*) FILTER (WHERE status = 'failed')
    INTO v_total, v_succeeded, v_failed
    FROM payout_provider_transactions
    WHERE batch_id = v_txn.batch_id;

    -- All items processed?
    IF (v_succeeded + v_failed) = v_total AND v_total > 0 THEN
      IF v_failed = 0 THEN
        -- All succeeded → mark batch paid
        PERFORM mark_payout_paid(v_txn.batch_id);
      ELSE
        -- Partial or full failure
        INSERT INTO payout_batch_logs (
          organization_id, batch_id, action,
          actor_type, prev_status, new_status, details
        ) VALUES (
          v_batch.organization_id, v_txn.batch_id, 'processing',
          'system', 'processing', 'processing',
          jsonb_build_object(
            'note', 'Partial execution complete',
            'succeeded', v_succeeded,
            'failed', v_failed,
            'total', v_total
          )
        );
      END IF;
    END IF;
  END;

  RETURN jsonb_build_object(
    'txn_id', p_txn_id,
    'payout_item_id', v_txn.payout_item_id,
    'status', p_status,
    'provider_transaction_id', p_provider_txn_id
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. RECONCILIATION FUNCTION
-- ═══════════════════════════════════════════════════════════════════════════════
-- Compares expected payout amounts/statuses against provider transaction records.
-- Flags mismatches for manual review.

CREATE OR REPLACE FUNCTION reconcile_payouts(
  p_batch_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch        record;
  v_row          record;
  v_total        int := 0;
  v_matched      int := 0;
  v_discrepancy  int := 0;
  v_missing      int := 0;
BEGIN
  SELECT * INTO v_batch
  FROM commission_payment_batches
  WHERE id = p_batch_id;

  IF v_batch IS NULL THEN
    RETURN jsonb_build_object('error', 'Batch not found');
  END IF;

  -- Compare each payout item against its provider transaction
  FOR v_row IN
    SELECT
      cp.id AS payout_item_id,
      cp.net_payout AS expected_amount,
      cp.status AS payout_status,
      pt.id AS provider_txn_id,
      pt.amount AS provider_amount,
      pt.status AS provider_status,
      pt.provider_transaction_id
    FROM commission_payouts cp
    LEFT JOIN payout_provider_transactions pt
      ON pt.payout_item_id = cp.id
      AND pt.status <> 'failed'
    WHERE cp.id IN (
      SELECT DISTINCT payout_id FROM commission_ledger
      WHERE payout_batch_id = p_batch_id AND payout_id IS NOT NULL
    )
  LOOP
    v_total := v_total + 1;

    IF v_row.provider_txn_id IS NULL THEN
      -- No provider transaction found
      INSERT INTO payout_reconciliation_logs (
        organization_id, batch_id, payout_item_id,
        expected_amount, discrepancy_flag, discrepancy_type,
        expected_status, actual_status, details
      ) VALUES (
        v_batch.organization_id, p_batch_id, v_row.payout_item_id,
        v_row.expected_amount, true, 'missing_provider_txn',
        v_row.payout_status, NULL,
        jsonb_build_object('note', 'No provider transaction record found')
      );
      v_missing := v_missing + 1;

    ELSIF v_row.expected_amount <> v_row.provider_amount THEN
      -- Amount mismatch
      INSERT INTO payout_reconciliation_logs (
        organization_id, batch_id, payout_item_id, provider_txn_id,
        expected_amount, actual_amount,
        discrepancy_flag, discrepancy_type,
        expected_status, actual_status, details
      ) VALUES (
        v_batch.organization_id, p_batch_id, v_row.payout_item_id, v_row.provider_txn_id,
        v_row.expected_amount, v_row.provider_amount,
        true, 'amount_mismatch',
        v_row.payout_status, v_row.provider_status,
        jsonb_build_object(
          'difference', v_row.expected_amount - v_row.provider_amount,
          'provider_transaction_id', v_row.provider_transaction_id
        )
      );
      v_discrepancy := v_discrepancy + 1;

    ELSIF v_row.payout_status = 'paid' AND v_row.provider_status <> 'succeeded' THEN
      -- Status mismatch: payout says paid but provider hasn't confirmed
      INSERT INTO payout_reconciliation_logs (
        organization_id, batch_id, payout_item_id, provider_txn_id,
        expected_amount, actual_amount,
        discrepancy_flag, discrepancy_type,
        expected_status, actual_status, details
      ) VALUES (
        v_batch.organization_id, p_batch_id, v_row.payout_item_id, v_row.provider_txn_id,
        v_row.expected_amount, v_row.provider_amount,
        true, 'status_mismatch',
        v_row.payout_status, v_row.provider_status,
        jsonb_build_object(
          'provider_transaction_id', v_row.provider_transaction_id,
          'note', 'Payout marked paid but provider has not confirmed'
        )
      );
      v_discrepancy := v_discrepancy + 1;

    ELSE
      -- All good
      INSERT INTO payout_reconciliation_logs (
        organization_id, batch_id, payout_item_id, provider_txn_id,
        expected_amount, actual_amount,
        discrepancy_flag,
        expected_status, actual_status
      ) VALUES (
        v_batch.organization_id, p_batch_id, v_row.payout_item_id, v_row.provider_txn_id,
        v_row.expected_amount, v_row.provider_amount,
        false,
        v_row.payout_status, v_row.provider_status
      );
      v_matched := v_matched + 1;
    END IF;
  END LOOP;

  -- Log reconciliation run
  INSERT INTO payout_audit_log (
    organization_id, event_type, entity_type, entity_id,
    actor_type, details
  ) VALUES (
    v_batch.organization_id, 'batch_reconciled', 'commission_payment_batch', p_batch_id,
    'system',
    jsonb_build_object(
      'total_items', v_total,
      'matched', v_matched,
      'discrepancies', v_discrepancy,
      'missing', v_missing,
      'batch_number', v_batch.batch_number
    )
  );

  RETURN jsonb_build_object(
    'batch_id', p_batch_id,
    'batch_number', v_batch.batch_number,
    'total_items', v_total,
    'matched', v_matched,
    'discrepancies', v_discrepancy,
    'missing_provider_txn', v_missing,
    'reconciled_at', now()
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. ADD 'batch_reconciled' TO PAYOUT AUDIT LOG CHECK CONSTRAINT
-- ═══════════════════════════════════════════════════════════════════════════════

-- Drop and recreate the event_type check to include new events
ALTER TABLE payout_audit_log DROP CONSTRAINT IF EXISTS payout_audit_log_event_type_check;
ALTER TABLE payout_audit_log ADD CONSTRAINT payout_audit_log_event_type_check
  CHECK (event_type IN (
    'batch_created', 'batch_approved', 'batch_processing',
    'batch_paid', 'batch_failed', 'batch_cancelled', 'batch_reconciled',
    'item_created', 'item_approved', 'item_paid', 'item_failed',
    'ledger_scheduled', 'ledger_paid', 'ledger_reversed', 'ledger_held',
    'reversal_created', 'clawback_created', 'clawback_applied',
    'export_requested', 'export_completed',
    'fraud_flag_raised', 'fraud_flag_resolved',
    'approval_blocked', 'threshold_exceeded',
    'provider_submitted', 'provider_succeeded', 'provider_failed', 'provider_webhook'
  ));


-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════

-- payment_providers: admin can see metadata, NEVER config (secrets)
ALTER TABLE payment_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_providers_select" ON payment_providers
  FOR SELECT USING (
    organization_id = (SELECT get_user_organization_id())
    AND get_user_role() IN ('owner', 'super_admin', 'admin')
  );

CREATE POLICY "admin_providers_insert" ON payment_providers
  FOR INSERT WITH CHECK (
    organization_id = (SELECT get_user_organization_id())
    AND get_user_role() IN ('owner', 'super_admin')
  );

CREATE POLICY "admin_providers_update" ON payment_providers
  FOR UPDATE USING (
    organization_id = (SELECT get_user_organization_id())
    AND get_user_role() IN ('owner', 'super_admin')
  );

-- payout_provider_transactions: admin read-only
ALTER TABLE payout_provider_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_provider_txn_select" ON payout_provider_transactions
  FOR SELECT USING (
    organization_id = (SELECT get_user_organization_id())
    AND get_user_role() IN ('owner', 'super_admin', 'admin')
  );

-- payout_reconciliation_logs: admin read-only
ALTER TABLE payout_reconciliation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_reconciliation_select" ON payout_reconciliation_logs
  FOR SELECT USING (
    organization_id = (SELECT get_user_organization_id())
    AND get_user_role() IN ('owner', 'super_admin', 'admin')
  );

CREATE POLICY "admin_reconciliation_update" ON payout_reconciliation_logs
  FOR UPDATE USING (
    organization_id = (SELECT get_user_organization_id())
    AND get_user_role() IN ('owner', 'super_admin', 'admin')
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE — Phase A3 Provider Integration + Reconciliation
-- ═══════════════════════════════════════════════════════════════════════════════

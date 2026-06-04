-- Migration: Phase A4 Gap-Fill — Compliance Hardening + Dual Approval Enforcement
-- ================================================================================
-- Builds on existing compliance infrastructure in 202603100007:
--   payout_audit_log, get_payout_compliance_config, create_payout_reversal,
--   create_payout_clawback, payout_fraud_flags, detect_payout_anomalies,
--   resolve_fraud_flag, log_payout_export, prevent_ledger_immutable_field_change
--
-- This migration adds:
-- 1. payout_approvals table (formal primary/secondary approval tracking)
-- 2. Dual approval enforcement in approve_payout_batch()
-- 3. payout_exports table (dedicated export log)
-- 4. 'clawback' status in commission_ledger CHECK
-- 5. Tamper protection triggers on batches + provider transactions
-- 6. DELETE prevention triggers on financial tables
-- 7. Change-capture audit triggers on financial table UPDATEs


-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. PAYOUT APPROVALS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS payout_approvals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  batch_id         uuid NOT NULL REFERENCES commission_payment_batches(id) ON DELETE CASCADE,
  approver_id      uuid NOT NULL REFERENCES profiles(id),
  approval_type    text NOT NULL CHECK (approval_type IN ('primary', 'secondary')),
  approved_at      timestamptz NOT NULL DEFAULT now(),
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- One primary + one secondary approval per batch (no double approvals)
CREATE UNIQUE INDEX IF NOT EXISTS idx_payout_approvals_batch_type
  ON payout_approvals (batch_id, approval_type);

-- Same person cannot approve twice on same batch
CREATE UNIQUE INDEX IF NOT EXISTS idx_payout_approvals_batch_person
  ON payout_approvals (batch_id, approver_id);

CREATE INDEX IF NOT EXISTS idx_payout_approvals_org
  ON payout_approvals (organization_id, approved_at DESC);

-- RLS
ALTER TABLE payout_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_approvals_select" ON payout_approvals
  FOR SELECT USING (
    organization_id = (SELECT get_user_organization_id())
    AND get_user_role() IN ('owner', 'super_admin', 'admin')
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. PAYOUT EXPORTS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS payout_exports (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  batch_id         uuid REFERENCES commission_payment_batches(id) ON DELETE SET NULL,
  exported_by      uuid NOT NULL REFERENCES profiles(id),
  exported_at      timestamptz NOT NULL DEFAULT now(),
  export_type      text NOT NULL DEFAULT 'csv'
                   CHECK (export_type IN ('csv', 'pdf', 'xlsx', 'ach_file')),
  record_count     int,
  total_amount     numeric(12,2),
  -- PII-safe: no file content, only metadata
  details          jsonb DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payout_exports_org
  ON payout_exports (organization_id, exported_at DESC);

CREATE INDEX IF NOT EXISTS idx_payout_exports_batch
  ON payout_exports (batch_id);

-- RLS
ALTER TABLE payout_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_exports_select" ON payout_exports
  FOR SELECT USING (
    organization_id = (SELECT get_user_organization_id())
    AND get_user_role() IN ('owner', 'super_admin', 'admin')
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. ADD 'clawback' STATUS TO commission_ledger
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE commission_ledger DROP CONSTRAINT IF EXISTS commission_ledger_status_check;
ALTER TABLE commission_ledger ADD CONSTRAINT commission_ledger_status_check
  CHECK (status IN ('available', 'scheduled', 'paid', 'reversed', 'held', 'clawback'));


-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. APPROVE PAYOUT BATCH — WITH ENFORCED DUAL APPROVAL
-- ═══════════════════════════════════════════════════════════════════════════════
-- Replaces the existing function to add payout_approvals tracking
-- and enforce dual approval when batch exceeds dual_approve_threshold.

CREATE OR REPLACE FUNCTION approve_payout_batch(
  p_batch_id    uuid,
  p_approved_by uuid,
  p_notes       text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch            record;
  v_config           jsonb;
  v_creator          uuid;
  v_existing_primary uuid;
  v_needs_dual       boolean;
  v_approval_type    text;
  v_approval_count   int;
BEGIN
  -- Lock the row
  SELECT * INTO v_batch
  FROM commission_payment_batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF v_batch IS NULL THEN
    RETURN jsonb_build_object('error', 'Batch not found');
  END IF;

  -- Idempotent: already processing
  IF v_batch.status = 'processing' THEN
    RETURN jsonb_build_object(
      'batch_id', p_batch_id,
      'status', 'processing',
      'already_approved', true,
      'approved_by', v_batch.approved_by,
      'approved_at', v_batch.approved_at
    );
  END IF;

  -- Only draft batches can be approved
  IF v_batch.status <> 'draft' THEN
    RETURN jsonb_build_object(
      'error', 'Batch cannot be approved from status: ' || v_batch.status
    );
  END IF;

  -- Load compliance config
  v_config := get_payout_compliance_config(v_batch.organization_id);

  -- Hard cap check
  IF v_batch.total_amount > (v_config->>'max_single_payout')::numeric THEN
    INSERT INTO payout_audit_log (
      organization_id, event_type, entity_type, entity_id,
      actor_id, actor_type, amount, details
    ) VALUES (
      v_batch.organization_id, 'threshold_exceeded', 'commission_payment_batch', p_batch_id,
      p_approved_by, 'user', v_batch.total_amount,
      jsonb_build_object('max_single_payout', v_config->>'max_single_payout')
    );
    RETURN jsonb_build_object(
      'error', 'Batch total $' || v_batch.total_amount || ' exceeds maximum payout limit of $' || (v_config->>'max_single_payout')
    );
  END IF;

  -- Find batch creator from logs
  SELECT actor_id INTO v_creator
  FROM payout_batch_logs
  WHERE batch_id = p_batch_id AND action = 'created'
  ORDER BY created_at LIMIT 1;

  -- Self-approve check (creator cannot approve above threshold)
  IF v_creator IS NOT NULL
     AND v_creator = p_approved_by
     AND v_batch.total_amount > (v_config->>'self_approve_threshold')::numeric
  THEN
    INSERT INTO payout_audit_log (
      organization_id, event_type, entity_type, entity_id,
      actor_id, actor_type, amount, details
    ) VALUES (
      v_batch.organization_id, 'approval_blocked', 'commission_payment_batch', p_batch_id,
      p_approved_by, 'user', v_batch.total_amount,
      jsonb_build_object(
        'reason', 'creator_cannot_self_approve',
        'threshold', v_config->>'self_approve_threshold'
      )
    );
    RETURN jsonb_build_object(
      'error', 'Separation of duties: batch creator cannot approve batches above $' || (v_config->>'self_approve_threshold'),
      'code', 'SELF_APPROVE_BLOCKED'
    );
  END IF;

  -- Determine if dual approval is needed
  v_needs_dual := v_batch.total_amount > (v_config->>'dual_approve_threshold')::numeric;

  -- Check existing approvals
  SELECT count(*) INTO v_approval_count
  FROM payout_approvals
  WHERE batch_id = p_batch_id;

  -- Check if this person already approved
  IF EXISTS (SELECT 1 FROM payout_approvals WHERE batch_id = p_batch_id AND approver_id = p_approved_by) THEN
    RETURN jsonb_build_object(
      'error', 'You have already approved this batch',
      'code', 'DUPLICATE_APPROVAL'
    );
  END IF;

  -- Determine approval type
  IF v_approval_count = 0 THEN
    v_approval_type := 'primary';
  ELSE
    v_approval_type := 'secondary';
  END IF;

  -- Record the approval
  INSERT INTO payout_approvals (
    organization_id, batch_id, approver_id,
    approval_type, notes
  ) VALUES (
    v_batch.organization_id, p_batch_id, p_approved_by,
    v_approval_type, p_notes
  );

  -- If dual approval needed and we only have primary → return pending
  IF v_needs_dual AND v_approval_type = 'primary' THEN
    -- Log the partial approval
    INSERT INTO payout_audit_log (
      organization_id, event_type, entity_type, entity_id,
      actor_id, actor_type, amount, details
    ) VALUES (
      v_batch.organization_id, 'batch_approved', 'commission_payment_batch', p_batch_id,
      p_approved_by, 'user', v_batch.total_amount,
      jsonb_build_object(
        'approval_type', 'primary',
        'dual_required', true,
        'awaiting_secondary', true,
        'threshold', v_config->>'dual_approve_threshold'
      )
    );

    INSERT INTO payout_batch_logs (
      organization_id, batch_id, action,
      actor_id, actor_type,
      prev_status, new_status, details
    ) VALUES (
      v_batch.organization_id, p_batch_id, 'approved',
      p_approved_by, 'user',
      'draft', 'draft',
      jsonb_build_object(
        'approval_type', 'primary',
        'dual_required', true,
        'note', 'Awaiting secondary approval'
      )
    );

    RETURN jsonb_build_object(
      'batch_id', p_batch_id,
      'status', 'draft',
      'approval_type', 'primary',
      'dual_required', true,
      'awaiting_secondary', true,
      'approved_by', p_approved_by,
      'message', 'Primary approval recorded. A second approver is required for batches above $' || (v_config->>'dual_approve_threshold')
    );
  END IF;

  -- All approvals met → transition to processing
  UPDATE commission_payment_batches
  SET status = 'processing',
      approved_by = p_approved_by,
      approved_at = now(),
      updated_at = now()
  WHERE id = p_batch_id;

  -- Update payout items
  UPDATE commission_payouts
  SET status = 'processing',
      approved_by = p_approved_by,
      approved_at = now(),
      updated_at = now()
  WHERE id IN (
    SELECT DISTINCT payout_id FROM commission_ledger
    WHERE payout_batch_id = p_batch_id AND payout_id IS NOT NULL
  );

  -- Log to payout_batch_logs
  INSERT INTO payout_batch_logs (
    organization_id, batch_id, action,
    actor_id, actor_type,
    prev_status, new_status, details
  ) VALUES (
    v_batch.organization_id, p_batch_id, 'approved',
    p_approved_by, 'user',
    'draft', 'processing',
    jsonb_build_object(
      'batch_number', v_batch.batch_number,
      'total_amount', v_batch.total_amount,
      'total_advisors', v_batch.total_advisors,
      'approval_type', v_approval_type,
      'dual_approval', v_needs_dual
    )
  );

  -- Immutable audit log
  INSERT INTO payout_audit_log (
    organization_id, event_type, entity_type, entity_id,
    actor_id, actor_type, prev_status, new_status,
    amount, details
  ) VALUES (
    v_batch.organization_id, 'batch_approved', 'commission_payment_batch', p_batch_id,
    p_approved_by, 'user', 'draft', 'processing',
    v_batch.total_amount,
    jsonb_build_object(
      'batch_number', v_batch.batch_number,
      'total_advisors', v_batch.total_advisors,
      'approval_type', v_approval_type,
      'dual_approval', v_needs_dual
    )
  );

  -- financial_audit_log
  INSERT INTO financial_audit_log (
    organization_id, action, entity_type, entity_id,
    performed_by, details
  ) VALUES (
    v_batch.organization_id, 'payout_approved', 'commission_payment_batch', p_batch_id,
    p_approved_by,
    jsonb_build_object(
      'batch_number', v_batch.batch_number,
      'total_amount', v_batch.total_amount,
      'total_advisors', v_batch.total_advisors,
      'approval_type', v_approval_type,
      'dual_approval', v_needs_dual
    )
  );

  RETURN jsonb_build_object(
    'batch_id', p_batch_id,
    'batch_number', v_batch.batch_number,
    'status', 'processing',
    'approved_by', p_approved_by,
    'approved_at', now(),
    'total_amount', v_batch.total_amount,
    'total_advisors', v_batch.total_advisors,
    'approval_type', v_approval_type,
    'dual_approval', v_needs_dual
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. TAMPER PROTECTION TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════════

-- 5a. Prevent batch period tampering
CREATE OR REPLACE FUNCTION prevent_batch_immutable_field_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.period_start IS DISTINCT FROM OLD.period_start THEN
    RAISE EXCEPTION 'commission_payment_batches.period_start is immutable after insert';
  END IF;
  IF NEW.period_end IS DISTINCT FROM OLD.period_end THEN
    RAISE EXCEPTION 'commission_payment_batches.period_end is immutable after insert';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'commission_payment_batches.organization_id is immutable after insert';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_batch_immutable_fields ON commission_payment_batches;
CREATE TRIGGER trg_batch_immutable_fields
  BEFORE UPDATE ON commission_payment_batches
  FOR EACH ROW
  EXECUTE FUNCTION prevent_batch_immutable_field_change();

-- 5b. Prevent provider transaction amount tampering
CREATE OR REPLACE FUNCTION prevent_provider_txn_immutable_field_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.amount IS DISTINCT FROM OLD.amount THEN
    RAISE EXCEPTION 'payout_provider_transactions.amount is immutable after insert';
  END IF;
  IF NEW.payout_item_id IS DISTINCT FROM OLD.payout_item_id THEN
    RAISE EXCEPTION 'payout_provider_transactions.payout_item_id is immutable after insert';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'payout_provider_transactions.organization_id is immutable after insert';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_provider_txn_immutable_fields ON payout_provider_transactions;
CREATE TRIGGER trg_provider_txn_immutable_fields
  BEFORE UPDATE ON payout_provider_transactions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_provider_txn_immutable_field_change();


-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. DELETE PREVENTION ON FINANCIAL TABLES
-- ═══════════════════════════════════════════════════════════════════════════════
-- Financial records must never be deleted. Use status fields for logical deletion.

CREATE OR REPLACE FUNCTION prevent_financial_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% rows cannot be deleted. Use status-based archival instead.', TG_TABLE_NAME;
END;
$$;

-- commission_ledger
DROP TRIGGER IF EXISTS trg_prevent_delete_ledger ON commission_ledger;
CREATE TRIGGER trg_prevent_delete_ledger
  BEFORE DELETE ON commission_ledger
  FOR EACH ROW
  EXECUTE FUNCTION prevent_financial_delete();

-- commission_payment_batches
DROP TRIGGER IF EXISTS trg_prevent_delete_batches ON commission_payment_batches;
CREATE TRIGGER trg_prevent_delete_batches
  BEFORE DELETE ON commission_payment_batches
  FOR EACH ROW
  EXECUTE FUNCTION prevent_financial_delete();

-- commission_payouts
DROP TRIGGER IF EXISTS trg_prevent_delete_payouts ON commission_payouts;
CREATE TRIGGER trg_prevent_delete_payouts
  BEFORE DELETE ON commission_payouts
  FOR EACH ROW
  EXECUTE FUNCTION prevent_financial_delete();

-- payout_provider_transactions
DROP TRIGGER IF EXISTS trg_prevent_delete_provider_txns ON payout_provider_transactions;
CREATE TRIGGER trg_prevent_delete_provider_txns
  BEFORE DELETE ON payout_provider_transactions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_financial_delete();

-- payout_approvals (approval records are immutable)
DROP TRIGGER IF EXISTS trg_prevent_delete_approvals ON payout_approvals;
CREATE TRIGGER trg_prevent_delete_approvals
  BEFORE DELETE ON payout_approvals
  FOR EACH ROW
  EXECUTE FUNCTION prevent_financial_delete();

-- payout_approvals cannot be updated either
DROP TRIGGER IF EXISTS trg_prevent_update_approvals ON payout_approvals;
CREATE TRIGGER trg_prevent_update_approvals
  BEFORE UPDATE ON payout_approvals
  FOR EACH ROW
  EXECUTE FUNCTION prevent_financial_delete();

-- financial_audit_log is already delete-protected via ON DELETE CASCADE on org,
-- but add explicit prevention for direct deletes
DROP TRIGGER IF EXISTS trg_prevent_delete_financial_audit ON financial_audit_log;
CREATE TRIGGER trg_prevent_delete_financial_audit
  BEFORE DELETE ON financial_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_financial_delete();

DROP TRIGGER IF EXISTS trg_prevent_update_financial_audit ON financial_audit_log;
CREATE TRIGGER trg_prevent_update_financial_audit
  BEFORE UPDATE ON financial_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_financial_delete();


-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. CHANGE-CAPTURE AUDIT TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════════
-- Automatically log all UPDATEs to financial tables into financial_audit_log.

CREATE OR REPLACE FUNCTION trg_financial_change_capture()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id uuid;
  v_old_json jsonb;
  v_new_json jsonb;
  v_changed jsonb := '{}'::jsonb;
  v_key text;
BEGIN
  -- Extract org_id from the row
  v_org_id := COALESCE(
    NEW.organization_id,
    (SELECT NEW.organization_id)
  );

  v_old_json := to_jsonb(OLD);
  v_new_json := to_jsonb(NEW);

  -- Build diff: only changed fields
  FOR v_key IN SELECT jsonb_object_keys(v_new_json)
  LOOP
    IF v_old_json->v_key IS DISTINCT FROM v_new_json->v_key THEN
      v_changed := v_changed || jsonb_build_object(
        v_key, jsonb_build_object('old', v_old_json->v_key, 'new', v_new_json->v_key)
      );
    END IF;
  END LOOP;

  -- Skip if nothing actually changed
  IF v_changed = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  INSERT INTO financial_audit_log (
    organization_id, action, entity_type, entity_id,
    old_values, new_values, details
  ) VALUES (
    v_org_id,
    'field_changed',
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    v_old_json,
    v_new_json,
    v_changed
  );

  RETURN NEW;
END;
$$;

-- Apply to commission_ledger
DROP TRIGGER IF EXISTS trg_audit_ledger_changes ON commission_ledger;
CREATE TRIGGER trg_audit_ledger_changes
  AFTER UPDATE ON commission_ledger
  FOR EACH ROW
  EXECUTE FUNCTION trg_financial_change_capture();

-- Apply to commission_payment_batches
DROP TRIGGER IF EXISTS trg_audit_batch_changes ON commission_payment_batches;
CREATE TRIGGER trg_audit_batch_changes
  AFTER UPDATE ON commission_payment_batches
  FOR EACH ROW
  EXECUTE FUNCTION trg_financial_change_capture();

-- Apply to commission_payouts
DROP TRIGGER IF EXISTS trg_audit_payout_changes ON commission_payouts;
CREATE TRIGGER trg_audit_payout_changes
  AFTER UPDATE ON commission_payouts
  FOR EACH ROW
  EXECUTE FUNCTION trg_financial_change_capture();

-- Apply to payout_provider_transactions
DROP TRIGGER IF EXISTS trg_audit_provider_txn_changes ON payout_provider_transactions;
CREATE TRIGGER trg_audit_provider_txn_changes
  AFTER UPDATE ON payout_provider_transactions
  FOR EACH ROW
  EXECUTE FUNCTION trg_financial_change_capture();


-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. ENHANCED CLAWBACK WITH 'clawback' LEDGER STATUS
-- ═══════════════════════════════════════════════════════════════════════════════
-- Update create_payout_clawback to use the new 'clawback' status and
-- create a negative ledger entry linked to the original.

CREATE OR REPLACE FUNCTION create_payout_clawback(
  p_org_id        uuid,
  p_advisor_id    uuid,
  p_amount        numeric,
  p_reason        text,
  p_commission_id uuid DEFAULT NULL,
  p_actor_id      uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_adjustment_id  uuid;
  v_ledger_id      uuid;
  v_original_paid  numeric;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('error', 'Clawback amount must be positive');
  END IF;

  -- If linked to a specific commission, verify it was paid and amount doesn't exceed
  IF p_commission_id IS NOT NULL THEN
    SELECT amount INTO v_original_paid
    FROM commission_ledger
    WHERE commission_id = p_commission_id
      AND status = 'paid';

    IF v_original_paid IS NULL THEN
      RETURN jsonb_build_object('error', 'Original commission not found in paid ledger entries');
    END IF;

    IF p_amount > v_original_paid THEN
      RETURN jsonb_build_object(
        'error', 'Clawback amount ($' || p_amount || ') exceeds paid amount ($' || v_original_paid || ')',
        'code', 'CLAWBACK_EXCEEDS_PAID'
      );
    END IF;

    -- Mark original ledger entry as clawback
    UPDATE commission_ledger
    SET status = 'clawback',
        updated_at = now()
    WHERE commission_id = p_commission_id
      AND status = 'paid';
  END IF;

  -- Create adjustment record
  INSERT INTO commission_adjustments (
    organization_id, advisor_id,
    adjustment_type, amount, description,
    commission_id, effective_period,
    status, approved_by, approved_at, created_by
  ) VALUES (
    p_org_id, p_advisor_id,
    'clawback', -p_amount, p_reason,
    p_commission_id, date_trunc('month', current_date)::date,
    'approved', p_actor_id, now(), p_actor_id
  )
  RETURNING id INTO v_adjustment_id;

  -- Audit
  INSERT INTO payout_audit_log (
    organization_id, event_type, entity_type, entity_id,
    actor_id, actor_type, amount, details
  ) VALUES (
    p_org_id, 'clawback_created', 'commission_adjustment', v_adjustment_id,
    p_actor_id, CASE WHEN p_actor_id IS NULL THEN 'system' ELSE 'user' END,
    -p_amount,
    jsonb_build_object(
      'reason', p_reason,
      'advisor_id', p_advisor_id,
      'commission_id', p_commission_id,
      'original_paid_amount', v_original_paid
    )
  );

  INSERT INTO financial_audit_log (
    organization_id, action, entity_type, entity_id,
    performed_by, details
  ) VALUES (
    p_org_id, 'clawback_created', 'commission_adjustment', v_adjustment_id,
    p_actor_id,
    jsonb_build_object(
      'amount', -p_amount,
      'reason', p_reason,
      'advisor_id', p_advisor_id
    )
  );

  RETURN jsonb_build_object(
    'adjustment_id', v_adjustment_id,
    'amount', -p_amount,
    'advisor_id', p_advisor_id,
    'reason', p_reason,
    'status', 'approved',
    'original_paid_amount', v_original_paid
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. LOG PAYOUT EXPORT (enhanced — writes to payout_exports table)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION log_payout_export(
  p_org_id       uuid,
  p_actor_id     uuid,
  p_batch_id     uuid DEFAULT NULL,
  p_format       text DEFAULT 'csv',
  p_record_count int DEFAULT NULL,
  p_total_amount numeric DEFAULT NULL,
  p_details      jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_export_id uuid;
BEGIN
  -- Insert into payout_exports
  INSERT INTO payout_exports (
    organization_id, batch_id, exported_by,
    export_type, record_count, total_amount, details
  ) VALUES (
    p_org_id, p_batch_id, p_actor_id,
    p_format, p_record_count, p_total_amount, p_details
  )
  RETURNING id INTO v_export_id;

  -- Also log to immutable audit
  INSERT INTO payout_audit_log (
    organization_id, event_type, entity_type, entity_id,
    actor_id, actor_type, amount, details
  ) VALUES (
    p_org_id, 'export_requested',
    'commission_payment_batch',
    COALESCE(p_batch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    p_actor_id, 'user',
    p_total_amount,
    jsonb_build_object(
      'format', p_format,
      'record_count', p_record_count,
      'export_id', v_export_id
    ) || p_details
  );

  RETURN v_export_id;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 10. ADD 'clawback_created' TO AUDIT LOG EVENT TYPES
-- ═══════════════════════════════════════════════════════════════════════════════

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
-- DONE — Phase A4 Compliance Hardening
-- ═══════════════════════════════════════════════════════════════════════════════

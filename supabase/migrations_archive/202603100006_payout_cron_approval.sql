-- Migration: Phase A2 — Cron Batch Builder + Approval Flow
-- =========================================================
-- 1. payout_batch_logs table (detailed audit trail per batch action)
-- 2. Status CHECK constraint on commission_payment_batches
-- 3. approve_payout_batch() function (draft → approved, idempotent)
-- 4. auto_create_weekly_batches() function (org-by-org, duplicate-safe)
-- 5. pg_cron schedule: Fridays 2 AM UTC

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. PAYOUT BATCH LOGS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS payout_batch_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  batch_id         uuid NOT NULL REFERENCES commission_payment_batches(id) ON DELETE CASCADE,
  action           text NOT NULL
                   CHECK (action IN (
                     'created', 'approved', 'rejected',
                     'processing', 'paid', 'failed',
                     'retried', 'cancelled'
                   )),
  actor_id         uuid REFERENCES profiles(id),   -- NULL for cron/system
  actor_type       text NOT NULL DEFAULT 'user'
                   CHECK (actor_type IN ('user', 'system', 'cron')),
  prev_status      text,
  new_status       text,
  details          jsonb DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payout_batch_logs_batch
  ON payout_batch_logs (batch_id, created_at);

CREATE INDEX IF NOT EXISTS idx_payout_batch_logs_org
  ON payout_batch_logs (organization_id, created_at);

CREATE INDEX IF NOT EXISTS idx_payout_batch_logs_action
  ON payout_batch_logs (action);

-- RLS
ALTER TABLE payout_batch_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_batch_logs_select" ON payout_batch_logs
  FOR SELECT USING (
    organization_id = (SELECT get_user_organization_id())
    AND get_user_role() IN ('owner', 'super_admin', 'admin')
  );

-- Service role can insert (trigger/cron functions run as SECURITY DEFINER)
-- No user-facing INSERT policy needed.


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. ADD STATUS CHECK CONSTRAINT TO commission_payment_batches
-- ═══════════════════════════════════════════════════════════════════════════════

-- Safe ALTER: only adds constraint if column value is already conforming
DO $$
BEGIN
  ALTER TABLE commission_payment_batches
    ADD CONSTRAINT chk_batch_status
    CHECK (status IN ('draft', 'approved', 'processing', 'paid', 'failed', 'cancelled'));
EXCEPTION WHEN duplicate_object THEN
  NULL; -- constraint already exists
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. APPROVE PAYOUT BATCH
-- ═══════════════════════════════════════════════════════════════════════════════

-- Moves batch from draft → processing. Idempotent: calling on an already-
-- processing batch is a no-op that returns success. Rejects if batch is
-- past processing (paid/failed/cancelled).

CREATE OR REPLACE FUNCTION approve_payout_batch(
  p_batch_id    uuid,
  p_approved_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch record;
BEGIN
  -- Lock the row to prevent concurrent approval
  SELECT * INTO v_batch
  FROM commission_payment_batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF v_batch IS NULL THEN
    RETURN jsonb_build_object('error', 'Batch not found');
  END IF;

  -- Idempotent: already processing is a success
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

  -- Transition: draft → processing
  UPDATE commission_payment_batches
  SET status = 'processing',
      approved_by = p_approved_by,
      approved_at = now(),
      updated_at = now()
  WHERE id = p_batch_id;

  -- Update all payout items to 'processing'
  UPDATE commission_payouts
  SET status = 'processing',
      approved_by = p_approved_by,
      approved_at = now(),
      updated_at = now()
  WHERE id IN (
    SELECT DISTINCT payout_id FROM commission_ledger
    WHERE payout_batch_id = p_batch_id
      AND payout_id IS NOT NULL
  );

  -- Log the approval
  INSERT INTO payout_batch_logs (
    organization_id, batch_id, action,
    actor_id, actor_type,
    prev_status, new_status,
    details
  ) VALUES (
    v_batch.organization_id, p_batch_id, 'approved',
    p_approved_by, 'user',
    'draft', 'processing',
    jsonb_build_object(
      'batch_number', v_batch.batch_number,
      'total_amount', v_batch.total_amount,
      'total_advisors', v_batch.total_advisors
    )
  );

  -- Also log to financial_audit_log for cross-entity audit trail
  INSERT INTO financial_audit_log (
    organization_id, action, entity_type, entity_id,
    performed_by,
    details
  ) VALUES (
    v_batch.organization_id, 'payout_approved', 'commission_payment_batch', p_batch_id,
    p_approved_by,
    jsonb_build_object(
      'batch_number', v_batch.batch_number,
      'total_amount', v_batch.total_amount,
      'total_advisors', v_batch.total_advisors
    )
  );

  RETURN jsonb_build_object(
    'batch_id', p_batch_id,
    'batch_number', v_batch.batch_number,
    'status', 'processing',
    'approved_by', p_approved_by,
    'approved_at', now(),
    'total_amount', v_batch.total_amount,
    'total_advisors', v_batch.total_advisors
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. AUTO-CREATE WEEKLY PAYOUT BATCHES (cron entry point)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Iterates all active orgs, creates a draft batch for the most recently
-- completed week. Skips orgs that already have a batch for that period.

CREATE OR REPLACE FUNCTION auto_create_weekly_batches()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org            record;
  v_period_start   date;
  v_period_end     date;
  v_existing       int;
  v_batch_result   jsonb;
  v_created        int := 0;
  v_skipped        int := 0;
  v_failed         int := 0;
  v_org_results    jsonb := '[]'::jsonb;
BEGIN
  -- Period: last completed week (Monday to Sunday)
  -- e.g. if run on Friday 2026-03-06, covers Mon 2026-02-24 → Sun 2026-03-02
  v_period_end   := (date_trunc('week', current_date) - interval '1 day')::date;   -- Previous Sunday
  v_period_start := (v_period_end - interval '6 days')::date;                       -- Previous Monday

  FOR v_org IN
    SELECT id FROM organizations
    WHERE id IN (
      -- Only orgs that have at least one 'available' ledger entry in the period
      SELECT DISTINCT organization_id
      FROM commission_ledger
      WHERE status = 'available'
        AND created_at >= v_period_start::timestamptz
        AND created_at < (v_period_end + interval '1 day')::timestamptz
    )
  LOOP
    BEGIN
      -- Idempotency: skip if a batch already exists for this org + period
      SELECT count(*) INTO v_existing
      FROM commission_payment_batches
      WHERE organization_id = v_org.id
        AND period_start = v_period_start
        AND period_end = v_period_end
        AND status <> 'failed';  -- Allow retry after failure

      IF v_existing > 0 THEN
        v_skipped := v_skipped + 1;
        v_org_results := v_org_results || jsonb_build_object(
          'org_id', v_org.id, 'action', 'skipped', 'reason', 'batch_exists'
        );
        CONTINUE;
      END IF;

      -- Create batch via existing function (handles locking + ledger linking)
      v_batch_result := create_payout_batch(
        v_org.id,
        v_period_start,
        v_period_end,
        'Weekly auto-batch ' || v_period_start::text || ' to ' || v_period_end::text
      );

      -- Log creation
      IF v_batch_result ? 'batch_id' THEN
        INSERT INTO payout_batch_logs (
          organization_id, batch_id, action,
          actor_id, actor_type,
          prev_status, new_status,
          details
        ) VALUES (
          v_org.id,
          (v_batch_result->>'batch_id')::uuid,
          'created',
          NULL, 'cron',
          NULL, 'draft',
          jsonb_build_object(
            'trigger', 'auto_create_weekly_batches',
            'period_start', v_period_start,
            'period_end', v_period_end,
            'result', v_batch_result
          )
        );

        v_created := v_created + 1;
        v_org_results := v_org_results || jsonb_build_object(
          'org_id', v_org.id, 'action', 'created', 'batch', v_batch_result
        );
      ELSE
        v_failed := v_failed + 1;
        v_org_results := v_org_results || jsonb_build_object(
          'org_id', v_org.id, 'action', 'empty', 'result', v_batch_result
        );
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_org_results := v_org_results || jsonb_build_object(
        'org_id', v_org.id, 'action', 'error', 'error', SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'period_start', v_period_start,
    'period_end', v_period_end,
    'created', v_created,
    'skipped', v_skipped,
    'failed', v_failed,
    'orgs', v_org_results,
    'ran_at', now()
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. ENHANCE mark_payout_paid / mark_payout_failed WITH BATCH LOGGING
-- ═══════════════════════════════════════════════════════════════════════════════

-- Wrap existing functions to also write to payout_batch_logs.
-- We replace them to add the logging step.

CREATE OR REPLACE FUNCTION mark_payout_paid(
  p_batch_id     uuid,
  p_processed_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch record;
  v_count int;
BEGIN
  -- Lock the batch row
  SELECT * INTO v_batch
  FROM commission_payment_batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF v_batch IS NULL THEN
    RETURN jsonb_build_object('error', 'Batch not found');
  END IF;

  IF v_batch.status NOT IN ('draft', 'approved', 'processing') THEN
    RETURN jsonb_build_object('error', 'Batch is not in a payable state: ' || v_batch.status);
  END IF;

  -- Mark all linked ledger entries as paid
  UPDATE commission_ledger
  SET status = 'paid', updated_at = now()
  WHERE payout_batch_id = p_batch_id
    AND status = 'scheduled';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Mark all payout items as paid
  UPDATE commission_payouts
  SET status = 'paid',
      paid_at = now(),
      updated_at = now()
  WHERE id IN (
    SELECT DISTINCT payout_id FROM commission_ledger
    WHERE payout_batch_id = p_batch_id
  );

  -- Mark batch as paid
  UPDATE commission_payment_batches
  SET status = 'paid',
      processed_by = p_processed_by,
      processed_at = now(),
      updated_at = now()
  WHERE id = p_batch_id;

  -- Log to financial audit
  INSERT INTO financial_audit_log (
    organization_id, action, entity_type, entity_id,
    performed_by, details
  ) VALUES (
    v_batch.organization_id, 'payout_completed', 'commission_payment_batch', p_batch_id,
    p_processed_by,
    jsonb_build_object(
      'batch_number', v_batch.batch_number,
      'total_amount', v_batch.total_amount,
      'ledger_entries_paid', v_count
    )
  );

  -- Log to payout_batch_logs
  INSERT INTO payout_batch_logs (
    organization_id, batch_id, action,
    actor_id, actor_type,
    prev_status, new_status,
    details
  ) VALUES (
    v_batch.organization_id, p_batch_id, 'paid',
    p_processed_by, CASE WHEN p_processed_by IS NULL THEN 'system' ELSE 'user' END,
    v_batch.status, 'paid',
    jsonb_build_object(
      'batch_number', v_batch.batch_number,
      'total_amount', v_batch.total_amount,
      'ledger_entries_paid', v_count
    )
  );

  RETURN jsonb_build_object(
    'batch_id', p_batch_id,
    'status', 'paid',
    'ledger_entries_paid', v_count,
    'paid_at', now()
  );
END;
$$;


CREATE OR REPLACE FUNCTION mark_payout_failed(
  p_batch_id uuid,
  p_reason   text DEFAULT 'Payment processing failed'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch record;
  v_count int;
  v_payout_ids uuid[];
BEGIN
  SELECT * INTO v_batch
  FROM commission_payment_batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF v_batch IS NULL THEN
    RETURN jsonb_build_object('error', 'Batch not found');
  END IF;

  -- Collect payout IDs BEFORE nullifying the batch reference
  SELECT array_agg(DISTINCT cl.payout_id) INTO v_payout_ids
  FROM commission_ledger cl
  WHERE cl.payout_batch_id = p_batch_id
    AND cl.payout_id IS NOT NULL;

  -- Release ledger entries back to available
  UPDATE commission_ledger
  SET status = 'available',
      payout_batch_id = NULL,
      payout_id = NULL,
      updated_at = now()
  WHERE payout_batch_id = p_batch_id
    AND status = 'scheduled';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Mark payout items as failed (using pre-collected IDs)
  UPDATE commission_payouts
  SET status = 'failed',
      notes = p_reason,
      updated_at = now()
  WHERE id = ANY(COALESCE(v_payout_ids, '{}'));

  -- Mark batch as failed
  UPDATE commission_payment_batches
  SET status = 'failed',
      notes = p_reason,
      updated_at = now()
  WHERE id = p_batch_id;

  -- Audit log
  INSERT INTO financial_audit_log (
    organization_id, action, entity_type, entity_id,
    details
  ) VALUES (
    v_batch.organization_id, 'payout_failed', 'commission_payment_batch', p_batch_id,
    jsonb_build_object(
      'batch_number', v_batch.batch_number,
      'reason', p_reason,
      'ledger_entries_released', v_count
    )
  );

  -- Log to payout_batch_logs
  INSERT INTO payout_batch_logs (
    organization_id, batch_id, action,
    actor_id, actor_type,
    prev_status, new_status,
    details
  ) VALUES (
    v_batch.organization_id, p_batch_id, 'failed',
    NULL, 'system',
    v_batch.status, 'failed',
    jsonb_build_object(
      'batch_number', v_batch.batch_number,
      'reason', p_reason,
      'ledger_entries_released', v_count
    )
  );

  RETURN jsonb_build_object(
    'batch_id', p_batch_id,
    'status', 'failed',
    'reason', p_reason,
    'ledger_entries_released', v_count
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. PG_CRON: WEEKLY BATCH CREATION (Friday 2 AM UTC)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  PERFORM cron.unschedule('weekly_auto_payout_batches');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'weekly_auto_payout_batches',
    '0 2 * * 5',
    'SELECT auto_create_weekly_batches()'
  );
  RAISE NOTICE 'Scheduled weekly payout batch creation: Fridays 2 AM UTC';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron scheduling skipped: %', SQLERRM;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE — Phase A2
-- ═══════════════════════════════════════════════════════════════════════════════

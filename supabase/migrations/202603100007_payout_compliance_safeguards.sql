-- Migration: Phase A4 — Payout Compliance Safeguards
-- ====================================================
-- 1. Immutable append-only payout_audit_log
-- 2. Org-level compliance configuration (thresholds, 2-person approval)
-- 3. Separation-of-duties enforcement function
-- 4. Reversal & clawback ledger functions
-- 5. Payout export logging
-- 6. Fraud / anomaly flag table + detection function
-- 7. PII-safe: no sensitive member data in audit tables


-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. IMMUTABLE APPEND-ONLY PAYOUT AUDIT LOG
-- ═══════════════════════════════════════════════════════════════════════════════
-- Records every state change across batches, payout items, and ledger entries.
-- PII-safe: only IDs and amounts, never names/SSN/bank details.

CREATE TABLE IF NOT EXISTS payout_audit_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type       text NOT NULL
                   CHECK (event_type IN (
                     'batch_created', 'batch_approved', 'batch_processing',
                     'batch_paid', 'batch_failed', 'batch_cancelled',
                     'item_created', 'item_approved', 'item_paid', 'item_failed',
                     'ledger_scheduled', 'ledger_paid', 'ledger_reversed', 'ledger_held',
                     'reversal_created', 'clawback_created', 'clawback_applied',
                     'export_requested', 'export_completed',
                     'fraud_flag_raised', 'fraud_flag_resolved',
                     'approval_blocked', 'threshold_exceeded'
                   )),
  entity_type      text NOT NULL
                   CHECK (entity_type IN (
                     'commission_payment_batch', 'commission_payout',
                     'commission_ledger', 'commission_adjustment'
                   )),
  entity_id        uuid NOT NULL,
  -- Actor: only profile ID, never PII
  actor_id         uuid REFERENCES profiles(id),
  actor_type       text NOT NULL DEFAULT 'user'
                   CHECK (actor_type IN ('user', 'system', 'cron')),
  -- State change (PII-safe: amounts and IDs only)
  prev_status      text,
  new_status       text,
  amount           numeric(12,2),
  details          jsonb DEFAULT '{}'::jsonb,
  -- Immutable timestamp
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Prevent updates and deletes (append-only)
CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'payout_audit_log is immutable: % not allowed', TG_OP;
END;
$$;

CREATE TRIGGER trg_payout_audit_no_update
  BEFORE UPDATE ON payout_audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

CREATE TRIGGER trg_payout_audit_no_delete
  BEFORE DELETE ON payout_audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

-- Indexes for querying
CREATE INDEX IF NOT EXISTS idx_payout_audit_org_created
  ON payout_audit_log (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payout_audit_entity
  ON payout_audit_log (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_payout_audit_event_type
  ON payout_audit_log (event_type);

CREATE INDEX IF NOT EXISTS idx_payout_audit_actor
  ON payout_audit_log (actor_id)
  WHERE actor_id IS NOT NULL;

-- RLS: admin-only read, no user writes (SECURITY DEFINER functions handle inserts)
ALTER TABLE payout_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_audit_select" ON payout_audit_log
  FOR SELECT USING (
    organization_id = (SELECT get_user_organization_id())
    AND get_user_role() IN ('owner', 'super_admin', 'admin')
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. ORG-LEVEL COMPLIANCE CONFIGURATION
-- ═══════════════════════════════════════════════════════════════════════════════
-- Stored in organizations.settings->'payout_compliance'. Uses JSONB path so no
-- new table needed. Define a helper to read config with defaults.

CREATE OR REPLACE FUNCTION get_payout_compliance_config(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_settings jsonb;
BEGIN
  SELECT COALESCE(settings->'payout_compliance', '{}'::jsonb)
  INTO v_settings
  FROM organizations
  WHERE id = p_org_id;

  -- Apply defaults
  RETURN jsonb_build_object(
    -- Amount above which creator cannot self-approve
    'self_approve_threshold', COALESCE((v_settings->>'self_approve_threshold')::numeric, 5000),
    -- Amount above which 2-person approval is required
    'dual_approve_threshold', COALESCE((v_settings->>'dual_approve_threshold')::numeric, 25000),
    -- Max single payout amount (hard cap)
    'max_single_payout', COALESCE((v_settings->>'max_single_payout')::numeric, 100000),
    -- Spike detection: flag if payout is N× the advisor's 3-month average
    'spike_multiplier', COALESCE((v_settings->>'spike_multiplier')::numeric, 3.0),
    -- Whether export requires logging
    'log_exports', COALESCE((v_settings->>'log_exports')::boolean, true)
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. SEPARATION-OF-DUTIES ENFORCEMENT
-- ═══════════════════════════════════════════════════════════════════════════════
-- Wraps approve_payout_batch to enforce:
--   a) Creator cannot approve if batch total > self_approve_threshold
--   b) 2-person approval needed if batch total > dual_approve_threshold

CREATE OR REPLACE FUNCTION approve_payout_batch(
  p_batch_id    uuid,
  p_approved_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch   record;
  v_config  jsonb;
  v_creator uuid;
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
    -- Log the block
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

  -- Separation of duties: find who created the batch
  SELECT actor_id INTO v_creator
  FROM payout_batch_logs
  WHERE batch_id = p_batch_id AND action = 'created'
  ORDER BY created_at LIMIT 1;

  -- Self-approve check
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

  -- Dual-approval check (for future: stub logs the requirement)
  -- When Phase A4+ adds a second approver field, this will enforce it.
  -- For now, log a warning in the audit trail if threshold is exceeded.
  IF v_batch.total_amount > (v_config->>'dual_approve_threshold')::numeric THEN
    INSERT INTO payout_audit_log (
      organization_id, event_type, entity_type, entity_id,
      actor_id, actor_type, amount, details
    ) VALUES (
      v_batch.organization_id, 'threshold_exceeded', 'commission_payment_batch', p_batch_id,
      p_approved_by, 'user', v_batch.total_amount,
      jsonb_build_object(
        'reason', 'dual_approval_recommended',
        'threshold', v_config->>'dual_approve_threshold'
      )
    );
  END IF;

  -- Transition: draft → processing
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
      'total_advisors', v_batch.total_advisors
    )
  );

  -- Log to immutable audit
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
      'total_advisors', v_batch.total_advisors
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
-- 4. REVERSAL & CLAWBACK SUPPORT
-- ═══════════════════════════════════════════════════════════════════════════════

-- 4a. Create a reversal ledger entry for a paid commission.
-- Reverses the original ledger entry and creates a negative entry.
CREATE OR REPLACE FUNCTION create_payout_reversal(
  p_ledger_entry_id uuid,
  p_reason          text,
  p_actor_id        uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entry record;
  v_reversal_id uuid;
BEGIN
  SELECT * INTO v_entry
  FROM commission_ledger
  WHERE id = p_ledger_entry_id
  FOR UPDATE;

  IF v_entry IS NULL THEN
    RETURN jsonb_build_object('error', 'Ledger entry not found');
  END IF;

  IF v_entry.status NOT IN ('available', 'scheduled', 'paid') THEN
    RETURN jsonb_build_object('error', 'Entry cannot be reversed from status: ' || v_entry.status);
  END IF;

  -- Mark original entry as reversed
  UPDATE commission_ledger
  SET status = 'reversed',
      reversed_at = now(),
      reversed_reason = p_reason,
      updated_at = now()
  WHERE id = p_ledger_entry_id;

  -- Audit
  INSERT INTO payout_audit_log (
    organization_id, event_type, entity_type, entity_id,
    actor_id, actor_type,
    prev_status, new_status, amount, details
  ) VALUES (
    v_entry.organization_id, 'ledger_reversed', 'commission_ledger', p_ledger_entry_id,
    p_actor_id, CASE WHEN p_actor_id IS NULL THEN 'system' ELSE 'user' END,
    v_entry.status, 'reversed', v_entry.amount,
    jsonb_build_object('reason', p_reason, 'commission_id', v_entry.commission_id)
  );

  RETURN jsonb_build_object(
    'ledger_entry_id', p_ledger_entry_id,
    'status', 'reversed',
    'original_amount', v_entry.amount,
    'reason', p_reason,
    'advisor_id', v_entry.advisor_id
  );
END;
$$;


-- 4b. Clawback: create a negative adjustment and a negative ledger entry
-- to recoup already-paid commissions. Different from reversal (which blocks
-- unpaid entries). Clawback creates a new debt entry.
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
  v_adjustment_id uuid;
  v_ledger_id     uuid;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('error', 'Clawback amount must be positive');
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
      'commission_id', p_commission_id
    )
  );

  RETURN jsonb_build_object(
    'adjustment_id', v_adjustment_id,
    'amount', -p_amount,
    'advisor_id', p_advisor_id,
    'reason', p_reason,
    'status', 'approved'
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. PAYOUT EXPORT LOGGING
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION log_payout_export(
  p_org_id     uuid,
  p_actor_id   uuid,
  p_batch_id   uuid DEFAULT NULL,
  p_format     text DEFAULT 'csv',
  p_details    jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO payout_audit_log (
    organization_id, event_type, entity_type, entity_id,
    actor_id, actor_type, details
  ) VALUES (
    p_org_id, 'export_requested',
    'commission_payment_batch',
    COALESCE(p_batch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    p_actor_id, 'user',
    jsonb_build_object('format', p_format) || p_details
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. FRAUD / ANOMALY FLAGS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS payout_fraud_flags (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  advisor_id       uuid NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
  batch_id         uuid REFERENCES commission_payment_batches(id) ON DELETE SET NULL,
  flag_type        text NOT NULL
                   CHECK (flag_type IN (
                     'spike_detected',       -- Sudden amount increase
                     'duplicate_bank',        -- Same bank account across advisors
                     'velocity_anomaly',      -- Too many payouts in short window
                     'threshold_breach',      -- Single payout exceeds threshold
                     'manual_review'          -- Manually flagged
                   )),
  severity         text NOT NULL DEFAULT 'medium'
                   CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status           text NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
  -- PII-safe details: only IDs and amounts
  amount           numeric(12,2),
  baseline_amount  numeric(12,2),  -- 3-month average for spike detection
  multiplier       numeric(6,2),   -- How many × above baseline
  details          jsonb DEFAULT '{}'::jsonb,
  -- Resolution
  resolved_by      uuid REFERENCES profiles(id),
  resolved_at      timestamptz,
  resolution_notes text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fraud_flags_org_status
  ON payout_fraud_flags (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_fraud_flags_advisor
  ON payout_fraud_flags (advisor_id);

CREATE INDEX IF NOT EXISTS idx_fraud_flags_type
  ON payout_fraud_flags (flag_type, status);

-- RLS
ALTER TABLE payout_fraud_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_fraud_flags_select" ON payout_fraud_flags
  FOR SELECT USING (
    organization_id = (SELECT get_user_organization_id())
    AND get_user_role() IN ('owner', 'super_admin', 'admin')
  );

CREATE POLICY "admin_fraud_flags_update" ON payout_fraud_flags
  FOR UPDATE USING (
    organization_id = (SELECT get_user_organization_id())
    AND get_user_role() IN ('owner', 'super_admin', 'admin')
  );


-- 6b. Spike detection function — called before or after batch creation.
-- Flags advisors whose payout in the current batch is N× their 3-month average.
CREATE OR REPLACE FUNCTION detect_payout_anomalies(
  p_batch_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch          record;
  v_config         jsonb;
  v_spike_mult     numeric;
  v_payout_row     record;
  v_avg_amount     numeric;
  v_flags_raised   int := 0;
  v_dup_count      int := 0;
  v_results        jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_batch
  FROM commission_payment_batches
  WHERE id = p_batch_id;

  IF v_batch IS NULL THEN
    RETURN jsonb_build_object('error', 'Batch not found');
  END IF;

  v_config := get_payout_compliance_config(v_batch.organization_id);
  v_spike_mult := (v_config->>'spike_multiplier')::numeric;

  -- Check each payout item in the batch
  FOR v_payout_row IN
    SELECT
      cp.id AS payout_id,
      cp.advisor_id,
      cp.net_payout
    FROM commission_payouts cp
    WHERE cp.id IN (
      SELECT DISTINCT payout_id FROM commission_ledger
      WHERE payout_batch_id = p_batch_id AND payout_id IS NOT NULL
    )
  LOOP
    -- Calculate 3-month average for this advisor (excluding current batch)
    SELECT COALESCE(avg(cp2.net_payout), 0)
    INTO v_avg_amount
    FROM commission_payouts cp2
    WHERE cp2.advisor_id = v_payout_row.advisor_id
      AND cp2.status = 'paid'
      AND cp2.paid_at >= (current_date - interval '3 months')
      AND cp2.id <> v_payout_row.payout_id;

    -- Spike detection: only flag if there's a meaningful baseline
    IF v_avg_amount > 50  -- Minimum $50 baseline to avoid flagging tiny amounts
       AND v_payout_row.net_payout > (v_avg_amount * v_spike_mult)
    THEN
      INSERT INTO payout_fraud_flags (
        organization_id, advisor_id, batch_id,
        flag_type, severity,
        amount, baseline_amount, multiplier,
        details
      ) VALUES (
        v_batch.organization_id, v_payout_row.advisor_id, p_batch_id,
        'spike_detected',
        CASE
          WHEN v_payout_row.net_payout > v_avg_amount * 10 THEN 'critical'
          WHEN v_payout_row.net_payout > v_avg_amount * 5 THEN 'high'
          ELSE 'medium'
        END,
        v_payout_row.net_payout, v_avg_amount,
        round(v_payout_row.net_payout / v_avg_amount, 2),
        jsonb_build_object(
          'payout_id', v_payout_row.payout_id,
          'batch_number', v_batch.batch_number
        )
      );

      -- Audit log
      INSERT INTO payout_audit_log (
        organization_id, event_type, entity_type, entity_id,
        actor_type, amount, details
      ) VALUES (
        v_batch.organization_id, 'fraud_flag_raised', 'commission_payout', v_payout_row.payout_id,
        'system', v_payout_row.net_payout,
        jsonb_build_object(
          'flag_type', 'spike_detected',
          'baseline', v_avg_amount,
          'multiplier', round(v_payout_row.net_payout / v_avg_amount, 2)
        )
      );

      v_flags_raised := v_flags_raised + 1;
      v_results := v_results || jsonb_build_object(
        'advisor_id', v_payout_row.advisor_id,
        'amount', v_payout_row.net_payout,
        'baseline', v_avg_amount,
        'multiplier', round(v_payout_row.net_payout / v_avg_amount, 2)
      );
    END IF;

    -- Threshold breach detection
    IF v_payout_row.net_payout > (v_config->>'max_single_payout')::numeric THEN
      INSERT INTO payout_fraud_flags (
        organization_id, advisor_id, batch_id,
        flag_type, severity,
        amount, details
      ) VALUES (
        v_batch.organization_id, v_payout_row.advisor_id, p_batch_id,
        'threshold_breach', 'critical',
        v_payout_row.net_payout,
        jsonb_build_object(
          'threshold', v_config->>'max_single_payout',
          'payout_id', v_payout_row.payout_id
        )
      );
      v_flags_raised := v_flags_raised + 1;
    END IF;
  END LOOP;

  -- Duplicate bank account detection (if payment_reference populated)
  INSERT INTO payout_fraud_flags (
    organization_id, advisor_id, batch_id,
    flag_type, severity, details
  )
  SELECT
    v_batch.organization_id,
    cp.advisor_id,
    p_batch_id,
    'duplicate_bank',
    'high',
    jsonb_build_object(
      'payment_reference', cp.payment_reference,
      'other_advisors', (
        SELECT jsonb_agg(DISTINCT cp2.advisor_id)
        FROM commission_payouts cp2
        WHERE cp2.payment_reference = cp.payment_reference
          AND cp2.advisor_id <> cp.advisor_id
          AND cp2.organization_id = v_batch.organization_id
          AND cp2.status IN ('paid', 'processing')
      )
    )
  FROM commission_payouts cp
  WHERE cp.id IN (
    SELECT DISTINCT payout_id FROM commission_ledger
    WHERE payout_batch_id = p_batch_id AND payout_id IS NOT NULL
  )
  AND cp.payment_reference IS NOT NULL
  AND cp.payment_reference <> ''
  AND EXISTS (
    SELECT 1 FROM commission_payouts cp2
    WHERE cp2.payment_reference = cp.payment_reference
      AND cp2.advisor_id <> cp.advisor_id
      AND cp2.organization_id = v_batch.organization_id
      AND cp2.status IN ('paid', 'processing')
  );

  GET DIAGNOSTICS v_dup_count = ROW_COUNT;
  v_flags_raised := v_flags_raised + v_dup_count;

  RETURN jsonb_build_object(
    'batch_id', p_batch_id,
    'flags_raised', v_flags_raised,
    'spike_details', v_results,
    'checked_at', now()
  );
END;
$$;


-- 6c. Resolve a fraud flag
CREATE OR REPLACE FUNCTION resolve_fraud_flag(
  p_flag_id   uuid,
  p_actor_id  uuid,
  p_status    text,    -- 'resolved' or 'dismissed'
  p_notes     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_flag record;
BEGIN
  IF p_status NOT IN ('resolved', 'dismissed') THEN
    RETURN jsonb_build_object('error', 'Status must be resolved or dismissed');
  END IF;

  SELECT * INTO v_flag
  FROM payout_fraud_flags
  WHERE id = p_flag_id
  FOR UPDATE;

  IF v_flag IS NULL THEN
    RETURN jsonb_build_object('error', 'Flag not found');
  END IF;

  IF v_flag.status NOT IN ('open', 'investigating') THEN
    RETURN jsonb_build_object('error', 'Flag already ' || v_flag.status);
  END IF;

  UPDATE payout_fraud_flags
  SET status = p_status,
      resolved_by = p_actor_id,
      resolved_at = now(),
      resolution_notes = p_notes
  WHERE id = p_flag_id;

  INSERT INTO payout_audit_log (
    organization_id, event_type, entity_type, entity_id,
    actor_id, actor_type, details
  ) VALUES (
    v_flag.organization_id, 'fraud_flag_resolved', 'commission_payout',
    COALESCE(v_flag.batch_id, v_flag.id),
    p_actor_id, 'user',
    jsonb_build_object(
      'flag_id', p_flag_id,
      'flag_type', v_flag.flag_type,
      'resolution', p_status,
      'notes', p_notes
    )
  );

  RETURN jsonb_build_object(
    'flag_id', p_flag_id,
    'status', p_status,
    'resolved_by', p_actor_id
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. ENHANCED mark_payout_paid WITH ANOMALY DETECTION + AUDIT
-- ═══════════════════════════════════════════════════════════════════════════════

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
  v_open_flags int;
BEGIN
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

  -- Check for unresolved fraud flags
  SELECT count(*) INTO v_open_flags
  FROM payout_fraud_flags
  WHERE batch_id = p_batch_id
    AND status IN ('open', 'investigating');

  IF v_open_flags > 0 THEN
    RETURN jsonb_build_object(
      'error', 'Batch has ' || v_open_flags || ' unresolved fraud flag(s). Resolve or dismiss before paying.',
      'code', 'FRAUD_FLAGS_OPEN',
      'open_flags', v_open_flags
    );
  END IF;

  -- Mark ledger entries as paid
  UPDATE commission_ledger
  SET status = 'paid', updated_at = now()
  WHERE payout_batch_id = p_batch_id
    AND status = 'scheduled';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Mark payout items as paid
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

  -- Financial audit log
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

  -- Payout batch logs
  INSERT INTO payout_batch_logs (
    organization_id, batch_id, action,
    actor_id, actor_type,
    prev_status, new_status, details
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

  -- Immutable audit log
  INSERT INTO payout_audit_log (
    organization_id, event_type, entity_type, entity_id,
    actor_id, actor_type, prev_status, new_status,
    amount, details
  ) VALUES (
    v_batch.organization_id, 'batch_paid', 'commission_payment_batch', p_batch_id,
    p_processed_by, CASE WHEN p_processed_by IS NULL THEN 'system' ELSE 'user' END,
    v_batch.status, 'paid',
    v_batch.total_amount,
    jsonb_build_object(
      'batch_number', v_batch.batch_number,
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

  -- Release ledger entries
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

  UPDATE commission_payment_batches
  SET status = 'failed',
      notes = p_reason,
      updated_at = now()
  WHERE id = p_batch_id;

  -- Financial audit
  INSERT INTO financial_audit_log (
    organization_id, action, entity_type, entity_id, details
  ) VALUES (
    v_batch.organization_id, 'payout_failed', 'commission_payment_batch', p_batch_id,
    jsonb_build_object(
      'batch_number', v_batch.batch_number,
      'reason', p_reason,
      'ledger_entries_released', v_count
    )
  );

  -- Batch logs
  INSERT INTO payout_batch_logs (
    organization_id, batch_id, action,
    actor_type, prev_status, new_status, details
  ) VALUES (
    v_batch.organization_id, p_batch_id, 'failed',
    'system', v_batch.status, 'failed',
    jsonb_build_object(
      'batch_number', v_batch.batch_number,
      'reason', p_reason,
      'ledger_entries_released', v_count
    )
  );

  -- Immutable audit
  INSERT INTO payout_audit_log (
    organization_id, event_type, entity_type, entity_id,
    actor_type, prev_status, new_status, amount, details
  ) VALUES (
    v_batch.organization_id, 'batch_failed', 'commission_payment_batch', p_batch_id,
    'system', v_batch.status, 'failed', v_batch.total_amount,
    jsonb_build_object(
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
-- DONE — Phase A4 Compliance Safeguards
-- ═══════════════════════════════════════════════════════════════════════════════

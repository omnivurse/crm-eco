-- ============================================================================
-- Migration: 202605210002_commission_processing_enhancements
-- Purpose:   Add columns for commission deduplication + billing-to-commission link
-- Guardrail: 100% additive — no DROP, no ALTER existing columns
-- ============================================================================

BEGIN;

-- ── 1. Mark billing transactions as commissioned ─────────────────────────────
-- After the commission processor calculates commissions for a billing txn,
-- it sets this timestamp so the same txn isn't processed again.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_transactions' AND column_name = 'commissioned_at'
  ) THEN
    ALTER TABLE billing_transactions ADD COLUMN commissioned_at timestamptz;
  END IF;
END $$;

COMMENT ON COLUMN billing_transactions.commissioned_at IS
  'Timestamp when commission was calculated for this transaction. NULL = not yet commissioned.';

CREATE INDEX IF NOT EXISTS idx_billing_txn_uncommissioned
  ON billing_transactions (organization_id, status)
  WHERE commissioned_at IS NULL AND status = 'success';

-- ── 2. Commission deduplication key ──────────────────────────────────────────
-- Prevents duplicate commission calculations. Format:
--   {enrollment_id}:{commission_type}:{YYYY-MM}

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_transactions' AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE commission_transactions ADD COLUMN idempotency_key text;
  END IF;
END $$;

-- Unique constraint for dedup (partial — only non-null keys)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'commission_transactions_idempotency_key_unique'
  ) THEN
    ALTER TABLE commission_transactions
      ADD CONSTRAINT commission_transactions_idempotency_key_unique
      UNIQUE (idempotency_key);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 3. Snapshot agent level at time of commission ────────────────────────────
-- Records what tier the agent was in when the commission was calculated,
-- so historical reports show the correct level even if the agent is promoted later.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_transactions' AND column_name = 'agent_level_at_time'
  ) THEN
    ALTER TABLE commission_transactions ADD COLUMN agent_level_at_time text;
  END IF;
END $$;

-- ── 4. Billing transaction idempotency key ──────────────────────────────────
-- Prevents duplicate charges on retry. Format:
--   {schedule_id}:{YYYY-MM-DD}

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing_transactions' AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE billing_transactions ADD COLUMN idempotency_key text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'billing_transactions_idempotency_key_unique'
  ) THEN
    ALTER TABLE billing_transactions
      ADD CONSTRAINT billing_transactions_idempotency_key_unique
      UNIQUE (idempotency_key);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;

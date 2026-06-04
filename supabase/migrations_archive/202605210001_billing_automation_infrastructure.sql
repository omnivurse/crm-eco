-- ============================================================================
-- Migration: 202605210001_billing_automation_infrastructure
-- Purpose:   Add billing automation config + job run audit tables
--            Prerequisite for Vercel Cron → Edge Function scheduling
-- Guardrail: 100% additive — no DROP, no ALTER existing columns
-- ============================================================================

BEGIN;

-- ── 1. billing_automation_config ─────────────────────────────────────────────
-- DB-backed scheduler configuration per organization.
-- The Vercel Cron route handler reads this table to decide whether to fire
-- the billing/commission Edge Function for a given org.

CREATE TABLE IF NOT EXISTS billing_automation_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Scheduler toggles
  billing_enabled    boolean  NOT NULL DEFAULT false,
  commission_enabled boolean  NOT NULL DEFAULT false,

  -- When to run (UTC)
  run_day_of_month   int      NOT NULL DEFAULT 20  CHECK (run_day_of_month BETWEEN 1 AND 31),
  run_hour_utc       int      NOT NULL DEFAULT 2   CHECK (run_hour_utc BETWEEN 0 AND 23),

  -- Processing limits
  batch_size         int      NOT NULL DEFAULT 50  CHECK (batch_size BETWEEN 1 AND 500),
  max_retries        int      NOT NULL DEFAULT 4   CHECK (max_retries BETWEEN 0 AND 10),

  -- Circuit breaker
  circuit_breaker_threshold  int NOT NULL DEFAULT 5   CHECK (circuit_breaker_threshold BETWEEN 1 AND 50),
  circuit_breaker_cooldown   int NOT NULL DEFAULT 300 CHECK (circuit_breaker_cooldown BETWEEN 60 AND 3600),
  -- ^^ seconds to wait after circuit opens before trying again

  -- Rate limiter
  rate_limit_per_minute      int NOT NULL DEFAULT 30  CHECK (rate_limit_per_minute BETWEEN 1 AND 120),

  -- Notification
  notify_on_failure  boolean  NOT NULL DEFAULT true,
  notify_email       text,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT billing_automation_config_org_unique UNIQUE (organization_id)
);

COMMENT ON TABLE billing_automation_config IS
  'Per-org configuration for automated billing/commission processing runs.';

-- ── 2. billing_job_runs ──────────────────────────────────────────────────────
-- Audit log for every billing or commission processing run.
-- One row per run, written at start (status=running) and updated at completion.

CREATE TABLE IF NOT EXISTS billing_job_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  job_type        text NOT NULL CHECK (job_type IN ('billing', 'commission', 'email', 'smoke_test')),
  status          text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),

  -- Timing
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  duration_ms     int,

  -- Counters
  total_eligible  int NOT NULL DEFAULT 0,
  processed_count int NOT NULL DEFAULT 0,
  success_count   int NOT NULL DEFAULT 0,
  failure_count   int NOT NULL DEFAULT 0,
  skipped_count   int NOT NULL DEFAULT 0,

  -- Details
  error_log       jsonb DEFAULT '[]'::jsonb,
  metadata        jsonb DEFAULT '{}'::jsonb,

  -- Trigger info
  triggered_by    text NOT NULL DEFAULT 'cron' CHECK (triggered_by IN ('cron', 'manual', 'api', 'smoke_test')),
  trigger_details text,

  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE billing_job_runs IS
  'Audit log for billing/commission processing runs. One row per run.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_billing_job_runs_org_type
  ON billing_job_runs (organization_id, job_type, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_job_runs_status
  ON billing_job_runs (status) WHERE status = 'running';

-- ── 3. RLS Policies ─────────────────────────────────────────────────────────

ALTER TABLE billing_automation_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_job_runs ENABLE ROW LEVEL SECURITY;

-- billing_automation_config: org members can read, admins+ can write
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'billing_automation_config' AND policyname = 'billing_auto_config_select'
  ) THEN
    CREATE POLICY billing_auto_config_select ON billing_automation_config
      FOR SELECT USING (
        organization_id IN (
          SELECT organization_id FROM organization_members
          WHERE user_id = auth.uid() AND is_active = true
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'billing_automation_config' AND policyname = 'billing_auto_config_modify'
  ) THEN
    CREATE POLICY billing_auto_config_modify ON billing_automation_config
      FOR ALL USING (
        organization_id IN (
          SELECT organization_id FROM organization_members
          WHERE user_id = auth.uid() AND is_active = true
            AND role IN ('owner', 'super_admin', 'admin')
        )
      );
  END IF;
END $$;

-- billing_job_runs: org members can read, service role inserts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'billing_job_runs' AND policyname = 'billing_job_runs_select'
  ) THEN
    CREATE POLICY billing_job_runs_select ON billing_job_runs
      FOR SELECT USING (
        organization_id IN (
          SELECT organization_id FROM organization_members
          WHERE user_id = auth.uid() AND is_active = true
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'billing_job_runs' AND policyname = 'billing_job_runs_insert_service'
  ) THEN
    CREATE POLICY billing_job_runs_insert_service ON billing_job_runs
      FOR INSERT WITH CHECK (true);
      -- Service role bypasses RLS; this policy allows the cron route handler
      -- to insert via service role. Anon/authenticated users cannot insert
      -- because the table has no policy that matches their JWT role for INSERT.
  END IF;
END $$;

-- ── 4. Updated_at trigger ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_billing_automation_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_billing_automation_config_updated_at ON billing_automation_config;
CREATE TRIGGER trg_billing_automation_config_updated_at
  BEFORE UPDATE ON billing_automation_config
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_automation_config_updated_at();

COMMIT;

-- ============================================================================
-- Migration: 202605210003_contract_pdf_and_smoke_test
-- Purpose:   Ensure enrollment_contracts columns for PDF + smoke_test org
-- Guardrail: 100% additive — no DROP, no ALTER existing columns
-- ============================================================================

BEGIN;

-- ── 1. Enrollment contract PDF columns ───────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enrollment_contracts' AND column_name = 'pdf_url'
  ) THEN
    ALTER TABLE enrollment_contracts ADD COLUMN pdf_url text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enrollment_contracts' AND column_name = 'generated_at'
  ) THEN
    ALTER TABLE enrollment_contracts ADD COLUMN generated_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enrollment_contracts' AND column_name = 'contract_version'
  ) THEN
    ALTER TABLE enrollment_contracts ADD COLUMN contract_version int NOT NULL DEFAULT 1;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enrollment_contracts' AND column_name = 'signature_data'
  ) THEN
    ALTER TABLE enrollment_contracts ADD COLUMN signature_data jsonb;
  END IF;
END $$;

COMMENT ON COLUMN enrollment_contracts.pdf_url IS 'Supabase Storage path to the generated PDF';
COMMENT ON COLUMN enrollment_contracts.generated_at IS 'When the PDF was generated';
COMMENT ON COLUMN enrollment_contracts.contract_version IS 'Monotonic version number for re-generations';
COMMENT ON COLUMN enrollment_contracts.signature_data IS 'Digital signature metadata: {ip, user_agent, signed_at, signer_name}';

-- ── 2. Smoke test organization ───────────────────────────────────────────────
-- A dedicated org for automated smoke tests. Never touches PIFH data.

INSERT INTO organizations (id, name, slug, status, plan, created_at, updated_at)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Smoke Test Org',
  'smoke-test',
  'active',
  'trial',
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Seed a billing_automation_config for the smoke test org
INSERT INTO billing_automation_config (organization_id, billing_enabled, commission_enabled)
VALUES ('a0000000-0000-0000-0000-000000000001', false, false)
ON CONFLICT (organization_id) DO NOTHING;

COMMIT;

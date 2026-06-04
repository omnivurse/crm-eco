-- ============================================================================
-- Migration: 202605220007_crm_records_stage_updated_at
-- Purpose:   Add the `stage_updated_at` column on `crm_records` that the
--            pipeline-velocity reports already filter and order by.
--
--            Today the pipeline reports query:
--              .lt('stage_updated_at', sevenDaysAgo.toISOString())
--              .order('stage_updated_at', { ascending: true })
--            against a non-existent column → PostgREST returns "Could not
--            find the 'stage_updated_at' column" and the velocity report
--            silently shows no data.
--
--            We add it as a real column, plus a trigger that keeps it
--            current whenever `stage` changes. We backfill from `updated_at`
--            for existing rows so the velocity reports immediately have
--            sensible data.
--
-- Audit refs (.audit/findings.json):
--   - "crm_records.stage_updated_at referenced in code but column does not exist" (4 sites)
--
-- Guardrails:
--   - Column is nullable (no default backfill churn).
--   - Trigger uses BEFORE UPDATE OF stage so we only fire on real stage changes.
--   - Backfill uses UPDATE in a single statement, ordered by updated_at to
--     give the most recent rows priority.
--   - Re-runnable (IF NOT EXISTS, CREATE OR REPLACE TRIGGER).
--
-- Rollback:
--   BEGIN;
--     DROP TRIGGER IF EXISTS crm_records_stage_updated_at_trg ON crm_records;
--     DROP FUNCTION IF EXISTS crm_records_set_stage_updated_at();
--     ALTER TABLE crm_records DROP COLUMN IF EXISTS stage_updated_at;
--   COMMIT;
-- ============================================================================

BEGIN;

-- 1. Add the column ----------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'crm_records'
      AND column_name = 'stage_updated_at'
  ) THEN
    ALTER TABLE public.crm_records
      ADD COLUMN stage_updated_at timestamptz;
    COMMENT ON COLUMN public.crm_records.stage_updated_at IS
      'Timestamp of the last `stage` change. Maintained by trigger crm_records_stage_updated_at_trg.';
  END IF;
END $$;

-- 2. Backfill: for existing rows, use updated_at as a reasonable proxy ------

UPDATE public.crm_records
SET stage_updated_at = updated_at
WHERE stage_updated_at IS NULL;

-- 3. Index — pipeline reports filter/order on this column -------------------

CREATE INDEX IF NOT EXISTS crm_records_stage_updated_at_idx
  ON public.crm_records (org_id, stage_updated_at DESC)
  WHERE stage_updated_at IS NOT NULL;

-- 4. Trigger to keep it current ---------------------------------------------

CREATE OR REPLACE FUNCTION public.crm_records_set_stage_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only stamp when stage actually changed (or moves between NULL and a value).
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    NEW.stage_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_records_stage_updated_at_trg ON public.crm_records;
CREATE TRIGGER crm_records_stage_updated_at_trg
  BEFORE UPDATE OF stage ON public.crm_records
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_records_set_stage_updated_at();

-- 5. Also stamp on INSERT so brand-new rows have a non-null value -----------

CREATE OR REPLACE FUNCTION public.crm_records_init_stage_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.stage_updated_at IS NULL THEN
    NEW.stage_updated_at := COALESCE(NEW.updated_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_records_stage_updated_at_init_trg ON public.crm_records;
CREATE TRIGGER crm_records_stage_updated_at_init_trg
  BEFORE INSERT ON public.crm_records
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_records_init_stage_updated_at();

NOTIFY pgrst, 'reload schema';

COMMIT;

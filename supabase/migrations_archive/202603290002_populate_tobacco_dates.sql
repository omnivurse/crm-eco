-- ============================================================================
-- Phase 2: Populate tobacco_user and ensure date fields are correct
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Populate tobacco_user from JSONB data field
-- Only 9 records have tobacco_user in data, and only 1 has the column set.
-- Set from data->>'tobacco_user' where available.
-- ============================================================================
UPDATE crm_records
SET tobacco_user = CASE
  WHEN LOWER(data->>'tobacco_user') IN ('true', 'yes', '1', 'y') THEN true
  WHEN LOWER(data->>'tobacco_user') IN ('false', 'no', '0', 'n') THEN false
  ELSE NULL
END
WHERE data->>'tobacco_user' IS NOT NULL
  AND tobacco_user IS NULL;

-- ============================================================================
-- Step 2: Ensure original_start_date is populated from data->>'start_date'
-- 23,645 records have start_date in data JSONB
-- ============================================================================
UPDATE crm_records
SET original_start_date = (data->>'start_date')::date
WHERE data->>'start_date' IS NOT NULL
  AND data->>'start_date' != ''
  AND original_start_date IS NULL
  AND data->>'start_date' ~ '^\d{4}-\d{2}-\d{2}';

-- Also handle MM/DD/YYYY format
UPDATE crm_records
SET original_start_date = TO_DATE(data->>'start_date', 'MM/DD/YYYY')
WHERE data->>'start_date' IS NOT NULL
  AND data->>'start_date' != ''
  AND original_start_date IS NULL
  AND data->>'start_date' ~ '^\d{1,2}/\d{1,2}/\d{4}$';

-- ============================================================================
-- Step 3: Populate cancellation_date as a top-level column if not already
-- Add column if needed, populate from data JSONB
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crm_records' AND column_name = 'cancellation_date'
  ) THEN
    ALTER TABLE crm_records ADD COLUMN cancellation_date date;
  END IF;
END $$;

UPDATE crm_records
SET cancellation_date = (data->>'cancellation_date')::date
WHERE data->>'cancellation_date' IS NOT NULL
  AND data->>'cancellation_date' != ''
  AND cancellation_date IS NULL
  AND data->>'cancellation_date' ~ '^\d{4}-\d{2}-\d{2}';

UPDATE crm_records
SET cancellation_date = TO_DATE(data->>'cancellation_date', 'MM/DD/YYYY')
WHERE data->>'cancellation_date' IS NOT NULL
  AND data->>'cancellation_date' != ''
  AND cancellation_date IS NULL
  AND data->>'cancellation_date' ~ '^\d{1,2}/\d{1,2}/\d{4}$';

-- ============================================================================
-- Step 4: Add group_name as a top-level column for searchability
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crm_records' AND column_name = 'group_name'
  ) THEN
    ALTER TABLE crm_records ADD COLUMN group_name text;
  END IF;
END $$;

-- ============================================================================
-- Step 5: Rebuild search tsvector to include tobacco_user and group_name
-- Update the trigger function to include new fields
-- ============================================================================
CREATE OR REPLACE FUNCTION crm_records_search_update()
RETURNS trigger AS $$
BEGIN
  NEW.search := to_tsvector('english',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.email, '') || ' ' ||
    coalesce(NEW.phone, '') || ' ' ||
    coalesce(NEW.status, '') || ' ' ||
    coalesce(NEW.data->>'first_name', '') || ' ' ||
    coalesce(NEW.data->>'last_name', '') || ' ' ||
    coalesce(NEW.data->>'spouse', '') || ' ' ||
    coalesce(NEW.data->>'spouse_name', '') || ' ' ||
    coalesce(NEW.data->>'child_1_name', '') || ' ' ||
    coalesce(NEW.data->>'child_2_name', '') || ' ' ||
    coalesce(NEW.data->>'child_3_name', '') || ' ' ||
    coalesce(NEW.data->>'child_4_name', '') || ' ' ||
    coalesce(NEW.data->>'child_5_name', '') || ' ' ||
    coalesce(NEW.data->>'contact_name', '') || ' ' ||
    coalesce(NEW.data->>'mailing_city', '') || ' ' ||
    coalesce(NEW.data->>'mailing_state', '') || ' ' ||
    coalesce(NEW.data->>'carrier', '') || ' ' ||
    coalesce(NEW.data->>'product', '') || ' ' ||
    coalesce(NEW.data->>'producer_name', '') || ' ' ||
    coalesce(NEW.group_name, '') || ' ' ||
    coalesce(CASE WHEN NEW.tobacco_user = true THEN 'tobacco smoker' ELSE '' END, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS crm_records_search_trigger ON crm_records;
CREATE TRIGGER crm_records_search_trigger
  BEFORE INSERT OR UPDATE ON crm_records
  FOR EACH ROW
  EXECUTE FUNCTION crm_records_search_update();

-- ============================================================================
-- Step 6: Search vector rebuild skipped — 'search' is a generated column
-- that auto-updates via its GENERATED ALWAYS AS expression.
-- ============================================================================

-- ============================================================================
-- Step 7: Add indexes for new searchable columns
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_crm_records_tobacco_user ON crm_records (tobacco_user) WHERE tobacco_user IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_records_group_name ON crm_records (group_name) WHERE group_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_records_cancellation_date ON crm_records (cancellation_date) WHERE cancellation_date IS NOT NULL;

COMMIT;

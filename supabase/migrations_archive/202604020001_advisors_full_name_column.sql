-- ============================================================================
-- Add generated full_name column to advisors table
-- Multiple CRM queries reference advisors.full_name but it doesn't exist.
-- This adds it as a stored generated column so all existing queries work.
-- ============================================================================

ALTER TABLE advisors
  ADD COLUMN IF NOT EXISTS full_name text
  GENERATED ALWAYS AS (TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))) STORED;

COMMENT ON COLUMN advisors.full_name IS 'Auto-generated from first_name + last_name';

NOTIFY pgrst, 'reload schema';

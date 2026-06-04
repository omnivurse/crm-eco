-- Add original_start_date and current_year_start_date to crm_records
ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS original_start_date date;
ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS current_year_start_date date;

COMMENT ON COLUMN crm_records.original_start_date IS 'Date the member first enrolled (ever). Preserved across annual renewals.';
COMMENT ON COLUMN crm_records.current_year_start_date IS 'Start date of the current coverage year / renewal period.';

-- Register these fields in crm_fields for UI visibility
DO $$
DECLARE
  v_mod record;
BEGIN
  FOR v_mod IN
    SELECT id, org_id FROM crm_modules
    WHERE key IN ('contacts', 'members')
  LOOP
    INSERT INTO crm_fields (
      org_id, module_id, key, label, type, required,
      is_system, is_pinned, display_order, section, tooltip
    ) VALUES
      (v_mod.org_id, v_mod.id, 'original_start_date', 'Original Start Date', 'date', false,
       true, false, 66, 'product', 'Date the member first enrolled'),
      (v_mod.org_id, v_mod.id, 'current_year_start_date', 'Current Year Start Date', 'date', false,
       true, false, 67, 'product', 'Start date of the current coverage year')
    ON CONFLICT (module_id, key) DO NOTHING;
  END LOOP;
END $$;

-- Backfill: use existing start_date as original_start_date where not already set
UPDATE crm_records
SET original_start_date = (data->>'start_date')::date
WHERE original_start_date IS NULL
  AND data->>'start_date' IS NOT NULL
  AND data->>'start_date' ~ '^\d{4}-\d{2}-\d{2}';

-- Backfill current_year_start_date: if start_date is before this year,
-- assume current year start is Jan 1 of current year (common for annual renewals)
-- Only set if original_start_date exists and is before current year
UPDATE crm_records
SET current_year_start_date = DATE_TRUNC('year', CURRENT_DATE)::date
WHERE current_year_start_date IS NULL
  AND original_start_date IS NOT NULL
  AND original_start_date < DATE_TRUNC('year', CURRENT_DATE);

NOTIFY pgrst, 'reload schema';

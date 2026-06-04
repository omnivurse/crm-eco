-- Backfill notes_history from import_contacts_staging into crm_records.data
-- The import function included notes_history in v_data but the null-stripping
-- filter may have dropped it if the value was empty, or the data was imported
-- through a different path that didn't include notes_history.
--
-- This migration updates crm_records.data to include notes_history from the
-- staging table for any records that have a matching zoho_record_id.

DO $$
DECLARE
  v_updated int := 0;
  v_row RECORD;
BEGIN
  -- Check if the staging table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'import_contacts_staging'
  ) THEN
    RAISE NOTICE 'import_contacts_staging table does not exist, skipping backfill';
    RETURN;
  END IF;

  -- Update records that have a matching zoho_record_id in the staging table
  -- and the staging row has non-empty notes_history
  FOR v_row IN
    SELECT
      cr.id AS record_id,
      ics.notes_history
    FROM crm_records cr
    INNER JOIN import_contacts_staging ics
      ON cr.data->>'zoho_record_id' = ics.record_id
    WHERE ics.notes_history IS NOT NULL
      AND ics.notes_history != ''
      AND ics.record_id IS NOT NULL
      AND ics.record_id != ''
      AND ics.record_id != 'Record Id'
      AND (cr.data->>'notes_history' IS NULL OR cr.data->>'notes_history' = '')
  LOOP
    UPDATE crm_records
    SET data = data || jsonb_build_object('notes_history', v_row.notes_history),
        updated_at = now()
    WHERE id = v_row.record_id;

    v_updated := v_updated + 1;
  END LOOP;

  RAISE NOTICE 'Backfilled notes_history for % records', v_updated;
END $$;

-- Also backfill from crm_import_rows.raw if the staging table route didn't
-- catch everything (records imported through the API route)
DO $$
DECLARE
  v_updated int := 0;
  v_row RECORD;
BEGIN
  -- Check if crm_import_rows table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'crm_import_rows'
  ) THEN
    RAISE NOTICE 'crm_import_rows table does not exist, skipping API import backfill';
    RETURN;
  END IF;

  -- Update records from import rows raw data
  -- The raw column stores the original CSV data as JSONB with the CSV column names
  FOR v_row IN
    SELECT
      cir.record_id,
      COALESCE(
        cir.raw->>'Notes History',
        cir.raw->>'notes_history',
        cir.raw->>'Notes_History',
        cir.raw->>'NOTES_HISTORY'
      ) AS notes_history_value
    FROM crm_import_rows cir
    WHERE cir.record_id IS NOT NULL
      AND cir.status IN ('inserted', 'updated')
      AND (
        cir.raw->>'Notes History' IS NOT NULL AND cir.raw->>'Notes History' != ''
        OR cir.raw->>'notes_history' IS NOT NULL AND cir.raw->>'notes_history' != ''
        OR cir.raw->>'Notes_History' IS NOT NULL AND cir.raw->>'Notes_History' != ''
      )
  LOOP
    -- Only update if the record doesn't already have notes_history
    UPDATE crm_records
    SET data = data || jsonb_build_object('notes_history', v_row.notes_history_value),
        updated_at = now()
    WHERE id = v_row.record_id
      AND (data->>'notes_history' IS NULL OR data->>'notes_history' = '');

    IF FOUND THEN
      v_updated := v_updated + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfilled notes_history from import rows for % additional records', v_updated;
END $$;

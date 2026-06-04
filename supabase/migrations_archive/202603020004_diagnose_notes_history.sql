-- Diagnostic migration to understand why notes_history is missing
-- This only raises NOTICE messages and does not change any data

DO $$
DECLARE
  v_staging_count int;
  v_staging_with_notes int;
  v_import_rows_count int;
  v_import_rows_with_raw int;
  v_import_rows_with_notes_raw int;
  v_records_count int;
  v_records_with_zoho_id int;
  v_records_with_notes int;
  v_sample_keys text;
BEGIN
  -- 1. Check import_contacts_staging
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'import_contacts_staging') THEN
    SELECT count(*) INTO v_staging_count FROM import_contacts_staging;
    SELECT count(*) INTO v_staging_with_notes FROM import_contacts_staging
      WHERE notes_history IS NOT NULL AND notes_history != '';
    RAISE NOTICE 'STAGING: total=%, with_notes=%', v_staging_count, v_staging_with_notes;
  ELSE
    RAISE NOTICE 'STAGING: table does not exist';
  END IF;

  -- 2. Check crm_import_rows
  SELECT count(*) INTO v_import_rows_count FROM crm_import_rows;
  SELECT count(*) INTO v_import_rows_with_raw FROM crm_import_rows WHERE raw IS NOT NULL;
  SELECT count(*) INTO v_import_rows_with_notes_raw FROM crm_import_rows
    WHERE raw->>'Notes History' IS NOT NULL AND raw->>'Notes History' != '';
  RAISE NOTICE 'IMPORT_ROWS: total=%, with_raw=%, with_notes_in_raw=%',
    v_import_rows_count, v_import_rows_with_raw, v_import_rows_with_notes_raw;

  -- 3. Check crm_records
  SELECT count(*) INTO v_records_count FROM crm_records;
  SELECT count(*) INTO v_records_with_zoho_id FROM crm_records
    WHERE data->>'zoho_record_id' IS NOT NULL;
  SELECT count(*) INTO v_records_with_notes FROM crm_records
    WHERE data->>'notes_history' IS NOT NULL AND data->>'notes_history' != '';
  RAISE NOTICE 'RECORDS: total=%, with_zoho_id=%, with_notes_history=%',
    v_records_count, v_records_with_zoho_id, v_records_with_notes;

  -- 4. Sample a record's data keys
  SELECT string_agg(key, ', ' ORDER BY key)
  INTO v_sample_keys
  FROM (
    SELECT DISTINCT key
    FROM crm_records, jsonb_each_text(data)
    LIMIT 50
  ) sub;
  RAISE NOTICE 'SAMPLE DATA KEYS: %', v_sample_keys;

  -- 5. Check if any record has a key containing 'note' (case insensitive)
  SELECT string_agg(DISTINCT key, ', ')
  INTO v_sample_keys
  FROM crm_records, jsonb_each_text(data)
  WHERE lower(key) LIKE '%note%';
  RAISE NOTICE 'KEYS WITH NOTE: %', COALESCE(v_sample_keys, '(none)');

END $$;

-- Diagnostic: count distinct records with notes
DO $$
DECLARE
  v_unique_records int;
  v_total_notes int;
  v_records_with_history int;
BEGIN
  SELECT count(DISTINCT record_id) INTO v_unique_records FROM crm_notes;
  SELECT count(*) INTO v_total_notes FROM crm_notes;
  SELECT count(*) INTO v_records_with_history FROM crm_records
    WHERE data->>'notes_history' IS NOT NULL AND data->>'notes_history' != '';
  
  RAISE NOTICE 'NOTES STATS: total_crm_notes=%, unique_records_with_notes=%, records_with_notes_history=%',
    v_total_notes, v_unique_records, v_records_with_history;
END $$;

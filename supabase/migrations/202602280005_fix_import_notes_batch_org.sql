-- Fix import_notes_batch to not rely on "organizations LIMIT 1" which may
-- pick the wrong org when multiple orgs exist.  Instead, derive the org_id
-- from the parent crm_record itself, so it always matches.

CREATE OR REPLACE FUNCTION import_notes_batch(p_offset int DEFAULT 0, p_limit int DEFAULT 1000)
RETURNS TABLE(imported int, skipped int, errors int) AS $$
DECLARE
  v_imported int := 0;
  v_skipped int := 0;
  v_errors int := 0;
  v_row RECORD;
  v_parent_record_id uuid;
  v_parent_org_id uuid;
BEGIN
  FOR v_row IN
    SELECT * FROM import_notes_staging
    WHERE record_id IS NOT NULL AND record_id != 'Record Id' AND record_id != ''
      AND note_content IS NOT NULL AND note_content != ''
    ORDER BY row_num
    OFFSET p_offset LIMIT p_limit
  LOOP
    BEGIN
      -- Look up parent CRM record by zoho_record_id (no org filter needed)
      SELECT id, org_id INTO v_parent_record_id, v_parent_org_id
      FROM crm_records
      WHERE data->>'zoho_record_id' = v_row.parent_id
      LIMIT 1;

      IF v_parent_record_id IS NULL THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      INSERT INTO crm_notes (org_id, record_id, body, is_pinned, created_at, updated_at)
      VALUES (v_parent_org_id, v_parent_record_id, v_row.note_content, false,
              COALESCE(_parse_import_datetime(v_row.created_time), now()),
              COALESCE(_parse_import_datetime(v_row.modified_time), now()));
      v_imported := v_imported + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT v_imported, v_skipped, v_errors;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION import_notes_batch(int, int) SET statement_timeout = '120s';

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- recover_zoho_notes_for_org(p_org_id, p_since)
--
-- Promotes rows from `import_notes_staging` into `crm_notes` for the given
-- organization. Matches notes to records by joining
--
--     import_notes_staging.parent_id  ↔  crm_records.data->>'zoho_record_id'
--
-- with the 'zcrm_' prefix tolerated on either side (older exports omit it).
--
-- Idempotent: a staging row is skipped if a `crm_notes` row with the same
-- record_id + body already exists within ±1 minute of its Zoho created_time.
-- Re-running cannot duplicate notes.
--
-- Returns one row with counts. Useful to call after `scripts/recover-zoho-notes.ts`
-- has staged a fresh Zoho CSV.
--
-- Parameters:
--   p_org_id  — the destination organization (PIFH or whoever)
--   p_since   — optional lower bound on staging.created_time; if null the
--               whole staging table is considered. Pass '2026-03-20' to
--               only process notes created after the original CSV export.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recover_zoho_notes_for_org(
  p_org_id uuid,
  p_since  timestamptz DEFAULT NULL
)
RETURNS TABLE (
  inserted_count       int,
  total_considered     int,
  duplicate_count      int,
  orphan_parent_count  int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_inserted int := 0;
  v_dupes    int := 0;
  v_total    int := 0;
  v_orphans  int := 0;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'p_org_id is required';
  END IF;

  -- ------------------------------------------------------------------------
  -- Working set: every staged row that has a body and resolves to a current
  -- crm_records.id in the requested org.
  -- ------------------------------------------------------------------------
  CREATE TEMP TABLE _zoho_notes_work ON COMMIT DROP AS
  SELECT
    s.row_num,
    r.id                                                        AS crm_record_id,
    p_org_id                                                    AS org_id,
    trim(s.note_content)                                        AS body,
    COALESCE(
      NULLIF(s.created_time, '')::timestamp AT TIME ZONE 'America/Denver',
      now()
    )                                                           AS created_at
  FROM import_notes_staging s
  JOIN crm_records r
    ON r.org_id = p_org_id
   AND (
         r.data->>'zoho_record_id' = s.parent_id
      OR r.data->>'zoho_record_id' = 'zcrm_' || s.parent_id
      OR replace(r.data->>'zoho_record_id', 'zcrm_', '') = s.parent_id
     )
  WHERE s.note_content IS NOT NULL
    AND trim(s.note_content) <> ''
    AND (p_since IS NULL OR NULLIF(s.created_time, '')::timestamp >= p_since);

  SELECT count(*) INTO v_total FROM _zoho_notes_work;

  -- ------------------------------------------------------------------------
  -- Drop rows whose body already exists on the same record near the same time.
  -- ------------------------------------------------------------------------
  DELETE FROM _zoho_notes_work t
  USING crm_notes n
  WHERE n.record_id = t.crm_record_id
    AND n.body = t.body
    AND n.created_at BETWEEN t.created_at - interval '1 minute'
                          AND t.created_at + interval '1 minute';

  GET DIAGNOSTICS v_dupes = ROW_COUNT;

  -- ------------------------------------------------------------------------
  -- Insert.
  -- ------------------------------------------------------------------------
  INSERT INTO crm_notes (org_id, record_id, body, is_pinned, created_by, created_at, updated_at)
  SELECT
    t.org_id,
    t.crm_record_id,
    t.body,
    false,
    NULL::uuid,
    t.created_at,
    now()
  FROM _zoho_notes_work t;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- ------------------------------------------------------------------------
  -- Count staging rows whose parent record we couldn't match.
  -- ------------------------------------------------------------------------
  SELECT count(*)
    INTO v_orphans
  FROM import_notes_staging s
  LEFT JOIN crm_records r
    ON r.org_id = p_org_id
   AND (
         r.data->>'zoho_record_id' = s.parent_id
      OR r.data->>'zoho_record_id' = 'zcrm_' || s.parent_id
      OR replace(r.data->>'zoho_record_id', 'zcrm_', '') = s.parent_id
     )
  WHERE r.id IS NULL
    AND s.note_content IS NOT NULL
    AND trim(s.note_content) <> ''
    AND (p_since IS NULL OR NULLIF(s.created_time, '')::timestamp >= p_since);

  RETURN QUERY SELECT v_inserted, v_total, v_dupes, v_orphans;
END
$fn$;

COMMENT ON FUNCTION public.recover_zoho_notes_for_org(uuid, timestamptz) IS
  'Promotes import_notes_staging rows into crm_notes for the given org. Idempotent.';

-- Lock it down: only authenticated CRM admins/managers should be able to call
-- this from the API. The script invokes it with the service-role key, which
-- bypasses RLS but still goes through this grant.
REVOKE EXECUTE ON FUNCTION public.recover_zoho_notes_for_org(uuid, timestamptz) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.recover_zoho_notes_for_org(uuid, timestamptz) TO service_role;

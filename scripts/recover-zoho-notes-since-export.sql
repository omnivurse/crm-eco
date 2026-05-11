-- ============================================================================
-- ZOHO NOTES RECOVERY — for records created after the 2026-03-20 CSV export.
--
-- Symptom: contacts/leads imported via `import-zoho-2026-03-20.ts` got their
-- field data, but any note created in Zoho AFTER the export cut-off date
-- never made it into `crm_notes`. Wendy reported this on Jacinta Olson
-- (record `d0972a17-bb33-4331-87e8-29eb0607e4a6`, zoho id starts
--  `zcrm_1579374000181370…`, created here 2026-03-29).
--
-- Recovery (one-shot, idempotent — safe to re-run):
--   1. In Zoho CRM:
--        Setup → Data Administration → Export
--        Module = Notes
--        Filter:  Created Time  AFTER  2026-03-20
--        Format = CSV
--      Save the CSV as Notes_Since_2026_03_20.csv.
--
--   2. In Supabase Studio (project sffisarikcreyyjzdjvb):
--        Table Editor → import_notes_staging → Insert → Import data from CSV
--        Upload the CSV. Map columns:
--          Record Id      → record_id      (the note's own Zoho id)
--          Parent Id      → parent_id      (the contact/lead/deal Zoho id)
--          Parent Name    → parent_name
--          Note Content   → note_content
--          Note Title     → note_title
--          Note Owner     → note_owner
--          Created Time   → created_time
--          Modified Time  → modified_time
--          Created By     → created_by
--      Leave row_num empty — Studio assigns it.
--      Click Save. Rows land in `import_notes_staging`.
--
--   3. Run this script in the SQL Editor. It will:
--        - Tag every newly-staged note with the matching crm_records.id
--          (joining on parent_id == crm_records.data->>'zoho_record_id'),
--        - Insert into crm_notes with the PIFH org_id and the original
--          Zoho created_time preserved,
--        - Skip any note already present (idempotent — no duplicates).
--      Final SELECT prints how many notes were inserted, how many were
--      skipped, and any staging rows that did NOT match a current record
--      (so we can decide whether to back-fill the parent record).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Resolve PIFH org id once.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id
  FROM organizations
  WHERE name ILIKE '%Pay It Forward%'
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'PIFH organization not found';
  END IF;

  -- Stash in a temp setting so the rest of the script can read it.
  PERFORM set_config('app.pifh_org_id', v_org_id::text, true);
END$$;

-- ----------------------------------------------------------------------------
-- 2. Build a working set of "stageable" notes that have:
--      - a non-empty note_content
--      - a parent_id that matches a current crm_records.data->>'zoho_record_id'
--    Match the Zoho id with or without the 'zcrm_' prefix.
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE _zoho_notes_to_import AS
SELECT
  s.row_num,
  r.id                                     AS crm_record_id,
  current_setting('app.pifh_org_id')::uuid AS org_id,
  trim(s.note_content)                     AS body,
  s.created_by                             AS zoho_author_name,
  -- Coerce Zoho time -> timestamptz. Zoho exports as local time without TZ;
  -- treat as US/Mountain (PIFH's home tz). Falls back to now() if unparseable.
  COALESCE(
    NULLIF(s.created_time, '')::timestamp AT TIME ZONE 'America/Denver',
    now()
  )                                        AS created_at
FROM import_notes_staging s
JOIN crm_records r
  ON r.org_id = current_setting('app.pifh_org_id')::uuid
 AND (
       r.data->>'zoho_record_id' = s.parent_id                       -- 'zcrm_…'
    OR r.data->>'zoho_record_id' = 'zcrm_' || s.parent_id            -- bare id in staging
    OR replace(r.data->>'zoho_record_id', 'zcrm_', '') = s.parent_id -- bare id in records
  )
WHERE s.note_content IS NOT NULL
  AND trim(s.note_content) <> '';

-- ----------------------------------------------------------------------------
-- 3. Idempotency: drop any rows whose body already exists on the same record
--    within ±1 minute of the same created_at. Identical body + record + time
--    is treated as "already migrated".
-- ----------------------------------------------------------------------------
DELETE FROM _zoho_notes_to_import t
USING crm_notes n
WHERE n.record_id = t.crm_record_id
  AND n.body = t.body
  AND n.created_at BETWEEN t.created_at - interval '1 minute'
                        AND t.created_at + interval '1 minute';

-- ----------------------------------------------------------------------------
-- 4. Insert. Preserve Zoho created_at; updated_at = now().
-- ----------------------------------------------------------------------------
INSERT INTO crm_notes (org_id, record_id, body, is_pinned, created_by, created_at, updated_at)
SELECT
  t.org_id,
  t.crm_record_id,
  t.body,
  false,
  NULL::uuid,        -- crm_notes.created_by is the profile uuid; Zoho author
                     -- name is not the same identity. Left null so notes show
                     -- the author from the body / signature text.
  t.created_at,
  now()
FROM _zoho_notes_to_import t;

-- ----------------------------------------------------------------------------
-- 5. Report.
-- ----------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM _zoho_notes_to_import)        AS inserted_now,
  (SELECT count(*) FROM import_notes_staging)         AS total_staged,
  (SELECT count(*) FROM crm_notes
    WHERE org_id = current_setting('app.pifh_org_id')::uuid) AS total_crm_notes_for_pifh;

-- Unmatched staging rows — note's parent_id doesn't match any current record.
-- Likely causes: parent contact/lead also wasn't imported, or the parent was
-- merged away. Spot-check these; back-fill the parent record if it should
-- exist, then re-run this script (idempotency dedupes safely).
SELECT
  s.parent_id,
  s.parent_name,
  count(*) AS orphan_notes,
  min(s.created_time) AS earliest_note,
  max(s.created_time) AS latest_note
FROM import_notes_staging s
LEFT JOIN crm_records r
  ON r.org_id = current_setting('app.pifh_org_id')::uuid
 AND (
       r.data->>'zoho_record_id' = s.parent_id
    OR r.data->>'zoho_record_id' = 'zcrm_' || s.parent_id
    OR replace(r.data->>'zoho_record_id', 'zcrm_', '') = s.parent_id
  )
WHERE r.id IS NULL
GROUP BY s.parent_id, s.parent_name
ORDER BY count(*) DESC
LIMIT 50;

COMMIT;

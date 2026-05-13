-- ============================================================================
-- READ-ONLY VERIFICATION  —  safe to run at any time
--
-- This script contains ZERO data mutations. No INSERT, no UPDATE, no DELETE,
-- no TRUNCATE, no DROP, no ALTER, no \copy. Pure SELECTs against the live
-- database. Safe to run before, between, or after any phase of the pipeline.
--
-- Use it to answer:
--   * Is the migration applied? (Does import_leads_staging exist? Does
--     upsert_leads_batch exist?)
--   * What are the current row counts for PIFH leads / contacts / notes?
--   * What's been edited recently? (audit log)
--   * What does a sampling of records look like? (so you can compare
--     before vs. after import)
--   * Are the staging tables empty? (they should be, between runs)
--
-- Run with:
--   psql "$SUPABASE_DB_URL" -f verify_only.sql
--
-- Or save the output:
--   psql "$SUPABASE_DB_URL" -f verify_only.sql > verify_$(date +%Y%m%d_%H%M%S).txt
-- ============================================================================

\pset format aligned
\pset null '∅'
\set ON_ERROR_STOP on
\timing off

\echo ''
\echo '############################################################'
\echo '# READ-ONLY VERIFICATION REPORT'
\echo '# Target org: ac6e7228-2ea0-4582-8464-562c3e8ac56e (PIFH)'
\echo '############################################################'
\echo ''

-- ----------------------------------------------------------------------------
-- 1. PRE-FLIGHT: schema objects
--    Confirms the migration has been applied. Each row should be 't'.
-- ----------------------------------------------------------------------------
\echo '── 1. SCHEMA PRESENCE ───────────────────────────────────────'

SELECT
  to_regclass('public.crm_records')                    IS NOT NULL AS crm_records_table,
  to_regclass('public.crm_notes')                      IS NOT NULL AS crm_notes_table,
  to_regclass('public.crm_modules')                    IS NOT NULL AS crm_modules_table,
  to_regclass('public.import_contacts_staging')        IS NOT NULL AS contacts_staging,
  to_regclass('public.import_notes_staging')           IS NOT NULL AS notes_staging,
  to_regclass('public.import_leads_staging')           IS NOT NULL AS leads_staging_new;

SELECT
  to_regprocedure('public.upsert_contacts_batch(int, int)')              IS NOT NULL AS upsert_contacts_batch,
  to_regprocedure('public.upsert_leads_batch(int, int, uuid)')           IS NOT NULL AS upsert_leads_batch_new,
  to_regprocedure('public.recover_zoho_notes_for_org(uuid, timestamptz)') IS NOT NULL AS recover_zoho_notes_rpc;

-- ----------------------------------------------------------------------------
-- 2. PIFH ORG + MODULES
--    The org_id we'll be writing to and which crm_modules exist for it.
-- ----------------------------------------------------------------------------
\echo ''
\echo '── 2. PIFH ORG + MODULES ────────────────────────────────────'

SELECT id, name, created_at
  FROM organizations
 WHERE id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e';

SELECT id, key, name, is_enabled
  FROM crm_modules
 WHERE org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
   AND key IN ('leads', 'contacts')
 ORDER BY key;

-- ----------------------------------------------------------------------------
-- 3. CURRENT ROW COUNTS
--    Before the run, leads count is likely 0. Contacts should be the count
--    from your 03_20 import. Notes is whatever crm_notes currently holds.
--    AFTER the run: leads ~= 1036, contacts UNCHANGED, notes increased.
-- ----------------------------------------------------------------------------
\echo ''
\echo '── 3. CURRENT ROW COUNTS (org-scoped) ───────────────────────'

SELECT
  m.key AS module,
  count(*) AS row_count
FROM crm_records r
JOIN crm_modules m ON m.id = r.module_id
WHERE r.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
GROUP BY m.key
ORDER BY m.key;

SELECT 'crm_notes (PIFH)' AS table_, count(*)
  FROM crm_notes
 WHERE org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e';

-- ----------------------------------------------------------------------------
-- 4. STAGING TABLES — should be empty between runs
--    If non-zero, a prior import is mid-flight or never cleaned up.
-- ----------------------------------------------------------------------------
\echo ''
\echo '── 4. STAGING TABLE STATE ───────────────────────────────────'

SELECT 'import_contacts_staging' AS tbl, count(*) FROM import_contacts_staging;
SELECT 'import_leads_staging'    AS tbl, count(*) FROM import_leads_staging;
SELECT 'import_notes_staging'    AS tbl, count(*) FROM import_notes_staging;

-- ----------------------------------------------------------------------------
-- 5. RECENT EDIT ACTIVITY (last 30 days)
--    Records modified since the 03_20 import — these have staff edits we
--    want to make absolutely sure we don't lose. After the pipeline runs,
--    re-run this — the count should be ≥ this baseline (never less).
-- ----------------------------------------------------------------------------
\echo ''
\echo '── 5. RECENT CONTACT EDITS (last 30 days) ──────────────────'

SELECT
  m.key AS module,
  count(*) FILTER (WHERE r.updated_at > now() - interval '30 days') AS edited_in_30d,
  count(*) FILTER (WHERE r.updated_at > now() - interval '7 days')  AS edited_in_7d,
  count(*) FILTER (WHERE r.updated_at > now() - interval '1 day')   AS edited_in_1d
FROM crm_records r
JOIN crm_modules m ON m.id = r.module_id
WHERE r.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
GROUP BY m.key
ORDER BY m.key;

-- ----------------------------------------------------------------------------
-- 6. AUDIT-LOG sanity (last 24h on crm_records)
--    Shows recent INSERTs / UPDATEs. If you see UPDATE actions on contacts
--    in here AFTER you run the pipeline, that's a red flag — investigate.
-- ----------------------------------------------------------------------------
\echo ''
\echo '── 6. AUDIT LOG (crm_records, last 24h) ────────────────────'

SELECT
  action,
  count(*)
FROM crm_audit_log
WHERE entity = 'crm_records'
  AND org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
  AND created_at > now() - interval '24 hours'
GROUP BY action
ORDER BY action;

-- ----------------------------------------------------------------------------
-- 7. SAMPLE CONTACTS (10 most-recently-edited) — for before/after comparison
--    Save this output BEFORE running the pipeline. Run again AFTER. If any
--    of these contacts' data->>'first_name', data->>'spouse', etc. changed
--    in a way that doesn't reflect a staff edit you can identify, ABORT.
-- ----------------------------------------------------------------------------
\echo ''
\echo '── 7. RECENTLY-EDITED CONTACTS (top 10) ─────────────────────'

SELECT
  r.id,
  r.title,
  r.email,
  r.phone,
  r.status,
  r.data->>'zoho_record_id'  AS zoho_id,
  r.data->>'spouse'          AS spouse,
  r.data->>'carrier'         AS carrier,
  r.data->>'monthly_premium' AS monthly_premium,
  r.updated_at
FROM crm_records r
JOIN crm_modules m ON m.id = r.module_id
WHERE r.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
  AND m.key = 'contacts'
ORDER BY r.updated_at DESC
LIMIT 10;

-- ----------------------------------------------------------------------------
-- 8. LEAD COVERAGE — how many of the 1,036 cleaned leads are already in
--    the database vs not. Pre-import expectation: 0 already exist.
--    If non-zero, the upsert function would UPDATE them — the hardened
--    "existing wins" merge still protects staff edits, but you should
--    know about overlap.
-- ----------------------------------------------------------------------------
\echo ''
\echo '── 8. CLEANED-LEADS OVERLAP WITH EXISTING crm_records ──────'

SELECT
  count(*) FILTER (WHERE m.key = 'leads')    AS overlap_with_existing_leads,
  count(*) FILTER (WHERE m.key = 'contacts') AS overlap_with_existing_contacts,
  count(*)                                    AS total_overlap_rows
FROM import_leads_staging s
JOIN crm_records r
  ON  r.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
  AND r.data->>'zoho_record_id' = s.record_id
JOIN crm_modules m ON m.id = r.module_id;

-- ----------------------------------------------------------------------------
-- 9. SAMPLE STAGED ROWS — what's actually loaded in staging, if anything.
--    Empty before/after a clean run.
-- ----------------------------------------------------------------------------
\echo ''
\echo '── 9. STAGED ROW SAMPLES (first 3 of each, if any) ─────────'

SELECT 'leads_staging' AS tbl, record_id, first_name, last_name, email, lead_status
  FROM import_leads_staging
 ORDER BY row_num LIMIT 3;

SELECT 'notes_staging' AS tbl, record_id, parent_id, note_title, length(note_content) AS body_len
  FROM import_notes_staging
 ORDER BY row_num LIMIT 3;

-- ----------------------------------------------------------------------------
-- 10. ORPHAN-NOTE FORECAST — for a more accurate post-import expectation.
--     How many staged notes will find a parent in crm_records? Mirrors what
--     recover_zoho_notes_for_org will report as `inserted_count` vs
--     `orphan_parent_count`. Pure SELECT, no writes.
-- ----------------------------------------------------------------------------
\echo ''
\echo '── 10. NOTE → PARENT MATCH FORECAST ────────────────────────'

WITH matched AS (
  SELECT count(*) AS n
    FROM import_notes_staging s
   WHERE s.note_content IS NOT NULL AND trim(s.note_content) <> ''
     AND EXISTS (
       SELECT 1 FROM crm_records r
        WHERE r.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
          AND (
            r.data->>'zoho_record_id' = s.parent_id
         OR r.data->>'zoho_record_id' = 'zcrm_' || s.parent_id
         OR replace(r.data->>'zoho_record_id', 'zcrm_', '') = s.parent_id
          )
     )
),
total AS (
  SELECT count(*) AS n FROM import_notes_staging
    WHERE note_content IS NOT NULL AND trim(note_content) <> ''
)
SELECT
  total.n   AS total_staged_notes,
  matched.n AS expected_to_insert,
  (total.n - matched.n) AS expected_orphans
FROM total, matched;

\echo ''
\echo '############################################################'
\echo '# END OF VERIFICATION — no data was modified.'
\echo '############################################################'
\echo ''

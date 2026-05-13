-- ============================================================================
-- POST-APPLY INVARIANT VERIFIER  —  READ-ONLY
--
-- Run this AFTER run_leads_and_notes_APPLY.sql to confirm the pipeline did
-- exactly what it was supposed to and nothing else. Each check returns a
-- status column showing ✅ PASS or ❌ FAIL.
--
-- Zero DML. Safe to re-run.
--
-- Default detection window: 30 minutes. If you ran the apply more than 30
-- minutes ago, edit the line below.
--
-- Run with:
--   psql "$SUPABASE_DB_URL" -f verify_only_post_apply.sql > post_apply_$(date +%Y%m%d_%H%M%S).txt
-- ============================================================================

\pset format aligned
\pset null '∅'
\set ON_ERROR_STOP on
\timing off

-- Adjust here if your apply ran longer ago:
\set window_minutes 30

\echo ''
\echo '############################################################'
\echo '# POST-APPLY VERIFICATION'
\echo '# Window: last 30 minutes (edit window_minutes at top if needed)'
\echo '# Target org: ac6e7228-2ea0-4582-8464-562c3e8ac56e (PIFH)'
\echo '############################################################'

-- ----------------------------------------------------------------------------
-- INVARIANT 1: Schema objects still present
-- (Migration didn't get rolled back or partial)
-- ----------------------------------------------------------------------------
\echo ''
\echo '── INVARIANT 1: SCHEMA INTACT ──────────────────────────────'

WITH schema_check AS (
  SELECT
    to_regclass('public.crm_records')                                       IS NOT NULL AS r1,
    to_regclass('public.crm_notes')                                         IS NOT NULL AS r2,
    to_regclass('public.crm_modules')                                       IS NOT NULL AS r3,
    to_regclass('public.import_leads_staging')                              IS NOT NULL AS r4,
    to_regclass('public.import_contacts_staging')                           IS NOT NULL AS r5,
    to_regclass('public.import_notes_staging')                              IS NOT NULL AS r6,
    to_regprocedure('public.upsert_leads_batch(int, int, uuid)')            IS NOT NULL AS f1,
    to_regprocedure('public.upsert_contacts_batch(int, int)')               IS NOT NULL AS f2,
    to_regprocedure('public.recover_zoho_notes_for_org(uuid, timestamptz)') IS NOT NULL AS f3
)
SELECT
  CASE WHEN r1 AND r2 AND r3 AND r4 AND r5 AND r6 AND f1 AND f2 AND f3
       THEN '✅ PASS — all expected tables and functions present'
       ELSE '❌ FAIL — see column flags below' END AS status,
  *
FROM schema_check;

-- ----------------------------------------------------------------------------
-- INVARIANT 2: Contacts NOT touched by the apply transaction
-- This is THE most important check. If any contact has updated_at within
-- the window, something other than the pipeline (or the pipeline going wrong)
-- modified it.
-- ----------------------------------------------------------------------------
\echo ''
\echo '── INVARIANT 2: CONTACTS UNTOUCHED IN WINDOW ───────────────'

SELECT
  CASE WHEN count(*) = 0 THEN '✅ PASS — no contacts modified in window'
       ELSE '❌ FAIL — '||count(*)||' contacts have updated_at in window' END AS status,
  count(*) AS contacts_modified_in_window
FROM crm_records r
JOIN crm_modules m ON m.id = r.module_id
WHERE r.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
  AND m.key = 'contacts'
  AND r.updated_at > now() - (:'window_minutes' || ' minutes')::interval;

-- ----------------------------------------------------------------------------
-- INVARIANT 3: Audit log shows no UPDATE actions on contacts in window
-- Belt-and-suspenders check against invariant 2 — different data source.
-- ----------------------------------------------------------------------------
\echo ''
\echo '── INVARIANT 3: AUDIT LOG NO CONTACT-UPDATES ───────────────'

WITH contact_updates AS (
  SELECT count(*) AS n
  FROM crm_audit_log al
  JOIN crm_records r ON r.id = al.entity_id
  JOIN crm_modules m ON m.id = r.module_id
  WHERE al.entity = 'crm_records'
    AND al.action = 'update'
    AND al.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
    AND m.key = 'contacts'
    AND al.created_at > now() - (:'window_minutes' || ' minutes')::interval
)
SELECT
  CASE WHEN n = 0 THEN '✅ PASS — audit log has no contact UPDATE entries in window'
       ELSE '❌ FAIL — '||n||' contact UPDATE entries in window — investigate' END AS status,
  n AS contact_updates_in_window
FROM contact_updates;

-- ----------------------------------------------------------------------------
-- INVARIANT 4: Leads inserted within window — expected ≈ 1,036
-- (or fewer, if any leads existed before and got UPDATEd instead of inserted)
-- ----------------------------------------------------------------------------
\echo ''
\echo '── INVARIANT 4: LEADS CREATED IN WINDOW ────────────────────'

SELECT
  CASE WHEN count(*) BETWEEN 900 AND 1100
       THEN '✅ PASS — '||count(*)||' leads created in window (expected ~1,036)'
       WHEN count(*) = 0
       THEN '⚠️ ZERO leads created — did the apply run? Check the apply log.'
       ELSE '⚠️ '||count(*)||' leads created — outside expected 900-1100 range, review' END AS status,
  count(*) AS leads_created_in_window
FROM crm_records r
JOIN crm_modules m ON m.id = r.module_id
WHERE r.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
  AND m.key = 'leads'
  AND r.created_at > now() - (:'window_minutes' || ' minutes')::interval;

-- ----------------------------------------------------------------------------
-- INVARIANT 5: Notes inserted within window — expected > 0 and <= 99,832
-- Most-likely value is around 1,191 (notes that linked to leads in the
-- consolidation), but if you imported contacts in a prior session, it
-- could be larger as notes find more parents.
-- ----------------------------------------------------------------------------
\echo ''
\echo '── INVARIANT 5: NOTES CREATED IN WINDOW ────────────────────'

SELECT
  CASE WHEN count(*) BETWEEN 1 AND 99832
       THEN '✅ PASS — '||count(*)||' notes inserted in window'
       WHEN count(*) = 0
       THEN '⚠️ ZERO notes inserted — orphan_parent_count may have been 100%, or apply did not run'
       ELSE '❌ FAIL — '||count(*)||' notes is more than staged ('||99832||')' END AS status,
  count(*) AS notes_created_in_window
FROM crm_notes
WHERE org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
  AND created_at > now() - (:'window_minutes' || ' minutes')::interval;

-- ----------------------------------------------------------------------------
-- INVARIANT 6: All leads have proper module_id and required fields
-- ----------------------------------------------------------------------------
\echo ''
\echo '── INVARIANT 6: NEW LEADS WELL-FORMED ──────────────────────'

WITH new_leads AS (
  SELECT *
  FROM crm_records
  WHERE org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
    AND created_at > now() - (:'window_minutes' || ' minutes')::interval
    AND module_id = (
      SELECT id FROM crm_modules
      WHERE org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e' AND key = 'leads'
    )
)
SELECT
  CASE WHEN count(*) = count(*) FILTER (WHERE module_id IS NOT NULL
                                          AND data->>'zoho_record_id' IS NOT NULL
                                          AND title IS NOT NULL)
       THEN '✅ PASS — all new leads have module_id, zoho_record_id, title'
       ELSE '❌ FAIL — some new leads missing required fields' END AS status,
  count(*) AS total_new_leads,
  count(*) FILTER (WHERE module_id IS NULL)                   AS missing_module_id,
  count(*) FILTER (WHERE data->>'zoho_record_id' IS NULL)     AS missing_zoho_id,
  count(*) FILTER (WHERE title IS NULL OR title = '')          AS missing_title,
  count(*) FILTER (WHERE email IS NOT NULL AND email <> '')   AS with_email,
  count(*) FILTER (WHERE phone IS NOT NULL AND phone <> '')   AS with_phone
FROM new_leads;

-- ----------------------------------------------------------------------------
-- INVARIANT 7: Every staged lead is now in crm_records
-- Compares import_leads_staging (1,036 rows after apply) against
-- crm_records via zoho_record_id. Should be zero missing.
-- ----------------------------------------------------------------------------
\echo ''
\echo '── INVARIANT 7: ALL STAGED LEADS LANDED ────────────────────'

WITH missing AS (
  SELECT s.record_id, s.first_name, s.last_name, s.email
  FROM import_leads_staging s
  WHERE NOT EXISTS (
    SELECT 1 FROM crm_records r
    WHERE r.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
      AND r.data->>'zoho_record_id' = s.record_id
  )
)
SELECT
  CASE WHEN (SELECT count(*) FROM missing) = 0
       THEN '✅ PASS — every staged lead found in crm_records'
       ELSE '❌ FAIL — '||(SELECT count(*) FROM missing)||' staged leads not found' END AS status,
  (SELECT count(*) FROM missing) AS missing_count;

-- Show up to 10 missing rows if any
SELECT 'MISSING LEAD' AS issue, record_id, first_name, last_name, email
FROM import_leads_staging s
WHERE NOT EXISTS (
  SELECT 1 FROM crm_records r
  WHERE r.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
    AND r.data->>'zoho_record_id' = s.record_id
)
LIMIT 10;

-- ----------------------------------------------------------------------------
-- INVARIANT 8: Sample 5 leads — show their fields so you can eyeball
-- ----------------------------------------------------------------------------
\echo ''
\echo '── INVARIANT 8: SAMPLE 5 NEW LEADS (eyeball check) ─────────'

SELECT
  r.title,
  r.email,
  r.phone,
  r.status,
  r.data->>'zoho_record_id' AS zoho_id,
  r.data->>'lead_source'    AS lead_source,
  r.data->>'lead_owner'     AS owner,
  r.data->>'company'        AS company,
  r.created_at
FROM crm_records r
JOIN crm_modules m ON m.id = r.module_id
WHERE r.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
  AND m.key = 'leads'
  AND r.created_at > now() - (:'window_minutes' || ' minutes')::interval
ORDER BY r.created_at DESC
LIMIT 5;

-- ----------------------------------------------------------------------------
-- INVARIANT 9: Sample 10 recently-edited contacts — diff against
-- verify_only.sql section 7 output saved BEFORE the apply.
-- If any field changed unexpectedly, you'll see it here.
-- ----------------------------------------------------------------------------
\echo ''
\echo '── INVARIANT 9: SAME 10 CONTACTS AS verify_only.sql §7 ─────'
\echo '   Compare side-by-side with your BEFORE snapshot.'

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
-- INVARIANT 10: Recent audit-log activity summary
-- Shows what actions were logged within the window, grouped by entity type.
-- Expected: many INSERTs on crm_records (leads), no UPDATEs on contacts.
-- ----------------------------------------------------------------------------
\echo ''
\echo '── INVARIANT 10: AUDIT LOG SUMMARY IN WINDOW ───────────────'

SELECT
  al.entity,
  al.action,
  count(*) AS n
FROM crm_audit_log al
WHERE al.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
  AND al.created_at > now() - (:'window_minutes' || ' minutes')::interval
GROUP BY al.entity, al.action
ORDER BY al.entity, al.action;

-- ----------------------------------------------------------------------------
-- SUMMARY CARD
-- ----------------------------------------------------------------------------
\echo ''
\echo '── SUMMARY CARD ────────────────────────────────────────────'

SELECT
  (SELECT count(*) FROM crm_records r JOIN crm_modules m ON m.id = r.module_id
    WHERE r.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e' AND m.key = 'leads')    AS total_leads,
  (SELECT count(*) FROM crm_records r JOIN crm_modules m ON m.id = r.module_id
    WHERE r.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e' AND m.key = 'contacts') AS total_contacts,
  (SELECT count(*) FROM crm_notes
    WHERE org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e')                          AS total_notes,
  (SELECT count(*) FROM crm_records r JOIN crm_modules m ON m.id = r.module_id
    WHERE r.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e' AND m.key = 'leads'
      AND r.created_at > now() - (:'window_minutes' || ' minutes')::interval)       AS leads_added_in_window,
  (SELECT count(*) FROM crm_notes
    WHERE org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'
      AND created_at > now() - (:'window_minutes' || ' minutes')::interval)         AS notes_added_in_window,
  (SELECT count(*) FROM crm_records r JOIN crm_modules m ON m.id = r.module_id
    WHERE r.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e' AND m.key = 'contacts'
      AND r.updated_at > now() - (:'window_minutes' || ' minutes')::interval)       AS contacts_modified_in_window_MUST_BE_0;

\echo ''
\echo '############################################################'
\echo '# END OF POST-APPLY VERIFICATION — no data was modified.'
\echo '############################################################'
\echo ''

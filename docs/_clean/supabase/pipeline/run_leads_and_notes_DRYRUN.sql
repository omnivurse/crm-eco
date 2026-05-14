-- ============================================================================
-- DRY-RUN: leads + notes only (NO contacts, NO commit)
--
-- This script wraps the whole operation in a transaction and ROLLS BACK at
-- the end. Nothing is persisted. You see exactly what WOULD happen — counts
-- of inserts/updates/orphans — without writing anything.
--
-- Run with:
--   cd '/Users/qloudagent/Desktop/CRM DATA/_clean/supabase/pipeline'
--   psql "$SUPABASE_DB_URL" -f run_leads_and_notes_DRYRUN.sql
--
-- Safety guarantees:
--   * Everything is inside BEGIN...ROLLBACK — committed state = unchanged
--   * Contacts staging table and upsert function are NEVER touched
--   * If anything errors mid-script, the whole transaction rolls back
--   * \copy runs inside the transaction so the staging table loads are
--     also rolled back
-- ============================================================================

\timing on
\set ON_ERROR_STOP on

BEGIN;

-- Raise statement_timeout for this transaction — recover_zoho_notes_for_org
-- on ~100k notes can exceed the 2-minute default. Direct connection or
-- pooler both honor this SET LOCAL.
SET LOCAL statement_timeout = '15min';

-- ----------------------------------------------------------------------------
-- 0. CAPTURE BEFORE-STATE for diff reporting
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE _before_counts ON COMMIT DROP AS
SELECT
  (SELECT count(*) FROM crm_records r
     JOIN crm_modules m ON m.id = r.module_id
    WHERE r.org_id = '00000000-0000-0000-0000-000000000001'
      AND m.key = 'leads')                                AS leads_before,
  (SELECT count(*) FROM crm_records r
     JOIN crm_modules m ON m.id = r.module_id
    WHERE r.org_id = '00000000-0000-0000-0000-000000000001'
      AND m.key = 'contacts')                             AS contacts_before,
  (SELECT count(*) FROM crm_notes
    WHERE org_id = '00000000-0000-0000-0000-000000000001') AS notes_before;

SELECT 'BEFORE' AS phase, * FROM _before_counts;

-- ----------------------------------------------------------------------------
-- 1. LEADS — load staging + batched upsert
-- ----------------------------------------------------------------------------
TRUNCATE import_leads_staging RESTART IDENTITY;
\copy import_leads_staging(record_id, lead_owner_id, lead_owner, is_converted, company, first_name, last_name, email, phone, mobile, lead_source, lead_status, created_by_id, created_by, modified_by_id, modified_by, created_time, modified_time, lead_name, street, city, state, zip_code, email_opt_out, salutation, last_activity_time, spouse, spouse_dob, child_1, child_1_dob, child_2, child_2_dob, child_3, child_3_dob, product_type, next_step, producer_id, producer, date_of_birth, child_5_dob, child_5, child_4_dob, child_4, coverage_option, tag, business_type, days_visited, average_time_spent_minutes, number_of_chats, most_recent_visit, first_visit, first_page_visited, referrer, visitor_score, data_processing_basis_id, data_processing_basis, data_source, middle_name, business_or_practice_name, converted_date_time, lead_conversion_time, unsubscribed_mode, unsubscribed_time, converted_account_id, converted_account, converted_contact_id, converted_contact, converted_deal_id, converted_deal, change_log_time, locked, last_enriched_time, enrich_status, referring_member, mobile_2, connected_to_module, connected_to_id) FROM 'csv/import_leads_staging.csv' WITH (FORMAT csv, HEADER, NULL '');

DO $$
DECLARE
  v_offset int := 0;
  v_batch  int := 500;
  v_total  int := (SELECT count(*) FROM import_leads_staging);
  r        record;
  v_total_inserted int := 0;
  v_total_updated  int := 0;
  v_total_errors   int := 0;
BEGIN
  RAISE NOTICE 'LEADS: % rows staged. Running upsert_leads_batch in 500-row pages...', v_total;
  WHILE v_offset < v_total LOOP
    SELECT * INTO r FROM upsert_leads_batch(v_offset, v_batch, '00000000-0000-0000-0000-000000000001'::uuid);
    v_total_inserted := v_total_inserted + r.inserted;
    v_total_updated  := v_total_updated  + r.updated;
    v_total_errors   := v_total_errors   + r.errors;
    RAISE NOTICE '  offset=% inserted=% updated=% skipped=% errors=%',
      v_offset, r.inserted, r.updated, r.skipped, r.errors;
    v_offset := v_offset + v_batch;
  END LOOP;
  RAISE NOTICE 'LEADS totals: inserted=% updated=% errors=%',
    v_total_inserted, v_total_updated, v_total_errors;
END$$;

-- ----------------------------------------------------------------------------
-- 2. NOTES — load staging + idempotent recovery RPC
-- ----------------------------------------------------------------------------
TRUNCATE import_notes_staging RESTART IDENTITY;
\copy import_notes_staging(record_id, associated_id, created_by_id, created_by, created_time, modified_by_id, modified_by, modified_time, note_content, note_owner_id, note_owner, note_title, parent_id, parent_name) FROM 'csv/import_notes_staging.csv' WITH (FORMAT csv, HEADER, NULL '');

-- Inline notes INSERT — replaces the slow function call. Uses single
-- indexed equality (no OR-with-replace pattern), same ±1min body-match
-- idempotent dedup. Planner uses idx_crm_records_zoho_record_id.
WITH ins AS (
  INSERT INTO crm_notes (org_id, record_id, body, is_pinned, created_by, created_at, updated_at)
  SELECT
    '00000000-0000-0000-0000-000000000001'::uuid,
    r.id,
    trim(s.note_content),
    false,
    NULL::uuid,
    COALESCE(NULLIF(s.created_time, '')::timestamp AT TIME ZONE 'America/Denver', now()),
    now()
  FROM import_notes_staging s
  JOIN crm_records r
    ON r.org_id = '00000000-0000-0000-0000-000000000001'::uuid
   AND r.data->>'zoho_record_id' = s.parent_id
  WHERE s.note_content IS NOT NULL
    AND trim(s.note_content) <> ''
    AND NOT EXISTS (
      SELECT 1 FROM crm_notes n
      WHERE n.record_id = r.id
        AND n.body = trim(s.note_content)
        AND n.created_at BETWEEN
              COALESCE(NULLIF(s.created_time,'')::timestamp AT TIME ZONE 'America/Denver', now()) - interval '1 minute'
          AND COALESCE(NULLIF(s.created_time,'')::timestamp AT TIME ZONE 'America/Denver', now()) + interval '1 minute'
    )
  RETURNING id
),
orphans AS (
  SELECT count(*) AS n
  FROM import_notes_staging s
  WHERE s.note_content IS NOT NULL AND trim(s.note_content) <> ''
    AND NOT EXISTS (
      SELECT 1 FROM crm_records r
      WHERE r.org_id = '00000000-0000-0000-0000-000000000001'::uuid
        AND r.data->>'zoho_record_id' = s.parent_id
    )
)
SELECT
  'inline_notes_result' AS phase,
  (SELECT count(*) FROM ins)     AS inserted_count,
  (SELECT count(*) FROM import_notes_staging WHERE note_content IS NOT NULL AND trim(note_content) <> '') AS total_considered,
  (SELECT n FROM orphans)        AS orphan_parent_count;

-- ----------------------------------------------------------------------------
-- 3. AFTER-STATE diff
-- ----------------------------------------------------------------------------
SELECT
  'AFTER (would be, if committed)' AS phase,
  (SELECT count(*) FROM crm_records r
     JOIN crm_modules m ON m.id = r.module_id
    WHERE r.org_id = '00000000-0000-0000-0000-000000000001' AND m.key = 'leads')    AS leads_after,
  (SELECT count(*) FROM crm_records r
     JOIN crm_modules m ON m.id = r.module_id
    WHERE r.org_id = '00000000-0000-0000-0000-000000000001' AND m.key = 'contacts') AS contacts_after_should_match_before,
  (SELECT count(*) FROM crm_notes
    WHERE org_id = '00000000-0000-0000-0000-000000000001') AS notes_after;

SELECT
  'DELTA' AS phase,
  ((SELECT count(*) FROM crm_records r
      JOIN crm_modules m ON m.id = r.module_id
     WHERE r.org_id = '00000000-0000-0000-0000-000000000001' AND m.key = 'leads')
   - (SELECT leads_before FROM _before_counts))    AS leads_delta,
  ((SELECT count(*) FROM crm_records r
      JOIN crm_modules m ON m.id = r.module_id
     WHERE r.org_id = '00000000-0000-0000-0000-000000000001' AND m.key = 'contacts')
   - (SELECT contacts_before FROM _before_counts)) AS contacts_delta_should_be_zero,
  ((SELECT count(*) FROM crm_notes
     WHERE org_id = '00000000-0000-0000-0000-000000000001')
   - (SELECT notes_before FROM _before_counts))    AS notes_delta;

-- ----------------------------------------------------------------------------
-- ROLLBACK — nothing above is persisted
-- ----------------------------------------------------------------------------
ROLLBACK;

\echo ''
\echo '============================================================================'
\echo '  DRY RUN COMPLETE — TRANSACTION ROLLED BACK. No production data changed.'
\echo '  Review the leads_delta and notes_delta numbers above.'
\echo '  contacts_delta_should_be_zero MUST be 0. If it is not, do not proceed.'
\echo '============================================================================'

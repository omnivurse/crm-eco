-- ############################################################################
-- ⚠️  DEPRECATED — DO NOT RUN  ⚠️
--
-- This file is the OLD full pipeline that included a contacts re-import.
-- Re-running contacts against this dataset would risk overwriting staff
-- edits made to crm_records.data since the original 03_20 Zoho import.
--
-- Use instead:
--   verify_only.sql                 — read-only health check
--   run_leads_and_notes_DRYRUN.sql  — leads + notes only, transaction rolled back
--   run_leads_and_notes_APPLY.sql   — leads + notes only, committed
--
-- Hard-stop guard below — psql will exit before any DDL/DML runs.
-- ############################################################################
\echo ''
\echo '⛔ ABORTED: _DEPRECATED_DO_NOT_RUN.sql is not safe to execute.'
\echo '   Use run_leads_and_notes_DRYRUN.sql or _APPLY.sql instead.'
\quit

-- ============================================================================
-- ZOHO IMPORT — full re-run against the cleaned, deduped data
-- Generated: 2026-05-11T23:22:27
--
-- Target: PIFH org (ac6e7228-2ea0-4582-8464-562c3e8ac56e) on PIF-ECO-V2.
-- Run with:
--   cd '/Users/qloudagent/Desktop/CRM DATA/_clean/supabase/pipeline'
--   psql "$SUPABASE_DB_URL" -f run_pipeline.sql
--
-- This script is idempotent — re-running will UPDATE existing records via the
-- 4-tier dedup in upsert_contacts_batch / upsert_leads_batch, and the notes
-- recovery RPC uses ±1 minute deduplication so duplicate inserts are
-- impossible.
--
-- Counts to expect:
--   contacts: 14,412 staged -> upsert into crm_records (module=contacts)
--   leads:    1,036  staged -> upsert into crm_records (module=leads)
--   notes:    99,832 staged -> insert into crm_notes (match by zoho_record_id)
-- ============================================================================

\timing on

-- ----------------------------------------------------------------------------
-- 1. CONTACTS — load staging then batch-upsert
-- ----------------------------------------------------------------------------
TRUNCATE import_contacts_staging RESTART IDENTITY;
\copy import_contacts_staging(record_id, contact_owner_id, contact_owner, lead_source, first_name, last_name, producer_name_id, producer_name, email, title, phone, fax, mobile, date_of_birth, created_by_id, created_by, modified_by_id, modified_by, created_time, modified_time, contact_name, mailing_street, mailing_city, mailing_state, mailing_zip, email_opt_out, salutation, secondary_email, currency, exchange_rate, last_activity_time, territories, spouse, spouse_dob, child_1, child_1_dob, child_2, child_2_dob, child_3, child_3_dob, primary_ss_number, notes_history, affiliate, carrier, previous_product, monthly_premium, commission_percentage, contact_status, product, coverage_option, start_date, referral_source, referring_member, add_on_product, declined, charge_waived, affiliate_referral, affiliate_rep_monthly, amount_received, team_leader_monthly, team_leader, primary_member_gender, mpower_life_code, welcome_call_performed_by, producer_commission, team_leader_referral, child_4, child_5_dob, child_5, child_4_dob, director, director_referral, director_monthly, life_code_4th, fulfillment_letter_mailed, fulfillment_email_sent, complete_date, life_code_3rd, life_code_2nd, date_referral_paid, welcome_call_status, child_4_ss_number, mec_submitted, child_3_ss_number, child_5_ss_number, child_1_ss_number, spouse_ss_number, child_2_ss_number, marital_status, work_phone, middle_initial, referral_fee, referral_requirement_satisfied, tag, days_visited, average_time_spent_minutes, number_of_chats, most_recent_visit, first_visit, first_page_visited, referrer, visitor_score, risk_assessment_paid, company_association, cancellation_date, data_processing_basis_id, data_processing_basis, data_source, preferred_method_of_communication, vision, dental, iua_amount, business_or_practice_name, dpc_name, cirrus_registration_date, portal_username, portal_password, select_conversion_completed, mec_decision_confirmed, unsubscribed_mode, unsubscribed_time, admin123, household_annual_adj_gross, change_log_time, locked, last_enriched_time, enrich_status, app_downloaded, birth_month, third_party_payor, atap, permission_to_discuss_plan, medical_release_form_on_file, life_code_5th, wc_outreach_date, e123_member_id, child_3_address, child_3_phone_number, child_1_phone_number, child_4_address, child_1_address, child_4_phone_number, child_2_phone_number, child_5_address, child_2_address, spouse_address, child_5_phone_number, spouse_phone_number, child_1_email, child_2_email, child_3_email, child_4_email, child_5_email, spouse_email, connected_to_module, connected_to_id, tax_id) FROM 'csv/import_contacts_staging.csv' WITH (FORMAT csv, HEADER, NULL '');

DO $$
DECLARE
  v_offset int := 0;
  v_batch  int := 500;
  v_total  int := (SELECT count(*) FROM import_contacts_staging);
  r        record;
BEGIN
  RAISE NOTICE 'Contacts: % rows staged. Running batched upsert...', v_total;
  WHILE v_offset < v_total LOOP
    SELECT * INTO r FROM upsert_contacts_batch(v_offset, v_batch);
    RAISE NOTICE '  contacts offset=% inserted=% updated=% skipped=% errors=%', v_offset, r.inserted, r.updated, r.skipped, r.errors;
    v_offset := v_offset + v_batch;
  END LOOP;
END$$;

-- ----------------------------------------------------------------------------
-- 2. LEADS — load staging then batch-upsert (excludes the 54 lead↔contact dupes)
-- ----------------------------------------------------------------------------
TRUNCATE import_leads_staging RESTART IDENTITY;
\copy import_leads_staging(record_id, lead_owner_id, lead_owner, is_converted, company, first_name, last_name, email, phone, mobile, lead_source, lead_status, created_by_id, created_by, modified_by_id, modified_by, created_time, modified_time, lead_name, street, city, state, zip_code, email_opt_out, salutation, last_activity_time, spouse, spouse_dob, child_1, child_1_dob, child_2, child_2_dob, child_3, child_3_dob, product_type, next_step, producer_id, producer, date_of_birth, child_5_dob, child_5, child_4_dob, child_4, coverage_option, tag, business_type, days_visited, average_time_spent_minutes, number_of_chats, most_recent_visit, first_visit, first_page_visited, referrer, visitor_score, data_processing_basis_id, data_processing_basis, data_source, middle_name, business_or_practice_name, converted_date_time, lead_conversion_time, unsubscribed_mode, unsubscribed_time, converted_account_id, converted_account, converted_contact_id, converted_contact, converted_deal_id, converted_deal, change_log_time, locked, last_enriched_time, enrich_status, referring_member, mobile_2, connected_to_module, connected_to_id) FROM 'csv/import_leads_staging.csv' WITH (FORMAT csv, HEADER, NULL '');

DO $$
DECLARE
  v_offset int := 0;
  v_batch  int := 500;
  v_total  int := (SELECT count(*) FROM import_leads_staging);
  r        record;
BEGIN
  RAISE NOTICE 'Leads: % rows staged. Running batched upsert...', v_total;
  WHILE v_offset < v_total LOOP
    SELECT * INTO r FROM upsert_leads_batch(v_offset, v_batch, 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'::uuid);
    RAISE NOTICE '  leads offset=% inserted=% updated=% skipped=% errors=%', v_offset, r.inserted, r.updated, r.skipped, r.errors;
    v_offset := v_offset + v_batch;
  END LOOP;
END$$;

-- ----------------------------------------------------------------------------
-- 3. NOTES — load staging then idempotent recovery RPC
-- ----------------------------------------------------------------------------
TRUNCATE import_notes_staging RESTART IDENTITY;
\copy import_notes_staging(record_id, associated_id, created_by_id, created_by, created_time, modified_by_id, modified_by, modified_time, note_content, note_owner_id, note_owner, note_title, parent_id, parent_name) FROM 'csv/import_notes_staging.csv' WITH (FORMAT csv, HEADER, NULL '');

SELECT * FROM recover_zoho_notes_for_org('ac6e7228-2ea0-4582-8464-562c3e8ac56e'::uuid, NULL);

-- ----------------------------------------------------------------------------
-- 4. POST-LOAD VERIFICATION
-- ----------------------------------------------------------------------------
SELECT 'contacts in crm_records' AS metric, count(*)
  FROM crm_records r
  JOIN crm_modules m ON m.id = r.module_id
 WHERE r.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e' AND m.key = 'contacts';

SELECT 'leads in crm_records' AS metric, count(*)
  FROM crm_records r
  JOIN crm_modules m ON m.id = r.module_id
 WHERE r.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e' AND m.key = 'leads';

SELECT 'notes in crm_notes' AS metric, count(*)
  FROM crm_notes
 WHERE org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e';

SELECT 'records with at least one note' AS metric, count(DISTINCT record_id)
  FROM crm_notes
 WHERE org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e';

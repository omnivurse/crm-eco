-- ============================================================================
-- Migration: Create staging tables, helper functions, and import RPC functions
-- Required for CSV import pipeline (contacts + notes)
-- ============================================================================

-- ############################################################################
-- PART 1: HELPER FUNCTIONS (CREATE OR REPLACE - safe to rerun)
-- ############################################################################

CREATE OR REPLACE FUNCTION _parse_import_date(date_str text)
RETURNS date AS $$
BEGIN
  IF date_str IS NULL OR date_str = '' OR date_str = '0000-00-00' THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN date_str::date;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      RETURN to_date(date_str, 'MM/DD/YYYY');
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        RETURN to_date(date_str, 'YYYY-MM-DD');
      EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
      END;
    END;
  END;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION _parse_import_datetime(dt_str text)
RETURNS timestamptz AS $$
BEGIN
  IF dt_str IS NULL OR dt_str = '' THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN dt_str::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION _parse_import_number(num_str text)
RETURNS numeric AS $$
BEGIN
  IF num_str IS NULL OR num_str = '' THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN num_str::numeric;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION _parse_import_boolean(bool_str text)
RETURNS boolean AS $$
BEGIN
  IF bool_str IS NULL OR bool_str = '' THEN
    RETURN false;
  END IF;
  RETURN UPPER(bool_str) IN ('TRUE', 'YES', '1', 'T', 'Y');
END;
$$ LANGUAGE plpgsql;


-- ############################################################################
-- PART 2: STAGING TABLES
-- ############################################################################

-- 2A: CONTACTS STAGING TABLE (157 columns)
DROP TABLE IF EXISTS import_contacts_staging CASCADE;
CREATE TABLE import_contacts_staging (
  row_num serial,
  record_id text,
  contact_owner_id text,
  contact_owner text,
  lead_source text,
  first_name text,
  last_name text,
  producer_name_id text,
  producer_name text,
  email text,
  title text,
  phone text,
  fax text,
  mobile text,
  date_of_birth text,
  created_by_id text,
  created_by text,
  modified_by_id text,
  modified_by text,
  created_time text,
  modified_time text,
  contact_name text,
  mailing_street text,
  mailing_city text,
  mailing_state text,
  mailing_zip text,
  email_opt_out text,
  salutation text,
  secondary_email text,
  currency text,
  exchange_rate text,
  last_activity_time text,
  territories text,
  spouse text,
  spouse_dob text,
  child_1 text,
  child_1_dob text,
  child_2 text,
  child_2_dob text,
  child_3 text,
  child_3_dob text,
  primary_ss_number text,
  notes_history text,
  affiliate text,
  carrier text,
  previous_product text,
  monthly_premium text,
  commission_percentage text,
  contact_status text,
  product text,
  coverage_option text,
  start_date text,
  referral_source text,
  referring_member text,
  add_on_product text,
  declined text,
  charge_waived text,
  affiliate_referral text,
  affiliate_rep_monthly text,
  amount_received text,
  team_leader_monthly text,
  team_leader text,
  primary_member_gender text,
  mpower_life_code text,
  welcome_call_performed_by text,
  producer_commission text,
  team_leader_referral text,
  child_4 text,
  child_5_dob text,
  child_5 text,
  child_4_dob text,
  director text,
  director_referral text,
  director_monthly text,
  life_code_4th text,
  fulfillment_letter_mailed text,
  fulfillment_email_sent text,
  complete_date text,
  life_code_3rd text,
  life_code_2nd text,
  date_referral_paid text,
  welcome_call_status text,
  child_4_ss_number text,
  mec_submitted text,
  child_3_ss_number text,
  child_5_ss_number text,
  child_1_ss_number text,
  spouse_ss_number text,
  child_2_ss_number text,
  marital_status text,
  work_phone text,
  middle_initial text,
  referral_fee text,
  referral_requirement_satisfied text,
  tag text,
  days_visited text,
  average_time_spent_minutes text,
  number_of_chats text,
  most_recent_visit text,
  first_visit text,
  first_page_visited text,
  referrer text,
  visitor_score text,
  risk_assessment_paid text,
  company_association text,
  cancellation_date text,
  data_processing_basis_id text,
  data_processing_basis text,
  data_source text,
  preferred_method_of_communication text,
  vision text,
  dental text,
  iua_amount text,
  business_or_practice_name text,
  dpc_name text,
  cirrus_registration_date text,
  portal_username text,
  portal_password text,
  select_conversion_completed text,
  mec_decision_confirmed text,
  unsubscribed_mode text,
  unsubscribed_time text,
  admin123 text,
  household_annual_adj_gross text,
  change_log_time text,
  locked text,
  last_enriched_time text,
  enrich_status text,
  app_downloaded text,
  birth_month text,
  third_party_payor text,
  atap text,
  permission_to_discuss_plan text,
  medical_release_form_on_file text,
  life_code_5th text,
  wc_outreach_date text,
  e123_member_id text,
  child_3_address text,
  child_3_phone_number text,
  child_1_phone_number text,
  child_4_address text,
  child_1_address text,
  child_4_phone_number text,
  child_2_phone_number text,
  child_5_address text,
  child_2_address text,
  spouse_address text,
  child_5_phone_number text,
  spouse_phone_number text,
  child_1_email text,
  child_2_email text,
  child_3_email text,
  child_4_email text,
  child_5_email text,
  spouse_email text,
  connected_to_module text,
  connected_to_id text,
  tax_id text
);

-- 2B: NOTES STAGING TABLE (14 columns)
DROP TABLE IF EXISTS import_notes_staging CASCADE;
CREATE TABLE import_notes_staging (
  row_num serial,
  record_id text,
  associated_id text,
  created_by_id text,
  created_by text,
  created_time text,
  modified_by_id text,
  modified_by text,
  modified_time text,
  note_content text,
  note_owner_id text,
  note_owner text,
  note_title text,
  parent_id text,
  parent_name text
);

-- Enable RLS and allow service_role full access
ALTER TABLE import_contacts_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_notes_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_contacts_staging" ON import_contacts_staging
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_notes_staging" ON import_notes_staging
  FOR ALL USING (auth.role() = 'service_role');


-- ############################################################################
-- PART 3: IMPORT FUNCTIONS
-- ############################################################################

-- 3A: UPSERT CONTACTS FROM STAGING
CREATE OR REPLACE FUNCTION upsert_contacts_from_staging()
RETURNS TABLE(inserted int, updated int, skipped int, errors int) AS $$
DECLARE
  v_org_id uuid;
  v_module_id uuid;
  v_import_job_id uuid;
  v_inserted int := 0;
  v_updated int := 0;
  v_skipped int := 0;
  v_errors int := 0;
  v_row RECORD;
  v_existing_id uuid;
  v_data jsonb;
  v_new_record_id uuid;
  v_match_method text;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found. Create one first.';
  END IF;

  SELECT id INTO v_module_id FROM crm_modules
  WHERE org_id = v_org_id AND key = 'contacts';
  IF v_module_id IS NULL THEN
    RAISE EXCEPTION 'Contacts module not found. Run seed first.';
  END IF;

  INSERT INTO crm_import_jobs (org_id, module_id, source_type, file_name, status, started_at)
  VALUES (v_org_id, v_module_id, 'csv', 'Contacts_2026_02_10_upsert.csv', 'processing', now())
  RETURNING id INTO v_import_job_id;

  FOR v_row IN
    SELECT * FROM import_contacts_staging
    WHERE record_id IS NOT NULL
      AND record_id != 'Record Id'
      AND (first_name IS NOT NULL OR last_name IS NOT NULL)
    ORDER BY row_num
  LOOP
    BEGIN
      v_existing_id := NULL;
      v_match_method := NULL;

      -- MATCH PRIORITY 1: By email (case-insensitive)
      IF NULLIF(TRIM(v_row.email), '') IS NOT NULL THEN
        SELECT id INTO v_existing_id
        FROM crm_records
        WHERE org_id = v_org_id
          AND module_id = v_module_id
          AND LOWER(email) = LOWER(TRIM(v_row.email))
        ORDER BY updated_at DESC
        LIMIT 1;
        IF v_existing_id IS NOT NULL THEN
          v_match_method := 'email';
        END IF;
      END IF;

      -- MATCH PRIORITY 2: By Zoho Record Id
      IF v_existing_id IS NULL AND NULLIF(v_row.record_id, '') IS NOT NULL THEN
        SELECT id INTO v_existing_id
        FROM crm_records
        WHERE org_id = v_org_id
          AND module_id = v_module_id
          AND data->>'zoho_record_id' = v_row.record_id
        LIMIT 1;
        IF v_existing_id IS NOT NULL THEN
          v_match_method := 'zoho_record_id';
        END IF;
      END IF;

      -- MATCH PRIORITY 3: By first_name + last_name + phone
      IF v_existing_id IS NULL
         AND NULLIF(v_row.first_name, '') IS NOT NULL
         AND NULLIF(v_row.last_name, '') IS NOT NULL
         AND NULLIF(v_row.phone, '') IS NOT NULL
      THEN
        SELECT id INTO v_existing_id
        FROM crm_records
        WHERE org_id = v_org_id
          AND module_id = v_module_id
          AND LOWER(data->>'first_name') = LOWER(v_row.first_name)
          AND LOWER(data->>'last_name') = LOWER(v_row.last_name)
          AND phone = v_row.phone
        ORDER BY updated_at DESC
        LIMIT 1;
        IF v_existing_id IS NOT NULL THEN
          v_match_method := 'name_phone';
        END IF;
      END IF;

      -- Build JSONB data object
      v_data := jsonb_build_object(
        'zoho_record_id', NULLIF(v_row.record_id, ''),
        'zoho_contact_owner_id', NULLIF(v_row.contact_owner_id, ''),
        'zoho_producer_id', NULLIF(v_row.producer_name_id, ''),
        'first_name', NULLIF(v_row.first_name, ''),
        'last_name', NULLIF(v_row.last_name, ''),
        'contact_name', NULLIF(v_row.contact_name, ''),
        'salutation', NULLIF(v_row.salutation, ''),
        'middle_initial', NULLIF(v_row.middle_initial, ''),
        'title', NULLIF(v_row.title, ''),
        'date_of_birth', _parse_import_date(v_row.date_of_birth),
        'birth_month', NULLIF(v_row.birth_month, ''),
        'primary_member_gender', NULLIF(v_row.primary_member_gender, ''),
        'marital_status', NULLIF(v_row.marital_status, ''),
        'secondary_email', NULLIF(v_row.secondary_email, ''),
        'mobile', NULLIF(v_row.mobile, ''),
        'work_phone', NULLIF(v_row.work_phone, ''),
        'fax', NULLIF(v_row.fax, ''),
        'mailing_street', NULLIF(v_row.mailing_street, ''),
        'mailing_city', NULLIF(v_row.mailing_city, ''),
        'mailing_state', NULLIF(v_row.mailing_state, ''),
        'mailing_zip', NULLIF(v_row.mailing_zip, ''),
        'contact_status', NULLIF(v_row.contact_status, ''),
        'contact_owner', NULLIF(v_row.contact_owner, ''),
        'lead_source', NULLIF(v_row.lead_source, ''),
        'affiliate', NULLIF(v_row.affiliate, ''),
        'producer_name', NULLIF(v_row.producer_name, ''),
        'referral_source', NULLIF(v_row.referral_source, ''),
        'referring_member', NULLIF(v_row.referring_member, ''),
        'tag', NULLIF(v_row.tag, ''),
        'territories', NULLIF(v_row.territories, ''),
        'company_association', NULLIF(v_row.company_association, ''),
        'data_source', NULLIF(v_row.data_source, ''),
        'spouse', NULLIF(v_row.spouse, ''),
        'spouse_dob', _parse_import_date(v_row.spouse_dob),
        'spouse_ss_number', NULLIF(v_row.spouse_ss_number, ''),
        'spouse_address', NULLIF(v_row.spouse_address, ''),
        'spouse_phone_number', NULLIF(v_row.spouse_phone_number, ''),
        'spouse_email', NULLIF(v_row.spouse_email, ''),
        'child_1', NULLIF(v_row.child_1, ''),
        'child_1_dob', _parse_import_date(v_row.child_1_dob),
        'child_1_ss_number', NULLIF(v_row.child_1_ss_number, ''),
        'child_1_address', NULLIF(v_row.child_1_address, ''),
        'child_1_phone_number', NULLIF(v_row.child_1_phone_number, ''),
        'child_1_email', NULLIF(v_row.child_1_email, ''),
        'child_2', NULLIF(v_row.child_2, ''),
        'child_2_dob', _parse_import_date(v_row.child_2_dob),
        'child_2_ss_number', NULLIF(v_row.child_2_ss_number, ''),
        'child_2_address', NULLIF(v_row.child_2_address, ''),
        'child_2_phone_number', NULLIF(v_row.child_2_phone_number, ''),
        'child_2_email', NULLIF(v_row.child_2_email, ''),
        'child_3', NULLIF(v_row.child_3, ''),
        'child_3_dob', _parse_import_date(v_row.child_3_dob),
        'child_3_ss_number', NULLIF(v_row.child_3_ss_number, ''),
        'child_3_address', NULLIF(v_row.child_3_address, ''),
        'child_3_phone_number', NULLIF(v_row.child_3_phone_number, ''),
        'child_3_email', NULLIF(v_row.child_3_email, ''),
        'child_4', NULLIF(v_row.child_4, ''),
        'child_4_dob', _parse_import_date(v_row.child_4_dob),
        'child_4_ss_number', NULLIF(v_row.child_4_ss_number, ''),
        'child_4_address', NULLIF(v_row.child_4_address, ''),
        'child_4_phone_number', NULLIF(v_row.child_4_phone_number, ''),
        'child_4_email', NULLIF(v_row.child_4_email, ''),
        'child_5', NULLIF(v_row.child_5, ''),
        'child_5_dob', _parse_import_date(v_row.child_5_dob),
        'child_5_ss_number', NULLIF(v_row.child_5_ss_number, ''),
        'child_5_address', NULLIF(v_row.child_5_address, ''),
        'child_5_phone_number', NULLIF(v_row.child_5_phone_number, ''),
        'child_5_email', NULLIF(v_row.child_5_email, ''),
        'product', NULLIF(v_row.product, ''),
        'coverage_option', NULLIF(v_row.coverage_option, ''),
        'carrier', NULLIF(v_row.carrier, ''),
        'previous_product', NULLIF(v_row.previous_product, ''),
        'monthly_premium', _parse_import_number(v_row.monthly_premium),
        'start_date', _parse_import_date(v_row.start_date),
        'cancellation_date', _parse_import_datetime(v_row.cancellation_date),
        'iua_amount', NULLIF(v_row.iua_amount, ''),
        'add_on_product', NULLIF(v_row.add_on_product, ''),
        'vision', NULLIF(v_row.vision, ''),
        'dental', NULLIF(v_row.dental, ''),
        'commission_percentage', _parse_import_number(v_row.commission_percentage),
        'producer_commission', _parse_import_number(v_row.producer_commission),
        'amount_received', _parse_import_number(v_row.amount_received),
        'team_leader', NULLIF(v_row.team_leader, ''),
        'team_leader_monthly', _parse_import_number(v_row.team_leader_monthly),
        'team_leader_referral', _parse_import_number(v_row.team_leader_referral),
        'director', NULLIF(v_row.director, ''),
        'director_monthly', _parse_import_number(v_row.director_monthly),
        'director_referral', _parse_import_number(v_row.director_referral),
        'affiliate_referral', NULLIF(v_row.affiliate_referral, ''),
        'affiliate_rep_monthly', _parse_import_number(v_row.affiliate_rep_monthly),
        'referral_fee', _parse_import_number(v_row.referral_fee),
        'date_referral_paid', _parse_import_date(v_row.date_referral_paid),
        'referral_requirement_satisfied', NULLIF(v_row.referral_requirement_satisfied, ''),
        'declined', _parse_import_boolean(v_row.declined),
        'charge_waived', _parse_import_boolean(v_row.charge_waived),
        'household_annual_adj_gross', _parse_import_number(v_row.household_annual_adj_gross),
        'primary_ss_number', NULLIF(v_row.primary_ss_number, ''),
        'tax_id', NULLIF(v_row.tax_id, ''),
        'mpower_life_code', NULLIF(v_row.mpower_life_code, ''),
        'life_code_2nd', NULLIF(v_row.life_code_2nd, ''),
        'life_code_3rd', NULLIF(v_row.life_code_3rd, ''),
        'life_code_4th', NULLIF(v_row.life_code_4th, ''),
        'life_code_5th', NULLIF(v_row.life_code_5th, ''),
        'e123_member_id', NULLIF(v_row.e123_member_id, ''),
        'portal_username', NULLIF(v_row.portal_username, ''),
        'portal_password', NULLIF(v_row.portal_password, ''),
        'cirrus_registration_date', _parse_import_date(v_row.cirrus_registration_date),
        'app_downloaded', _parse_import_boolean(v_row.app_downloaded),
        'select_conversion_completed', _parse_import_boolean(v_row.select_conversion_completed),
        'mec_submitted', _parse_import_boolean(v_row.mec_submitted),
        'mec_decision_confirmed', _parse_import_boolean(v_row.mec_decision_confirmed),
        'medical_release_form_on_file', _parse_import_boolean(v_row.medical_release_form_on_file),
        'permission_to_discuss_plan', _parse_import_boolean(v_row.permission_to_discuss_plan),
        'atap', NULLIF(v_row.atap, ''),
        'third_party_payor', NULLIF(v_row.third_party_payor, ''),
        'risk_assessment_paid', NULLIF(v_row.risk_assessment_paid, ''),
        'welcome_call_status', NULLIF(v_row.welcome_call_status, ''),
        'welcome_call_performed_by', NULLIF(v_row.welcome_call_performed_by, ''),
        'wc_outreach_date', _parse_import_date(v_row.wc_outreach_date),
        'fulfillment_letter_mailed', _parse_import_date(v_row.fulfillment_letter_mailed),
        'fulfillment_email_sent', _parse_import_date(v_row.fulfillment_email_sent),
        'complete_date', _parse_import_date(v_row.complete_date),
        'business_or_practice_name', NULLIF(v_row.business_or_practice_name, ''),
        'dpc_name', NULLIF(v_row.dpc_name, ''),
        'email_opt_out', _parse_import_boolean(v_row.email_opt_out),
        'preferred_method_of_communication', NULLIF(v_row.preferred_method_of_communication, ''),
        'unsubscribed_mode', NULLIF(v_row.unsubscribed_mode, ''),
        'unsubscribed_time', _parse_import_datetime(v_row.unsubscribed_time),
        'days_visited', _parse_import_number(v_row.days_visited),
        'average_time_spent_minutes', _parse_import_number(v_row.average_time_spent_minutes),
        'number_of_chats', _parse_import_number(v_row.number_of_chats),
        'most_recent_visit', _parse_import_datetime(v_row.most_recent_visit),
        'first_visit', _parse_import_datetime(v_row.first_visit),
        'first_page_visited', NULLIF(v_row.first_page_visited, ''),
        'referrer', NULLIF(v_row.referrer, ''),
        'visitor_score', _parse_import_number(v_row.visitor_score),
        'last_activity_time', _parse_import_datetime(v_row.last_activity_time),
        'notes_history', NULLIF(v_row.notes_history, ''),
        'created_by_name', NULLIF(v_row.created_by, ''),
        'modified_by_name', NULLIF(v_row.modified_by, ''),
        'zoho_created_time', _parse_import_datetime(v_row.created_time),
        'zoho_modified_time', _parse_import_datetime(v_row.modified_time),
        'locked', _parse_import_boolean(v_row.locked),
        'admin123', NULLIF(v_row.admin123, ''),
        'change_log_time', _parse_import_datetime(v_row.change_log_time),
        'data_processing_basis', NULLIF(v_row.data_processing_basis, ''),
        'connected_to_module', NULLIF(v_row.connected_to_module, ''),
        'connected_to_id', NULLIF(v_row.connected_to_id, '')
      );

      -- Strip null values
      v_data := (
        SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb)
        FROM jsonb_each(v_data)
        WHERE value IS NOT NULL
          AND value != 'null'::jsonb
          AND value != '""'::jsonb
      );

      -- UPSERT
      IF v_existing_id IS NOT NULL THEN
        UPDATE crm_records SET
          title = COALESCE(
            NULLIF(v_row.contact_name, ''),
            NULLIF(TRIM(COALESCE(v_row.first_name, '') || ' ' || COALESCE(v_row.last_name, '')), ''),
            title
          ),
          status = COALESCE(NULLIF(v_row.contact_status, ''), status),
          email = COALESCE(NULLIF(TRIM(v_row.email), ''), email),
          phone = COALESCE(NULLIF(v_row.phone, ''), phone),
          data = (
            SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb)
            FROM jsonb_each(data || v_data)
            WHERE value IS NOT NULL
              AND value != 'null'::jsonb
              AND value != '""'::jsonb
          ),
          updated_at = now()
        WHERE id = v_existing_id;

        INSERT INTO crm_import_rows (job_id, row_index, record_id, status, match_type)
        VALUES (v_import_job_id, v_row.row_num, v_existing_id, 'updated', v_match_method);
        v_updated := v_updated + 1;
      ELSE
        INSERT INTO crm_records (
          org_id, module_id, title, status, email, phone, data, created_at, updated_at
        ) VALUES (
          v_org_id, v_module_id,
          COALESCE(
            NULLIF(v_row.contact_name, ''),
            TRIM(COALESCE(v_row.first_name, '') || ' ' || COALESCE(v_row.last_name, ''))
          ),
          COALESCE(NULLIF(v_row.contact_status, ''), 'Active'),
          NULLIF(TRIM(v_row.email), ''),
          NULLIF(v_row.phone, ''),
          v_data,
          COALESCE(_parse_import_datetime(v_row.created_time), now()),
          COALESCE(_parse_import_datetime(v_row.modified_time), now())
        )
        RETURNING id INTO v_new_record_id;

        INSERT INTO crm_import_rows (job_id, row_index, record_id, status, match_type)
        VALUES (v_import_job_id, v_row.row_num, v_new_record_id, 'inserted', 'new');
        v_inserted := v_inserted + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      INSERT INTO crm_import_rows (job_id, row_index, status, error)
      VALUES (v_import_job_id, v_row.row_num, 'error', SQLERRM);
      v_errors := v_errors + 1;
    END;
  END LOOP;

  UPDATE crm_import_jobs SET
    status = 'completed',
    completed_at = now(),
    total_rows = v_inserted + v_updated + v_skipped + v_errors,
    processed_rows = v_inserted + v_updated + v_skipped + v_errors,
    inserted_count = v_inserted,
    updated_count = v_updated,
    skipped_count = v_skipped,
    error_count = v_errors
  WHERE id = v_import_job_id;

  RAISE NOTICE 'Contacts upsert complete: % inserted, % updated, % skipped, % errors',
    v_inserted, v_updated, v_skipped, v_errors;
  RETURN QUERY SELECT v_inserted, v_updated, v_skipped, v_errors;
END;
$$ LANGUAGE plpgsql;


-- 3B: DEDUPLICATE CONTACTS
CREATE OR REPLACE FUNCTION deduplicate_contacts()
RETURNS TABLE(
  duplicates_found int,
  records_merged int,
  records_deleted int,
  name_phone_duplicates_found int,
  name_phone_deleted int
) AS $$
DECLARE
  v_org_id uuid;
  v_module_id uuid;
  v_dup RECORD;
  v_keeper_id uuid;
  v_dupe_rec RECORD;
  v_duplicates_found int := 0;
  v_records_merged int := 0;
  v_records_deleted int := 0;
  v_np_duplicates_found int := 0;
  v_np_deleted int := 0;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  SELECT id INTO v_module_id FROM crm_modules
  WHERE org_id = v_org_id AND key = 'contacts';

  -- Phase 1: Deduplicate by email
  FOR v_dup IN
    SELECT LOWER(email) AS norm_email, COUNT(*) AS cnt
    FROM crm_records
    WHERE org_id = v_org_id AND module_id = v_module_id
      AND email IS NOT NULL AND email != ''
    GROUP BY LOWER(email) HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  LOOP
    v_duplicates_found := v_duplicates_found + 1;
    SELECT id INTO v_keeper_id FROM crm_records
    WHERE org_id = v_org_id AND module_id = v_module_id
      AND LOWER(email) = v_dup.norm_email
    ORDER BY updated_at DESC LIMIT 1;

    FOR v_dupe_rec IN
      SELECT id, data FROM crm_records
      WHERE org_id = v_org_id AND module_id = v_module_id
        AND LOWER(email) = v_dup.norm_email AND id != v_keeper_id
      ORDER BY updated_at DESC
    LOOP
      UPDATE crm_records SET
        data = (
          SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb)
          FROM jsonb_each(
            COALESCE(v_dupe_rec.data, '{}'::jsonb) ||
            COALESCE((SELECT data FROM crm_records WHERE id = v_keeper_id), '{}'::jsonb)
          )
          WHERE value IS NOT NULL AND value != 'null'::jsonb AND value != '""'::jsonb
        ),
        updated_at = now()
      WHERE id = v_keeper_id;
      v_records_merged := v_records_merged + 1;
      DELETE FROM crm_records WHERE id = v_dupe_rec.id;
      v_records_deleted := v_records_deleted + 1;
    END LOOP;
  END LOOP;

  -- Phase 2: Deduplicate by name + phone
  FOR v_dup IN
    SELECT LOWER(data->>'first_name') AS norm_first,
           LOWER(data->>'last_name') AS norm_last,
           phone AS norm_phone, COUNT(*) AS cnt
    FROM crm_records
    WHERE org_id = v_org_id AND module_id = v_module_id
      AND data->>'first_name' IS NOT NULL AND data->>'last_name' IS NOT NULL
      AND phone IS NOT NULL AND phone != ''
    GROUP BY LOWER(data->>'first_name'), LOWER(data->>'last_name'), phone
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  LOOP
    v_np_duplicates_found := v_np_duplicates_found + 1;
    SELECT id INTO v_keeper_id FROM crm_records
    WHERE org_id = v_org_id AND module_id = v_module_id
      AND LOWER(data->>'first_name') = v_dup.norm_first
      AND LOWER(data->>'last_name') = v_dup.norm_last
      AND phone = v_dup.norm_phone
    ORDER BY updated_at DESC LIMIT 1;

    FOR v_dupe_rec IN
      SELECT id, data FROM crm_records
      WHERE org_id = v_org_id AND module_id = v_module_id
        AND LOWER(data->>'first_name') = v_dup.norm_first
        AND LOWER(data->>'last_name') = v_dup.norm_last
        AND phone = v_dup.norm_phone AND id != v_keeper_id
      ORDER BY updated_at DESC
    LOOP
      UPDATE crm_records SET
        data = (
          SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb)
          FROM jsonb_each(
            COALESCE(v_dupe_rec.data, '{}'::jsonb) ||
            COALESCE((SELECT data FROM crm_records WHERE id = v_keeper_id), '{}'::jsonb)
          )
          WHERE value IS NOT NULL AND value != 'null'::jsonb AND value != '""'::jsonb
        ),
        updated_at = now()
      WHERE id = v_keeper_id;
      DELETE FROM crm_records WHERE id = v_dupe_rec.id;
      v_np_deleted := v_np_deleted + 1;
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT v_duplicates_found, v_records_merged, v_records_deleted, v_np_duplicates_found, v_np_deleted;
END;
$$ LANGUAGE plpgsql;


-- 3C: IMPORT NOTES FROM STAGING
CREATE OR REPLACE FUNCTION import_notes_from_staging()
RETURNS TABLE(imported int, skipped int, errors int) AS $$
DECLARE
  v_org_id uuid;
  v_imported int := 0;
  v_skipped int := 0;
  v_errors int := 0;
  v_row RECORD;
  v_parent_record_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found.';
  END IF;

  FOR v_row IN
    SELECT * FROM import_notes_staging
    WHERE record_id IS NOT NULL
      AND record_id != 'Record Id'
      AND note_content IS NOT NULL
      AND note_content != ''
    ORDER BY row_num
  LOOP
    BEGIN
      SELECT id INTO v_parent_record_id
      FROM crm_records
      WHERE org_id = v_org_id
        AND data->>'zoho_record_id' = v_row.parent_id
      LIMIT 1;

      IF v_parent_record_id IS NULL THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      INSERT INTO crm_notes (
        org_id, record_id, body, is_pinned, created_at, updated_at
      ) VALUES (
        v_org_id,
        v_parent_record_id,
        v_row.note_content,
        false,
        COALESCE(_parse_import_datetime(v_row.created_time), now()),
        COALESCE(_parse_import_datetime(v_row.modified_time), now())
      );

      v_imported := v_imported + 1;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  RAISE NOTICE 'Notes import complete: % imported, % skipped (no parent), % errors', v_imported, v_skipped, v_errors;
  RETURN QUERY SELECT v_imported, v_skipped, v_errors;
END;
$$ LANGUAGE plpgsql;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

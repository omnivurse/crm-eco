-- ============================================================================
-- CRM CONTACTS IMPORT SCRIPT
-- Imports contacts from Zoho CRM CSV export (Contacts_2025_10_16.csv)
-- 
-- This script creates a staging table, maps CSV columns to CRM fields,
-- and inserts records into crm_records with proper JSONB data structure.
-- ============================================================================

-- Step 1: Create staging table for raw CSV data
DROP TABLE IF EXISTS _import_contacts_staging;

CREATE TABLE _import_contacts_staging (
  row_num serial,
  record_id text,
  affiliate text,
  contact_status text,
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
  carrier text,
  previous_product text,
  monthly_premium text,
  commission_percentage text,
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
  mpb_referral_fee text,
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
  payment_method text,
  account_type text,
  routing_number text,
  account_number text,
  iua_amount text,
  business_or_practice_name text,
  dpc_name text,
  cirrus_registration_date text,
  mpb_portal_username text,
  mpb_portal_password text,
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
  mpb_app_downloaded text,
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
  connected_to_id text
);

-- ============================================================================
-- Step 2: Load CSV data using COPY (run this from psql or adjust path)
-- Note: The COPY command must be run with appropriate permissions
-- ============================================================================

-- For local import via psql:
-- \COPY _import_contacts_staging(record_id, affiliate, contact_status, contact_owner_id, contact_owner, lead_source, first_name, last_name, producer_name_id, producer_name, email, title, phone, fax, mobile, date_of_birth, created_by_id, created_by, modified_by_id, modified_by, created_time, modified_time, contact_name, mailing_street, mailing_city, mailing_state, mailing_zip, email_opt_out, salutation, secondary_email, currency, exchange_rate, last_activity_time, territories, spouse, spouse_dob, child_1, child_1_dob, child_2, child_2_dob, child_3, child_3_dob, primary_ss_number, notes_history, carrier, previous_product, monthly_premium, commission_percentage, product, coverage_option, start_date, referral_source, referring_member, add_on_product, declined, charge_waived, affiliate_referral, affiliate_rep_monthly, amount_received, team_leader_monthly, team_leader, primary_member_gender, mpower_life_code, welcome_call_performed_by, producer_commission, team_leader_referral, child_4, child_5_dob, child_5, child_4_dob, director, director_referral, director_monthly, life_code_4th, fulfillment_letter_mailed, fulfillment_email_sent, complete_date, life_code_3rd, life_code_2nd, date_referral_paid, welcome_call_status, child_4_ss_number, mec_submitted, child_3_ss_number, child_5_ss_number, child_1_ss_number, spouse_ss_number, child_2_ss_number, marital_status, work_phone, middle_initial, mpb_referral_fee, referral_requirement_satisfied, tag, days_visited, average_time_spent_minutes, number_of_chats, most_recent_visit, first_visit, first_page_visited, referrer, visitor_score, risk_assessment_paid, company_association, cancellation_date, data_processing_basis_id, data_processing_basis, data_source, preferred_method_of_communication, vision, dental, payment_method, account_type, routing_number, account_number, iua_amount, business_or_practice_name, dpc_name, cirrus_registration_date, mpb_portal_username, mpb_portal_password, select_conversion_completed, mec_decision_confirmed, unsubscribed_mode, unsubscribed_time, admin123, household_annual_adj_gross, change_log_time, locked, last_enriched_time, enrich_status, mpb_app_downloaded, birth_month, third_party_payor, atap, permission_to_discuss_plan, medical_release_form_on_file, life_code_5th, wc_outreach_date, e123_member_id, child_3_address, child_3_phone_number, child_1_phone_number, child_4_address, child_1_address, child_4_phone_number, child_2_phone_number, child_5_address, child_2_address, spouse_address, child_5_phone_number, spouse_phone_number, child_1_email, child_2_email, child_3_email, child_4_email, child_5_email, spouse_email, connected_to_module, connected_to_id) FROM '/path/to/Contacts_2025_10_16.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

-- ============================================================================
-- Step 3: Helper function to parse dates safely
-- ============================================================================

CREATE OR REPLACE FUNCTION _parse_import_date(date_str text)
RETURNS date AS $$
BEGIN
  IF date_str IS NULL OR date_str = '' OR date_str = '0000-00-00' THEN
    RETURN NULL;
  END IF;
  
  -- Try parsing various formats
  BEGIN
    RETURN date_str::date;
  EXCEPTION WHEN OTHERS THEN
    -- Try MM/DD/YYYY format
    BEGIN
      RETURN to_date(date_str, 'MM/DD/YYYY');
    EXCEPTION WHEN OTHERS THEN
      -- Try other formats
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

-- ============================================================================
-- Step 4: Insert contacts into crm_records
-- ============================================================================

CREATE OR REPLACE FUNCTION import_contacts_from_staging()
RETURNS TABLE(imported int, skipped int, errors int) AS $$
DECLARE
  v_org_id uuid;
  v_module_id uuid;
  v_import_job_id uuid;
  v_imported int := 0;
  v_skipped int := 0;
  v_errors int := 0;
  v_row RECORD;
  v_record_id uuid;
  v_data jsonb;
BEGIN
  -- Get organization and module
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found';
  END IF;
  
  SELECT id INTO v_module_id FROM crm_modules 
  WHERE org_id = v_org_id AND key = 'contacts';
  IF v_module_id IS NULL THEN
    RAISE EXCEPTION 'Contacts module not found';
  END IF;
  
  -- Create import job for tracking
  INSERT INTO crm_import_jobs (org_id, module_id, source_type, file_name, status, started_at)
  VALUES (v_org_id, v_module_id, 'csv', 'Contacts_2025_10_16.csv', 'processing', now())
  RETURNING id INTO v_import_job_id;
  
  -- Process each row
  FOR v_row IN 
    SELECT * FROM _import_contacts_staging 
    WHERE record_id IS NOT NULL 
      AND record_id != 'Record Id'  -- Skip header if present
      AND first_name IS NOT NULL
    ORDER BY row_num
  LOOP
    BEGIN
      -- Build JSONB data object
      v_data := jsonb_build_object(
        -- Core contact info
        'record_id', NULLIF(v_row.record_id, ''),
        'first_name', NULLIF(v_row.first_name, ''),
        'last_name', NULLIF(v_row.last_name, ''),
        'contact_name', NULLIF(v_row.contact_name, ''),
        'salutation', NULLIF(v_row.salutation, ''),
        'middle_initial', NULLIF(v_row.middle_initial, ''),
        'title', NULLIF(v_row.title, ''),
        'secondary_email', NULLIF(v_row.secondary_email, ''),
        'mobile', NULLIF(v_row.mobile, ''),
        'work_phone', NULLIF(v_row.work_phone, ''),
        'fax', NULLIF(v_row.fax, ''),
        'date_of_birth', _parse_import_date(v_row.date_of_birth),
        'birth_month', NULLIF(v_row.birth_month, ''),
        'primary_member_gender', NULLIF(v_row.primary_member_gender, ''),
        'marital_status', NULLIF(v_row.marital_status, ''),
        'primary_ss_number', NULLIF(v_row.primary_ss_number, ''),
        
        -- Contact management
        'contact_status', NULLIF(v_row.contact_status, ''),
        'contact_owner', NULLIF(v_row.contact_owner, ''),
        'contact_owner_id', NULLIF(v_row.contact_owner_id, ''),
        'lead_source', NULLIF(v_row.lead_source, ''),
        'affiliate', NULLIF(v_row.affiliate, ''),
        'producer_name', NULLIF(v_row.producer_name, ''),
        'producer_name_id', NULLIF(v_row.producer_name_id, ''),
        'referral_source', NULLIF(v_row.referral_source, ''),
        'referring_member', NULLIF(v_row.referring_member, ''),
        'tag', NULLIF(v_row.tag, ''),
        'territories', NULLIF(v_row.territories, ''),
        'company_association', NULLIF(v_row.company_association, ''),
        'data_source', NULLIF(v_row.data_source, ''),
        
        -- Address
        'mailing_street', NULLIF(v_row.mailing_street, ''),
        'mailing_city', NULLIF(v_row.mailing_city, ''),
        'mailing_state', NULLIF(v_row.mailing_state, ''),
        'mailing_zip', NULLIF(v_row.mailing_zip, ''),
        
        -- Spouse
        'spouse', NULLIF(v_row.spouse, ''),
        'spouse_dob', _parse_import_date(v_row.spouse_dob),
        'spouse_ss_number', NULLIF(v_row.spouse_ss_number, ''),
        'spouse_address', NULLIF(v_row.spouse_address, ''),
        'spouse_phone_number', NULLIF(v_row.spouse_phone_number, ''),
        'spouse_email', NULLIF(v_row.spouse_email, ''),
        
        -- Children
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
        
        -- Insurance/Product
        'carrier', NULLIF(v_row.carrier, ''),
        'previous_product', NULLIF(v_row.previous_product, ''),
        'product', NULLIF(v_row.product, ''),
        'coverage_option', NULLIF(v_row.coverage_option, ''),
        'monthly_premium', _parse_import_number(v_row.monthly_premium),
        'start_date', _parse_import_date(v_row.start_date),
        'cancellation_date', _parse_import_datetime(v_row.cancellation_date),
        'iua_amount', _parse_import_number(v_row.iua_amount),
        'vision', NULLIF(v_row.vision, ''),
        'dental', NULLIF(v_row.dental, ''),
        'add_on_product', NULLIF(v_row.add_on_product, ''),
        
        -- Payment
        'payment_method', NULLIF(v_row.payment_method, ''),
        'account_type', NULLIF(v_row.account_type, ''),
        'routing_number', NULLIF(v_row.routing_number, ''),
        'account_number', NULLIF(v_row.account_number, ''),
        'currency', NULLIF(v_row.currency, ''),
        'exchange_rate', _parse_import_number(v_row.exchange_rate),
        
        -- Commissions
        'commission_percentage', _parse_import_number(v_row.commission_percentage),
        'amount_received', _parse_import_number(v_row.amount_received),
        'producer_commission', _parse_import_number(v_row.producer_commission),
        'team_leader', NULLIF(v_row.team_leader, ''),
        'team_leader_monthly', _parse_import_number(v_row.team_leader_monthly),
        'team_leader_referral', _parse_import_number(v_row.team_leader_referral),
        'director', NULLIF(v_row.director, ''),
        'director_monthly', _parse_import_number(v_row.director_monthly),
        'director_referral', _parse_import_number(v_row.director_referral),
        'affiliate_referral', NULLIF(v_row.affiliate_referral, ''),
        'affiliate_rep_monthly', _parse_import_number(v_row.affiliate_rep_monthly),
        'mpb_referral_fee', _parse_import_number(v_row.mpb_referral_fee),
        'date_referral_paid', _parse_import_date(v_row.date_referral_paid),
        'referral_requirement_satisfied', NULLIF(v_row.referral_requirement_satisfied, ''),
        'declined', _parse_import_boolean(v_row.declined),
        'charge_waived', _parse_import_boolean(v_row.charge_waived),
        
        -- Identifiers
        'mpower_life_code', NULLIF(v_row.mpower_life_code, ''),
        'life_code_2nd', NULLIF(v_row.life_code_2nd, ''),
        'life_code_3rd', NULLIF(v_row.life_code_3rd, ''),
        'life_code_4th', NULLIF(v_row.life_code_4th, ''),
        'life_code_5th', NULLIF(v_row.life_code_5th, ''),
        'e123_member_id', NULLIF(v_row.e123_member_id, ''),
        
        -- Portal
        'mpb_portal_username', NULLIF(v_row.mpb_portal_username, ''),
        'mpb_portal_password', NULLIF(v_row.mpb_portal_password, ''),
        'cirrus_registration_date', _parse_import_date(v_row.cirrus_registration_date),
        'mpb_app_downloaded', _parse_import_boolean(v_row.mpb_app_downloaded),
        'select_conversion_completed', _parse_import_boolean(v_row.select_conversion_completed),
        
        -- Compliance
        'mec_submitted', _parse_import_boolean(v_row.mec_submitted),
        'mec_decision_confirmed', _parse_import_boolean(v_row.mec_decision_confirmed),
        'medical_release_form_on_file', _parse_import_boolean(v_row.medical_release_form_on_file),
        'permission_to_discuss_plan', _parse_import_boolean(v_row.permission_to_discuss_plan),
        'atap', NULLIF(v_row.atap, ''),
        'third_party_payor', NULLIF(v_row.third_party_payor, ''),
        'data_processing_basis', NULLIF(v_row.data_processing_basis, ''),
        'risk_assessment_paid', NULLIF(v_row.risk_assessment_paid, ''),
        
        -- Fulfillment
        'welcome_call_status', NULLIF(v_row.welcome_call_status, ''),
        'welcome_call_performed_by', NULLIF(v_row.welcome_call_performed_by, ''),
        'wc_outreach_date', _parse_import_date(v_row.wc_outreach_date),
        'fulfillment_letter_mailed', _parse_import_date(v_row.fulfillment_letter_mailed),
        'fulfillment_email_sent', _parse_import_date(v_row.fulfillment_email_sent),
        'complete_date', _parse_import_date(v_row.complete_date),
        
        -- Activity
        'days_visited', _parse_import_number(v_row.days_visited),
        'average_time_spent_minutes', _parse_import_number(v_row.average_time_spent_minutes),
        'number_of_chats', _parse_import_number(v_row.number_of_chats),
        'most_recent_visit', _parse_import_datetime(v_row.most_recent_visit),
        'first_visit', _parse_import_datetime(v_row.first_visit),
        'first_page_visited', NULLIF(v_row.first_page_visited, ''),
        'referrer', NULLIF(v_row.referrer, ''),
        'visitor_score', _parse_import_number(v_row.visitor_score),
        'last_activity_time', _parse_import_datetime(v_row.last_activity_time),
        
        -- Preferences
        'email_opt_out', _parse_import_boolean(v_row.email_opt_out),
        'preferred_method_of_communication', NULLIF(v_row.preferred_method_of_communication, ''),
        'unsubscribed_mode', NULLIF(v_row.unsubscribed_mode, ''),
        'unsubscribed_time', _parse_import_datetime(v_row.unsubscribed_time),
        
        -- Business
        'business_or_practice_name', NULLIF(v_row.business_or_practice_name, ''),
        'dpc_name', NULLIF(v_row.dpc_name, ''),
        'household_annual_adj_gross', _parse_import_number(v_row.household_annual_adj_gross),
        
        -- System
        'created_by_name', NULLIF(v_row.created_by, ''),
        'modified_by_name', NULLIF(v_row.modified_by, ''),
        'zoho_created_time', _parse_import_datetime(v_row.created_time),
        'zoho_modified_time', _parse_import_datetime(v_row.modified_time),
        'notes_history', NULLIF(v_row.notes_history, ''),
        'locked', _parse_import_boolean(v_row.locked),
        'admin123', NULLIF(v_row.admin123, ''),
        'change_log_time', _parse_import_datetime(v_row.change_log_time),
        'last_enriched_time', _parse_import_datetime(v_row.last_enriched_time),
        'enrich_status', NULLIF(v_row.enrich_status, ''),
        'connected_to_module', NULLIF(v_row.connected_to_module, ''),
        'connected_to_id', NULLIF(v_row.connected_to_id, '')
      );
      
      -- Remove null values from JSONB
      v_data := (
        SELECT jsonb_object_agg(key, value)
        FROM jsonb_each(v_data)
        WHERE value IS NOT NULL AND value != 'null'::jsonb
      );
      
      -- Insert into crm_records
      INSERT INTO crm_records (
        org_id,
        module_id,
        title,
        status,
        email,
        phone,
        data,
        created_at
      ) VALUES (
        v_org_id,
        v_module_id,
        COALESCE(v_row.contact_name, v_row.first_name || ' ' || COALESCE(v_row.last_name, '')),
        COALESCE(v_row.contact_status, 'Active'),
        NULLIF(v_row.email, ''),
        NULLIF(v_row.phone, ''),
        v_data,
        COALESCE(_parse_import_datetime(v_row.created_time), now())
      )
      RETURNING id INTO v_record_id;
      
      -- Track in import rows
      INSERT INTO crm_import_rows (job_id, row_index, raw, record_id, status, match_type)
      VALUES (
        v_import_job_id,
        v_row.row_num,
        to_jsonb(v_row),
        v_record_id,
        'inserted',
        'new'
      );
      
      v_imported := v_imported + 1;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log error
      INSERT INTO crm_import_rows (job_id, row_index, raw, status, error)
      VALUES (v_import_job_id, v_row.row_num, to_jsonb(v_row), 'error', SQLERRM);
      
      v_errors := v_errors + 1;
    END;
  END LOOP;
  
  -- Update import job with final stats
  UPDATE crm_import_jobs 
  SET 
    status = 'completed',
    completed_at = now(),
    total_rows = v_imported + v_skipped + v_errors,
    processed_rows = v_imported + v_skipped + v_errors,
    inserted_count = v_imported,
    skipped_count = v_skipped,
    error_count = v_errors
  WHERE id = v_import_job_id;
  
  RETURN QUERY SELECT v_imported, v_skipped, v_errors;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Step 5: Run the import (after loading CSV data)
-- ============================================================================

-- SELECT * FROM import_contacts_from_staging();

-- ============================================================================
-- Step 6: Cleanup (optional - run after verifying import)
-- ============================================================================

-- DROP TABLE IF EXISTS _import_contacts_staging;
-- DROP FUNCTION IF EXISTS _parse_import_date;
-- DROP FUNCTION IF EXISTS _parse_import_datetime;
-- DROP FUNCTION IF EXISTS _parse_import_number;
-- DROP FUNCTION IF EXISTS _parse_import_boolean;
-- DROP FUNCTION IF EXISTS import_contacts_from_staging;

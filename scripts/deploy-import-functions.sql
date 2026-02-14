-- Deploy staging tables, helper functions, and import functions to remote database
-- Run via: npx supabase db execute --linked -f scripts/deploy-import-functions.sql

-- ============================================================================
-- PART 1: HELPER FUNCTIONS
-- ============================================================================

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


-- ============================================================================
-- PART 2: STAGING TABLES
-- ============================================================================

-- 2A: CONTACTS STAGING TABLE
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

-- 2B: NOTES STAGING TABLE
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

-- Enable RLS but allow service_role full access
ALTER TABLE import_contacts_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_notes_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_contacts_staging" ON import_contacts_staging
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_notes_staging" ON import_notes_staging
  FOR ALL USING (auth.role() = 'service_role');

-- Notify PostgREST to pick up the new tables
NOTIFY pgrst, 'reload schema';

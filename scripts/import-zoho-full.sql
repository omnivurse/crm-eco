-- ============================================================================
-- ZOHO CRM FULL IMPORT SCRIPT
-- Imports Contacts, Leads, and Notes from Zoho CRM CSV exports
-- 
-- CSV Files:
--   1. Contacts_2026_02_10.csv  (~4,615 records, 157 columns)
--   2. Leads_2026_02_10.csv     (~1,072 records, 76 columns)
--   3. Notes_Contacts_2026_02_10.csv (~28,656 notes, 14 columns)
--
-- IMPORT ORDER: Contacts → Leads → Notes (notes depend on contacts/leads)
--
-- INSTRUCTIONS:
--   Option A (Supabase SQL Editor):
--     1. Run Parts 1-3 to create staging tables and helper functions
--     2. Use Supabase Dashboard → Table Editor to import CSVs into staging tables
--     3. Run Part 4 to transform and insert into crm_records/crm_notes
--
--   Option B (psql):
--     1. Run this entire script
--     2. Uncomment and adjust the \COPY commands with your file paths
--     3. Run the import functions
--
-- ⚠️  SENSITIVE DATA: This import includes SSNs, Tax IDs, and portal
--     credentials. Ensure your database connection is encrypted and
--     restrict access to the staging tables.
-- ============================================================================


-- ############################################################################
-- PART 1: HELPER FUNCTIONS
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
-- Column order MUST match the CSV column order exactly
-- ############################################################################

-- ============================================================================
-- 2A: CONTACTS STAGING TABLE (157 columns)
-- Matches: Contacts_2026_02_10.csv
-- ============================================================================
DROP TABLE IF EXISTS import_contacts_staging CASCADE;
CREATE TABLE import_contacts_staging (
  row_num serial,
  -- Columns in exact CSV order:
  record_id text,                           -- 1: Record Id
  contact_owner_id text,                    -- 2: Contact Owner.id
  contact_owner text,                       -- 3: Contact Owner
  lead_source text,                         -- 4: Lead Source
  first_name text,                          -- 5: First Name
  last_name text,                           -- 6: Last Name
  producer_name_id text,                    -- 7: Producer Name.id
  producer_name text,                       -- 8: Producer Name
  email text,                               -- 9: Email
  title text,                               -- 10: Title
  phone text,                               -- 11: Phone
  fax text,                                 -- 12: Fax
  mobile text,                              -- 13: Mobile
  date_of_birth text,                       -- 14: Date of Birth
  created_by_id text,                       -- 15: Created By.id
  created_by text,                          -- 16: Created By
  modified_by_id text,                      -- 17: Modified By.id
  modified_by text,                         -- 18: Modified By
  created_time text,                        -- 19: Created Time
  modified_time text,                       -- 20: Modified Time
  contact_name text,                        -- 21: Contact Name
  mailing_street text,                      -- 22: Mailing Street
  mailing_city text,                        -- 23: Mailing City
  mailing_state text,                       -- 24: Mailing State
  mailing_zip text,                         -- 25: Mailing Zip
  email_opt_out text,                       -- 26: Email Opt Out
  salutation text,                          -- 27: Salutation
  secondary_email text,                     -- 28: Secondary Email
  currency text,                            -- 29: Currency
  exchange_rate text,                       -- 30: Exchange Rate
  last_activity_time text,                  -- 31: Last Activity Time
  territories text,                         -- 32: Territories
  spouse text,                              -- 33: Spouse
  spouse_dob text,                          -- 34: Spouse - DOB
  child_1 text,                             -- 35: Child 1
  child_1_dob text,                         -- 36: Child 1-DOB
  child_2 text,                             -- 37: Child 2
  child_2_dob text,                         -- 38: Child 2-DOB
  child_3 text,                             -- 39: Child 3
  child_3_dob text,                         -- 40: Child 3 -DOB
  primary_ss_number text,                   -- 41: Primary S.S Number
  notes_history text,                       -- 42: Notes History
  affiliate text,                           -- 43: Affiliate
  carrier text,                             -- 44: Carrier
  previous_product text,                    -- 45: Previous Product
  monthly_premium text,                     -- 46: Monthly Premium
  commission_percentage text,               -- 47: Commission Percentage
  contact_status text,                      -- 48: Contact Status
  product text,                             -- 49: Product
  coverage_option text,                     -- 50: Coverage Option
  start_date text,                          -- 51: Start Date
  referral_source text,                     -- 52: Referral Source
  referring_member text,                    -- 53: Referring Member
  add_on_product text,                      -- 54: Add on Product
  declined text,                            -- 55: Declined
  charge_waived text,                       -- 56: Charge Waived
  affiliate_referral text,                  -- 57: Affiliate Referral
  affiliate_rep_monthly text,               -- 58: Affiliate Rep Monthly
  amount_received text,                     -- 59: Amount Received
  team_leader_monthly text,                 -- 60: Team Leader Monthly
  team_leader text,                         -- 61: Team Leader
  primary_member_gender text,               -- 62: Primary Member Gender
  mpower_life_code text,                    -- 63: MPower Life Code
  welcome_call_performed_by text,           -- 64: Welcome call performed by
  producer_commission text,                 -- 65: Producer Commission
  team_leader_referral text,                -- 66: Team Leader Referral
  child_4 text,                             -- 67: Child 4
  child_5_dob text,                         -- 68: Child 5 -DOB
  child_5 text,                             -- 69: Child 5
  child_4_dob text,                         -- 70: Child 4 -DOB
  director text,                            -- 71: Director
  director_referral text,                   -- 72: Director Referral
  director_monthly text,                    -- 73: Director Monthly
  life_code_4th text,                       -- 74: 4th Life Code
  fulfillment_letter_mailed text,           -- 75: Fulfillment Letter mailed
  fulfillment_email_sent text,              -- 76: Fulfillment Email Sent
  complete_date text,                       -- 77: Complete Date
  life_code_3rd text,                       -- 78: 3rd Life Code
  life_code_2nd text,                       -- 79: 2nd Life Code
  date_referral_paid text,                  -- 80: Date Referral Paid
  welcome_call_status text,                 -- 81: Welcome Call Status
  child_4_ss_number text,                   -- 82: Child 4 S.S. Number
  mec_submitted text,                       -- 83: MEC Submitted
  child_3_ss_number text,                   -- 84: Child 3 S.S. Number
  child_5_ss_number text,                   -- 85: Child 5 S.S. Number
  child_1_ss_number text,                   -- 86: Child 1 S.S. Number
  spouse_ss_number text,                    -- 87: Spouse S.S. Number
  child_2_ss_number text,                   -- 88: Child 2 S.S. Number
  marital_status text,                      -- 89: Marital Status
  work_phone text,                          -- 90: Work Phone
  middle_initial text,                      -- 91: Middle Initial
  referral_fee text,                        -- 92: MPB Referral Fee
  referral_requirement_satisfied text,      -- 93: Referral requirement satisfied
  tag text,                                 -- 94: Tag
  days_visited text,                        -- 95: Days Visited
  average_time_spent_minutes text,          -- 96: Average Time Spent (Minutes)
  number_of_chats text,                     -- 97: Number Of Chats
  most_recent_visit text,                   -- 98: Most Recent Visit
  first_visit text,                         -- 99: First Visit
  first_page_visited text,                  -- 100: First Page Visited
  referrer text,                            -- 101: Referrer
  visitor_score text,                       -- 102: Visitor Score
  risk_assessment_paid text,                -- 103: Risk assessment paid
  company_association text,                 -- 104: Company/Association
  cancellation_date text,                   -- 105: Cancellation Date
  data_processing_basis_id text,            -- 106: Data Processing Basis Details.id
  data_processing_basis text,               -- 107: Data Processing Basis
  data_source text,                         -- 108: Data Source
  preferred_method_of_communication text,   -- 109: Preferred Method of Communication
  vision text,                              -- 110: Vision
  dental text,                              -- 111: Dental
  iua_amount text,                          -- 112: IUA Amount
  business_or_practice_name text,           -- 113: Business or Practice Name
  dpc_name text,                            -- 114: DPC Name
  cirrus_registration_date text,            -- 115: Cirrus registration Date
  portal_username text,                     -- 116: MPB Portal Username
  portal_password text,                     -- 117: MPB Portal Password
  select_conversion_completed text,         -- 118: Select Conversion Completed
  mec_decision_confirmed text,              -- 119: MEC Decision Confirmed
  unsubscribed_mode text,                   -- 120: Unsubscribed Mode
  unsubscribed_time text,                   -- 121: Unsubscribed Time
  admin123 text,                            -- 122: Admin123
  household_annual_adj_gross text,          -- 123: Household Annual Adj Gross
  change_log_time text,                     -- 124: Change Log Time
  locked text,                              -- 125: Locked
  last_enriched_time text,                  -- 126: Last Enriched Time
  enrich_status text,                       -- 127: Enrich Status
  app_downloaded text,                      -- 128: MPB APP Downloaded
  birth_month text,                         -- 129: Birth Month
  third_party_payor text,                   -- 130: Third Party Payor
  atap text,                                -- 131: ATAP
  permission_to_discuss_plan text,          -- 132: Permission to Discuss Plan
  medical_release_form_on_file text,        -- 133: Medical Release Form on File
  life_code_5th text,                       -- 134: 5th Life Code
  wc_outreach_date text,                    -- 135: WC Outreach Date
  e123_member_id text,                      -- 136: E123 Member ID
  child_3_address text,                     -- 137: Child 3 Address
  child_3_phone_number text,                -- 138: Child 3 Phone Number
  child_1_phone_number text,                -- 139: Child 1 Phone Number
  child_4_address text,                     -- 140: Child 4 Address
  child_1_address text,                     -- 141: Child 1 Address
  child_4_phone_number text,                -- 142: Child 4 Phone Number
  child_2_phone_number text,                -- 143: Child 2 Phone Number
  child_5_address text,                     -- 144: Child 5 Address
  child_2_address text,                     -- 145: Child 2 Address
  spouse_address text,                      -- 146: Spouse Address
  child_5_phone_number text,                -- 147: Child 5 Phone Number
  spouse_phone_number text,                 -- 148: Spouse Phone Number
  child_1_email text,                       -- 149: Child 1 Email
  child_2_email text,                       -- 150: Child 2 Email
  child_3_email text,                       -- 151: Child 3 Email
  child_4_email text,                       -- 152: Child 4 Email
  child_5_email text,                       -- 153: Child 5 Email
  spouse_email text,                        -- 154: Spouse Email
  connected_to_module text,                 -- 155: Connected To.module
  connected_to_id text,                     -- 156: Connected To.id
  tax_id text                               -- 157: Tax-ID
);

-- ============================================================================
-- 2B: LEADS STAGING TABLE (76 columns)
-- Matches: Leads_2026_02_10.csv
-- ============================================================================
DROP TABLE IF EXISTS import_leads_staging CASCADE;
CREATE TABLE import_leads_staging (
  row_num serial,
  -- Columns in exact CSV order:
  record_id text,                           -- 1: Record Id
  lead_owner_id text,                       -- 2: Lead Owner.id
  lead_owner text,                          -- 3: Lead Owner
  is_converted text,                        -- 4: Is Converted
  company text,                             -- 5: Company
  first_name text,                          -- 6: First Name
  last_name text,                           -- 7: Last Name
  email text,                               -- 8: Email
  phone text,                               -- 9: Phone
  mobile text,                              -- 10: Mobile
  lead_source text,                         -- 11: Lead Source
  lead_status text,                         -- 12: Lead Status
  created_by_id text,                       -- 13: Created By.id
  created_by text,                          -- 14: Created By
  modified_by_id text,                      -- 15: Modified By.id
  modified_by text,                         -- 16: Modified By
  created_time text,                        -- 17: Created Time
  modified_time text,                       -- 18: Modified Time
  lead_name text,                           -- 19: Lead Name
  street text,                              -- 20: Street
  city text,                                -- 21: City
  state text,                               -- 22: State
  zip_code text,                            -- 23: Zip Code
  email_opt_out text,                       -- 24: Email Opt Out
  salutation text,                          -- 25: Salutation
  last_activity_time text,                  -- 26: Last Activity Time
  spouse text,                              -- 27: Spouse
  spouse_dob text,                          -- 28: Spouse - DOB
  child_1 text,                             -- 29: Child 1
  child_1_dob text,                         -- 30: Child 1 - DOB
  child_2 text,                             -- 31: Child 2
  child_2_dob text,                         -- 32: Child 2 - DOB
  child_3 text,                             -- 33: Child 3
  child_3_dob text,                         -- 34: Child 3 - DOB
  product_type text,                        -- 35: Product Type
  next_step text,                           -- 36: Next Step
  producer_id text,                         -- 37: Producer.id
  producer text,                            -- 38: Producer
  date_of_birth text,                       -- 39: Date of Birth
  child_5_dob text,                         -- 40: Child 5 - DOB
  child_5 text,                             -- 41: Child 5
  child_4_dob text,                         -- 42: Child 4 - DOB
  child_4 text,                             -- 43: Child 4
  coverage_option text,                     -- 44: Coverage Option
  tag text,                                 -- 45: Tag
  business_type text,                       -- 46: Business Type
  days_visited text,                        -- 47: Days Visited
  average_time_spent_minutes text,          -- 48: Average Time Spent (Minutes)
  number_of_chats text,                     -- 49: Number Of Chats
  most_recent_visit text,                   -- 50: Most Recent Visit
  first_visit text,                         -- 51: First Visit
  first_page_visited text,                  -- 52: First Page Visited
  referrer text,                            -- 53: Referrer
  visitor_score text,                       -- 54: Visitor Score
  data_processing_basis_id text,            -- 55: Data Processing Basis Details.id
  data_processing_basis text,               -- 56: Data Processing Basis
  data_source text,                         -- 57: Data Source
  middle_name text,                         -- 58: Middle Name
  business_or_practice_name text,           -- 59: Business or Practice Name
  converted_date_time text,                 -- 60: Converted Date Time
  lead_conversion_time text,                -- 61: Lead Conversion Time
  unsubscribed_mode text,                   -- 62: Unsubscribed Mode
  unsubscribed_time text,                   -- 63: Unsubscribed Time
  converted_account_id text,                -- 64: Converted Account.id
  converted_account text,                   -- 65: Converted Account
  converted_contact_id text,                -- 66: Converted Contact.id
  converted_contact text,                   -- 67: Converted Contact
  converted_deal_id text,                   -- 68: Converted Deal.id
  converted_deal text,                      -- 69: Converted Deal
  change_log_time text,                     -- 70: Change Log Time
  locked text,                              -- 71: Locked
  last_enriched_time text,                  -- 72: Last Enriched Time
  enrich_status text,                       -- 73: Enrich Status
  referring_member text,                    -- 74: Referring Member
  mobile_2 text,                            -- 75: Mobile 2
  connected_to_module text,                 -- 76: Connected To.module
  connected_to_id text                      -- 77: Connected To.id
);

-- ============================================================================
-- 2C: NOTES STAGING TABLE (14 columns)
-- Matches: Notes_Contacts_2026_02_10.csv
-- ============================================================================
DROP TABLE IF EXISTS import_notes_staging CASCADE;
CREATE TABLE import_notes_staging (
  row_num serial,
  -- Columns in exact CSV order:
  record_id text,                           -- 1: Record Id (Note's own ID)
  associated_id text,                       -- 2: Associated_Id
  created_by_id text,                       -- 3: Created By.id
  created_by text,                          -- 4: Created By
  created_time text,                        -- 5: Created Time
  modified_by_id text,                      -- 6: Modified By.id
  modified_by text,                         -- 7: Modified By
  modified_time text,                       -- 8: Modified Time
  note_content text,                        -- 9: Note Content
  note_owner_id text,                       -- 10: Note Owner.id
  note_owner text,                          -- 11: Note Owner
  note_title text,                          -- 12: Note Title
  parent_id text,                           -- 13: Parent ID.id (Zoho Contact/Lead Record Id)
  parent_name text                          -- 14: Parent ID (Contact/Lead Name)
);


-- ############################################################################
-- PART 3: CSV LOADING
-- ############################################################################

-- Option A: psql \COPY commands (uncomment and set file paths)
-- These load CSVs with HEADER row skipping, UTF-8 encoding

-- \COPY import_contacts_staging(record_id, contact_owner_id, contact_owner, lead_source, first_name, last_name, producer_name_id, producer_name, email, title, phone, fax, mobile, date_of_birth, created_by_id, created_by, modified_by_id, modified_by, created_time, modified_time, contact_name, mailing_street, mailing_city, mailing_state, mailing_zip, email_opt_out, salutation, secondary_email, currency, exchange_rate, last_activity_time, territories, spouse, spouse_dob, child_1, child_1_dob, child_2, child_2_dob, child_3, child_3_dob, primary_ss_number, notes_history, affiliate, carrier, previous_product, monthly_premium, commission_percentage, contact_status, product, coverage_option, start_date, referral_source, referring_member, add_on_product, declined, charge_waived, affiliate_referral, affiliate_rep_monthly, amount_received, team_leader_monthly, team_leader, primary_member_gender, mpower_life_code, welcome_call_performed_by, producer_commission, team_leader_referral, child_4, child_5_dob, child_5, child_4_dob, director, director_referral, director_monthly, life_code_4th, fulfillment_letter_mailed, fulfillment_email_sent, complete_date, life_code_3rd, life_code_2nd, date_referral_paid, welcome_call_status, child_4_ss_number, mec_submitted, child_3_ss_number, child_5_ss_number, child_1_ss_number, spouse_ss_number, child_2_ss_number, marital_status, work_phone, middle_initial, referral_fee, referral_requirement_satisfied, tag, days_visited, average_time_spent_minutes, number_of_chats, most_recent_visit, first_visit, first_page_visited, referrer, visitor_score, risk_assessment_paid, company_association, cancellation_date, data_processing_basis_id, data_processing_basis, data_source, preferred_method_of_communication, vision, dental, iua_amount, business_or_practice_name, dpc_name, cirrus_registration_date, portal_username, portal_password, select_conversion_completed, mec_decision_confirmed, unsubscribed_mode, unsubscribed_time, admin123, household_annual_adj_gross, change_log_time, locked, last_enriched_time, enrich_status, app_downloaded, birth_month, third_party_payor, atap, permission_to_discuss_plan, medical_release_form_on_file, life_code_5th, wc_outreach_date, e123_member_id, child_3_address, child_3_phone_number, child_1_phone_number, child_4_address, child_1_address, child_4_phone_number, child_2_phone_number, child_5_address, child_2_address, spouse_address, child_5_phone_number, spouse_phone_number, child_1_email, child_2_email, child_3_email, child_4_email, child_5_email, spouse_email, connected_to_module, connected_to_id, tax_id) FROM 'C:/Users/User/Desktop/Contacts_2026_02_10.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

-- \COPY import_leads_staging(record_id, lead_owner_id, lead_owner, is_converted, company, first_name, last_name, email, phone, mobile, lead_source, lead_status, created_by_id, created_by, modified_by_id, modified_by, created_time, modified_time, lead_name, street, city, state, zip_code, email_opt_out, salutation, last_activity_time, spouse, spouse_dob, child_1, child_1_dob, child_2, child_2_dob, child_3, child_3_dob, product_type, next_step, producer_id, producer, date_of_birth, child_5_dob, child_5, child_4_dob, child_4, coverage_option, tag, business_type, days_visited, average_time_spent_minutes, number_of_chats, most_recent_visit, first_visit, first_page_visited, referrer, visitor_score, data_processing_basis_id, data_processing_basis, data_source, middle_name, business_or_practice_name, converted_date_time, lead_conversion_time, unsubscribed_mode, unsubscribed_time, converted_account_id, converted_account, converted_contact_id, converted_contact, converted_deal_id, converted_deal, change_log_time, locked, last_enriched_time, enrich_status, referring_member, mobile_2, connected_to_module, connected_to_id) FROM 'C:/Users/User/Desktop/Leads_2026_02_10_WS_Only/Leads_2026_02_10.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

-- \COPY import_notes_staging(record_id, associated_id, created_by_id, created_by, created_time, modified_by_id, modified_by, modified_time, note_content, note_owner_id, note_owner, note_title, parent_id, parent_name) FROM 'C:/Users/User/Desktop/Notes_Contacts_2026_02_10_WS_Notes/Notes_Contacts_2026_02_10.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

-- Option B: If using Supabase Dashboard, import CSVs into the staging tables
-- via Table Editor → Import CSV button. The column names will auto-match.


-- ############################################################################
-- PART 4: IMPORT FUNCTIONS
-- ############################################################################

-- ============================================================================
-- 4A: IMPORT CONTACTS
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
  v_existing_email text;
BEGIN
  -- Get organization and contacts module
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found. Create one first.';
  END IF;

  SELECT id INTO v_module_id FROM crm_modules
  WHERE org_id = v_org_id AND key = 'contacts';
  IF v_module_id IS NULL THEN
    RAISE EXCEPTION 'Contacts module not found. Run seed first.';
  END IF;

  -- Create import job for tracking
  INSERT INTO crm_import_jobs (org_id, module_id, source_type, file_name, status, started_at)
  VALUES (v_org_id, v_module_id, 'csv', 'Contacts_2026_02_10.csv', 'processing', now())
  RETURNING id INTO v_import_job_id;

  FOR v_row IN
    SELECT * FROM import_contacts_staging
    WHERE record_id IS NOT NULL
      AND record_id != 'Record Id'
      AND (first_name IS NOT NULL OR last_name IS NOT NULL)
    ORDER BY row_num
  LOOP
    BEGIN
      -- Skip duplicates by email (if email exists)
      IF NULLIF(v_row.email, '') IS NOT NULL THEN
        SELECT email INTO v_existing_email
        FROM crm_records
        WHERE org_id = v_org_id
          AND module_id = v_module_id
          AND email = v_row.email
        LIMIT 1;

        IF v_existing_email IS NOT NULL THEN
          INSERT INTO crm_import_rows (job_id, row_index, raw, status, match_type, error)
          VALUES (v_import_job_id, v_row.row_num, to_jsonb(v_row), 'skipped', 'duplicate_email',
                  'Duplicate email: ' || v_row.email);
          v_skipped := v_skipped + 1;
          CONTINUE;
        END IF;
      END IF;

      -- Build comprehensive JSONB data object with ALL Zoho fields
      v_data := jsonb_build_object(
        -- Zoho identifiers (for linking notes later)
        'zoho_record_id', NULLIF(v_row.record_id, ''),
        'zoho_contact_owner_id', NULLIF(v_row.contact_owner_id, ''),
        'zoho_producer_id', NULLIF(v_row.producer_name_id, ''),

        -- Core identity
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

        -- Contact info
        'secondary_email', NULLIF(v_row.secondary_email, ''),
        'mobile', NULLIF(v_row.mobile, ''),
        'work_phone', NULLIF(v_row.work_phone, ''),
        'fax', NULLIF(v_row.fax, ''),

        -- Address
        'mailing_street', NULLIF(v_row.mailing_street, ''),
        'mailing_city', NULLIF(v_row.mailing_city, ''),
        'mailing_state', NULLIF(v_row.mailing_state, ''),
        'mailing_zip', NULLIF(v_row.mailing_zip, ''),

        -- Ownership & source
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

        -- Commissions & Financial
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

        -- Identifiers & Codes
        'primary_ss_number', NULLIF(v_row.primary_ss_number, ''),
        'tax_id', NULLIF(v_row.tax_id, ''),
        'mpower_life_code', NULLIF(v_row.mpower_life_code, ''),
        'life_code_2nd', NULLIF(v_row.life_code_2nd, ''),
        'life_code_3rd', NULLIF(v_row.life_code_3rd, ''),
        'life_code_4th', NULLIF(v_row.life_code_4th, ''),
        'life_code_5th', NULLIF(v_row.life_code_5th, ''),
        'e123_member_id', NULLIF(v_row.e123_member_id, ''),

        -- Portal / Digital
        'portal_username', NULLIF(v_row.portal_username, ''),
        'portal_password', NULLIF(v_row.portal_password, ''),
        'cirrus_registration_date', _parse_import_date(v_row.cirrus_registration_date),
        'app_downloaded', _parse_import_boolean(v_row.app_downloaded),
        'select_conversion_completed', _parse_import_boolean(v_row.select_conversion_completed),

        -- Compliance
        'mec_submitted', _parse_import_boolean(v_row.mec_submitted),
        'mec_decision_confirmed', _parse_import_boolean(v_row.mec_decision_confirmed),
        'medical_release_form_on_file', _parse_import_boolean(v_row.medical_release_form_on_file),
        'permission_to_discuss_plan', _parse_import_boolean(v_row.permission_to_discuss_plan),
        'atap', NULLIF(v_row.atap, ''),
        'third_party_payor', NULLIF(v_row.third_party_payor, ''),
        'risk_assessment_paid', NULLIF(v_row.risk_assessment_paid, ''),

        -- Fulfillment & Welcome
        'welcome_call_status', NULLIF(v_row.welcome_call_status, ''),
        'welcome_call_performed_by', NULLIF(v_row.welcome_call_performed_by, ''),
        'wc_outreach_date', _parse_import_date(v_row.wc_outreach_date),
        'fulfillment_letter_mailed', _parse_import_date(v_row.fulfillment_letter_mailed),
        'fulfillment_email_sent', _parse_import_date(v_row.fulfillment_email_sent),
        'complete_date', _parse_import_date(v_row.complete_date),

        -- Business
        'business_or_practice_name', NULLIF(v_row.business_or_practice_name, ''),
        'dpc_name', NULLIF(v_row.dpc_name, ''),

        -- Preferences
        'email_opt_out', _parse_import_boolean(v_row.email_opt_out),
        'preferred_method_of_communication', NULLIF(v_row.preferred_method_of_communication, ''),
        'unsubscribed_mode', NULLIF(v_row.unsubscribed_mode, ''),
        'unsubscribed_time', _parse_import_datetime(v_row.unsubscribed_time),

        -- Activity tracking
        'days_visited', _parse_import_number(v_row.days_visited),
        'average_time_spent_minutes', _parse_import_number(v_row.average_time_spent_minutes),
        'number_of_chats', _parse_import_number(v_row.number_of_chats),
        'most_recent_visit', _parse_import_datetime(v_row.most_recent_visit),
        'first_visit', _parse_import_datetime(v_row.first_visit),
        'first_page_visited', NULLIF(v_row.first_page_visited, ''),
        'referrer', NULLIF(v_row.referrer, ''),
        'visitor_score', _parse_import_number(v_row.visitor_score),
        'last_activity_time', _parse_import_datetime(v_row.last_activity_time),

        -- Inline notes from Zoho (HTML formatted)
        'notes_history', NULLIF(v_row.notes_history, ''),

        -- System/Audit
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

      -- Strip null values from JSONB to keep it clean
      v_data := (
        SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb)
        FROM jsonb_each(v_data)
        WHERE value IS NOT NULL
          AND value != 'null'::jsonb
          AND value != '""'::jsonb
      );

      -- Insert into crm_records
      INSERT INTO crm_records (
        org_id, module_id, title, status, email, phone, data, created_at, updated_at
      ) VALUES (
        v_org_id,
        v_module_id,
        COALESCE(
          NULLIF(v_row.contact_name, ''),
          TRIM(COALESCE(v_row.first_name, '') || ' ' || COALESCE(v_row.last_name, ''))
        ),
        COALESCE(NULLIF(v_row.contact_status, ''), 'Active'),
        NULLIF(v_row.email, ''),
        NULLIF(v_row.phone, ''),
        v_data,
        COALESCE(_parse_import_datetime(v_row.created_time), now()),
        COALESCE(_parse_import_datetime(v_row.modified_time), now())
      )
      RETURNING id INTO v_record_id;

      -- Track in import rows
      INSERT INTO crm_import_rows (job_id, row_index, record_id, status, match_type)
      VALUES (v_import_job_id, v_row.row_num, v_record_id, 'inserted', 'new');

      v_imported := v_imported + 1;

    EXCEPTION WHEN OTHERS THEN
      INSERT INTO crm_import_rows (job_id, row_index, status, error)
      VALUES (v_import_job_id, v_row.row_num, 'error', SQLERRM);
      v_errors := v_errors + 1;
    END;
  END LOOP;

  -- Update import job
  UPDATE crm_import_jobs SET
    status = 'completed',
    completed_at = now(),
    total_rows = v_imported + v_skipped + v_errors,
    processed_rows = v_imported + v_skipped + v_errors,
    inserted_count = v_imported,
    skipped_count = v_skipped,
    error_count = v_errors
  WHERE id = v_import_job_id;

  RAISE NOTICE 'Contacts import complete: % imported, % skipped, % errors', v_imported, v_skipped, v_errors;
  RETURN QUERY SELECT v_imported, v_skipped, v_errors;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 4B: IMPORT LEADS
-- ============================================================================
CREATE OR REPLACE FUNCTION import_leads_from_staging()
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
  v_existing_email text;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found.';
  END IF;

  SELECT id INTO v_module_id FROM crm_modules
  WHERE org_id = v_org_id AND key = 'leads';
  IF v_module_id IS NULL THEN
    RAISE EXCEPTION 'Leads module not found. Run seed first.';
  END IF;

  INSERT INTO crm_import_jobs (org_id, module_id, source_type, file_name, status, started_at)
  VALUES (v_org_id, v_module_id, 'csv', 'Leads_2026_02_10.csv', 'processing', now())
  RETURNING id INTO v_import_job_id;

  FOR v_row IN
    SELECT * FROM import_leads_staging
    WHERE record_id IS NOT NULL
      AND record_id != 'Record Id'
      AND (first_name IS NOT NULL OR last_name IS NOT NULL)
    ORDER BY row_num
  LOOP
    BEGIN
      -- Skip duplicates by email
      IF NULLIF(v_row.email, '') IS NOT NULL THEN
        SELECT email INTO v_existing_email
        FROM crm_records
        WHERE org_id = v_org_id
          AND module_id = v_module_id
          AND email = v_row.email
        LIMIT 1;

        IF v_existing_email IS NOT NULL THEN
          INSERT INTO crm_import_rows (job_id, row_index, status, match_type, error)
          VALUES (v_import_job_id, v_row.row_num, 'skipped', 'duplicate_email',
                  'Duplicate email: ' || v_row.email);
          v_skipped := v_skipped + 1;
          CONTINUE;
        END IF;
      END IF;

      v_data := jsonb_build_object(
        -- Zoho identifiers
        'zoho_record_id', NULLIF(v_row.record_id, ''),
        'zoho_lead_owner_id', NULLIF(v_row.lead_owner_id, ''),
        'zoho_producer_id', NULLIF(v_row.producer_id, ''),

        -- Core identity
        'first_name', NULLIF(v_row.first_name, ''),
        'last_name', NULLIF(v_row.last_name, ''),
        'lead_name', NULLIF(v_row.lead_name, ''),
        'salutation', NULLIF(v_row.salutation, ''),
        'middle_name', NULLIF(v_row.middle_name, ''),
        'date_of_birth', _parse_import_date(v_row.date_of_birth),
        'company', NULLIF(v_row.company, ''),

        -- Contact
        'mobile', NULLIF(v_row.mobile, ''),
        'mobile_2', NULLIF(v_row.mobile_2, ''),

        -- Address
        'street', NULLIF(v_row.street, ''),
        'city', NULLIF(v_row.city, ''),
        'state', NULLIF(v_row.state, ''),
        'zip_code', NULLIF(v_row.zip_code, ''),

        -- Lead management
        'lead_status', NULLIF(v_row.lead_status, ''),
        'lead_source', NULLIF(v_row.lead_source, ''),
        'lead_owner', NULLIF(v_row.lead_owner, ''),
        'producer', NULLIF(v_row.producer, ''),
        'is_converted', _parse_import_boolean(v_row.is_converted),
        'tag', NULLIF(v_row.tag, ''),
        'referring_member', NULLIF(v_row.referring_member, ''),

        -- Product interest
        'product_type', NULLIF(v_row.product_type, ''),
        'coverage_option', NULLIF(v_row.coverage_option, ''),
        'next_step', NULLIF(v_row.next_step, ''),
        'business_type', NULLIF(v_row.business_type, ''),
        'business_or_practice_name', NULLIF(v_row.business_or_practice_name, ''),

        -- Spouse & Family
        'spouse', NULLIF(v_row.spouse, ''),
        'spouse_dob', _parse_import_date(v_row.spouse_dob),
        'child_1', NULLIF(v_row.child_1, ''),
        'child_1_dob', _parse_import_date(v_row.child_1_dob),
        'child_2', NULLIF(v_row.child_2, ''),
        'child_2_dob', _parse_import_date(v_row.child_2_dob),
        'child_3', NULLIF(v_row.child_3, ''),
        'child_3_dob', _parse_import_date(v_row.child_3_dob),
        'child_4', NULLIF(v_row.child_4, ''),
        'child_4_dob', _parse_import_date(v_row.child_4_dob),
        'child_5', NULLIF(v_row.child_5, ''),
        'child_5_dob', _parse_import_date(v_row.child_5_dob),

        -- Conversion
        'converted_date_time', _parse_import_datetime(v_row.converted_date_time),
        'lead_conversion_time', NULLIF(v_row.lead_conversion_time, ''),
        'converted_account', NULLIF(v_row.converted_account, ''),
        'converted_account_id', NULLIF(v_row.converted_account_id, ''),
        'converted_contact', NULLIF(v_row.converted_contact, ''),
        'converted_contact_id', NULLIF(v_row.converted_contact_id, ''),
        'converted_deal', NULLIF(v_row.converted_deal, ''),
        'converted_deal_id', NULLIF(v_row.converted_deal_id, ''),

        -- Preferences
        'email_opt_out', _parse_import_boolean(v_row.email_opt_out),
        'unsubscribed_mode', NULLIF(v_row.unsubscribed_mode, ''),
        'unsubscribed_time', _parse_import_datetime(v_row.unsubscribed_time),

        -- Activity tracking
        'days_visited', _parse_import_number(v_row.days_visited),
        'average_time_spent_minutes', _parse_import_number(v_row.average_time_spent_minutes),
        'number_of_chats', _parse_import_number(v_row.number_of_chats),
        'most_recent_visit', _parse_import_datetime(v_row.most_recent_visit),
        'first_visit', _parse_import_datetime(v_row.first_visit),
        'first_page_visited', NULLIF(v_row.first_page_visited, ''),
        'referrer', NULLIF(v_row.referrer, ''),
        'visitor_score', _parse_import_number(v_row.visitor_score),
        'last_activity_time', _parse_import_datetime(v_row.last_activity_time),

        -- System/Audit
        'created_by_name', NULLIF(v_row.created_by, ''),
        'modified_by_name', NULLIF(v_row.modified_by, ''),
        'zoho_created_time', _parse_import_datetime(v_row.created_time),
        'zoho_modified_time', _parse_import_datetime(v_row.modified_time),
        'data_source', NULLIF(v_row.data_source, ''),
        'data_processing_basis', NULLIF(v_row.data_processing_basis, ''),
        'locked', _parse_import_boolean(v_row.locked),
        'connected_to_module', NULLIF(v_row.connected_to_module, ''),
        'connected_to_id', NULLIF(v_row.connected_to_id, '')
      );

      -- Strip nulls
      v_data := (
        SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb)
        FROM jsonb_each(v_data)
        WHERE value IS NOT NULL
          AND value != 'null'::jsonb
          AND value != '""'::jsonb
      );

      INSERT INTO crm_records (
        org_id, module_id, title, status, email, phone, data, created_at, updated_at
      ) VALUES (
        v_org_id,
        v_module_id,
        COALESCE(
          NULLIF(v_row.lead_name, ''),
          TRIM(COALESCE(v_row.first_name, '') || ' ' || COALESCE(v_row.last_name, ''))
        ),
        COALESCE(NULLIF(v_row.lead_status, ''), 'New'),
        NULLIF(v_row.email, ''),
        NULLIF(v_row.phone, ''),
        v_data,
        COALESCE(_parse_import_datetime(v_row.created_time), now()),
        COALESCE(_parse_import_datetime(v_row.modified_time), now())
      )
      RETURNING id INTO v_record_id;

      INSERT INTO crm_import_rows (job_id, row_index, record_id, status, match_type)
      VALUES (v_import_job_id, v_row.row_num, v_record_id, 'inserted', 'new');

      v_imported := v_imported + 1;

    EXCEPTION WHEN OTHERS THEN
      INSERT INTO crm_import_rows (job_id, row_index, status, error)
      VALUES (v_import_job_id, v_row.row_num, 'error', SQLERRM);
      v_errors := v_errors + 1;
    END;
  END LOOP;

  UPDATE crm_import_jobs SET
    status = 'completed',
    completed_at = now(),
    total_rows = v_imported + v_skipped + v_errors,
    processed_rows = v_imported + v_skipped + v_errors,
    inserted_count = v_imported,
    skipped_count = v_skipped,
    error_count = v_errors
  WHERE id = v_import_job_id;

  RAISE NOTICE 'Leads import complete: % imported, % skipped, % errors', v_imported, v_skipped, v_errors;
  RETURN QUERY SELECT v_imported, v_skipped, v_errors;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 4C: IMPORT NOTES
-- Links notes to contacts/leads via Zoho Record ID stored in data->>'zoho_record_id'
-- MUST run AFTER contacts and leads import
-- ============================================================================
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
      -- Look up the parent CRM record by Zoho Record ID
      -- The parent_id from notes CSV matches the Record Id of contacts/leads
      SELECT id INTO v_parent_record_id
      FROM crm_records
      WHERE org_id = v_org_id
        AND data->>'zoho_record_id' = v_row.parent_id
      LIMIT 1;

      IF v_parent_record_id IS NULL THEN
        -- Parent record not found - skip but log
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      -- Insert into crm_notes
      INSERT INTO crm_notes (
        org_id,
        record_id,
        body,
        is_pinned,
        created_at,
        updated_at
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


-- ############################################################################
-- PART 5: RUN THE IMPORTS (execute in order after loading CSVs)
-- ############################################################################

-- Step 1: Import Contacts
-- SELECT * FROM import_contacts_from_staging();

-- Step 2: Import Leads
-- SELECT * FROM import_leads_from_staging();

-- Step 3: Import Notes (must run AFTER contacts & leads)
-- SELECT * FROM import_notes_from_staging();

-- ############################################################################
-- PART 6: VERIFICATION QUERIES (run after import to check results)
-- ############################################################################

-- Check record counts per module:
-- SELECT m.name, COUNT(r.id) as record_count
-- FROM crm_modules m
-- LEFT JOIN crm_records r ON r.module_id = m.id
-- GROUP BY m.name ORDER BY m.name;

-- Check import job results:
-- SELECT file_name, status, inserted_count, skipped_count, error_count, 
--        started_at, completed_at
-- FROM crm_import_jobs ORDER BY started_at DESC;

-- Check for any import errors:
-- SELECT job_id, row_index, error
-- FROM crm_import_rows WHERE status = 'error' LIMIT 20;

-- Check notes linked correctly:
-- SELECT r.title, COUNT(n.id) as note_count
-- FROM crm_records r
-- JOIN crm_notes n ON n.record_id = r.id
-- GROUP BY r.title
-- ORDER BY note_count DESC LIMIT 20;

-- Check sample contact data integrity:
-- SELECT title, email, phone, status,
--        data->>'first_name' as first_name,
--        data->>'last_name' as last_name,
--        data->>'mailing_state' as state,
--        data->>'contact_status' as contact_status,
--        data->>'product' as product
-- FROM crm_records
-- WHERE module_id = (SELECT id FROM crm_modules WHERE key = 'contacts' LIMIT 1)
-- LIMIT 10;


-- ############################################################################
-- PART 7: CLEANUP (run after verifying everything is correct)
-- ############################################################################

-- DROP TABLE IF EXISTS import_contacts_staging CASCADE;
-- DROP TABLE IF EXISTS import_leads_staging CASCADE;
-- DROP TABLE IF EXISTS import_notes_staging CASCADE;
-- DROP FUNCTION IF EXISTS _parse_import_date;
-- DROP FUNCTION IF EXISTS _parse_import_datetime;
-- DROP FUNCTION IF EXISTS _parse_import_number;
-- DROP FUNCTION IF EXISTS _parse_import_boolean;
-- DROP FUNCTION IF EXISTS import_contacts_from_staging;
-- DROP FUNCTION IF EXISTS import_leads_from_staging;
-- DROP FUNCTION IF EXISTS import_notes_from_staging;

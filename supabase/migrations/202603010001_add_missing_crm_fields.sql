-- ============================================================================
-- Add all missing CRM field definitions for Contacts and Leads modules
-- This ensures every field imported from Zoho CSV is visible on the frontend.
--
-- The import scripts store ALL CSV data into crm_records.data JSONB, but the
-- frontend requires crm_fields entries to know field labels, types, and sections.
-- ============================================================================

DO $$
DECLARE
  v_org_id uuid;
  v_contacts_module_id uuid;
  v_leads_module_id uuid;
BEGIN
  -- Get the first organization
  SELECT id INTO v_org_id FROM organizations LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found. Skipping.';
    RETURN;
  END IF;

  -- Get module IDs
  SELECT id INTO v_contacts_module_id
    FROM crm_modules WHERE org_id = v_org_id AND key = 'contacts';
  SELECT id INTO v_leads_module_id
    FROM crm_modules WHERE org_id = v_org_id AND key = 'leads';

  IF v_contacts_module_id IS NULL THEN
    RAISE NOTICE 'Contacts module not found. Skipping.';
    RETURN;
  END IF;

  -- ============================================================================
  -- CONTACTS: Identity & Demographics
  -- ============================================================================
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section)
  VALUES
    (v_org_id, v_contacts_module_id, 'middle_initial', 'Middle Initial', 'text', false, false, 100, 'identity'),
    (v_org_id, v_contacts_module_id, 'primary_member_gender', 'Gender', 'select', false, false, 101, 'identity'),
    (v_org_id, v_contacts_module_id, 'birth_month', 'Birth Month', 'text', false, false, 102, 'identity'),
    (v_org_id, v_contacts_module_id, 'primary_ss_number', 'Primary SSN', 'text', false, false, 103, 'identity'),
    (v_org_id, v_contacts_module_id, 'tax_id', 'Tax ID', 'text', false, false, 104, 'identity')
  ON CONFLICT (module_id, key) DO NOTHING;

  UPDATE crm_fields
    SET options = '["Male", "Female", "Other"]'::jsonb
  WHERE module_id = v_contacts_module_id AND key = 'primary_member_gender';

  -- ============================================================================
  -- CONTACTS: Management / Ownership
  -- ============================================================================
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section)
  VALUES
    (v_org_id, v_contacts_module_id, 'contact_name', 'Contact Name', 'text', false, false, 110, 'management'),
    (v_org_id, v_contacts_module_id, 'contact_owner', 'Contact Owner (Zoho)', 'text', false, false, 111, 'management'),
    (v_org_id, v_contacts_module_id, 'producer_name', 'Producer Name', 'text', false, false, 112, 'management'),
    (v_org_id, v_contacts_module_id, 'territories', 'Territories', 'text', false, false, 113, 'management'),
    (v_org_id, v_contacts_module_id, 'data_source', 'Data Source', 'text', false, false, 114, 'management')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- ============================================================================
  -- CONTACTS: Spouse Extended (add to existing 'family' section)
  -- ============================================================================
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section)
  VALUES
    (v_org_id, v_contacts_module_id, 'spouse_ss_number', 'Spouse SSN', 'text', false, false, 53, 'family'),
    (v_org_id, v_contacts_module_id, 'spouse_address', 'Spouse Address', 'text', false, false, 54, 'family'),
    (v_org_id, v_contacts_module_id, 'spouse_phone_number', 'Spouse Phone', 'phone', false, false, 55, 'family'),
    (v_org_id, v_contacts_module_id, 'spouse_email', 'Spouse Email', 'email', false, false, 56, 'family')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- ============================================================================
  -- CONTACTS: Children Extended (add to existing 'family' section)
  -- ============================================================================
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section)
  VALUES
    -- Child 1 extended
    (v_org_id, v_contacts_module_id, 'child_1_ss_number', 'Child 1 SSN', 'text', false, false, 57, 'family'),
    (v_org_id, v_contacts_module_id, 'child_1_address', 'Child 1 Address', 'text', false, false, 58, 'family'),
    (v_org_id, v_contacts_module_id, 'child_1_phone_number', 'Child 1 Phone', 'phone', false, false, 59, 'family'),
    (v_org_id, v_contacts_module_id, 'child_1_email', 'Child 1 Email', 'email', false, false, 60, 'family'),
    -- Child 2 extended
    (v_org_id, v_contacts_module_id, 'child_2_ss_number', 'Child 2 SSN', 'text', false, false, 61, 'family'),
    (v_org_id, v_contacts_module_id, 'child_2_address', 'Child 2 Address', 'text', false, false, 62, 'family'),
    (v_org_id, v_contacts_module_id, 'child_2_phone_number', 'Child 2 Phone', 'phone', false, false, 63, 'family'),
    (v_org_id, v_contacts_module_id, 'child_2_email', 'Child 2 Email', 'email', false, false, 64, 'family'),
    -- Child 3 extended
    (v_org_id, v_contacts_module_id, 'child_3_ss_number', 'Child 3 SSN', 'text', false, false, 65, 'family'),
    (v_org_id, v_contacts_module_id, 'child_3_address', 'Child 3 Address', 'text', false, false, 66, 'family'),
    (v_org_id, v_contacts_module_id, 'child_3_phone_number', 'Child 3 Phone', 'phone', false, false, 67, 'family'),
    (v_org_id, v_contacts_module_id, 'child_3_email', 'Child 3 Email', 'email', false, false, 68, 'family'),
    -- Child 4 extended
    (v_org_id, v_contacts_module_id, 'child_4_ss_number', 'Child 4 SSN', 'text', false, false, 69, 'family'),
    (v_org_id, v_contacts_module_id, 'child_4_address', 'Child 4 Address', 'text', false, false, 70, 'family'),
    (v_org_id, v_contacts_module_id, 'child_4_phone_number', 'Child 4 Phone', 'phone', false, false, 71, 'family'),
    (v_org_id, v_contacts_module_id, 'child_4_email', 'Child 4 Email', 'email', false, false, 72, 'family'),
    -- Child 5 extended
    (v_org_id, v_contacts_module_id, 'child_5_ss_number', 'Child 5 SSN', 'text', false, false, 73, 'family'),
    (v_org_id, v_contacts_module_id, 'child_5_address', 'Child 5 Address', 'text', false, false, 74, 'family'),
    (v_org_id, v_contacts_module_id, 'child_5_phone_number', 'Child 5 Phone', 'phone', false, false, 75, 'family'),
    (v_org_id, v_contacts_module_id, 'child_5_email', 'Child 5 Email', 'email', false, false, 76, 'family')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- ============================================================================
  -- CONTACTS: Insurance Add-ons (add to existing 'product' section)
  -- ============================================================================
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section)
  VALUES
    (v_org_id, v_contacts_module_id, 'add_on_product', 'Add-on Product', 'text', false, false, 68, 'product'),
    (v_org_id, v_contacts_module_id, 'vision', 'Vision', 'text', false, false, 69, 'product'),
    (v_org_id, v_contacts_module_id, 'dental', 'Dental', 'text', false, false, 70, 'product')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- ============================================================================
  -- CONTACTS: Commissions (new section)
  -- ============================================================================
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section)
  VALUES
    (v_org_id, v_contacts_module_id, 'amount_received', 'Amount Received', 'currency', false, false, 120, 'commissions'),
    (v_org_id, v_contacts_module_id, 'team_leader', 'Team Leader', 'text', false, false, 121, 'commissions'),
    (v_org_id, v_contacts_module_id, 'team_leader_monthly', 'Team Leader Monthly', 'currency', false, false, 122, 'commissions'),
    (v_org_id, v_contacts_module_id, 'team_leader_referral', 'Team Leader Referral', 'currency', false, false, 123, 'commissions'),
    (v_org_id, v_contacts_module_id, 'director', 'Director', 'text', false, false, 124, 'commissions'),
    (v_org_id, v_contacts_module_id, 'director_monthly', 'Director Monthly', 'currency', false, false, 125, 'commissions'),
    (v_org_id, v_contacts_module_id, 'director_referral', 'Director Referral', 'currency', false, false, 126, 'commissions'),
    (v_org_id, v_contacts_module_id, 'affiliate_referral', 'Affiliate Referral', 'text', false, false, 127, 'commissions'),
    (v_org_id, v_contacts_module_id, 'affiliate_rep_monthly', 'Affiliate Rep Monthly', 'currency', false, false, 128, 'commissions'),
    (v_org_id, v_contacts_module_id, 'referral_fee', 'MPB Referral Fee', 'currency', false, false, 129, 'commissions'),
    (v_org_id, v_contacts_module_id, 'date_referral_paid', 'Date Referral Paid', 'date', false, false, 130, 'commissions'),
    (v_org_id, v_contacts_module_id, 'referral_requirement_satisfied', 'Referral Requirement Satisfied', 'text', false, false, 131, 'commissions'),
    (v_org_id, v_contacts_module_id, 'declined', 'Declined', 'boolean', false, false, 132, 'commissions'),
    (v_org_id, v_contacts_module_id, 'charge_waived', 'Charge Waived', 'boolean', false, false, 133, 'commissions'),
    (v_org_id, v_contacts_module_id, 'household_annual_adj_gross', 'Household Annual Adj Gross', 'currency', false, false, 134, 'commissions')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- ============================================================================
  -- CONTACTS: Identifiers (new section)
  -- ============================================================================
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section)
  VALUES
    (v_org_id, v_contacts_module_id, 'mpower_life_code', 'MPower Life Code', 'text', false, false, 140, 'identifiers'),
    (v_org_id, v_contacts_module_id, 'life_code_2nd', '2nd Life Code', 'text', false, false, 141, 'identifiers'),
    (v_org_id, v_contacts_module_id, 'life_code_3rd', '3rd Life Code', 'text', false, false, 142, 'identifiers'),
    (v_org_id, v_contacts_module_id, 'life_code_4th', '4th Life Code', 'text', false, false, 143, 'identifiers'),
    (v_org_id, v_contacts_module_id, 'life_code_5th', '5th Life Code', 'text', false, false, 144, 'identifiers'),
    (v_org_id, v_contacts_module_id, 'e123_member_id', 'E123 Member ID', 'text', false, false, 145, 'identifiers')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- ============================================================================
  -- CONTACTS: Portal (new section)
  -- ============================================================================
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section)
  VALUES
    (v_org_id, v_contacts_module_id, 'portal_username', 'MPB Portal Username', 'text', false, false, 150, 'portal'),
    (v_org_id, v_contacts_module_id, 'portal_password', 'MPB Portal Password', 'text', false, false, 151, 'portal'),
    (v_org_id, v_contacts_module_id, 'cirrus_registration_date', 'Cirrus Registration Date', 'date', false, false, 152, 'portal'),
    (v_org_id, v_contacts_module_id, 'app_downloaded', 'MPB App Downloaded', 'boolean', false, false, 153, 'portal'),
    (v_org_id, v_contacts_module_id, 'select_conversion_completed', 'Select Conversion Completed', 'boolean', false, false, 154, 'portal')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- ============================================================================
  -- CONTACTS: Compliance (new section)
  -- ============================================================================
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section)
  VALUES
    (v_org_id, v_contacts_module_id, 'mec_submitted', 'MEC Submitted', 'boolean', false, false, 160, 'compliance'),
    (v_org_id, v_contacts_module_id, 'mec_decision_confirmed', 'MEC Decision Confirmed', 'boolean', false, false, 161, 'compliance'),
    (v_org_id, v_contacts_module_id, 'medical_release_form_on_file', 'Medical Release Form on File', 'boolean', false, false, 162, 'compliance'),
    (v_org_id, v_contacts_module_id, 'permission_to_discuss_plan', 'Permission to Discuss Plan', 'boolean', false, false, 163, 'compliance'),
    (v_org_id, v_contacts_module_id, 'atap', 'ATAP', 'text', false, false, 164, 'compliance'),
    (v_org_id, v_contacts_module_id, 'third_party_payor', 'Third Party Payor', 'text', false, false, 165, 'compliance'),
    (v_org_id, v_contacts_module_id, 'risk_assessment_paid', 'Risk Assessment Paid', 'text', false, false, 166, 'compliance'),
    (v_org_id, v_contacts_module_id, 'data_processing_basis', 'Data Processing Basis', 'text', false, false, 167, 'compliance')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- ============================================================================
  -- CONTACTS: Fulfillment (new section)
  -- ============================================================================
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section)
  VALUES
    (v_org_id, v_contacts_module_id, 'welcome_call_performed_by', 'Welcome Call Performed By', 'text', false, false, 170, 'fulfillment'),
    (v_org_id, v_contacts_module_id, 'wc_outreach_date', 'WC Outreach Date', 'date', false, false, 171, 'fulfillment'),
    (v_org_id, v_contacts_module_id, 'fulfillment_letter_mailed', 'Fulfillment Letter Mailed', 'date', false, false, 172, 'fulfillment'),
    (v_org_id, v_contacts_module_id, 'fulfillment_email_sent', 'Fulfillment Email Sent', 'date', false, false, 173, 'fulfillment'),
    (v_org_id, v_contacts_module_id, 'complete_date', 'Complete Date', 'date', false, false, 174, 'fulfillment')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- ============================================================================
  -- CONTACTS: Business (new section)
  -- ============================================================================
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section)
  VALUES
    (v_org_id, v_contacts_module_id, 'business_or_practice_name', 'Business/Practice Name', 'text', false, false, 180, 'business'),
    (v_org_id, v_contacts_module_id, 'dpc_name', 'DPC Name', 'text', false, false, 181, 'business')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- ============================================================================
  -- CONTACTS: Preferences (new section)
  -- ============================================================================
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section)
  VALUES
    (v_org_id, v_contacts_module_id, 'preferred_method_of_communication', 'Preferred Communication Method', 'text', false, false, 190, 'preferences'),
    (v_org_id, v_contacts_module_id, 'unsubscribed_mode', 'Unsubscribed Mode', 'text', false, false, 191, 'preferences'),
    (v_org_id, v_contacts_module_id, 'unsubscribed_time', 'Unsubscribed Time', 'datetime', false, false, 192, 'preferences')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- ============================================================================
  -- CONTACTS: Payment (new section)
  -- ============================================================================
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section)
  VALUES
    (v_org_id, v_contacts_module_id, 'payment_method', 'Payment Method', 'text', false, false, 200, 'payment'),
    (v_org_id, v_contacts_module_id, 'account_type', 'Account Type', 'text', false, false, 201, 'payment'),
    (v_org_id, v_contacts_module_id, 'routing_number', 'Routing Number', 'text', false, false, 202, 'payment'),
    (v_org_id, v_contacts_module_id, 'account_number', 'Account Number', 'text', false, false, 203, 'payment'),
    (v_org_id, v_contacts_module_id, 'currency', 'Currency', 'text', false, false, 204, 'payment'),
    (v_org_id, v_contacts_module_id, 'exchange_rate', 'Exchange Rate', 'number', false, false, 205, 'payment')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- ============================================================================
  -- CONTACTS: Activity / Analytics (new section)
  -- ============================================================================
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section)
  VALUES
    (v_org_id, v_contacts_module_id, 'days_visited', 'Days Visited', 'number', false, false, 210, 'activity'),
    (v_org_id, v_contacts_module_id, 'average_time_spent_minutes', 'Avg Time Spent (Min)', 'number', false, false, 211, 'activity'),
    (v_org_id, v_contacts_module_id, 'number_of_chats', 'Number of Chats', 'number', false, false, 212, 'activity'),
    (v_org_id, v_contacts_module_id, 'most_recent_visit', 'Most Recent Visit', 'datetime', false, false, 213, 'activity'),
    (v_org_id, v_contacts_module_id, 'first_visit', 'First Visit', 'datetime', false, false, 214, 'activity'),
    (v_org_id, v_contacts_module_id, 'first_page_visited', 'First Page Visited', 'text', false, false, 215, 'activity'),
    (v_org_id, v_contacts_module_id, 'referrer', 'Referrer', 'text', false, false, 216, 'activity'),
    (v_org_id, v_contacts_module_id, 'visitor_score', 'Visitor Score', 'number', false, false, 217, 'activity'),
    (v_org_id, v_contacts_module_id, 'last_activity_time', 'Last Activity Time', 'datetime', false, false, 218, 'activity')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- ============================================================================
  -- CONTACTS: Zoho System Fields (new section, for reference/audit)
  -- ============================================================================
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section)
  VALUES
    (v_org_id, v_contacts_module_id, 'zoho_record_id', 'Zoho Record ID', 'text', false, false, 220, 'zoho_system'),
    (v_org_id, v_contacts_module_id, 'zoho_contact_owner_id', 'Zoho Owner ID', 'text', false, false, 221, 'zoho_system'),
    (v_org_id, v_contacts_module_id, 'zoho_producer_id', 'Zoho Producer ID', 'text', false, false, 222, 'zoho_system'),
    (v_org_id, v_contacts_module_id, 'created_by_name', 'Created By', 'text', false, false, 223, 'zoho_system'),
    (v_org_id, v_contacts_module_id, 'modified_by_name', 'Modified By', 'text', false, false, 224, 'zoho_system'),
    (v_org_id, v_contacts_module_id, 'zoho_created_time', 'Zoho Created Time', 'datetime', false, false, 225, 'zoho_system'),
    (v_org_id, v_contacts_module_id, 'zoho_modified_time', 'Zoho Modified Time', 'datetime', false, false, 226, 'zoho_system'),
    (v_org_id, v_contacts_module_id, 'locked', 'Locked', 'boolean', false, false, 227, 'zoho_system'),
    (v_org_id, v_contacts_module_id, 'admin123', 'Admin123', 'text', false, false, 228, 'zoho_system')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- ============================================================================
  -- LEADS: Missing Fields
  -- ============================================================================
  IF v_leads_module_id IS NOT NULL THEN

    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section)
    VALUES
      -- Core missing
      (v_org_id, v_leads_module_id, 'lead_name', 'Lead Name', 'text', false, false, 9, 'main'),
      (v_org_id, v_leads_module_id, 'middle_name', 'Middle Name', 'text', false, false, 14, 'main'),
      (v_org_id, v_leads_module_id, 'mobile_2', 'Mobile 2', 'phone', false, false, 15, 'main'),
      -- Management
      (v_org_id, v_leads_module_id, 'lead_owner', 'Lead Owner (Zoho)', 'text', false, false, 16, 'main'),
      (v_org_id, v_leads_module_id, 'producer', 'Producer', 'text', false, false, 17, 'main'),
      (v_org_id, v_leads_module_id, 'data_source', 'Data Source', 'text', false, false, 18, 'main'),
      -- Business
      (v_org_id, v_leads_module_id, 'business_or_practice_name', 'Business/Practice Name', 'text', false, false, 34, 'interest'),
      -- Conversion extended
      (v_org_id, v_leads_module_id, 'converted_date_time', 'Converted Date/Time', 'datetime', false, false, 65, 'conversion'),
      (v_org_id, v_leads_module_id, 'lead_conversion_time', 'Lead Conversion Time', 'text', false, false, 66, 'conversion'),
      (v_org_id, v_leads_module_id, 'converted_account', 'Converted Account', 'text', false, false, 67, 'conversion'),
      (v_org_id, v_leads_module_id, 'converted_contact', 'Converted Contact', 'text', false, false, 68, 'conversion'),
      (v_org_id, v_leads_module_id, 'converted_deal', 'Converted Deal', 'text', false, false, 69, 'conversion'),
      -- Zoho system
      (v_org_id, v_leads_module_id, 'zoho_record_id', 'Zoho Record ID', 'text', false, false, 70, 'zoho_system'),
      (v_org_id, v_leads_module_id, 'zoho_lead_owner_id', 'Zoho Owner ID', 'text', false, false, 71, 'zoho_system'),
      (v_org_id, v_leads_module_id, 'zoho_producer_id', 'Zoho Producer ID', 'text', false, false, 72, 'zoho_system'),
      (v_org_id, v_leads_module_id, 'created_by_name', 'Created By', 'text', false, false, 73, 'zoho_system'),
      (v_org_id, v_leads_module_id, 'modified_by_name', 'Modified By', 'text', false, false, 74, 'zoho_system'),
      (v_org_id, v_leads_module_id, 'zoho_created_time', 'Zoho Created Time', 'datetime', false, false, 75, 'zoho_system'),
      (v_org_id, v_leads_module_id, 'zoho_modified_time', 'Zoho Modified Time', 'datetime', false, false, 76, 'zoho_system'),
      (v_org_id, v_leads_module_id, 'locked', 'Locked', 'boolean', false, false, 77, 'zoho_system')
    ON CONFLICT (module_id, key) DO NOTHING;

  END IF;

  -- ============================================================================
  -- UPDATE CONTACTS LAYOUT: Add new sections
  -- ============================================================================
  UPDATE crm_layouts
  SET config = '{
    "sections": [
      {"key": "main", "label": "Contact Information", "columns": 2, "collapsed": false},
      {"key": "address", "label": "Address", "columns": 2, "collapsed": false},
      {"key": "identity", "label": "Identity & Demographics", "columns": 2, "collapsed": true},
      {"key": "management", "label": "Ownership & Management", "columns": 2, "collapsed": true},
      {"key": "family", "label": "Family & Household", "columns": 2, "collapsed": true},
      {"key": "product", "label": "Product & Coverage", "columns": 2, "collapsed": false},
      {"key": "financial", "label": "Financial", "columns": 2, "collapsed": true},
      {"key": "commissions", "label": "Commissions", "columns": 2, "collapsed": true},
      {"key": "payment", "label": "Payment", "columns": 2, "collapsed": true},
      {"key": "identifiers", "label": "Life Codes & IDs", "columns": 2, "collapsed": true},
      {"key": "portal", "label": "Portal Access", "columns": 2, "collapsed": true},
      {"key": "compliance", "label": "Compliance", "columns": 2, "collapsed": true},
      {"key": "fulfillment", "label": "Fulfillment", "columns": 2, "collapsed": true},
      {"key": "business", "label": "Business Info", "columns": 2, "collapsed": true},
      {"key": "preferences", "label": "Communication Preferences", "columns": 2, "collapsed": true},
      {"key": "activity", "label": "Activity & Analytics", "columns": 2, "collapsed": true},
      {"key": "additional", "label": "Additional Information", "columns": 1, "collapsed": true},
      {"key": "zoho_system", "label": "Zoho System Fields", "columns": 2, "collapsed": true}
    ]
  }'::jsonb
  WHERE module_id = v_contacts_module_id
    AND org_id = v_org_id
    AND is_default = true;

  -- ============================================================================
  -- UPDATE LEADS LAYOUT: Add new sections
  -- ============================================================================
  IF v_leads_module_id IS NOT NULL THEN
    UPDATE crm_layouts
    SET config = '{
      "sections": [
        {"key": "main", "label": "Lead Information", "columns": 2, "collapsed": false},
        {"key": "address", "label": "Address", "columns": 2, "collapsed": false},
        {"key": "interest", "label": "Product Interest", "columns": 2, "collapsed": false},
        {"key": "family", "label": "Family", "columns": 2, "collapsed": true},
        {"key": "conversion", "label": "Conversion", "columns": 2, "collapsed": true},
        {"key": "zoho_system", "label": "Zoho System Fields", "columns": 2, "collapsed": true}
      ]
    }'::jsonb
    WHERE module_id = v_leads_module_id
      AND org_id = v_org_id
      AND is_default = true;
  END IF;

  -- ============================================================================
  -- ADD NEW VIEWS
  -- ============================================================================

  -- Contacts: Full Details view
  INSERT INTO crm_views (org_id, module_id, name, is_default, is_shared, columns, sort)
  VALUES (
    v_org_id,
    v_contacts_module_id,
    'Full Details',
    false,
    true,
    '["first_name", "last_name", "email", "phone", "contact_status", "producer_name", "product", "coverage_option", "monthly_premium", "start_date", "mailing_city", "mailing_state", "carrier"]'::jsonb,
    '[{"field": "created_at", "direction": "desc"}]'::jsonb
  )
  ON CONFLICT DO NOTHING;

  -- Contacts: Commissions view
  INSERT INTO crm_views (org_id, module_id, name, is_default, is_shared, columns, sort)
  VALUES (
    v_org_id,
    v_contacts_module_id,
    'Commissions',
    false,
    true,
    '["first_name", "last_name", "product", "monthly_premium", "commission_percentage", "producer_commission", "amount_received", "team_leader", "team_leader_monthly", "director", "director_monthly"]'::jsonb,
    '[{"field": "created_at", "direction": "desc"}]'::jsonb
  )
  ON CONFLICT DO NOTHING;

  -- Contacts: Fulfillment Tracking view
  INSERT INTO crm_views (org_id, module_id, name, is_default, is_shared, columns, sort)
  VALUES (
    v_org_id,
    v_contacts_module_id,
    'Fulfillment Tracking',
    false,
    true,
    '["first_name", "last_name", "contact_status", "welcome_call_status", "welcome_call_performed_by", "wc_outreach_date", "fulfillment_letter_mailed", "fulfillment_email_sent", "complete_date"]'::jsonb,
    '[{"field": "created_at", "direction": "desc"}]'::jsonb
  )
  ON CONFLICT DO NOTHING;

  -- Contacts: Compliance view
  INSERT INTO crm_views (org_id, module_id, name, is_default, is_shared, columns, sort)
  VALUES (
    v_org_id,
    v_contacts_module_id,
    'Compliance',
    false,
    true,
    '["first_name", "last_name", "contact_status", "mec_submitted", "mec_decision_confirmed", "medical_release_form_on_file", "permission_to_discuss_plan", "risk_assessment_paid"]'::jsonb,
    '[{"field": "created_at", "direction": "desc"}]'::jsonb
  )
  ON CONFLICT DO NOTHING;

  -- Leads: Full Details view
  IF v_leads_module_id IS NOT NULL THEN
    INSERT INTO crm_views (org_id, module_id, name, is_default, is_shared, columns, sort)
    VALUES (
      v_org_id,
      v_leads_module_id,
      'Full Details',
      false,
      true,
      '["first_name", "last_name", "email", "phone", "lead_status", "lead_source", "producer", "product_type", "coverage_option", "city", "state", "next_step"]'::jsonb,
      '[{"field": "created_at", "direction": "desc"}]'::jsonb
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RAISE NOTICE 'Added missing CRM field definitions for org %', v_org_id;

END $$;

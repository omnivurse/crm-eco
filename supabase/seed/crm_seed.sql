-- CRM-ECO: Default CRM Modules and Fields Seed Data
-- Based on Zoho CRM export field analysis from Contacts and Leads CSVs

-- ============================================================================
-- HELPER: Insert module and return ID
-- ============================================================================
-- This seed file assumes an organization already exists.
-- In production, replace the org_id placeholder with actual org ID.

DO $$
DECLARE
  v_org_id uuid;
  v_contacts_module_id uuid;
  v_leads_module_id uuid;
  v_deals_module_id uuid;
  v_accounts_module_id uuid;
BEGIN
  -- Get the first organization (for development/testing)
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  
  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found. Skipping CRM seed.';
    RETURN;
  END IF;

  -- ============================================================================
  -- CREATE MODULES
  -- ============================================================================
  
  -- Contacts Module
  INSERT INTO crm_modules (id, org_id, key, name, name_plural, icon, description, is_system, is_enabled, display_order)
  VALUES (
    gen_random_uuid(),
    v_org_id,
    'contacts',
    'Contact',
    'Contacts',
    'user',
    'Manage all your contacts and customers',
    true,
    true,
    1
  )
  ON CONFLICT (org_id, key) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_contacts_module_id;

  -- Leads Module
  INSERT INTO crm_modules (id, org_id, key, name, name_plural, icon, description, is_system, is_enabled, display_order)
  VALUES (
    gen_random_uuid(),
    v_org_id,
    'leads',
    'Lead',
    'Leads',
    'user-plus',
    'Track and nurture potential customers',
    true,
    true,
    2
  )
  ON CONFLICT (org_id, key) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_leads_module_id;

  -- Deals Module
  INSERT INTO crm_modules (id, org_id, key, name, name_plural, icon, description, is_system, is_enabled, display_order)
  VALUES (
    gen_random_uuid(),
    v_org_id,
    'deals',
    'Deal',
    'Deals',
    'dollar-sign',
    'Manage your sales pipeline',
    true,
    true,
    3
  )
  ON CONFLICT (org_id, key) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_deals_module_id;

  -- Accounts Module
  INSERT INTO crm_modules (id, org_id, key, name, name_plural, icon, description, is_system, is_enabled, display_order)
  VALUES (
    gen_random_uuid(),
    v_org_id,
    'accounts',
    'Account',
    'Accounts',
    'building',
    'Manage organizations and companies',
    true,
    true,
    4
  )
  ON CONFLICT (org_id, key) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_accounts_module_id;

  -- ============================================================================
  -- CONTACTS FIELDS (Based on Zoho Contacts CSV)
  -- ============================================================================
  
  -- Core Name Fields
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, is_title_field, display_order, section)
  VALUES
    (v_org_id, v_contacts_module_id, 'salutation', 'Salutation', 'select', false, true, false, 1, 'main'),
    (v_org_id, v_contacts_module_id, 'first_name', 'First Name', 'text', true, true, true, 2, 'main'),
    (v_org_id, v_contacts_module_id, 'last_name', 'Last Name', 'text', true, true, true, 3, 'main'),
    (v_org_id, v_contacts_module_id, 'middle_name', 'Middle Name', 'text', false, false, false, 4, 'main'),
    (v_org_id, v_contacts_module_id, 'email', 'Email', 'email', true, true, false, 5, 'main'),
    (v_org_id, v_contacts_module_id, 'secondary_email', 'Secondary Email', 'email', false, false, false, 6, 'main'),
    (v_org_id, v_contacts_module_id, 'phone', 'Phone', 'phone', false, true, false, 7, 'main'),
    (v_org_id, v_contacts_module_id, 'mobile', 'Mobile', 'phone', false, false, false, 8, 'main'),
    (v_org_id, v_contacts_module_id, 'work_phone', 'Work Phone', 'phone', false, false, false, 9, 'main'),
    (v_org_id, v_contacts_module_id, 'fax', 'Fax', 'phone', false, false, false, 10, 'main'),
    (v_org_id, v_contacts_module_id, 'date_of_birth', 'Date of Birth', 'date', false, true, false, 11, 'main'),
    (v_org_id, v_contacts_module_id, 'gender', 'Gender', 'select', false, false, false, 12, 'main')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- Update salutation options
  UPDATE crm_fields SET options = '["Mr.", "Mrs.", "Ms.", "Dr.", "Prof."]'::jsonb
  WHERE module_id = v_contacts_module_id AND key = 'salutation';

  -- Update gender options
  UPDATE crm_fields SET options = '["Male", "Female", "Other", "Prefer not to say"]'::jsonb
  WHERE module_id = v_contacts_module_id AND key = 'gender';

  -- Status & Ownership
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, options)
  VALUES
    (v_org_id, v_contacts_module_id, 'contact_status', 'Contact Status', 'select', false, true, 20, 'main',
     '["Active", "In-Active", "Future Prospect", "Lost Opportunity", "Cancelled", "Complimentary"]'::jsonb),
    (v_org_id, v_contacts_module_id, 'owner_id', 'Contact Owner', 'user', false, true, 21, 'main', '[]'::jsonb),
    (v_org_id, v_contacts_module_id, 'lead_source', 'Lead Source', 'select', false, false, 22, 'main',
     '["Member Referral", "Non-Member Referral", "Website", "Social Media", "Email Campaign", "Event", "Liberty Healthshare", "Sedera Generated Lead", "Connect for Health Colorado", "DMAR", "Other"]'::jsonb),
    (v_org_id, v_contacts_module_id, 'affiliate', 'Affiliate', 'text', false, false, 23, 'main', '[]'::jsonb)
  ON CONFLICT (module_id, key) DO NOTHING;

  -- Address Fields
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section)
  VALUES
    (v_org_id, v_contacts_module_id, 'mailing_street', 'Street', 'text', false, false, 30, 'address'),
    (v_org_id, v_contacts_module_id, 'mailing_city', 'City', 'text', false, false, 31, 'address'),
    (v_org_id, v_contacts_module_id, 'mailing_state', 'State', 'text', false, false, 32, 'address'),
    (v_org_id, v_contacts_module_id, 'mailing_zip', 'ZIP Code', 'text', false, false, 33, 'address')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- Family/Household Fields (from Zoho Contacts CSV)
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section)
  VALUES
    (v_org_id, v_contacts_module_id, 'marital_status', 'Marital Status', 'select', false, false, 40, 'family'),
    (v_org_id, v_contacts_module_id, 'spouse', 'Spouse Name', 'text', false, false, 41, 'family'),
    (v_org_id, v_contacts_module_id, 'spouse_dob', 'Spouse DOB', 'date', false, false, 42, 'family'),
    (v_org_id, v_contacts_module_id, 'child_1', 'Child 1 Name', 'text', false, false, 43, 'family'),
    (v_org_id, v_contacts_module_id, 'child_1_dob', 'Child 1 DOB', 'date', false, false, 44, 'family'),
    (v_org_id, v_contacts_module_id, 'child_2', 'Child 2 Name', 'text', false, false, 45, 'family'),
    (v_org_id, v_contacts_module_id, 'child_2_dob', 'Child 2 DOB', 'date', false, false, 46, 'family'),
    (v_org_id, v_contacts_module_id, 'child_3', 'Child 3 Name', 'text', false, false, 47, 'family'),
    (v_org_id, v_contacts_module_id, 'child_3_dob', 'Child 3 DOB', 'date', false, false, 48, 'family'),
    (v_org_id, v_contacts_module_id, 'child_4', 'Child 4 Name', 'text', false, false, 49, 'family'),
    (v_org_id, v_contacts_module_id, 'child_4_dob', 'Child 4 DOB', 'date', false, false, 50, 'family'),
    (v_org_id, v_contacts_module_id, 'child_5', 'Child 5 Name', 'text', false, false, 51, 'family'),
    (v_org_id, v_contacts_module_id, 'child_5_dob', 'Child 5 DOB', 'date', false, false, 52, 'family')
  ON CONFLICT (module_id, key) DO NOTHING;

  UPDATE crm_fields SET options = '["Single", "Married", "Divorced", "Widowed", "Domestic Partnership"]'::jsonb
  WHERE module_id = v_contacts_module_id AND key = 'marital_status';

  -- Product & Coverage Fields (Healthcare specific)
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, options)
  VALUES
    (v_org_id, v_contacts_module_id, 'product', 'Product', 'select', false, false, 60, 'product',
     '["Health Sharing", "MPB Care", "To Be Determined", "OPD"]'::jsonb),
    (v_org_id, v_contacts_module_id, 'coverage_option', 'Coverage Option', 'select', false, false, 61, 'product',
     '["Member Only", "Member and Spouse", "Member and Child", "Member and Family"]'::jsonb),
    (v_org_id, v_contacts_module_id, 'carrier', 'Carrier', 'text', false, false, 62, 'product', '[]'::jsonb),
    (v_org_id, v_contacts_module_id, 'previous_product', 'Previous Product', 'text', false, false, 63, 'product', '[]'::jsonb),
    (v_org_id, v_contacts_module_id, 'monthly_premium', 'Monthly Premium', 'currency', false, false, 64, 'product', '[]'::jsonb),
    (v_org_id, v_contacts_module_id, 'start_date', 'Start Date', 'date', false, false, 65, 'product', '[]'::jsonb),
    (v_org_id, v_contacts_module_id, 'cancellation_date', 'Cancellation Date', 'date', false, false, 66, 'product', '[]'::jsonb),
    (v_org_id, v_contacts_module_id, 'iua_amount', 'IUA Amount', 'currency', false, false, 67, 'product', '[]'::jsonb)
  ON CONFLICT (module_id, key) DO NOTHING;

  -- Financial & Commission Fields
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section)
  VALUES
    (v_org_id, v_contacts_module_id, 'commission_percentage', 'Commission %', 'number', false, false, 70, 'financial'),
    (v_org_id, v_contacts_module_id, 'producer_commission', 'Producer Commission', 'currency', false, false, 71, 'financial'),
    (v_org_id, v_contacts_module_id, 'referral_source', 'Referral Source', 'text', false, false, 72, 'financial'),
    (v_org_id, v_contacts_module_id, 'referring_member', 'Referring Member', 'text', false, false, 73, 'financial')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- Additional Info Fields
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section)
  VALUES
    (v_org_id, v_contacts_module_id, 'notes_history', 'Notes History', 'textarea', false, false, 80, 'additional'),
    (v_org_id, v_contacts_module_id, 'company_association', 'Company/Association', 'text', false, false, 81, 'additional'),
    (v_org_id, v_contacts_module_id, 'email_opt_out', 'Email Opt Out', 'boolean', false, false, 82, 'additional'),
    (v_org_id, v_contacts_module_id, 'tag', 'Tag', 'text', false, false, 83, 'additional'),
    (v_org_id, v_contacts_module_id, 'welcome_call_status', 'Welcome Call Status', 'select', false, false, 84, 'additional')
  ON CONFLICT (module_id, key) DO NOTHING;

  UPDATE crm_fields SET options = '["Pending", "Completed", "No Answer", "Voicemail Left", "Not Required"]'::jsonb
  WHERE module_id = v_contacts_module_id AND key = 'welcome_call_status';

  -- ============================================================================
  -- LEADS FIELDS (Based on Zoho Leads CSV)
  -- ============================================================================

  -- Core Fields
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, is_title_field, display_order, section)
  VALUES
    (v_org_id, v_leads_module_id, 'salutation', 'Salutation', 'select', false, true, false, 1, 'main'),
    (v_org_id, v_leads_module_id, 'first_name', 'First Name', 'text', true, true, true, 2, 'main'),
    (v_org_id, v_leads_module_id, 'last_name', 'Last Name', 'text', true, true, true, 3, 'main'),
    (v_org_id, v_leads_module_id, 'email', 'Email', 'email', false, true, false, 4, 'main'),
    (v_org_id, v_leads_module_id, 'phone', 'Phone', 'phone', false, true, false, 5, 'main'),
    (v_org_id, v_leads_module_id, 'mobile', 'Mobile', 'phone', false, false, false, 6, 'main'),
    (v_org_id, v_leads_module_id, 'company', 'Company', 'text', false, false, false, 7, 'main'),
    (v_org_id, v_leads_module_id, 'date_of_birth', 'Date of Birth', 'date', false, false, false, 8, 'main')
  ON CONFLICT (module_id, key) DO NOTHING;

  UPDATE crm_fields SET options = '["Mr.", "Mrs.", "Ms.", "Dr.", "Prof."]'::jsonb
  WHERE module_id = v_leads_module_id AND key = 'salutation';

  -- Lead Status & Source
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, options)
  VALUES
    (v_org_id, v_leads_module_id, 'lead_status', 'Lead Status', 'select', false, true, 10, 'main',
     '["New", "Contacted", "Hot Prospect - ready to move", "Qualified", "Working", "Converted", "Lost", "Unqualified"]'::jsonb),
    (v_org_id, v_leads_module_id, 'lead_source', 'Lead Source', 'select', false, true, 11, 'main',
     '["Member Referral", "Non-Member Referral", "Liberty Healthshare", "Sedera Generated Lead", "Website", "Social Media", "Email Campaign", "Outside Advisor", "Event", "Other"]'::jsonb),
    (v_org_id, v_leads_module_id, 'owner_id', 'Lead Owner', 'user', false, true, 12, 'main', '[]'::jsonb),
    (v_org_id, v_leads_module_id, 'producer_id', 'Producer', 'user', false, false, 13, 'main', '[]'::jsonb)
  ON CONFLICT (module_id, key) DO NOTHING;

  -- Address
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section)
  VALUES
    (v_org_id, v_leads_module_id, 'street', 'Street', 'text', false, false, 20, 'address'),
    (v_org_id, v_leads_module_id, 'city', 'City', 'text', false, false, 21, 'address'),
    (v_org_id, v_leads_module_id, 'state', 'State', 'text', false, false, 22, 'address'),
    (v_org_id, v_leads_module_id, 'zip_code', 'ZIP Code', 'text', false, false, 23, 'address')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- Product Interest
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, options)
  VALUES
    (v_org_id, v_leads_module_id, 'product_type', 'Product Type', 'select', false, false, 30, 'interest',
     '["Health Sharing", "OPD", "Other"]'::jsonb),
    (v_org_id, v_leads_module_id, 'coverage_option', 'Coverage Option', 'select', false, false, 31, 'interest',
     '["Member Only", "Member and Spouse", "Member and Child", "Member and Family"]'::jsonb),
    (v_org_id, v_leads_module_id, 'next_step', 'Next Step', 'select', false, false, 32, 'interest',
     '["Initial Contact", "Send Info", "Schedule Call", "Follow Up", "Convert", "Close"]'::jsonb),
    (v_org_id, v_leads_module_id, 'business_type', 'Business Type', 'text', false, false, 33, 'interest', '[]'::jsonb)
  ON CONFLICT (module_id, key) DO NOTHING;

  -- Family Fields
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section)
  VALUES
    (v_org_id, v_leads_module_id, 'spouse', 'Spouse Name', 'text', false, false, 40, 'family'),
    (v_org_id, v_leads_module_id, 'spouse_dob', 'Spouse DOB', 'date', false, false, 41, 'family'),
    (v_org_id, v_leads_module_id, 'child_1', 'Child 1 Name', 'text', false, false, 42, 'family'),
    (v_org_id, v_leads_module_id, 'child_1_dob', 'Child 1 DOB', 'date', false, false, 43, 'family'),
    (v_org_id, v_leads_module_id, 'child_2', 'Child 2 Name', 'text', false, false, 44, 'family'),
    (v_org_id, v_leads_module_id, 'child_2_dob', 'Child 2 DOB', 'date', false, false, 45, 'family'),
    (v_org_id, v_leads_module_id, 'child_3', 'Child 3 Name', 'text', false, false, 46, 'family'),
    (v_org_id, v_leads_module_id, 'child_3_dob', 'Child 3 DOB', 'date', false, false, 47, 'family'),
    (v_org_id, v_leads_module_id, 'child_4', 'Child 4 Name', 'text', false, false, 48, 'family'),
    (v_org_id, v_leads_module_id, 'child_4_dob', 'Child 4 DOB', 'date', false, false, 49, 'family'),
    (v_org_id, v_leads_module_id, 'child_5', 'Child 5 Name', 'text', false, false, 50, 'family'),
    (v_org_id, v_leads_module_id, 'child_5_dob', 'Child 5 DOB', 'date', false, false, 51, 'family')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- Conversion Fields
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section)
  VALUES
    (v_org_id, v_leads_module_id, 'is_converted', 'Is Converted', 'boolean', false, true, 60, 'conversion'),
    (v_org_id, v_leads_module_id, 'converted_date', 'Converted Date', 'date', false, true, 61, 'conversion'),
    (v_org_id, v_leads_module_id, 'referring_member', 'Referring Member', 'text', false, false, 62, 'conversion'),
    (v_org_id, v_leads_module_id, 'email_opt_out', 'Email Opt Out', 'boolean', false, false, 63, 'conversion'),
    (v_org_id, v_leads_module_id, 'tag', 'Tag', 'text', false, false, 64, 'conversion')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- ============================================================================
  -- DEALS FIELDS
  -- ============================================================================

  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, is_title_field, display_order, section)
  VALUES
    (v_org_id, v_deals_module_id, 'deal_name', 'Deal Name', 'text', true, true, true, 1, 'main'),
    (v_org_id, v_deals_module_id, 'contact_id', 'Contact', 'lookup', false, true, false, 2, 'main'),
    (v_org_id, v_deals_module_id, 'account_id', 'Account', 'lookup', false, false, false, 3, 'main'),
    (v_org_id, v_deals_module_id, 'amount', 'Amount', 'currency', false, true, false, 4, 'main'),
    (v_org_id, v_deals_module_id, 'stage', 'Stage', 'select', true, true, false, 5, 'main'),
    (v_org_id, v_deals_module_id, 'probability', 'Probability (%)', 'number', false, false, false, 6, 'main'),
    (v_org_id, v_deals_module_id, 'expected_close_date', 'Expected Close Date', 'date', false, true, false, 7, 'main'),
    (v_org_id, v_deals_module_id, 'actual_close_date', 'Actual Close Date', 'date', false, false, false, 8, 'main'),
    (v_org_id, v_deals_module_id, 'owner_id', 'Deal Owner', 'user', false, true, false, 9, 'main'),
    (v_org_id, v_deals_module_id, 'description', 'Description', 'textarea', false, false, false, 10, 'main'),
    (v_org_id, v_deals_module_id, 'next_step', 'Next Step', 'text', false, false, false, 11, 'main'),
    (v_org_id, v_deals_module_id, 'lost_reason', 'Lost Reason', 'text', false, false, false, 12, 'main')
  ON CONFLICT (module_id, key) DO NOTHING;

  UPDATE crm_fields SET options = '["Qualification", "Needs Analysis", "Proposal", "Negotiation", "Closed Won", "Closed Lost"]'::jsonb
  WHERE module_id = v_deals_module_id AND key = 'stage';

  -- ============================================================================
  -- ACCOUNTS FIELDS
  -- ============================================================================

  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, is_title_field, display_order, section)
  VALUES
    (v_org_id, v_accounts_module_id, 'account_name', 'Account Name', 'text', true, true, true, 1, 'main'),
    (v_org_id, v_accounts_module_id, 'website', 'Website', 'url', false, false, false, 2, 'main'),
    (v_org_id, v_accounts_module_id, 'phone', 'Phone', 'phone', false, true, false, 3, 'main'),
    (v_org_id, v_accounts_module_id, 'industry', 'Industry', 'select', false, false, false, 4, 'main'),
    (v_org_id, v_accounts_module_id, 'employees', 'Number of Employees', 'number', false, false, false, 5, 'main'),
    (v_org_id, v_accounts_module_id, 'annual_revenue', 'Annual Revenue', 'currency', false, false, false, 6, 'main'),
    (v_org_id, v_accounts_module_id, 'owner_id', 'Account Owner', 'user', false, true, false, 7, 'main'),
    (v_org_id, v_accounts_module_id, 'description', 'Description', 'textarea', false, false, false, 8, 'main'),
    (v_org_id, v_accounts_module_id, 'billing_street', 'Billing Street', 'text', false, false, false, 10, 'address'),
    (v_org_id, v_accounts_module_id, 'billing_city', 'Billing City', 'text', false, false, false, 11, 'address'),
    (v_org_id, v_accounts_module_id, 'billing_state', 'Billing State', 'text', false, false, false, 12, 'address'),
    (v_org_id, v_accounts_module_id, 'billing_zip', 'Billing ZIP', 'text', false, false, false, 13, 'address')
  ON CONFLICT (module_id, key) DO NOTHING;

  UPDATE crm_fields SET options = '["Healthcare", "Insurance", "Technology", "Financial Services", "Real Estate", "Retail", "Manufacturing", "Other"]'::jsonb
  WHERE module_id = v_accounts_module_id AND key = 'industry';

  -- ============================================================================
  -- DEFAULT LAYOUTS
  -- ============================================================================

  -- Contacts Layout
  INSERT INTO crm_layouts (org_id, module_id, name, is_default, config)
  VALUES (
    v_org_id,
    v_contacts_module_id,
    'Default Layout',
    true,
    '{
      "sections": [
        {"key": "main", "label": "Contact Information", "columns": 2, "collapsed": false},
        {"key": "address", "label": "Address", "columns": 2, "collapsed": false},
        {"key": "family", "label": "Family & Household", "columns": 2, "collapsed": true},
        {"key": "product", "label": "Product & Coverage", "columns": 2, "collapsed": false},
        {"key": "financial", "label": "Financial", "columns": 2, "collapsed": true},
        {"key": "additional", "label": "Additional Information", "columns": 1, "collapsed": true}
      ]
    }'::jsonb
  )
  ON CONFLICT DO NOTHING;

  -- Leads Layout
  INSERT INTO crm_layouts (org_id, module_id, name, is_default, config)
  VALUES (
    v_org_id,
    v_leads_module_id,
    'Default Layout',
    true,
    '{
      "sections": [
        {"key": "main", "label": "Lead Information", "columns": 2, "collapsed": false},
        {"key": "address", "label": "Address", "columns": 2, "collapsed": false},
        {"key": "interest", "label": "Product Interest", "columns": 2, "collapsed": false},
        {"key": "family", "label": "Family", "columns": 2, "collapsed": true},
        {"key": "conversion", "label": "Conversion", "columns": 2, "collapsed": true}
      ]
    }'::jsonb
  )
  ON CONFLICT DO NOTHING;

  -- Deals Layout
  INSERT INTO crm_layouts (org_id, module_id, name, is_default, config)
  VALUES (
    v_org_id,
    v_deals_module_id,
    'Default Layout',
    true,
    '{
      "sections": [
        {"key": "main", "label": "Deal Information", "columns": 2, "collapsed": false}
      ]
    }'::jsonb
  )
  ON CONFLICT DO NOTHING;

  -- Accounts Layout
  INSERT INTO crm_layouts (org_id, module_id, name, is_default, config)
  VALUES (
    v_org_id,
    v_accounts_module_id,
    'Default Layout',
    true,
    '{
      "sections": [
        {"key": "main", "label": "Account Information", "columns": 2, "collapsed": false},
        {"key": "address", "label": "Address", "columns": 2, "collapsed": false}
      ]
    }'::jsonb
  )
  ON CONFLICT DO NOTHING;

  -- ============================================================================
  -- DEFAULT VIEWS
  -- ============================================================================

  -- Contacts - All Contacts View
  INSERT INTO crm_views (org_id, module_id, name, is_default, is_shared, columns, sort)
  VALUES (
    v_org_id,
    v_contacts_module_id,
    'All Contacts',
    true,
    true,
    '["first_name", "last_name", "email", "phone", "contact_status", "mailing_city", "mailing_state", "product"]'::jsonb,
    '[{"field": "created_at", "direction": "desc"}]'::jsonb
  )
  ON CONFLICT DO NOTHING;

  -- Contacts - Active Contacts View
  INSERT INTO crm_views (org_id, module_id, name, is_default, is_shared, columns, filters, sort)
  VALUES (
    v_org_id,
    v_contacts_module_id,
    'Active Contacts',
    false,
    true,
    '["first_name", "last_name", "email", "phone", "product", "start_date"]'::jsonb,
    '[{"field": "contact_status", "operator": "equals", "value": "Active"}]'::jsonb,
    '[{"field": "last_name", "direction": "asc"}]'::jsonb
  )
  ON CONFLICT DO NOTHING;

  -- Leads - All Leads View
  INSERT INTO crm_views (org_id, module_id, name, is_default, is_shared, columns, sort)
  VALUES (
    v_org_id,
    v_leads_module_id,
    'All Leads',
    true,
    true,
    '["first_name", "last_name", "email", "phone", "lead_status", "lead_source", "city", "state"]'::jsonb,
    '[{"field": "created_at", "direction": "desc"}]'::jsonb
  )
  ON CONFLICT DO NOTHING;

  -- Leads - Hot Prospects View
  INSERT INTO crm_views (org_id, module_id, name, is_default, is_shared, columns, filters, sort)
  VALUES (
    v_org_id,
    v_leads_module_id,
    'Hot Prospects',
    false,
    true,
    '["first_name", "last_name", "email", "phone", "product_type", "coverage_option", "next_step"]'::jsonb,
    '[{"field": "lead_status", "operator": "equals", "value": "Hot Prospect - ready to move"}]'::jsonb,
    '[{"field": "created_at", "direction": "desc"}]'::jsonb
  )
  ON CONFLICT DO NOTHING;

  -- Deals - All Deals View
  INSERT INTO crm_views (org_id, module_id, name, is_default, is_shared, columns, sort)
  VALUES (
    v_org_id,
    v_deals_module_id,
    'All Deals',
    true,
    true,
    '["deal_name", "amount", "stage", "expected_close_date", "probability"]'::jsonb,
    '[{"field": "expected_close_date", "direction": "asc"}]'::jsonb
  )
  ON CONFLICT DO NOTHING;

  -- Accounts - All Accounts View
  INSERT INTO crm_views (org_id, module_id, name, is_default, is_shared, columns, sort)
  VALUES (
    v_org_id,
    v_accounts_module_id,
    'All Accounts',
    true,
    true,
    '["account_name", "website", "phone", "industry", "billing_city", "billing_state"]'::jsonb,
    '[{"field": "account_name", "direction": "asc"}]'::jsonb
  )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'CRM seed completed for organization %', v_org_id;

END $$;

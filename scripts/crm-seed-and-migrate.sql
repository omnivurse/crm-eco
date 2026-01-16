-- =============================================================================
-- CRM SEED AND MEMBER MIGRATION SCRIPT
-- =============================================================================
-- This script:
-- 1. Creates/updates CRM modules (Contacts, Leads, Deals, Accounts)
-- 2. Creates default fields for each module
-- 3. Migrates existing members table data to crm_records as Contacts
-- 4. Creates default views and layouts
--
-- Run this in Supabase SQL Editor
-- =============================================================================

-- Step 1: Check prerequisites
DO $$
BEGIN
  -- Verify crm_modules table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'crm_modules') THEN
    RAISE EXCEPTION 'CRM tables not found. Please ensure migration 202601110001_crm_zoho_schema.sql has been applied.';
  END IF;
  
  RAISE NOTICE 'Prerequisites check passed. CRM tables exist.';
END $$;

-- =============================================================================
-- PART 1: SEED CRM MODULES AND FIELDS
-- =============================================================================

DO $$
DECLARE
  v_org_id uuid;
  v_contacts_module_id uuid;
  v_leads_module_id uuid;
  v_deals_module_id uuid;
  v_accounts_module_id uuid;
  v_module_count int;
BEGIN
  -- Get the first organization
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found. Please create an organization first.';
  END IF;
  
  RAISE NOTICE 'Seeding CRM for organization: %', v_org_id;

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

  RAISE NOTICE 'Modules created/updated. Contacts: %, Leads: %, Deals: %, Accounts: %', 
    v_contacts_module_id, v_leads_module_id, v_deals_module_id, v_accounts_module_id;

  -- ============================================================================
  -- CONTACTS FIELDS
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
    (v_org_id, v_contacts_module_id, 'date_of_birth', 'Date of Birth', 'date', false, true, false, 10, 'main'),
    (v_org_id, v_contacts_module_id, 'gender', 'Gender', 'select', false, false, false, 11, 'main')
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
     '["Active", "In-Active", "Future Prospect", "Lost Opportunity", "Cancelled", "Complimentary", "Pending"]'::jsonb),
    (v_org_id, v_contacts_module_id, 'owner_id', 'Contact Owner', 'user', false, true, 21, 'main', '[]'::jsonb),
    (v_org_id, v_contacts_module_id, 'member_number', 'Member Number', 'text', false, true, 22, 'main', '[]'::jsonb),
    (v_org_id, v_contacts_module_id, 'advisor_name', 'Advisor', 'text', false, false, 23, 'main', '[]'::jsonb)
  ON CONFLICT (module_id, key) DO NOTHING;

  -- Address Fields
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section)
  VALUES
    (v_org_id, v_contacts_module_id, 'mailing_street', 'Street', 'text', false, false, 30, 'address'),
    (v_org_id, v_contacts_module_id, 'mailing_city', 'City', 'text', false, false, 31, 'address'),
    (v_org_id, v_contacts_module_id, 'mailing_state', 'State', 'text', false, false, 32, 'address'),
    (v_org_id, v_contacts_module_id, 'mailing_zip', 'ZIP Code', 'text', false, false, 33, 'address')
  ON CONFLICT (module_id, key) DO NOTHING;

  -- Product & Coverage Fields
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, options)
  VALUES
    (v_org_id, v_contacts_module_id, 'plan_name', 'Plan Name', 'text', false, false, 40, 'product', '[]'::jsonb),
    (v_org_id, v_contacts_module_id, 'plan_type', 'Plan Type', 'select', false, false, 41, 'product',
     '["Member Only", "Member and Spouse", "Member and Child", "Member and Family"]'::jsonb),
    (v_org_id, v_contacts_module_id, 'coverage_type', 'Coverage Type', 'text', false, false, 42, 'product', '[]'::jsonb),
    (v_org_id, v_contacts_module_id, 'monthly_share', 'Monthly Share', 'currency', false, false, 43, 'product', '[]'::jsonb),
    (v_org_id, v_contacts_module_id, 'effective_date', 'Effective Date', 'date', false, false, 44, 'product', '[]'::jsonb),
    (v_org_id, v_contacts_module_id, 'termination_date', 'Termination Date', 'date', false, false, 45, 'product', '[]'::jsonb)
  ON CONFLICT (module_id, key) DO NOTHING;

  RAISE NOTICE 'Contacts fields created/updated';

  -- ============================================================================
  -- LEADS FIELDS
  -- ============================================================================

  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, is_title_field, display_order, section)
  VALUES
    (v_org_id, v_leads_module_id, 'salutation', 'Salutation', 'select', false, true, false, 1, 'main'),
    (v_org_id, v_leads_module_id, 'first_name', 'First Name', 'text', true, true, true, 2, 'main'),
    (v_org_id, v_leads_module_id, 'last_name', 'Last Name', 'text', true, true, true, 3, 'main'),
    (v_org_id, v_leads_module_id, 'email', 'Email', 'email', false, true, false, 4, 'main'),
    (v_org_id, v_leads_module_id, 'phone', 'Phone', 'phone', false, true, false, 5, 'main'),
    (v_org_id, v_leads_module_id, 'mobile', 'Mobile', 'phone', false, false, false, 6, 'main'),
    (v_org_id, v_leads_module_id, 'company', 'Company', 'text', false, false, false, 7, 'main')
  ON CONFLICT (module_id, key) DO NOTHING;

  UPDATE crm_fields SET options = '["Mr.", "Mrs.", "Ms.", "Dr.", "Prof."]'::jsonb
  WHERE module_id = v_leads_module_id AND key = 'salutation';

  -- Lead Status & Source
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, options)
  VALUES
    (v_org_id, v_leads_module_id, 'lead_status', 'Lead Status', 'select', false, true, 10, 'main',
     '["New", "Contacted", "Hot Prospect", "Qualified", "Working", "Converted", "Lost", "Unqualified"]'::jsonb),
    (v_org_id, v_leads_module_id, 'lead_source', 'Lead Source', 'select', false, true, 11, 'main',
     '["Member Referral", "Non-Member Referral", "Website", "Social Media", "Email Campaign", "Event", "Other"]'::jsonb),
    (v_org_id, v_leads_module_id, 'owner_id', 'Lead Owner', 'user', false, true, 12, 'main', '[]'::jsonb)
  ON CONFLICT (module_id, key) DO NOTHING;

  -- Address
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section)
  VALUES
    (v_org_id, v_leads_module_id, 'street', 'Street', 'text', false, false, 20, 'address'),
    (v_org_id, v_leads_module_id, 'city', 'City', 'text', false, false, 21, 'address'),
    (v_org_id, v_leads_module_id, 'state', 'State', 'text', false, false, 22, 'address'),
    (v_org_id, v_leads_module_id, 'zip_code', 'ZIP Code', 'text', false, false, 23, 'address')
  ON CONFLICT (module_id, key) DO NOTHING;

  RAISE NOTICE 'Leads fields created/updated';

  -- ============================================================================
  -- DEALS FIELDS
  -- ============================================================================

  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, is_title_field, display_order, section)
  VALUES
    (v_org_id, v_deals_module_id, 'deal_name', 'Deal Name', 'text', true, true, true, 1, 'main'),
    (v_org_id, v_deals_module_id, 'amount', 'Amount', 'currency', false, true, false, 2, 'main'),
    (v_org_id, v_deals_module_id, 'stage', 'Stage', 'select', true, true, false, 3, 'main'),
    (v_org_id, v_deals_module_id, 'probability', 'Probability (%)', 'number', false, false, false, 4, 'main'),
    (v_org_id, v_deals_module_id, 'expected_close_date', 'Expected Close Date', 'date', false, true, false, 5, 'main'),
    (v_org_id, v_deals_module_id, 'owner_id', 'Deal Owner', 'user', false, true, false, 6, 'main'),
    (v_org_id, v_deals_module_id, 'description', 'Description', 'textarea', false, false, false, 7, 'main')
  ON CONFLICT (module_id, key) DO NOTHING;

  UPDATE crm_fields SET options = '["Qualification", "Needs Analysis", "Proposal", "Negotiation", "Closed Won", "Closed Lost"]'::jsonb
  WHERE module_id = v_deals_module_id AND key = 'stage';

  RAISE NOTICE 'Deals fields created/updated';

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
    (v_org_id, v_accounts_module_id, 'owner_id', 'Account Owner', 'user', false, true, false, 6, 'main'),
    (v_org_id, v_accounts_module_id, 'description', 'Description', 'textarea', false, false, false, 7, 'main')
  ON CONFLICT (module_id, key) DO NOTHING;

  UPDATE crm_fields SET options = '["Healthcare", "Insurance", "Technology", "Financial Services", "Real Estate", "Retail", "Manufacturing", "Other"]'::jsonb
  WHERE module_id = v_accounts_module_id AND key = 'industry';

  RAISE NOTICE 'Accounts fields created/updated';

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
        {"key": "product", "label": "Product & Coverage", "columns": 2, "collapsed": false}
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
        {"key": "address", "label": "Address", "columns": 2, "collapsed": false}
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
        {"key": "main", "label": "Account Information", "columns": 2, "collapsed": false}
      ]
    }'::jsonb
  )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Layouts created/updated';

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
    '["first_name", "last_name", "email", "phone", "contact_status", "mailing_city", "mailing_state"]'::jsonb,
    '[{"field": "created_at", "direction": "desc"}]'::jsonb
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
    '["first_name", "last_name", "email", "phone", "lead_status", "lead_source"]'::jsonb,
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
    '["account_name", "website", "phone", "industry"]'::jsonb,
    '[{"field": "account_name", "direction": "asc"}]'::jsonb
  )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Views created/updated';

  -- Count modules
  SELECT COUNT(*) INTO v_module_count FROM crm_modules WHERE org_id = v_org_id;
  RAISE NOTICE 'CRM seed completed. Total modules: %', v_module_count;

END $$;

-- =============================================================================
-- PART 2: MIGRATE MEMBERS TO CRM_RECORDS AS CONTACTS
-- =============================================================================

DO $$
DECLARE
  v_org_id uuid;
  v_contacts_module_id uuid;
  v_migrated_count int := 0;
  v_member RECORD;
  v_advisor_name text;
BEGIN
  -- Get organization
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found.';
  END IF;

  -- Get contacts module
  SELECT id INTO v_contacts_module_id 
  FROM crm_modules 
  WHERE org_id = v_org_id AND key = 'contacts';
  
  IF v_contacts_module_id IS NULL THEN
    RAISE EXCEPTION 'Contacts module not found. Please run seed first.';
  END IF;

  RAISE NOTICE 'Starting migration of members to crm_records...';
  RAISE NOTICE 'Organization: %, Contacts Module: %', v_org_id, v_contacts_module_id;

  -- Iterate through members and insert into crm_records
  FOR v_member IN 
    SELECT m.*, 
           a.first_name as advisor_first_name,
           a.last_name as advisor_last_name
    FROM members m
    LEFT JOIN advisors a ON m.advisor_id = a.id
    WHERE m.organization_id = v_org_id
  LOOP
    -- Build advisor name
    v_advisor_name := NULL;
    IF v_member.advisor_first_name IS NOT NULL THEN
      v_advisor_name := v_member.advisor_first_name || ' ' || COALESCE(v_member.advisor_last_name, '');
    END IF;

    -- Check if this member already exists in crm_records (by email or member_number)
    IF NOT EXISTS (
      SELECT 1 FROM crm_records 
      WHERE org_id = v_org_id 
        AND module_id = v_contacts_module_id 
        AND (
          (email = v_member.email AND v_member.email IS NOT NULL AND v_member.email != '')
          OR (data->>'member_number' = v_member.member_number AND v_member.member_number IS NOT NULL)
        )
    ) THEN
      -- Insert into crm_records
      INSERT INTO crm_records (
        org_id,
        module_id,
        title,
        email,
        phone,
        status,
        data,
        created_at,
        updated_at
      )
      VALUES (
        v_org_id,
        v_contacts_module_id,
        v_member.first_name || ' ' || v_member.last_name,
        v_member.email,
        v_member.phone,
        CASE v_member.status
          WHEN 'active' THEN 'Active'
          WHEN 'pending' THEN 'Pending'
          WHEN 'inactive' THEN 'In-Active'
          WHEN 'terminated' THEN 'Cancelled'
          WHEN 'paused' THEN 'In-Active'
          ELSE 'Active'
        END,
        jsonb_build_object(
          'first_name', v_member.first_name,
          'last_name', v_member.last_name,
          'email', v_member.email,
          'phone', v_member.phone,
          'date_of_birth', v_member.date_of_birth,
          'gender', v_member.gender,
          'mailing_street', v_member.address_line1,
          'mailing_city', v_member.city,
          'mailing_state', v_member.state,
          'mailing_zip', v_member.postal_code,
          'member_number', v_member.member_number,
          'plan_name', v_member.plan_name,
          'plan_type', v_member.plan_type,
          'coverage_type', v_member.coverage_type,
          'monthly_share', v_member.monthly_share,
          'effective_date', v_member.effective_date,
          'termination_date', v_member.termination_date,
          'contact_status', CASE v_member.status
            WHEN 'active' THEN 'Active'
            WHEN 'pending' THEN 'Pending'
            WHEN 'inactive' THEN 'In-Active'
            WHEN 'terminated' THEN 'Cancelled'
            WHEN 'paused' THEN 'In-Active'
            ELSE 'Active'
          END,
          'advisor_name', v_advisor_name,
          'source_table', 'members',
          'source_id', v_member.id
        ),
        v_member.created_at,
        v_member.updated_at
      );
      
      v_migrated_count := v_migrated_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Migration completed. Migrated % members to crm_records as Contacts.', v_migrated_count;

END $$;

-- =============================================================================
-- PART 3: MIGRATE LEADS TO CRM_RECORDS
-- =============================================================================

DO $$
DECLARE
  v_org_id uuid;
  v_leads_module_id uuid;
  v_migrated_count int := 0;
  v_lead RECORD;
BEGIN
  -- Get organization
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  
  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found. Skipping leads migration.';
    RETURN;
  END IF;

  -- Get leads module
  SELECT id INTO v_leads_module_id 
  FROM crm_modules 
  WHERE org_id = v_org_id AND key = 'leads';
  
  IF v_leads_module_id IS NULL THEN
    RAISE NOTICE 'Leads module not found. Skipping leads migration.';
    RETURN;
  END IF;

  RAISE NOTICE 'Starting migration of leads to crm_records...';

  -- Iterate through leads and insert into crm_records
  FOR v_lead IN 
    SELECT * FROM leads 
    WHERE organization_id = v_org_id
  LOOP
    -- Check if this lead already exists in crm_records
    IF NOT EXISTS (
      SELECT 1 FROM crm_records 
      WHERE org_id = v_org_id 
        AND module_id = v_leads_module_id 
        AND email = v_lead.email
        AND v_lead.email IS NOT NULL
        AND v_lead.email != ''
    ) THEN
      -- Insert into crm_records
      INSERT INTO crm_records (
        org_id,
        module_id,
        title,
        email,
        phone,
        status,
        data,
        created_at,
        updated_at
      )
      VALUES (
        v_org_id,
        v_leads_module_id,
        v_lead.first_name || ' ' || v_lead.last_name,
        v_lead.email,
        v_lead.phone,
        CASE v_lead.status
          WHEN 'new' THEN 'New'
          WHEN 'contacted' THEN 'Contacted'
          WHEN 'working' THEN 'Working'
          WHEN 'qualified' THEN 'Qualified'
          WHEN 'unqualified' THEN 'Unqualified'
          WHEN 'converted' THEN 'Converted'
          WHEN 'lost' THEN 'Lost'
          ELSE 'New'
        END,
        jsonb_build_object(
          'first_name', v_lead.first_name,
          'last_name', v_lead.last_name,
          'email', v_lead.email,
          'phone', v_lead.phone,
          'state', v_lead.state,
          'lead_status', CASE v_lead.status
            WHEN 'new' THEN 'New'
            WHEN 'contacted' THEN 'Contacted'
            WHEN 'working' THEN 'Working'
            WHEN 'qualified' THEN 'Qualified'
            WHEN 'unqualified' THEN 'Unqualified'
            WHEN 'converted' THEN 'Converted'
            WHEN 'lost' THEN 'Lost'
            ELSE 'New'
          END,
          'lead_source', v_lead.source,
          'source_table', 'leads',
          'source_id', v_lead.id
        ),
        v_lead.created_at,
        v_lead.updated_at
      );
      
      v_migrated_count := v_migrated_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Migration completed. Migrated % leads to crm_records.', v_migrated_count;

END $$;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Check module counts
SELECT 'CRM Modules' as item, COUNT(*) as count FROM crm_modules
UNION ALL
SELECT 'CRM Fields' as item, COUNT(*) as count FROM crm_fields
UNION ALL
SELECT 'CRM Records (Contacts)' as item, COUNT(*) as count 
FROM crm_records cr 
JOIN crm_modules cm ON cr.module_id = cm.id 
WHERE cm.key = 'contacts'
UNION ALL
SELECT 'CRM Records (Leads)' as item, COUNT(*) as count 
FROM crm_records cr 
JOIN crm_modules cm ON cr.module_id = cm.id 
WHERE cm.key = 'leads'
UNION ALL
SELECT 'CRM Records (Total)' as item, COUNT(*) as count FROM crm_records
UNION ALL
SELECT 'Original Members' as item, COUNT(*) as count FROM members
UNION ALL
SELECT 'Original Leads' as item, COUNT(*) as count FROM leads;

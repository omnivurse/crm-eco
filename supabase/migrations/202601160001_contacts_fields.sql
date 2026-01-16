-- ============================================================================
-- CRM CONTACTS FIELD DEFINITIONS
-- Complete field schema for health insurance CRM contacts import
-- 160+ fields organized by logical sections
-- ============================================================================

-- First, ensure the Contacts module exists and get its ID
DO $$
DECLARE
  v_org_id uuid;
  v_module_id uuid;
  v_display_order int := 0;
BEGIN
  -- Get the first organization (for initial setup)
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  
  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found. Fields will be created when an organization exists.';
    RETURN;
  END IF;
  
  -- Get or create the Contacts module
  SELECT id INTO v_module_id FROM crm_modules 
  WHERE org_id = v_org_id AND key = 'contacts';
  
  IF v_module_id IS NULL THEN
    INSERT INTO crm_modules (org_id, key, name, name_plural, icon, description, is_system, is_enabled, display_order)
    VALUES (v_org_id, 'contacts', 'Contact', 'Contacts', 'users', 'Customer and prospect contacts', true, true, 1)
    RETURNING id INTO v_module_id;
  END IF;

  -- ============================================================================
  -- SECTION: Core Contact Information
  -- ============================================================================
  
  -- Record Id (external/legacy ID)
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, is_indexed, section, display_order)
  VALUES (v_org_id, v_module_id, 'record_id', 'Record Id', 'text', false, true, true, 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- First Name
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, is_indexed, section, display_order)
  VALUES (v_org_id, v_module_id, 'first_name', 'First Name', 'text', true, true, true, 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Last Name
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, is_indexed, section, display_order)
  VALUES (v_org_id, v_module_id, 'last_name', 'Last Name', 'text', true, true, true, 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Contact Name (full name)
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, is_title_field, section, display_order)
  VALUES (v_org_id, v_module_id, 'contact_name', 'Contact Name', 'text', false, true, true, 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Salutation
  INSERT INTO crm_fields (org_id, module_id, key, label, type, options, section, display_order)
  VALUES (v_org_id, v_module_id, 'salutation', 'Salutation', 'select', 
    '["Mr.", "Mrs.", "Ms.", "Dr.", "Prof."]'::jsonb, 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Middle Initial
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'middle_initial', 'Middle Initial', 'text', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Title
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'title', 'Title', 'text', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Email
  INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, is_indexed, section, display_order)
  VALUES (v_org_id, v_module_id, 'email', 'Email', 'email', false, true, true, 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Secondary Email
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'secondary_email', 'Secondary Email', 'email', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Phone
  INSERT INTO crm_fields (org_id, module_id, key, label, type, is_system, is_indexed, section, display_order)
  VALUES (v_org_id, v_module_id, 'phone', 'Phone', 'phone', true, true, 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Mobile
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'mobile', 'Mobile', 'phone', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Work Phone
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'work_phone', 'Work Phone', 'phone', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Fax
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'fax', 'Fax', 'phone', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Date of Birth
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'date_of_birth', 'Date of Birth', 'date', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Birth Month
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'birth_month', 'Birth Month', 'text', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Primary Member Gender
  INSERT INTO crm_fields (org_id, module_id, key, label, type, options, section, display_order)
  VALUES (v_org_id, v_module_id, 'primary_member_gender', 'Gender', 'select',
    '["Male", "Female", "Other", "Prefer not to say"]'::jsonb, 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Marital Status
  INSERT INTO crm_fields (org_id, module_id, key, label, type, options, section, display_order)
  VALUES (v_org_id, v_module_id, 'marital_status', 'Marital Status', 'select',
    '["Single", "Married", "Divorced", "Widowed", "Domestic Partnership"]'::jsonb, 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Primary S.S Number
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'primary_ss_number', 'Primary S.S. Number', 'text', 'core', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;

  -- ============================================================================
  -- SECTION: Contact Management
  -- ============================================================================
  v_display_order := 100;
  
  -- Contact Status
  INSERT INTO crm_fields (org_id, module_id, key, label, type, is_system, is_indexed, options, section, display_order)
  VALUES (v_org_id, v_module_id, 'contact_status', 'Contact Status', 'select', true, true,
    '["Active", "In-Active", "Future Prospect", "Lost Opportunity", "Complimentary", "Cancelled", "Pending"]'::jsonb, 
    'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, options = EXCLUDED.options, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Contact Owner
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'contact_owner', 'Contact Owner', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Contact Owner ID
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'contact_owner_id', 'Contact Owner ID', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Lead Source
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'lead_source', 'Lead Source', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Affiliate
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'affiliate', 'Affiliate', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Producer Name
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'producer_name', 'Producer Name', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Producer Name ID
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'producer_name_id', 'Producer Name ID', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Referral Source
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'referral_source', 'Referral Source', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Referring Member
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'referring_member', 'Referring Member', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Tag
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'tag', 'Tag', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Territories
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'territories', 'Territories', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Company/Association
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'company_association', 'Company/Association', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Data Source
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'data_source', 'Data Source', 'text', 'management', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;

  -- ============================================================================
  -- SECTION: Address
  -- ============================================================================
  v_display_order := 200;
  
  -- Mailing Street
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'mailing_street', 'Mailing Street', 'text', 'address', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Mailing City
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'mailing_city', 'Mailing City', 'text', 'address', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Mailing State
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'mailing_state', 'Mailing State', 'text', 'address', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Mailing Zip
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'mailing_zip', 'Mailing Zip', 'text', 'address', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;

  -- ============================================================================
  -- SECTION: Family - Spouse
  -- ============================================================================
  v_display_order := 300;
  
  -- Spouse
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'spouse', 'Spouse Name', 'text', 'family_spouse', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Spouse DOB
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'spouse_dob', 'Spouse DOB', 'date', 'family_spouse', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Spouse S.S. Number
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'spouse_ss_number', 'Spouse S.S. Number', 'text', 'family_spouse', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Spouse Address
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'spouse_address', 'Spouse Address', 'text', 'family_spouse', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Spouse Phone Number
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'spouse_phone_number', 'Spouse Phone Number', 'phone', 'family_spouse', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Spouse Email
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'spouse_email', 'Spouse Email', 'email', 'family_spouse', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;

  -- ============================================================================
  -- SECTION: Family - Children (Child 1-5)
  -- ============================================================================
  v_display_order := 400;
  
  -- Child 1
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_1', 'Child 1 Name', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_1_dob', 'Child 1 DOB', 'date', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_1_ss_number', 'Child 1 S.S. Number', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_1_address', 'Child 1 Address', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_1_phone_number', 'Child 1 Phone Number', 'phone', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_1_email', 'Child 1 Email', 'email', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Child 2
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_2', 'Child 2 Name', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_2_dob', 'Child 2 DOB', 'date', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_2_ss_number', 'Child 2 S.S. Number', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_2_address', 'Child 2 Address', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_2_phone_number', 'Child 2 Phone Number', 'phone', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_2_email', 'Child 2 Email', 'email', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Child 3
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_3', 'Child 3 Name', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_3_dob', 'Child 3 DOB', 'date', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_3_ss_number', 'Child 3 S.S. Number', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_3_address', 'Child 3 Address', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_3_phone_number', 'Child 3 Phone Number', 'phone', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_3_email', 'Child 3 Email', 'email', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Child 4
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_4', 'Child 4 Name', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_4_dob', 'Child 4 DOB', 'date', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_4_ss_number', 'Child 4 S.S. Number', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_4_address', 'Child 4 Address', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_4_phone_number', 'Child 4 Phone Number', 'phone', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_4_email', 'Child 4 Email', 'email', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  -- Child 5
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_5', 'Child 5 Name', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_5_dob', 'Child 5 DOB', 'date', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_5_ss_number', 'Child 5 S.S. Number', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_5_address', 'Child 5 Address', 'text', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_5_phone_number', 'Child 5 Phone Number', 'phone', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'child_5_email', 'Child 5 Email', 'email', 'family_children', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;

  -- ============================================================================
  -- SECTION: Insurance/Product
  -- ============================================================================
  v_display_order := 500;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'carrier', 'Carrier', 'text', 'insurance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'previous_product', 'Previous Product', 'text', 'insurance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'product', 'Product', 'text', 'insurance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'coverage_option', 'Coverage Option', 'text', 'insurance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'monthly_premium', 'Monthly Premium', 'currency', 'insurance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'start_date', 'Start Date', 'date', 'insurance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'cancellation_date', 'Cancellation Date', 'datetime', 'insurance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'iua_amount', 'IUA Amount', 'currency', 'insurance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'vision', 'Vision', 'text', 'insurance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'dental', 'Dental', 'text', 'insurance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'add_on_product', 'Add-on Product', 'text', 'insurance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;

  -- ============================================================================
  -- SECTION: Payment
  -- ============================================================================
  v_display_order := 600;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'payment_method', 'Payment Method', 'text', 'payment', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'account_type', 'Account Type', 'text', 'payment', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'routing_number', 'Routing Number', 'text', 'payment', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'account_number', 'Account Number', 'text', 'payment', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'currency', 'Currency', 'text', 'payment', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'exchange_rate', 'Exchange Rate', 'number', 'payment', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;

  -- ============================================================================
  -- SECTION: Commissions
  -- ============================================================================
  v_display_order := 700;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'commission_percentage', 'Commission Percentage', 'number', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'amount_received', 'Amount Received', 'currency', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'producer_commission', 'Producer Commission', 'currency', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'team_leader', 'Team Leader', 'text', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'team_leader_monthly', 'Team Leader Monthly', 'currency', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'team_leader_referral', 'Team Leader Referral', 'currency', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'director', 'Director', 'text', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'director_monthly', 'Director Monthly', 'currency', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'director_referral', 'Director Referral', 'currency', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'affiliate_referral', 'Affiliate Referral', 'text', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'affiliate_rep_monthly', 'Affiliate Rep Monthly', 'currency', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'mpb_referral_fee', 'MPB Referral Fee', 'currency', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'date_referral_paid', 'Date Referral Paid', 'date', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'referral_requirement_satisfied', 'Referral Requirement Satisfied', 'text', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'declined', 'Declined', 'boolean', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'charge_waived', 'Charge Waived', 'boolean', 'commissions', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;

  -- ============================================================================
  -- SECTION: Life Codes / Identifiers
  -- ============================================================================
  v_display_order := 800;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'mpower_life_code', 'MPower Life Code', 'text', 'identifiers', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'life_code_2nd', '2nd Life Code', 'text', 'identifiers', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'life_code_3rd', '3rd Life Code', 'text', 'identifiers', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'life_code_4th', '4th Life Code', 'text', 'identifiers', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'life_code_5th', '5th Life Code', 'text', 'identifiers', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'e123_member_id', 'E123 Member ID', 'text', 'identifiers', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;

  -- ============================================================================
  -- SECTION: Portal Access
  -- ============================================================================
  v_display_order := 900;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'mpb_portal_username', 'MPB Portal Username', 'text', 'portal', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'mpb_portal_password', 'MPB Portal Password', 'text', 'portal', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'cirrus_registration_date', 'Cirrus Registration Date', 'date', 'portal', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'mpb_app_downloaded', 'MPB APP Downloaded', 'boolean', 'portal', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'select_conversion_completed', 'Select Conversion Completed', 'boolean', 'portal', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;

  -- ============================================================================
  -- SECTION: Compliance
  -- ============================================================================
  v_display_order := 1000;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'mec_submitted', 'MEC Submitted', 'boolean', 'compliance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'mec_decision_confirmed', 'MEC Decision Confirmed', 'boolean', 'compliance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'medical_release_form_on_file', 'Medical Release Form on File', 'boolean', 'compliance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'permission_to_discuss_plan', 'Permission to Discuss Plan', 'boolean', 'compliance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'atap', 'ATAP', 'text', 'compliance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'third_party_payor', 'Third Party Payor', 'text', 'compliance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'data_processing_basis', 'Data Processing Basis', 'text', 'compliance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'risk_assessment_paid', 'Risk Assessment Paid', 'text', 'compliance', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;

  -- ============================================================================
  -- SECTION: Welcome/Fulfillment
  -- ============================================================================
  v_display_order := 1100;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'welcome_call_status', 'Welcome Call Status', 'text', 'fulfillment', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'welcome_call_performed_by', 'Welcome Call Performed By', 'text', 'fulfillment', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'wc_outreach_date', 'WC Outreach Date', 'date', 'fulfillment', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'fulfillment_letter_mailed', 'Fulfillment Letter Mailed', 'date', 'fulfillment', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'fulfillment_email_sent', 'Fulfillment Email Sent', 'date', 'fulfillment', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'complete_date', 'Complete Date', 'date', 'fulfillment', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;

  -- ============================================================================
  -- SECTION: Activity Tracking
  -- ============================================================================
  v_display_order := 1200;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'days_visited', 'Days Visited', 'number', 'activity', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'average_time_spent_minutes', 'Average Time Spent (Minutes)', 'number', 'activity', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'number_of_chats', 'Number Of Chats', 'number', 'activity', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'most_recent_visit', 'Most Recent Visit', 'datetime', 'activity', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'first_visit', 'First Visit', 'datetime', 'activity', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'first_page_visited', 'First Page Visited', 'text', 'activity', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'referrer', 'Referrer', 'text', 'activity', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'visitor_score', 'Visitor Score', 'number', 'activity', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'last_activity_time', 'Last Activity Time', 'datetime', 'activity', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;

  -- ============================================================================
  -- SECTION: Communication Preferences
  -- ============================================================================
  v_display_order := 1300;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'email_opt_out', 'Email Opt Out', 'boolean', 'preferences', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'preferred_method_of_communication', 'Preferred Method of Communication', 'text', 'preferences', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'unsubscribed_mode', 'Unsubscribed Mode', 'text', 'preferences', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'unsubscribed_time', 'Unsubscribed Time', 'datetime', 'preferences', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;

  -- ============================================================================
  -- SECTION: Business Info
  -- ============================================================================
  v_display_order := 1400;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'business_or_practice_name', 'Business or Practice Name', 'text', 'business', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'dpc_name', 'DPC Name', 'text', 'business', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, section, display_order)
  VALUES (v_org_id, v_module_id, 'household_annual_adj_gross', 'Household Annual Adj Gross', 'currency', 'business', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;

  -- ============================================================================
  -- SECTION: System/Audit
  -- ============================================================================
  v_display_order := 1500;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, is_system, section, display_order)
  VALUES (v_org_id, v_module_id, 'created_by_name', 'Created By', 'text', true, 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, is_system, section, display_order)
  VALUES (v_org_id, v_module_id, 'modified_by_name', 'Modified By', 'text', true, 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, is_system, section, display_order)
  VALUES (v_org_id, v_module_id, 'zoho_created_time', 'Created Time (Zoho)', 'datetime', true, 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, is_system, section, display_order)
  VALUES (v_org_id, v_module_id, 'zoho_modified_time', 'Modified Time (Zoho)', 'datetime', true, 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, is_system, section, display_order)
  VALUES (v_org_id, v_module_id, 'notes_history', 'Notes History', 'textarea', true, 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, is_system, section, display_order)
  VALUES (v_org_id, v_module_id, 'locked', 'Locked', 'boolean', true, 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, is_system, section, display_order)
  VALUES (v_org_id, v_module_id, 'admin123', 'Admin123', 'text', true, 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, is_system, section, display_order)
  VALUES (v_org_id, v_module_id, 'change_log_time', 'Change Log Time', 'datetime', true, 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, is_system, section, display_order)
  VALUES (v_org_id, v_module_id, 'last_enriched_time', 'Last Enriched Time', 'datetime', true, 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, is_system, section, display_order)
  VALUES (v_org_id, v_module_id, 'enrich_status', 'Enrich Status', 'text', true, 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, is_system, section, display_order)
  VALUES (v_org_id, v_module_id, 'connected_to_module', 'Connected To Module', 'text', true, 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;
  
  INSERT INTO crm_fields (org_id, module_id, key, label, type, is_system, section, display_order)
  VALUES (v_org_id, v_module_id, 'connected_to_id', 'Connected To ID', 'text', true, 'system', v_display_order)
  ON CONFLICT (module_id, key) DO UPDATE SET label = EXCLUDED.label, section = EXCLUDED.section;
  v_display_order := v_display_order + 1;

  -- ============================================================================
  -- Create default layout for Contacts
  -- ============================================================================
  INSERT INTO crm_layouts (org_id, module_id, name, is_default, config)
  VALUES (
    v_org_id, 
    v_module_id, 
    'Default Contact Layout', 
    true,
    '{
      "sections": [
        {"key": "core", "label": "Contact Information", "columns": 2},
        {"key": "management", "label": "Contact Management", "columns": 2},
        {"key": "address", "label": "Address", "columns": 2},
        {"key": "family_spouse", "label": "Spouse Information", "columns": 2},
        {"key": "family_children", "label": "Children", "columns": 2},
        {"key": "insurance", "label": "Insurance / Product", "columns": 2},
        {"key": "payment", "label": "Payment Information", "columns": 2},
        {"key": "commissions", "label": "Commissions & Referrals", "columns": 2},
        {"key": "identifiers", "label": "Codes & Identifiers", "columns": 2},
        {"key": "portal", "label": "Portal Access", "columns": 2},
        {"key": "compliance", "label": "Compliance", "columns": 2},
        {"key": "fulfillment", "label": "Welcome & Fulfillment", "columns": 2},
        {"key": "activity", "label": "Activity Tracking", "columns": 2},
        {"key": "preferences", "label": "Communication Preferences", "columns": 2},
        {"key": "business", "label": "Business Information", "columns": 2},
        {"key": "system", "label": "System Information", "columns": 2, "collapsed": true}
      ]
    }'::jsonb
  )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Created/updated all contact fields for organization %', v_org_id;
END $$;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Contact field definitions migration complete. Fields organized into 16 sections.';
END $$;

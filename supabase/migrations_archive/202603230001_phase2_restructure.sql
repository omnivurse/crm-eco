-- ============================================================================
-- PHASE 2: Data Model, Terminology, and Contact Experience Rebuild
-- 2.1 Separate Insurance vs Health Sharing
-- 2.2 Terminology standardization
-- 2.3 Contact page layout reorganization (commissions to bottom)
-- 2.4 Multi-email support (verify/extend)
-- 2.5 Vision/Dental structured cards
-- ============================================================================

DO $$
DECLARE
  v_org_id uuid;
  v_contacts_module_id uuid;
  v_leads_module_id uuid;
  v_members_module_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  IF v_org_id IS NULL THEN RETURN; END IF;

  SELECT id INTO v_contacts_module_id
    FROM crm_modules WHERE org_id = v_org_id AND key = 'contacts';
  SELECT id INTO v_leads_module_id
    FROM crm_modules WHERE org_id = v_org_id AND key = 'leads';
  SELECT id INTO v_members_module_id
    FROM crm_modules WHERE org_id = v_org_id AND key = 'members';

  -- ==========================================================================
  -- 2.1: SEPARATE INSURANCE VS HEALTH SHARING
  -- Create two distinct sections: 'insurance_coverage' and 'health_sharing'
  -- ==========================================================================

  IF v_contacts_module_id IS NOT NULL THEN

    -- Insurance-specific fields
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width, tooltip)
    VALUES
      (v_org_id, v_contacts_module_id, 'insurance_carrier', 'Insurance Carrier', 'select', false, false, 300, 'insurance_coverage', 'half', 'Insurance company name'),
      (v_org_id, v_contacts_module_id, 'insurance_plan_name', 'Insurance Plan', 'text', false, false, 301, 'insurance_coverage', 'half', 'Plan name'),
      (v_org_id, v_contacts_module_id, 'insurance_full_cost', 'Full Premium Cost', 'currency', false, false, 302, 'insurance_coverage', 'half', 'Total monthly premium before subsidy'),
      (v_org_id, v_contacts_module_id, 'insurance_subsidy_amount', 'Subsidy Amount', 'currency', false, false, 303, 'insurance_coverage', 'half', 'Monthly subsidy / tax credit amount'),
      (v_org_id, v_contacts_module_id, 'insurance_client_pays', 'Client Pays', 'currency', false, false, 304, 'insurance_coverage', 'half', 'Actual monthly amount client pays after subsidy'),
      (v_org_id, v_contacts_module_id, 'insurance_effective_date', 'Effective Date', 'date', false, false, 305, 'insurance_coverage', 'half', NULL),
      (v_org_id, v_contacts_module_id, 'insurance_status', 'Insurance Status', 'select', false, false, 306, 'insurance_coverage', 'half', NULL)
    ON CONFLICT (module_id, key) DO NOTHING;

    UPDATE crm_fields SET options = '["Anthem","Cigna","Kaiser","RMHP","Select Health","UnitedHealthcare","Aetna","Humana","Blue Cross","Other"]'::jsonb
      WHERE module_id = v_contacts_module_id AND key = 'insurance_carrier';
    UPDATE crm_fields SET options = '["Active","Inactive","Pending","Cancelled","Terminated"]'::jsonb
      WHERE module_id = v_contacts_module_id AND key = 'insurance_status';

    -- Health Sharing-specific fields
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width, tooltip)
    VALUES
      (v_org_id, v_contacts_module_id, 'sharing_entity', 'Sharing Entity', 'select', false, false, 320, 'health_sharing', 'half', 'Health sharing organization'),
      (v_org_id, v_contacts_module_id, 'member_tier', 'Member Tier', 'text', false, false, 321, 'health_sharing', 'half', 'Coverage tier / household option'),
      (v_org_id, v_contacts_module_id, 'monthly_contribution', 'Monthly Contribution', 'currency', false, false, 322, 'health_sharing', 'half', 'Monthly sharing contribution amount'),
      (v_org_id, v_contacts_module_id, 'iua_amount', 'Initial Unshareable Amount', 'currency', false, false, 323, 'health_sharing', 'half', 'IUA / deductible equivalent'),
      (v_org_id, v_contacts_module_id, 'sharing_effective_date', 'Effective Date', 'date', false, false, 324, 'health_sharing', 'half', NULL),
      (v_org_id, v_contacts_module_id, 'sharing_status', 'Sharing Status', 'select', false, false, 325, 'health_sharing', 'half', NULL),
      (v_org_id, v_contacts_module_id, 'previous_membership', 'Previous Membership', 'text', false, false, 326, 'health_sharing', 'half', 'Previous health sharing membership / product'),
      (v_org_id, v_contacts_module_id, 'sharing_member_id', 'Sharing Member ID', 'text', false, false, 327, 'health_sharing', 'half', 'Member ID with sharing entity')
    ON CONFLICT (module_id, key) DO NOTHING;

    UPDATE crm_fields SET options = '["Sedera","Zion Health","MPB","Knew Health","Altrua","Impact","OneShare","Solidarity","Other"]'::jsonb
      WHERE module_id = v_contacts_module_id AND key = 'sharing_entity';
    UPDATE crm_fields SET options = '["Active","Inactive","Pending","Cancelled","Terminated"]'::jsonb
      WHERE module_id = v_contacts_module_id AND key = 'sharing_status';

    -- ==========================================================================
    -- 2.2: TERMINOLOGY STANDARDIZATION
    -- Update labels on existing fields (preserves keys for backward compat)
    -- ==========================================================================

    -- "Coverage Option" → "Member Tier" (if it exists)
    UPDATE crm_fields SET label = 'Member Tier'
      WHERE module_id = v_contacts_module_id AND key = 'coverage_option'
        AND label IN ('Coverage Option', 'Coverage option');

    -- "Monthly Premium" → "Monthly Contribution" for health sharing context
    UPDATE crm_fields SET label = 'Monthly Contribution'
      WHERE module_id = v_contacts_module_id AND key = 'monthly_premium'
        AND label = 'Monthly Premium';

    -- "Previous Product" → "Previous Membership"
    UPDATE crm_fields SET label = 'Previous Membership'
      WHERE module_id = v_contacts_module_id AND key = 'previous_product'
        AND label IN ('Previous Product', 'Previous product');

    -- Update "Product & Coverage" section label in layout to "Coverage Overview"
    -- (This happens via layout config update, not field rename)

    -- ==========================================================================
    -- 2.3: CONTACT PAGE LAYOUT REORGANIZATION
    -- Move commissions to high display_order so they appear last
    -- Reorder sections for logical reading flow
    -- ==========================================================================

    -- Push commissions to the bottom (display_order 9000+)
    UPDATE crm_fields SET display_order = 9000 + (display_order - 120)
      WHERE module_id = v_contacts_module_id AND section = 'commissions';

    -- Push zoho_system to the very bottom
    UPDATE crm_fields SET display_order = 9500 + (display_order - 220)
      WHERE module_id = v_contacts_module_id AND section = 'zoho_system';

    -- Push activity to near-bottom
    UPDATE crm_fields SET display_order = 8500 + (display_order - 210)
      WHERE module_id = v_contacts_module_id AND section = 'activity';

    -- ==========================================================================
    -- 2.4: MULTI-EMAIL SUPPORT
    -- email2, email3 already exist on members table from CSV migration
    -- Add to contacts module CRM fields for UI visibility
    -- ==========================================================================

    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width, tooltip)
    VALUES
      (v_org_id, v_contacts_module_id, 'email_secondary', 'Secondary Email', 'email', false, false, 35, 'main', 'half', 'Alternate email for this contact'),
      (v_org_id, v_contacts_module_id, 'email_opt_in_primary', 'Primary Email Opt-In', 'boolean', false, false, 36, 'main', 'half', 'Can send communications to primary email'),
      (v_org_id, v_contacts_module_id, 'email_opt_in_secondary', 'Secondary Email Opt-In', 'boolean', false, false, 37, 'main', 'half', 'Can send communications to secondary email')
    ON CONFLICT (module_id, key) DO NOTHING;

    -- Spouse email already exists in family section; add opt-in for it
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width, tooltip)
    VALUES
      (v_org_id, v_contacts_module_id, 'spouse_email_opt_in', 'Spouse Email Opt-In', 'boolean', false, false, 57, 'family', 'half', 'Can send communications to spouse email')
    ON CONFLICT (module_id, key) DO NOTHING;

    -- ==========================================================================
    -- 2.5: VISION/DENTAL RESTRUCTURE
    -- Replace simple text fields with structured sections
    -- ==========================================================================

    -- Vision structured section
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width, tooltip)
    VALUES
      (v_org_id, v_contacts_module_id, 'vision_provider', 'Vision Provider', 'text', false, false, 350, 'vision_coverage', 'half', 'Vision insurance company / provider'),
      (v_org_id, v_contacts_module_id, 'vision_plan_name', 'Vision Plan', 'text', false, false, 351, 'vision_coverage', 'half', 'Plan name'),
      (v_org_id, v_contacts_module_id, 'vision_start_date', 'Vision Start Date', 'date', false, false, 352, 'vision_coverage', 'half', NULL),
      (v_org_id, v_contacts_module_id, 'vision_end_date', 'Vision End Date', 'date', false, false, 353, 'vision_coverage', 'half', NULL),
      (v_org_id, v_contacts_module_id, 'vision_price', 'Vision Monthly Cost', 'currency', false, false, 354, 'vision_coverage', 'half', 'Monthly premium / cost'),
      (v_org_id, v_contacts_module_id, 'vision_covered_members', 'Vision Covered Members', 'text', false, false, 355, 'vision_coverage', 'full', 'Primary, Spouse, Dependents covered')
    ON CONFLICT (module_id, key) DO NOTHING;

    -- Dental structured section
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width, tooltip)
    VALUES
      (v_org_id, v_contacts_module_id, 'dental_provider', 'Dental Provider', 'text', false, false, 370, 'dental_coverage', 'half', 'Dental insurance company / provider'),
      (v_org_id, v_contacts_module_id, 'dental_plan_name', 'Dental Plan', 'text', false, false, 371, 'dental_coverage', 'half', 'Plan name'),
      (v_org_id, v_contacts_module_id, 'dental_start_date', 'Dental Start Date', 'date', false, false, 372, 'dental_coverage', 'half', NULL),
      (v_org_id, v_contacts_module_id, 'dental_end_date', 'Dental End Date', 'date', false, false, 373, 'dental_coverage', 'half', NULL),
      (v_org_id, v_contacts_module_id, 'dental_price', 'Dental Monthly Cost', 'currency', false, false, 374, 'dental_coverage', 'half', 'Monthly premium / cost'),
      (v_org_id, v_contacts_module_id, 'dental_covered_members', 'Dental Covered Members', 'text', false, false, 375, 'dental_coverage', 'full', 'Primary, Spouse, Dependents covered')
    ON CONFLICT (module_id, key) DO NOTHING;

  END IF;

  -- ==========================================================================
  -- Apply same Insurance/HealthSharing separation to Members module
  -- ==========================================================================

  IF v_members_module_id IS NOT NULL THEN
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width, tooltip)
    VALUES
      -- Insurance
      (v_org_id, v_members_module_id, 'insurance_carrier', 'Insurance Carrier', 'select', false, false, 300, 'insurance_coverage', 'half', NULL),
      (v_org_id, v_members_module_id, 'insurance_plan_name', 'Insurance Plan', 'text', false, false, 301, 'insurance_coverage', 'half', NULL),
      (v_org_id, v_members_module_id, 'insurance_full_cost', 'Full Premium Cost', 'currency', false, false, 302, 'insurance_coverage', 'half', NULL),
      (v_org_id, v_members_module_id, 'insurance_subsidy_amount', 'Subsidy Amount', 'currency', false, false, 303, 'insurance_coverage', 'half', NULL),
      (v_org_id, v_members_module_id, 'insurance_client_pays', 'Client Pays', 'currency', false, false, 304, 'insurance_coverage', 'half', NULL),
      (v_org_id, v_members_module_id, 'insurance_effective_date', 'Effective Date', 'date', false, false, 305, 'insurance_coverage', 'half', NULL),
      (v_org_id, v_members_module_id, 'insurance_status', 'Insurance Status', 'select', false, false, 306, 'insurance_coverage', 'half', NULL),
      -- Health Sharing
      (v_org_id, v_members_module_id, 'sharing_entity', 'Sharing Entity', 'select', false, false, 320, 'health_sharing', 'half', NULL),
      (v_org_id, v_members_module_id, 'member_tier', 'Member Tier', 'text', false, false, 321, 'health_sharing', 'half', NULL),
      (v_org_id, v_members_module_id, 'monthly_contribution', 'Monthly Contribution', 'currency', false, false, 322, 'health_sharing', 'half', NULL),
      (v_org_id, v_members_module_id, 'iua_amount', 'Initial Unshareable Amount', 'currency', false, false, 323, 'health_sharing', 'half', NULL),
      (v_org_id, v_members_module_id, 'sharing_effective_date', 'Effective Date', 'date', false, false, 324, 'health_sharing', 'half', NULL),
      (v_org_id, v_members_module_id, 'sharing_status', 'Sharing Status', 'select', false, false, 325, 'health_sharing', 'half', NULL),
      (v_org_id, v_members_module_id, 'previous_membership', 'Previous Membership', 'text', false, false, 326, 'health_sharing', 'half', NULL),
      (v_org_id, v_members_module_id, 'sharing_member_id', 'Sharing Member ID', 'text', false, false, 327, 'health_sharing', 'half', NULL),
      -- Vision
      (v_org_id, v_members_module_id, 'vision_provider', 'Vision Provider', 'text', false, false, 350, 'vision_coverage', 'half', NULL),
      (v_org_id, v_members_module_id, 'vision_plan_name', 'Vision Plan', 'text', false, false, 351, 'vision_coverage', 'half', NULL),
      (v_org_id, v_members_module_id, 'vision_start_date', 'Vision Start Date', 'date', false, false, 352, 'vision_coverage', 'half', NULL),
      (v_org_id, v_members_module_id, 'vision_end_date', 'Vision End Date', 'date', false, false, 353, 'vision_coverage', 'half', NULL),
      (v_org_id, v_members_module_id, 'vision_price', 'Vision Monthly Cost', 'currency', false, false, 354, 'vision_coverage', 'half', NULL),
      (v_org_id, v_members_module_id, 'vision_covered_members', 'Vision Covered Members', 'text', false, false, 355, 'vision_coverage', 'full', NULL),
      -- Dental
      (v_org_id, v_members_module_id, 'dental_provider', 'Dental Provider', 'text', false, false, 370, 'dental_coverage', 'half', NULL),
      (v_org_id, v_members_module_id, 'dental_plan_name', 'Dental Plan', 'text', false, false, 371, 'dental_coverage', 'half', NULL),
      (v_org_id, v_members_module_id, 'dental_start_date', 'Dental Start Date', 'date', false, false, 372, 'dental_coverage', 'half', NULL),
      (v_org_id, v_members_module_id, 'dental_end_date', 'Dental End Date', 'date', false, false, 373, 'dental_coverage', 'half', NULL),
      (v_org_id, v_members_module_id, 'dental_price', 'Dental Monthly Cost', 'currency', false, false, 374, 'dental_coverage', 'half', NULL),
      (v_org_id, v_members_module_id, 'dental_covered_members', 'Dental Covered Members', 'text', false, false, 375, 'dental_coverage', 'full', NULL)
    ON CONFLICT (module_id, key) DO NOTHING;

    -- Set options for members module
    UPDATE crm_fields SET options = '["Anthem","Cigna","Kaiser","RMHP","Select Health","UnitedHealthcare","Aetna","Humana","Blue Cross","Other"]'::jsonb
      WHERE module_id = v_members_module_id AND key = 'insurance_carrier';
    UPDATE crm_fields SET options = '["Active","Inactive","Pending","Cancelled","Terminated"]'::jsonb
      WHERE module_id = v_members_module_id AND key IN ('insurance_status', 'sharing_status');
    UPDATE crm_fields SET options = '["Sedera","Zion Health","MPB","Knew Health","Altrua","Impact","OneShare","Solidarity","Other"]'::jsonb
      WHERE module_id = v_members_module_id AND key = 'sharing_entity';

    -- Move commissions and activity to bottom for members too
    UPDATE crm_fields SET display_order = 9000 + (display_order % 100)
      WHERE module_id = v_members_module_id AND section = 'commissions'
        AND display_order < 9000;
  END IF;

  -- ==========================================================================
  -- Update layout configs with new section ordering
  -- The DynamicRecordForm auto-discovers sections from fields, but layout
  -- config controls the order. Update the contacts layout.
  -- ==========================================================================

  UPDATE crm_layouts
  SET config = jsonb_set(
    config,
    '{sections}',
    '[
      {"key": "main", "label": "Contact Information", "columns": 2},
      {"key": "address", "label": "Address", "columns": 2},
      {"key": "family", "label": "Family & Household", "columns": 2, "collapsed": true},
      {"key": "insurance_coverage", "label": "Insurance Coverage", "columns": 2},
      {"key": "health_sharing", "label": "Health Sharing", "columns": 2},
      {"key": "product", "label": "Coverage Overview", "columns": 2, "collapsed": true},
      {"key": "secondary_coverage", "label": "Secondary Coverage", "columns": 2, "collapsed": true},
      {"key": "vision_coverage", "label": "Vision", "columns": 2, "collapsed": true},
      {"key": "dental_coverage", "label": "Dental", "columns": 2, "collapsed": true},
      {"key": "identity", "label": "Identity & Demographics", "columns": 2, "collapsed": true},
      {"key": "management", "label": "Ownership & Management", "columns": 2, "collapsed": true},
      {"key": "payment", "label": "Payment", "columns": 2, "collapsed": true},
      {"key": "identifiers", "label": "Life Codes & IDs", "columns": 2, "collapsed": true},
      {"key": "portal", "label": "Portal Access", "columns": 2, "collapsed": true},
      {"key": "compliance", "label": "Compliance", "columns": 2, "collapsed": true},
      {"key": "fulfillment", "label": "Fulfillment", "columns": 2, "collapsed": true},
      {"key": "business", "label": "Business Info", "columns": 2, "collapsed": true},
      {"key": "preferences", "label": "Communication Preferences", "columns": 2, "collapsed": true},
      {"key": "additional", "label": "Additional Information", "columns": 2, "collapsed": true},
      {"key": "activity", "label": "Activity & Analytics", "columns": 2, "collapsed": true},
      {"key": "commissions", "label": "Commissions", "columns": 2, "collapsed": true},
      {"key": "zoho_system", "label": "Zoho System Fields", "columns": 2, "collapsed": true}
    ]'::jsonb
  )
  WHERE module_id = v_contacts_module_id
    AND is_default = true;

END $$;

NOTIFY pgrst, 'reload schema';

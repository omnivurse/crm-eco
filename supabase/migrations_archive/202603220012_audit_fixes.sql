-- ============================================================================
-- CRM Audit Fixes — Items #2, #4, #6, #8, #9, #10
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
  -- FIX #4: Phone ownership labels
  -- Add sublabel/description to existing phone fields so UI can show
  -- "belongs to: Spouse", "belongs to: Child 1", etc.
  -- ==========================================================================

  -- Update tooltip on existing phone fields to indicate ownership
  IF v_contacts_module_id IS NOT NULL THEN
    UPDATE crm_fields SET tooltip = 'Primary member phone'
      WHERE module_id = v_contacts_module_id AND key = 'phone' AND tooltip IS NULL;
    UPDATE crm_fields SET tooltip = 'Spouse phone number'
      WHERE module_id = v_contacts_module_id AND key = 'spouse_phone_number';
    UPDATE crm_fields SET tooltip = 'Child 1 phone number'
      WHERE module_id = v_contacts_module_id AND key = 'child_1_phone_number';
    UPDATE crm_fields SET tooltip = 'Child 2 phone number'
      WHERE module_id = v_contacts_module_id AND key = 'child_2_phone_number';
    UPDATE crm_fields SET tooltip = 'Child 3 phone number'
      WHERE module_id = v_contacts_module_id AND key = 'child_3_phone_number';
    UPDATE crm_fields SET tooltip = 'Child 4 phone number'
      WHERE module_id = v_contacts_module_id AND key = 'child_4_phone_number';
    UPDATE crm_fields SET tooltip = 'Child 5 phone number'
      WHERE module_id = v_contacts_module_id AND key = 'child_5_phone_number';
  END IF;

  -- Add phone_owner field for members module phones
  IF v_members_module_id IS NOT NULL THEN
    UPDATE crm_fields SET tooltip = 'Primary member phone'
      WHERE module_id = v_members_module_id AND key IN ('phone', 'phone_ext') AND tooltip IS NULL;
    UPDATE crm_fields SET tooltip = 'Secondary phone (specify owner in notes)'
      WHERE module_id = v_members_module_id AND key = 'phone2' AND tooltip IS NULL;
    UPDATE crm_fields SET tooltip = 'Tertiary phone (specify owner in notes)'
      WHERE module_id = v_members_module_id AND key = 'phone3' AND tooltip IS NULL;

    -- Add explicit phone_owner fields for phone2 and phone3
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width, tooltip)
    VALUES
      (v_org_id, v_members_module_id, 'phone2_owner', 'Phone 2 Belongs To', 'select', false, false, 403, 'extended_contact', 'half',
       'Who does this phone number belong to?'),
      (v_org_id, v_members_module_id, 'phone3_owner', 'Phone 3 Belongs To', 'select', false, false, 405, 'extended_contact', 'half',
       'Who does this phone number belong to?')
    ON CONFLICT (module_id, key) DO NOTHING;

    -- Set options for owner dropdowns
    UPDATE crm_fields
      SET options = '["Primary","Spouse","Child","Parent","Other"]'::jsonb
    WHERE module_id = v_members_module_id AND key IN ('phone2_owner', 'phone3_owner');
  END IF;

  -- ==========================================================================
  -- FIX #2: Carrier dropdown field on contacts
  -- Register a carrier_name select field populated from insurance_carriers
  -- ==========================================================================

  IF v_contacts_module_id IS NOT NULL THEN
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width, tooltip)
    VALUES
      (v_org_id, v_contacts_module_id, 'carrier_name', 'Insurance Carrier', 'select', false, false, 250, 'coverage', 'half',
       'Select insurance carrier')
    ON CONFLICT (module_id, key) DO NOTHING;

    -- Populate options from existing carriers + the 5 required static carriers
    UPDATE crm_fields
      SET options = (
        SELECT jsonb_agg(DISTINCT carrier)
        FROM (
          -- Static required carriers
          SELECT unnest(ARRAY['Anthem','Cigna','Kaiser','RMHP','Select Health']) AS carrier
          UNION
          -- Existing DB carriers
          SELECT carrier_name AS carrier
          FROM insurance_carriers
          WHERE organization_id = v_org_id AND is_active = true
          ORDER BY carrier
        ) sub
      )
    WHERE module_id = v_contacts_module_id AND key = 'carrier_name';
  END IF;

  -- Also add to leads and members
  IF v_leads_module_id IS NOT NULL THEN
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width, tooltip)
    VALUES
      (v_org_id, v_leads_module_id, 'carrier_name', 'Insurance Carrier', 'select', false, false, 250, 'coverage', 'half',
       'Select insurance carrier')
    ON CONFLICT (module_id, key) DO NOTHING;

    UPDATE crm_fields
      SET options = (
        SELECT jsonb_agg(DISTINCT carrier)
        FROM (
          SELECT unnest(ARRAY['Anthem','Cigna','Kaiser','RMHP','Select Health']) AS carrier
          UNION
          SELECT carrier_name FROM insurance_carriers
          WHERE organization_id = v_org_id AND is_active = true
        ) sub
      )
    WHERE module_id = v_leads_module_id AND key = 'carrier_name';
  END IF;

  IF v_members_module_id IS NOT NULL THEN
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width, tooltip)
    VALUES
      (v_org_id, v_members_module_id, 'carrier_name', 'Insurance Carrier', 'select', false, false, 250, 'coverage', 'half',
       'Select insurance carrier')
    ON CONFLICT (module_id, key) DO NOTHING;

    UPDATE crm_fields
      SET options = (
        SELECT jsonb_agg(DISTINCT carrier)
        FROM (
          SELECT unnest(ARRAY['Anthem','Cigna','Kaiser','RMHP','Select Health']) AS carrier
          UNION
          SELECT carrier_name FROM insurance_carriers
          WHERE organization_id = v_org_id AND is_active = true
        ) sub
      )
    WHERE module_id = v_members_module_id AND key = 'carrier_name';
  END IF;

  -- ==========================================================================
  -- FIX #8: Ensure contact_status is visible on ALL modules
  -- (Already exists on contacts/leads/members from 202603220003 migration
  -- but ensure it's pinned so it always appears)
  -- ==========================================================================

  UPDATE crm_fields SET is_pinned = true
  WHERE key = 'contact_status'
    AND module_id IN (v_contacts_module_id, v_leads_module_id, v_members_module_id);

  -- Also ensure 'status' badge field is pinned
  UPDATE crm_fields SET is_pinned = true
  WHERE key = 'status'
    AND module_id IN (v_contacts_module_id, v_leads_module_id, v_members_module_id);

  -- ==========================================================================
  -- FIX #6: Ensure start date fields appear in layouts (pin them)
  -- ==========================================================================

  UPDATE crm_fields SET is_pinned = true
  WHERE key IN ('original_start_date', 'current_year_start_date')
    AND module_id IN (v_contacts_module_id, v_leads_module_id, v_members_module_id);

  -- ==========================================================================
  -- FIX #10: Dual enrollment / two plans support
  -- Add secondary coverage fields to contacts and members
  -- ==========================================================================

  IF v_contacts_module_id IS NOT NULL THEN
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width, tooltip)
    VALUES
      (v_org_id, v_contacts_module_id, 'secondary_carrier', 'Secondary Carrier', 'select', false, false, 260, 'secondary_coverage', 'half',
       'Second insurance carrier if member has dual coverage'),
      (v_org_id, v_contacts_module_id, 'secondary_plan_name', 'Secondary Plan', 'text', false, false, 261, 'secondary_coverage', 'half',
       'Second plan name'),
      (v_org_id, v_contacts_module_id, 'secondary_plan_type', 'Secondary Plan Type', 'select', false, false, 262, 'secondary_coverage', 'half',
       'Type of secondary coverage'),
      (v_org_id, v_contacts_module_id, 'secondary_effective_date', 'Secondary Effective Date', 'date', false, false, 263, 'secondary_coverage', 'half',
       'When secondary coverage began'),
      (v_org_id, v_contacts_module_id, 'secondary_monthly_share', 'Secondary Monthly Cost', 'currency', false, false, 264, 'secondary_coverage', 'half',
       'Monthly cost for secondary plan'),
      (v_org_id, v_contacts_module_id, 'secondary_status', 'Secondary Status', 'select', false, false, 265, 'secondary_coverage', 'half',
       'Status of secondary coverage')
    ON CONFLICT (module_id, key) DO NOTHING;

    -- Set options for secondary fields
    UPDATE crm_fields SET options = (
      SELECT jsonb_agg(DISTINCT carrier)
      FROM (
        SELECT unnest(ARRAY['Anthem','Cigna','Kaiser','RMHP','Select Health']) AS carrier
        UNION
        SELECT carrier_name FROM insurance_carriers
        WHERE organization_id = v_org_id AND is_active = true
      ) sub
    )
    WHERE module_id = v_contacts_module_id AND key = 'secondary_carrier';

    UPDATE crm_fields
      SET options = '["Healthshare","Major Medical","Dental","Vision","Supplemental","Medicare","Medicaid"]'::jsonb
    WHERE module_id = v_contacts_module_id AND key = 'secondary_plan_type';

    UPDATE crm_fields
      SET options = '["Active","Inactive","Pending","Cancelled","Terminated"]'::jsonb
    WHERE module_id = v_contacts_module_id AND key = 'secondary_status';
  END IF;

  -- Same for members module
  IF v_members_module_id IS NOT NULL THEN
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, width, tooltip)
    VALUES
      (v_org_id, v_members_module_id, 'secondary_carrier', 'Secondary Carrier', 'select', false, false, 260, 'secondary_coverage', 'half',
       'Second insurance carrier if member has dual coverage'),
      (v_org_id, v_members_module_id, 'secondary_plan_name', 'Secondary Plan', 'text', false, false, 261, 'secondary_coverage', 'half',
       'Second plan name'),
      (v_org_id, v_members_module_id, 'secondary_plan_type', 'Secondary Plan Type', 'select', false, false, 262, 'secondary_coverage', 'half',
       'Type of secondary coverage'),
      (v_org_id, v_members_module_id, 'secondary_effective_date', 'Secondary Effective Date', 'date', false, false, 263, 'secondary_coverage', 'half',
       'When secondary coverage began'),
      (v_org_id, v_members_module_id, 'secondary_monthly_share', 'Secondary Monthly Cost', 'currency', false, false, 264, 'secondary_coverage', 'half',
       'Monthly cost for secondary plan'),
      (v_org_id, v_members_module_id, 'secondary_status', 'Secondary Status', 'select', false, false, 265, 'secondary_coverage', 'half',
       'Status of secondary coverage')
    ON CONFLICT (module_id, key) DO NOTHING;

    UPDATE crm_fields SET options = (
      SELECT jsonb_agg(DISTINCT carrier)
      FROM (
        SELECT unnest(ARRAY['Anthem','Cigna','Kaiser','RMHP','Select Health']) AS carrier
        UNION
        SELECT carrier_name FROM insurance_carriers
        WHERE organization_id = v_org_id AND is_active = true
      ) sub
    )
    WHERE module_id = v_members_module_id AND key = 'secondary_carrier';

    UPDATE crm_fields
      SET options = '["Healthshare","Major Medical","Dental","Vision","Supplemental","Medicare","Medicaid"]'::jsonb
    WHERE module_id = v_members_module_id AND key = 'secondary_plan_type';

    UPDATE crm_fields
      SET options = '["Active","Inactive","Pending","Cancelled","Terminated"]'::jsonb
    WHERE module_id = v_members_module_id AND key = 'secondary_status';
  END IF;

END $$;

-- ============================================================================
-- FIX #9: Deeper duplicate notes cleanup
-- Remove dupes where body matches after trimming whitespace, across all authors
-- Keep the earliest note per (record_id, trimmed_body)
-- ============================================================================

DELETE FROM crm_notes
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY record_id, TRIM(BOTH FROM LOWER(body))
        ORDER BY created_at ASC
      ) AS rn
    FROM crm_notes
  ) dupes
  WHERE dupes.rn > 1
);

-- ============================================================================
-- FIX #4 continued: Add phone_owner columns to members table
-- ============================================================================

ALTER TABLE members ADD COLUMN IF NOT EXISTS phone2_owner text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS phone3_owner text;

NOTIFY pgrst, 'reload schema';

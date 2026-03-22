-- ============================================================================
-- COMPLETE FILTER FIELDS — Ensure ALL client-expected fields exist
-- for both contacts AND leads modules so filtering works on every field
-- ============================================================================

DO $$
DECLARE
  v_mod record;
BEGIN
  -- Add missing fields to BOTH contacts and leads modules
  FOR v_mod IN
    SELECT id, org_id FROM crm_modules
    WHERE key IN ('contacts', 'leads')
  LOOP
    INSERT INTO crm_fields (
      org_id, module_id, key, label, type, required, is_system, display_order, section, tooltip, options
    ) VALUES
      -- Personal fields that may be missing on contacts
      (v_mod.org_id, v_mod.id, 'middle_name', 'Middle Name', 'text', false, false, 14, 'main', NULL, NULL),
      (v_mod.org_id, v_mod.id, 'mobile_2', 'Mobile 2', 'phone', false, false, 26, 'contact', 'Secondary mobile number', NULL),
      (v_mod.org_id, v_mod.id, 'email_opt_out', 'Email Opt Out', 'boolean', false, false, 190, 'preferences', 'Whether contact has opted out of emails', NULL),
      (v_mod.org_id, v_mod.id, 'next_step', 'Next Step', 'text', false, false, 55, 'management', 'Next action to take for this record', NULL),
      (v_mod.org_id, v_mod.id, 'business_type', 'Business Type', 'text', false, false, 32, 'main', 'Type of business or practice', NULL),
      (v_mod.org_id, v_mod.id, 'connected_to', 'Connected To', 'text', false, false, 33, 'management', 'Related record or account', NULL),
      -- Lead conversion fields (useful on both modules)
      (v_mod.org_id, v_mod.id, 'lead_conversion_time', 'Lead Conversion Time', 'datetime', false, false, 66, 'conversion', NULL, NULL),
      (v_mod.org_id, v_mod.id, 'converted_account', 'Converted Account', 'text', false, false, 67, 'conversion', NULL, NULL),
      (v_mod.org_id, v_mod.id, 'converted_contact', 'Converted Contact', 'text', false, false, 68, 'conversion', NULL, NULL),
      (v_mod.org_id, v_mod.id, 'converted_deal', 'Converted Deal', 'text', false, false, 69, 'conversion', NULL, NULL),
      -- Lead management fields
      (v_mod.org_id, v_mod.id, 'lead_name', 'Lead Name', 'text', false, false, 9, 'main', NULL, NULL),
      (v_mod.org_id, v_mod.id, 'lead_owner', 'Lead Owner', 'text', false, false, 16, 'management', NULL, NULL),
      (v_mod.org_id, v_mod.id, 'lead_status', 'Lead Status', 'select', false, false, 18, 'management', NULL,
       '["New","Contacted","Qualified","Unqualified","Converted","Lost"]'::jsonb),
      -- Compliance and preferences
      (v_mod.org_id, v_mod.id, 'data_processing_basis', 'Data Processing Basis', 'text', false, false, 167, 'compliance', NULL, NULL),
      (v_mod.org_id, v_mod.id, 'unsubscribed_mode', 'Unsubscribed Mode', 'text', false, false, 191, 'preferences', NULL, NULL),
      (v_mod.org_id, v_mod.id, 'unsubscribed_time', 'Unsubscribed Time', 'datetime', false, false, 192, 'preferences', NULL, NULL),
      -- Business/practice
      (v_mod.org_id, v_mod.id, 'company', 'Company', 'text', false, false, 31, 'main', 'Company or organization name', NULL)
    ON CONFLICT (module_id, key) DO NOTHING;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

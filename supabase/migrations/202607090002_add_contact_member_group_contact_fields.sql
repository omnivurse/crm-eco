-- ============================================================================
-- Surface the lead "Company & Contact" fields on the Contacts and Members
-- modules so the company / role / decision-maker context stays VISIBLE after a
-- lead converts.
--
-- The data already carries across conversion:
--   * lead -> contact (convert_lead_to_contact RPC) copies the whole lead
--     `data` blob minus a few lead-only keys; group_name / contact_role /
--     is_decision_maker / contact_phone / contact_email all survive, and
--     group_name is additionally written to the indexed column.
--   * lead -> member (ensureCrmMemberRecordFromLead) spreads the whole `data`.
-- What was missing were the crm_fields DEFINITIONS on those modules, without
-- which getFieldsForModule() returns nothing for these keys and the values sit
-- invisibly in JSONB. This migration only adds those definitions.
--
-- Placement mirrors Leads: the module's primary identity section
--   * Contacts -> 'main'  (display_order 24-28, after the seeded main fields)
--   * Members  -> 'core'  (display_order 50-54, after the seeded core fields)
--
-- Idempotent (ON CONFLICT (module_id, key) DO NOTHING) and loops over every org.
-- Column conventions match each module's existing fields: Contacts set org_id
-- only; Members set org_id + organization_id (its sync/RLS paths read both).
-- ============================================================================

DO $$
DECLARE
  v_module_id uuid;
  v_org_id uuid;
  v_contacts int := 0;
  v_members int := 0;
BEGIN
  -- --------------------------------------------------------------------------
  -- CONTACTS  (section 'main')
  -- --------------------------------------------------------------------------
  FOR v_module_id, v_org_id IN
    SELECT id, org_id FROM crm_modules WHERE key = 'contacts'
  LOOP
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, display_order, section, options)
    VALUES
      (v_org_id, v_module_id, 'group_name', 'Company / Group', 'text', false, false, 24, 'main', '[]'::jsonb),
      (v_org_id, v_module_id, 'contact_role', 'Contact Role', 'select', false, false, 25, 'main',
       '["Owner", "Decision Maker", "Office Manager", "HR Manager", "Office Admin", "Benefits Coordinator", "Accountant / Bookkeeper", "Other"]'::jsonb),
      (v_org_id, v_module_id, 'is_decision_maker', 'Primary Decision-Maker?', 'select', false, false, 26, 'main', '["Yes", "No"]'::jsonb),
      (v_org_id, v_module_id, 'contact_phone', 'Direct Phone', 'phone', false, false, 27, 'main', '[]'::jsonb),
      (v_org_id, v_module_id, 'contact_email', 'Direct Email', 'email', false, false, 28, 'main', '[]'::jsonb)
    ON CONFLICT (module_id, key) DO NOTHING;

    v_contacts := v_contacts + 1;
  END LOOP;

  -- --------------------------------------------------------------------------
  -- MEMBERS  (section 'core'; set organization_id like the module's other fields)
  -- --------------------------------------------------------------------------
  FOR v_module_id, v_org_id IN
    SELECT id, org_id FROM crm_modules WHERE key = 'members'
  LOOP
    INSERT INTO crm_fields (org_id, organization_id, module_id, key, label, type, required, is_system, display_order, section, options)
    VALUES
      (v_org_id, v_org_id, v_module_id, 'group_name', 'Company / Group', 'text', false, false, 50, 'core', '[]'::jsonb),
      (v_org_id, v_org_id, v_module_id, 'contact_role', 'Contact Role', 'select', false, false, 51, 'core',
       '["Owner", "Decision Maker", "Office Manager", "HR Manager", "Office Admin", "Benefits Coordinator", "Accountant / Bookkeeper", "Other"]'::jsonb),
      (v_org_id, v_org_id, v_module_id, 'is_decision_maker', 'Primary Decision-Maker?', 'select', false, false, 52, 'core', '["Yes", "No"]'::jsonb),
      (v_org_id, v_org_id, v_module_id, 'contact_phone', 'Direct Phone', 'phone', false, false, 53, 'core', '[]'::jsonb),
      (v_org_id, v_org_id, v_module_id, 'contact_email', 'Direct Email', 'email', false, false, 54, 'core', '[]'::jsonb)
    ON CONFLICT (module_id, key) DO NOTHING;

    v_members := v_members + 1;
  END LOOP;

  RAISE NOTICE 'Added Company & Contact fields to % contacts and % members module(s).', v_contacts, v_members;
END $$;

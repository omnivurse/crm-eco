-- ============================================================================
-- Add "Advisor" and "Agent" fields to Contacts and Leads modules
-- These fields support health insurance workflow where records are
-- organized by the selling advisor and agent.
-- ============================================================================

DO $$
DECLARE
  v_org record;
  v_mod record;
BEGIN
  -- Loop over every organization's contacts and leads modules
  FOR v_org IN SELECT DISTINCT org_id FROM crm_modules LOOP
    FOR v_mod IN
      SELECT id, org_id, key FROM crm_modules
      WHERE org_id = v_org.org_id AND key IN ('contacts', 'leads')
    LOOP
      INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, is_pinned, display_order, section, tooltip)
      VALUES
        (v_mod.org_id, v_mod.id, 'advisor', 'Advisor', 'text', false, false, true, 115, 'management', 'The advisor responsible for this record'),
        (v_mod.org_id, v_mod.id, 'agent', 'Agent', 'text', false, false, true, 116, 'management', 'The selling agent for this record')
      ON CONFLICT (module_id, key) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

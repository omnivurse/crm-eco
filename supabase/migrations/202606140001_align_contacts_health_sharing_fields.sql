-- Align Contacts coverage field sections with Leads so converted contacts show the
-- same Health Share editor (iua_amount lives in health_sharing on Leads).
-- ADDITIVE / UPDATE only — no data loss.

DO $$
DECLARE
  v_org_id    uuid;
  v_module_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found, skipping contacts coverage field alignment';
    RETURN;
  END IF;

  SELECT id INTO v_module_id
  FROM crm_modules
  WHERE organization_id = v_org_id AND key = 'contacts'
  LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE NOTICE 'Contacts module not found';
    RETURN;
  END IF;

  -- Move iua_amount into health_sharing (Leads parity); key is unique per module.
  UPDATE crm_fields
  SET section = 'health_sharing',
      display_order = 323,
      updated_at = now()
  WHERE module_id = v_module_id
    AND key = 'iua_amount'
    AND section IS DISTINCT FROM 'health_sharing';

  INSERT INTO crm_fields (
    org_id, module_id, key, label, type, required, is_system,
    display_order, section, width, tooltip, metadata
  )
  VALUES (
    v_org_id, v_module_id, 'previous_membership', 'Previous Membership', 'text',
    false, false, 327, 'health_sharing', 'half', 'Previous health sharing membership / product',
    '{}'::jsonb
  )
  ON CONFLICT (module_id, key) DO UPDATE
  SET section = EXCLUDED.section,
      label = EXCLUDED.label,
      display_order = EXCLUDED.display_order,
      updated_at = now()
  WHERE crm_fields.section IS DISTINCT FROM EXCLUDED.section;

END $$;

NOTIFY pgrst, 'reload schema';

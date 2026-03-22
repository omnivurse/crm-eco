-- Ensure contact_status field exists for ALL contact-type modules
-- This fixes the inconsistency where some records can't edit their status

DO $$
DECLARE
  v_mod record;
BEGIN
  FOR v_mod IN
    SELECT id, org_id FROM crm_modules
    WHERE key IN ('contacts', 'leads', 'members')
  LOOP
    INSERT INTO crm_fields (
      org_id, module_id, key, label, type, required,
      is_system, is_pinned, display_order, section, tooltip, options
    ) VALUES (
      v_mod.org_id, v_mod.id, 'contact_status', 'Contact Status', 'select', false,
      true, true, 5, 'main', 'Current status of this contact',
      '["Active","Inactive","Pending","Cancelled","Deceased","Terminated"]'::jsonb
    )
    ON CONFLICT (module_id, key) DO UPDATE
    SET options = EXCLUDED.options,
        is_pinned = true,
        display_order = 5;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

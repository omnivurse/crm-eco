-- ============================================================================
-- Add County to the Address section on contacts / leads / members, and place
-- First Name + Last Name side-by-side (width = half) for CO exchange tracking.
--
-- members.county already exists; sync_member_to_crm_records already writes
-- data.county. This only adds the crm_fields DEFINITION so the field is
-- visible/editable in the CRM Address section, plus the name layout tweak.
--
-- Idempotent: ON CONFLICT (module_id, key) DO NOTHING for inserts; width
-- UPDATE is safe to re-run. Loops every org that has the module.
-- ============================================================================

DO $$
DECLARE
  v_module_id uuid;
  v_org_id uuid;
  v_module_key text;
  v_display_order int;
  v_modules int := 0;
BEGIN
  FOR v_module_id, v_org_id, v_module_key IN
    SELECT id, org_id, key
    FROM crm_modules
    WHERE key IN ('contacts', 'leads', 'members')
  LOOP
    v_display_order := CASE v_module_key
      WHEN 'members' THEN 105
      WHEN 'contacts' THEN 32
      WHEN 'leads' THEN 16
      ELSE 200
    END;

    IF v_module_key = 'members' THEN
      INSERT INTO crm_fields (
        org_id, organization_id, module_id, key, label, type,
        required, is_system, display_order, section, options, width
      )
      VALUES (
        v_org_id, v_org_id, v_module_id, 'county', 'County', 'text',
        false, true, v_display_order, 'address', '[]'::jsonb, 'half'
      )
      ON CONFLICT (module_id, key) DO NOTHING;
    ELSE
      INSERT INTO crm_fields (
        org_id, module_id, key, label, type,
        required, is_system, display_order, section, options, width
      )
      VALUES (
        v_org_id, v_module_id, 'county', 'County', 'text',
        false, false, v_display_order, 'address', '[]'::jsonb, 'half'
      )
      ON CONFLICT (module_id, key) DO NOTHING;
    END IF;

    UPDATE crm_fields
    SET width = 'half',
        updated_at = now()
    WHERE module_id = v_module_id
      AND key IN ('first_name', 'last_name')
      AND (width IS DISTINCT FROM 'half');

    v_modules := v_modules + 1;
  END LOOP;

  RAISE NOTICE 'County address field + name half-width applied on % person module(s).', v_modules;
END $$;

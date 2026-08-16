-- ============================================================================
-- Dental Member ID # on person modules (contacts, leads, members)
--
-- Adds dental_member_id under dental_coverage so reps can store the plan
-- member ID next to Dental Provider / Plan / dates — mirroring sharing_member_id
-- on health_sharing. Values live in crm_records.data JSONB.
--
-- Idempotent: ON CONFLICT (module_id, key) DO NOTHING. Loops every org.
--
-- Rollback:
--   DELETE FROM crm_fields WHERE key = 'dental_member_id';
-- ============================================================================

DO $$
DECLARE
  v_module_id uuid;
  v_org_id uuid;
  v_count int := 0;
BEGIN
  FOR v_module_id, v_org_id IN
    SELECT id, org_id FROM crm_modules WHERE key IN ('contacts', 'leads', 'members')
  LOOP
    INSERT INTO crm_fields (
      org_id, organization_id, module_id, key, label, type,
      required, is_system, display_order, section, options, width, tooltip
    )
    VALUES (
      v_org_id, v_org_id, v_module_id,
      'dental_member_id',
      'Member ID #',
      'text',
      false,
      false,
      374,
      'dental_coverage',
      '[]'::jsonb,
      'half',
      'Dental plan member ID'
    )
    ON CONFLICT (module_id, key) DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'dental_member_id field applied to % person module(s).', v_count;
END $$;

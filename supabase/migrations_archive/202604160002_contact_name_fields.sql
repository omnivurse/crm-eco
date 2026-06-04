-- ============================================================================
-- Contact Name Field Cleanup
--
-- 1. Consolidate `middle_initial` (Zoho legacy) into `middle_name`:
--    - Copy any non-empty middle_initial into middle_name when middle_name is
--      empty/null on the record (no destructive overwrites).
--    - Remove the `middle_initial` row from `crm_fields` so it stops appearing
--      in detail / edit forms. JSONB key remains in `crm_records.data` for
--      historical traceability.
--
-- 2. Add `preferred_name` field to contacts AND leads modules.
--    "Preferred Name" — the nickname / commonly-used name shown in lists
--    and the drawer. Legal name (`first_name`) is preserved for enrollment
--    and carrier compliance.
--    Backfill from any pre-existing `nickname` JSONB key (legacy imports).
--
-- 3. Default display order: between `last_name` and `email`, with section
--    `core` so it appears with other identity fields.
-- ============================================================================

DO $$
DECLARE
  v_mod         record;
  v_updated_ct  bigint;
BEGIN
  -- ---------------------------------------------------------------- consolidate
  -- Copy middle_initial → middle_name where middle_name is empty
  UPDATE crm_records
  SET data = jsonb_set(
        COALESCE(data, '{}'::jsonb),
        '{middle_name}',
        data->'middle_initial',
        true
      )
  WHERE COALESCE(NULLIF(data->>'middle_initial', ''), NULL) IS NOT NULL
    AND COALESCE(NULLIF(data->>'middle_name', ''), NULL) IS NULL;
  GET DIAGNOSTICS v_updated_ct = ROW_COUNT;
  RAISE NOTICE 'Backfilled middle_name from middle_initial on % records', v_updated_ct;

  -- Backfill preferred_name from any legacy `nickname` key
  UPDATE crm_records
  SET data = jsonb_set(
        COALESCE(data, '{}'::jsonb),
        '{preferred_name}',
        data->'nickname',
        true
      )
  WHERE COALESCE(NULLIF(data->>'nickname', ''), NULL) IS NOT NULL
    AND COALESCE(NULLIF(data->>'preferred_name', ''), NULL) IS NULL;
  GET DIAGNOSTICS v_updated_ct = ROW_COUNT;
  RAISE NOTICE 'Backfilled preferred_name from nickname on % records', v_updated_ct;

  -- ---------------------------------------------------------------- remove
  -- Delete `middle_initial` field rows across all modules (any org).
  -- The JSONB value is kept in `crm_records.data` for traceability.
  DELETE FROM crm_fields WHERE key = 'middle_initial';

  -- ---------------------------------------------------------------- add field
  FOR v_mod IN
    SELECT id, org_id FROM crm_modules WHERE key IN ('contacts', 'leads')
  LOOP
    -- Ensure middle_name exists with the right label / section / display_order
    INSERT INTO crm_fields (
      org_id, module_id, key, label, type, required, is_system,
      display_order, section, tooltip
    ) VALUES (
      v_mod.org_id, v_mod.id, 'middle_name', 'Middle Name', 'text', false, false,
      4, 'core', 'Full middle name (used on enrollment & carrier applications)'
    )
    ON CONFLICT (module_id, key) DO UPDATE
      SET label   = EXCLUDED.label,
          section = EXCLUDED.section,
          tooltip = EXCLUDED.tooltip;

    -- Add preferred_name (nickname / commonly used name)
    INSERT INTO crm_fields (
      org_id, module_id, key, label, type, required, is_system,
      display_order, section, tooltip
    ) VALUES (
      v_mod.org_id, v_mod.id, 'preferred_name', 'Preferred Name', 'text', false, false,
      5, 'core',
      'Nickname or commonly used name. Legal name still required for enrollment & compliance.'
    )
    ON CONFLICT (module_id, key) DO UPDATE
      SET label   = EXCLUDED.label,
          section = EXCLUDED.section,
          tooltip = EXCLUDED.tooltip;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- PIFH data-only cleanup driven by the Aug-2026 client notes audit.
-- All three changes are additive/reversible and scoped to the PIFH org.
--
-- 1) Default Contact layout: the client hand-enters membership data
--    (who enrolled = producer/advisor, referring member, plan/product,
--    member IDs) into sections that the default layout collapses, so the
--    values look missing. Open `management`, `insurance` and `identifiers`
--    by default (the other 20 collapsed sections stay collapsed).
-- 2) Members module has NO crm_views row, so the list falls back to
--    rendering ALL 91 fields as columns (~16,500px wide → "scroll bar is
--    too long to the right"). Seed one shared default view with a compact
--    column set. Exactly one is_default row per module (getDefaultView
--    uses .single()).
-- 3) `enrollment_approval_test` (0 fields, 0 records, display_order 0)
--    sorts first in module pickers. Disable it (not deleted).
--
-- Rollback:
--   UPDATE public.crm_layouts SET config = jsonb_set(config,'{sections}',
--     (SELECT jsonb_agg(CASE WHEN s->>'key' IN ('management','insurance','identifiers')
--        THEN s || '{"collapsed":true}' ELSE s END) FROM jsonb_array_elements(config->'sections') s))
--   WHERE id = '5d349566-65b6-42f6-84ba-79d5db14c917';
--   DELETE FROM public.crm_views WHERE name = 'All Members' AND module_id = '860fecc8-2f08-4469-a401-f5d30fc8687f';
--   UPDATE public.crm_modules SET is_enabled = true WHERE id = '19d2c155-b86f-4aec-9dc8-c11149fb11bd';

SET lock_timeout = '5s';

DO $$
DECLARE
  v_org       uuid := '00000000-0000-0000-0000-000000000001';
  v_contacts  uuid;
  v_members   uuid;
  v_layout    uuid;
  v_updated   int := 0;
BEGIN
  SELECT id INTO v_contacts FROM public.crm_modules WHERE org_id = v_org AND key = 'contacts' LIMIT 1;
  SELECT id INTO v_members  FROM public.crm_modules WHERE org_id = v_org AND key = 'members'  LIMIT 1;

  ---------------------------------------------------------------------------
  -- 1) Open membership sections on the default Contact layout
  ---------------------------------------------------------------------------
  IF v_contacts IS NOT NULL THEN
    FOR v_layout IN
      SELECT id FROM public.crm_layouts
       WHERE module_id = v_contacts AND is_default = true
         AND jsonb_typeof(config->'sections') = 'array'
    LOOP
      UPDATE public.crm_layouts
         SET config = jsonb_set(
               config, '{sections}',
               (SELECT jsonb_agg(
                        CASE WHEN s->>'key' IN ('management','insurance','identifiers')
                             THEN s || jsonb_build_object('collapsed', false)
                             ELSE s END
                        ORDER BY ord)
                  FROM jsonb_array_elements(config->'sections') WITH ORDINALITY AS t(s, ord))
             ),
             updated_at = now()
       WHERE id = v_layout;
      GET DIAGNOSTICS v_updated = ROW_COUNT;
      RAISE NOTICE 'contact layout % updated (% row)', v_layout, v_updated;
    END LOOP;
  END IF;

  ---------------------------------------------------------------------------
  -- 2) Seed a compact default view for the Members module
  ---------------------------------------------------------------------------
  IF v_members IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.crm_views WHERE module_id = v_members AND is_default = true) THEN
    INSERT INTO public.crm_views (org_id, organization_id, module_id, name, columns, filters, sort, is_default, is_shared)
    VALUES (
      v_org, v_org, v_members, 'All Members',
      '["first_name","last_name","member_number","email","phone","contact_status","advisor_name"]'::jsonb,
      '[]'::jsonb,
      '[{"field":"created_at","direction":"desc"}]'::jsonb,
      true, true
    );
    RAISE NOTICE 'members default view inserted';
  END IF;

  ---------------------------------------------------------------------------
  -- 3) Disable the leftover TEST module
  ---------------------------------------------------------------------------
  UPDATE public.crm_modules
     SET is_enabled = false, updated_at = now()
   WHERE org_id = v_org AND key = 'enrollment_approval_test' AND is_enabled = true;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'test module disabled: % row(s)', v_updated;
END $$;

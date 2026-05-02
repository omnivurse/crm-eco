-- Align Leads with Contacts/Members insurance UX:
-- 1) Ensure default Leads layouts include the `health_insurance` section (repair path for orgs where
--    the section row was missing; after dropping `insurance_coverage` from layouts, omission left
--    no Health Insurance panel on Leads only).
-- 2) Rename legacy layout section key `insurance` → shown label "HealthShare" on Leads layouts,
--    matching contacts/members (202605050002).

DO $$
DECLARE
  v_hi jsonb :=
    '{"key":"health_insurance","label":"Health Insurance (major medical)","columns":2,"accent":"sky","collapsed":false}'::jsonb;
  r record;
  v_sections jsonb;
  v_elem jsonb;
  v_new jsonb;
  v_have_hi boolean;
  v_inserted boolean;
BEGIN
  FOR r IN
    SELECT cl.id AS layout_id, cl.config
      FROM crm_layouts cl
      JOIN crm_modules m ON m.id = cl.module_id
     WHERE cl.is_default = true
       AND m.key = 'leads'
  LOOP
    v_sections := COALESCE(r.config->'sections', '[]'::jsonb);

    SELECT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_sections) e(value)
      WHERE value->>'key' = 'health_insurance'
    ) INTO v_have_hi;

    IF v_have_hi THEN
      CONTINUE;
    END IF;

    v_new := '[]'::jsonb;
    v_inserted := false;

    FOR v_elem IN SELECT value FROM jsonb_array_elements(v_sections) AS x(value)
    LOOP
      IF v_elem->>'key' = 'health_insurance' THEN
        CONTINUE;
      END IF;

      IF v_elem->>'key' = 'health_sharing' THEN
        v_new := v_new || jsonb_build_array(v_elem);
        IF NOT v_inserted THEN
          v_new := v_new || jsonb_build_array(v_hi);
          v_inserted := true;
        END IF;
      ELSIF v_elem->>'key' = 'insurance_coverage' AND NOT v_inserted THEN
        v_new := v_new || jsonb_build_array(v_hi);
        v_new := v_new || jsonb_build_array(v_elem);
        v_inserted := true;
      ELSIF v_elem->>'key' = 'other_coverage' AND NOT v_inserted THEN
        v_new := v_new || jsonb_build_array(v_hi);
        v_new := v_new || jsonb_build_array(v_elem);
        v_inserted := true;
      ELSE
        v_new := v_new || jsonb_build_array(v_elem);
      END IF;
    END LOOP;

    IF NOT v_inserted THEN
      v_new := v_sections || jsonb_build_array(v_hi);
    END IF;

    UPDATE crm_layouts
       SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{sections}', v_new, true),
           updated_at = now()
     WHERE id = r.layout_id;
  END LOOP;
END $$;

UPDATE public.crm_layouts l
SET config = jsonb_set(
       l.config,
       '{sections}',
       COALESCE(
         (
           SELECT jsonb_agg(
                    CASE
                      WHEN elem->>'key' = 'insurance'
                           AND elem->>'label' ~* '^Insurance(\s|$|/)'
                           THEN elem || jsonb_build_object('label', 'HealthShare')
                      ELSE elem
                    END
                    ORDER BY ordinality
                  )
             FROM jsonb_array_elements(COALESCE(l.config->'sections', '[]'::jsonb))
                  WITH ORDINALITY AS t(elem, ordinality)
         ),
         '[]'::jsonb
       ),
       true
     ),
    updated_at = now()
WHERE l.config IS NOT NULL
  AND jsonb_typeof(COALESCE(l.config->'sections', 'null'::jsonb)) = 'array'
  AND EXISTS (
    SELECT 1
      FROM public.crm_modules m
     WHERE m.id = l.module_id
       AND m.key = 'leads'
  );

NOTIFY pgrst, 'reload schema';

-- Persist HealthShare wording for legacy `insurance` section keys on contacts/members layouts.
-- UI also normalizes generic "Insurance*" titles at runtime (section-utils.ts); this aligns DB defaults.

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
       AND m.key IN ('contacts', 'members')
  );

NOTIFY pgrst, 'reload schema';

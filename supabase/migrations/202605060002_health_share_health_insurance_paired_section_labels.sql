-- Pair Health Share × Health Insurance in the UI wording: reps sell BOTH — sharing
-- memberships (alternative pathway) alongside traditional / ACA major‑medical plans.
--
-- Touches default layouts for contacts/leads/members only; does not rename the legacy
-- `insurance_coverage` slug (still used for subsidy/carrier shorthand on some installs).

UPDATE public.crm_layouts l
SET config = jsonb_set(
       l.config,
       '{sections}',
       COALESCE(
         (
           SELECT jsonb_agg(
                    CASE elem->>'key'
                      WHEN 'health_sharing'
                        THEN elem || jsonb_build_object('label', 'Health Share')
                      WHEN 'health_insurance'
                        THEN elem ||
                             jsonb_build_object('label', 'Health Insurance (major medical)')
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
  AND l.is_default = true
  AND jsonb_typeof(COALESCE(l.config->'sections', 'null'::jsonb)) = 'array'
  AND EXISTS (
    SELECT 1
      FROM public.crm_modules m
     WHERE m.id = l.module_id
       AND m.key IN ('contacts', 'leads', 'members')
  );

NOTIFY pgrst, 'reload schema';

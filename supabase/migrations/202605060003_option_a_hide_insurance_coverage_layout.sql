-- Option A: one Health Insurance UI surface — remove duplicate "Insurance Products"
-- (insurance_coverage) from DEFAULT layouts only. Legacy JSON keys are unchanged.
-- Phase-2 `insurance_*` field rows are grouped under section `health_insurance` so they
-- render beside the newer `health_insurance_*` ACA fields without a second card.

UPDATE public.crm_layouts l
SET config = jsonb_set(
       l.config,
       '{sections}',
       COALESCE(
         (
           SELECT jsonb_agg(elem ORDER BY ordinality)
             FROM jsonb_array_elements(COALESCE(l.config->'sections', '[]'::jsonb))
                  WITH ORDINALITY AS t(elem, ordinality)
            WHERE elem->>'key' IS DISTINCT FROM 'insurance_coverage'
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
      FROM jsonb_array_elements(COALESCE(l.config->'sections', '[]'::jsonb)) e(elem)
     WHERE elem->>'key' = 'insurance_coverage'
  )
  AND EXISTS (
    SELECT 1
      FROM public.crm_modules m
     WHERE m.id = l.module_id
       AND m.key IN ('contacts', 'leads', 'members')
  );

UPDATE public.crm_fields f
   SET section = 'health_insurance',
       updated_at = now()
  FROM public.crm_modules m
 WHERE m.id = f.module_id
   AND m.key IN ('contacts', 'leads', 'members')
   AND f.section = 'insurance_coverage'
   AND f.key IN (
     'insurance_carrier',
     'insurance_plan_name',
     'insurance_full_cost',
     'insurance_subsidy_amount',
     'insurance_client_pays',
     'insurance_effective_date',
     'insurance_status'
   );

NOTIFY pgrst, 'reload schema';

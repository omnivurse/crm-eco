-- Enrollment canonical dates (original / current coverage year) were registered
-- in crm_fields.section = 'product' (see 202603220007). Primary product + carrier +
-- coverage live under 'insurance', so the Overview showed the wrong headings.
--
-- 1. Move those two columns next to traditional insurance/product fields on contacts + members.
-- 2. Relabel legacy layout sections whose key is still "product" vs "insurance" so leftovers
--    (vision / dental / add_on_product) aren't titled "Product" / misleading generic Insurance titles.

UPDATE public.crm_fields f
SET section = 'insurance'
WHERE f.key IN ('original_start_date', 'current_year_start_date')
  AND EXISTS (
    SELECT 1
      FROM public.crm_modules m
     WHERE m.id = f.module_id
       AND m.key IN ('contacts', 'members')
  );

UPDATE public.crm_layouts l
SET config = jsonb_set(
       l.config,
       '{sections}',
       COALESCE(
         (
           SELECT jsonb_agg(
                    CASE elem->>'key'
                      WHEN 'product' THEN
                        CASE elem->>'label'
                          WHEN 'Product' THEN elem || jsonb_build_object('label', 'Add-on coverage')
                          WHEN 'Product Interest'
                            THEN elem || jsonb_build_object('label', 'Add-on coverage')
                          ELSE elem
                        END
                      WHEN 'insurance' THEN
                        CASE elem->>'label'
                          WHEN 'Insurance'
                            THEN elem || jsonb_build_object('label', 'HealthShare')
                          WHEN 'Insurance / Product'
                            THEN elem || jsonb_build_object('label', 'HealthShare')
                          ELSE elem
                        END
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

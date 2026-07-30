-- Backfilled from the production migration ledger.
-- This migration was applied directly to production on 2026-07-20 22:06:36 UTC
-- (outside the repo) and was missing from version control. The SQL below is
-- reproduced verbatim from supabase_migrations.schema_migrations so that a
-- rebuild from migrations reproduces production. Already recorded as applied
-- in production -- it will not re-run there.

-- Remove zero-field non-coverage layout sections that caused empty Overview cards
-- (false "Coverage fields are not configured" for Start Date / Notes History / etc.).

CREATE TABLE IF NOT EXISTS public.crm_layout_orphan_cleanup_20260720 (
  layout_id uuid PRIMARY KEY REFERENCES public.crm_layouts(id) ON DELETE CASCADE,
  config_before jsonb NOT NULL,
  cleaned_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.crm_layout_orphan_cleanup_20260720 IS
  'One-shot backup from 202607200001_remove_orphan_layout_sections. Safe to DROP after verification.';

ALTER TABLE public.crm_layout_orphan_cleanup_20260720 ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.crm_layout_orphan_cleanup_20260720 FROM PUBLIC, anon, authenticated;

INSERT INTO public.crm_layout_orphan_cleanup_20260720 (layout_id, config_before)
SELECT l.id, l.config
FROM public.crm_layouts l
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements(COALESCE(l.config->'sections', '[]'::jsonb)) s
  WHERE (s->>'key') IS NOT NULL
    AND (s->>'key') NOT IN (
      'health_sharing', 'health_insurance', 'insurance', 'insurance_coverage',
      'dental_coverage', 'vision_coverage', 'other_coverage', 'life_coverage', 'product'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.crm_fields f
      WHERE f.module_id = l.module_id
        AND f.section = s->>'key'
    )
)
ON CONFLICT (layout_id) DO NOTHING;

UPDATE public.crm_layouts l
SET
  config = jsonb_set(
    COALESCE(l.config, '{}'::jsonb),
    '{sections}',
    COALESCE((
      SELECT jsonb_agg(s.elem ORDER BY s.ord)
      FROM jsonb_array_elements(COALESCE(l.config->'sections', '[]'::jsonb))
           WITH ORDINALITY AS s(elem, ord)
      WHERE NOT (
        (s.elem->>'key') IS NOT NULL
        AND (s.elem->>'key') NOT IN (
          'health_sharing', 'health_insurance', 'insurance', 'insurance_coverage',
          'dental_coverage', 'vision_coverage', 'other_coverage', 'life_coverage', 'product'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.crm_fields f
          WHERE f.module_id = l.module_id
            AND f.section = s.elem->>'key'
        )
      )
    ), '[]'::jsonb)
  ),
  updated_at = now()
WHERE l.id IN (SELECT layout_id FROM public.crm_layout_orphan_cleanup_20260720);

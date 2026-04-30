-- =============================================================================
-- crm_layouts — at most one is_default per module.
--
-- Symptom this fixes: useEditRecordData.fetchDefaultLayout() calls
--   .from('crm_layouts').eq('module_id', X).eq('is_default', true).maybeSingle()
-- which throws PGRST116 ("Results contain 2 rows...") when a module has
-- multiple default layouts. The edit page then shows "Could not load form
-- metadata".
--
-- Repair: keep the most recently updated default per (org_id, module_id) and
-- demote the rest. Then add a partial unique index so this can't drift back.
-- Idempotent.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  n_demoted bigint;
BEGIN
  WITH ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY org_id, module_id
        ORDER BY updated_at DESC NULLS LAST,
                 created_at DESC NULLS LAST,
                 id
      ) AS rn
    FROM public.crm_layouts
    WHERE is_default = true
  )
  UPDATE public.crm_layouts l
     SET is_default = false,
         updated_at = now()
    FROM ranked r
   WHERE l.id = r.id
     AND r.rn > 1;

  GET DIAGNOSTICS n_demoted = ROW_COUNT;
  IF n_demoted > 0 THEN
    RAISE NOTICE '[crm-layouts-default] demoted % duplicate default rows', n_demoted;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_layouts_one_default_per_module
  ON public.crm_layouts (org_id, module_id)
  WHERE is_default = true;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- CRM notes: fix invisible rows + safer SELECT policy
--
-- Problem: SELECT policy required crm_notes.org_id to match the parent
-- crm_records.org_id. Import / conversion / merges sometimes left
-- crm_notes.org_id stale, so notes existed in the DB but were hidden by RLS.
--
-- Fix:
--   1) Heal org_id for all notes where it differs from the parent record.
--   2) Replace SELECT policy so visibility follows the parent record’s org
--      (same rule of thumb as “can you open this record?”).
-- ============================================================================

BEGIN;

UPDATE public.crm_notes n
SET org_id = r.org_id
FROM public.crm_records r
WHERE n.record_id = r.id
  AND n.org_id IS DISTINCT FROM r.org_id;

DROP POLICY IF EXISTS "CRM members can view notes" ON public.crm_notes;

CREATE POLICY "CRM members can view notes"
  ON public.crm_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.crm_records r
      WHERE r.id = crm_notes.record_id
        AND public.is_crm_member(r.org_id)
    )
  );

COMMIT;

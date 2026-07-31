-- Prevent authenticated CRM users from attaching notes to records owned by a
-- different tenant. The previous INSERT policy checked only the tenant key on
-- crm_notes; note visibility is derived from crm_records, so a forged
-- record_id could inject content into another tenant's record.
--
-- Existing-data audit before this migration: zero crm_notes rows had a tenant
-- key different from their parent crm_records row. No backfill is required.
-- This policy is additive enforcement for future writes.
--
-- PROD WRITE RISK: YES when applied (RLS policy replacement; no row changes).
-- Application/deployment of this migration requires the production approval
-- gate. Committing this file does not apply it.

BEGIN;

SET LOCAL lock_timeout = '5s';

-- Freeze note writes while the invariant is checked and policies are replaced.
-- This does not block reads and fails quickly instead of waiting on live traffic.
LOCK TABLE public.crm_notes IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.crm_notes AS note
    JOIN public.crm_records AS record ON record.id = note.record_id
    WHERE note.organization_id IS DISTINCT FROM record.organization_id
  ) THEN
    RAISE EXCEPTION
      'crm_notes contains cross-tenant record references; remediate before enforcing the policy';
  END IF;
END
$$;

DROP POLICY IF EXISTS "CRM members can create notes" ON public.crm_notes;
DROP POLICY IF EXISTS "CRM note record tenant must match" ON public.crm_notes;

CREATE POLICY "CRM members can create notes"
ON public.crm_notes
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_crm_role(
    organization_id,
    ARRAY['crm_admin'::text, 'crm_manager'::text, 'crm_agent'::text]
  )
);

-- Restrictive policies are ANDed with every permissive INSERT policy. Keeping
-- the parent/tenant invariant separate prevents a future super-admin or other
-- permissive policy from accidentally bypassing it.
CREATE POLICY "CRM note record tenant must match"
ON public.crm_notes
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.crm_records AS parent
    WHERE parent.id = crm_notes.record_id
      AND parent.organization_id = crm_notes.organization_id
      AND parent.deleted_at IS NULL
  )
);

COMMIT;

-- Rollback:
-- BEGIN;
-- SET LOCAL lock_timeout = '5s';
-- DROP POLICY IF EXISTS "CRM note record tenant must match" ON public.crm_notes;
-- DROP POLICY IF EXISTS "CRM members can create notes" ON public.crm_notes;
-- CREATE POLICY "CRM members can create notes"
--   ON public.crm_notes
--   FOR INSERT
--   TO authenticated
--   WITH CHECK (
--     public.has_crm_role(
--       organization_id,
--       ARRAY['crm_admin'::text, 'crm_manager'::text, 'crm_agent'::text]
--     )
--   );
-- COMMIT;

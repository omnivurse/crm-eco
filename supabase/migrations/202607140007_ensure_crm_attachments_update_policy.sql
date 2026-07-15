-- Safety / idempotency guard for the CRM undo-delete Phase 2 rollout.
--
-- Phase 2 soft-deletes attachments via an UPDATE (set deleted_at), but
-- crm_attachments originally shipped with only DELETE / INSERT / SELECT policies
-- for `authenticated` — no UPDATE policy. Without one, the soft-delete UPDATE
-- silently matches 0 rows (RLS), so "delete attachment" becomes a no-op and
-- restore always 404s.
--
-- Migration 202607140005 adds this policy, but that migration may have been
-- pushed to prod during a window before the policy was included (the file was
-- edited after an early apply). An already-applied migration never re-runs, so
-- re-affirm the policy here idempotently — this is a harmless no-op if it already
-- exists, and repairs prod if it doesn't.

SET lock_timeout = '5s';

DO $$
BEGIN
  IF to_regclass('public.crm_attachments') IS NOT NULL THEN
    DROP POLICY IF EXISTS crm_attachments_update ON public.crm_attachments;
    CREATE POLICY crm_attachments_update ON public.crm_attachments
      FOR UPDATE TO authenticated
      USING (public.has_crm_role(organization_id, ARRAY['crm_admin'::text, 'crm_manager'::text]))
      WITH CHECK (public.has_crm_role(organization_id, ARRAY['crm_admin'::text, 'crm_manager'::text]));
  END IF;
END $$;

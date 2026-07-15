-- Phase 2 of the CRM undo-delete system: soft-delete for the record's child
-- entities — crm_tasks (a.k.a. Activities), crm_notes, notes (sticky notes),
-- and crm_attachments.
--
-- Same model as Phase 1 (202607140003): deleting sets deleted_at instead of a
-- physical DELETE, so the item is restorable via an Undo toast / Trash. Purely
-- additive (nullable columns + partial trash indexes) → inert until the app
-- starts calling the new soft-delete path. Soft-delete/restore for these
-- entities goes through their existing per-row RLS (owner/author/admin), so no
-- new RPCs are needed; the app writes deleted_at through the user client.

SET lock_timeout = '5s';

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['crm_tasks', 'crm_notes', 'notes', 'crm_attachments'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I
           ADD COLUMN IF NOT EXISTS deleted_at      timestamptz,
           ADD COLUMN IF NOT EXISTS deleted_by      uuid,
           ADD COLUMN IF NOT EXISTS delete_batch_id uuid,
           ADD COLUMN IF NOT EXISTS deleted_origin  text', t);
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (deleted_at) WHERE deleted_at IS NOT NULL',
        'idx_' || t || '_trash', t);
      EXECUTE format(
        'COMMENT ON COLUMN public.%I.deleted_at IS %L', t,
        'Soft-delete timestamp. NULL = live. Non-NULL = in Trash (hidden, restorable).');
    END IF;
  END LOOP;
END $$;

-- crm_attachments (unlike crm_tasks / crm_notes / notes) has NO UPDATE policy for
-- `authenticated` — only DELETE / INSERT / SELECT. A soft-delete is an UPDATE, so
-- without this policy it would silently match 0 rows (and restore would 404).
-- Mirror the existing DELETE policy so admins/managers can soft-delete AND restore
-- attachments.
DROP POLICY IF EXISTS crm_attachments_update ON public.crm_attachments;
CREATE POLICY crm_attachments_update ON public.crm_attachments
  FOR UPDATE TO authenticated
  USING (public.has_crm_role(organization_id, ARRAY['crm_admin'::text, 'crm_manager'::text]))
  WITH CHECK (public.has_crm_role(organization_id, ARRAY['crm_admin'::text, 'crm_manager'::text]));

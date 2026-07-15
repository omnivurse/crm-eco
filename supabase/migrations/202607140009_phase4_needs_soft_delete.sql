-- Phase 4 of the CRM undo-delete system: soft-delete for needs (Sharing
-- Requests) and need_attachments (member-uploaded medical documents).
--
-- The key new capability is member-facing: today a member CANNOT remove a
-- mistakenly-uploaded document at all. Phase 4 adds a soft-delete so a member
-- can remove a document and undo it, and staff no longer see removed docs.
--
-- Purely additive (nullable columns + partial trash indexes) → inert until the
-- app writes deleted_at. need_events stays append-only (unchanged). The storage
-- blob is kept on soft-delete and only removed on purge (retention cron, Phase 6).
--
-- NOTE: tightening the over-broad `need_att_org_all` FOR ALL RLS policy is
-- deliberately deferred — members soft-delete via UPDATE (governed by the same
-- policy that already lets them upload), so the feature works without it, and a
-- member-portal RLS change needs its own careful pass.

SET lock_timeout = '5s';

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['need_attachments', 'needs'] LOOP
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
        'Soft-delete timestamp. NULL = live. Non-NULL = removed/in Trash (hidden, restorable).');
    END IF;
  END LOOP;
END $$;

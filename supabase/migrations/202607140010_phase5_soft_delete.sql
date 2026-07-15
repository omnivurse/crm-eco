-- Phase 5 of the CRM undo-delete system: soft-delete columns for the member
-- domain — dependents, members, advisors, enrollments.
--
-- Purely additive (nullable columns + partial trash indexes) → inert until the
-- app writes deleted_at. The only exercised hard-delete being converted in this
-- phase is the member-facing dependent purge; members/advisors/enrollments get
-- the columns so the mirror-sync softening and future soft-delete paths have a
-- target, but nothing writes them yet.

SET lock_timeout = '5s';

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['dependents', 'members', 'advisors', 'enrollments'] LOOP
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

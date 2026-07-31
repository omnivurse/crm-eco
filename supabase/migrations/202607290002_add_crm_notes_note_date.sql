-- Adds an optional, user-facing "note date" to crm_notes.
--
-- Advisors log notes about a conversation that may have happened days earlier
-- (e.g. writing today about a call from last week). `created_at` is the
-- immutable system save-time and must not be overloaded, so this adds a
-- separate, nullable `note_date` the advisor can set/back-date. The app sorts
-- and displays by `note_date` when present and falls back to `created_at`
-- otherwise.
--
-- Purely additive + nullable -> inert until the app starts writing it. Existing
-- notes keep note_date = NULL and continue to sort/display by created_at, so no
-- backfill is required. Writing note_date goes through the existing per-row
-- crm_notes INSERT/UPDATE RLS (author/admin), so no new policy is needed.
--
-- Rollback:
--   DROP INDEX IF EXISTS public.idx_crm_notes_record_note_date;
--   ALTER TABLE public.crm_notes DROP COLUMN IF EXISTS note_date;

SET lock_timeout = '5s';

DO $$
BEGIN
  IF to_regclass('public.crm_notes') IS NOT NULL THEN
    ALTER TABLE public.crm_notes
      ADD COLUMN IF NOT EXISTS note_date date;

    COMMENT ON COLUMN public.crm_notes.note_date IS
      'Optional user-facing note date (the date the note is about). NULL = fall back to created_at for sort/display. Distinct from created_at, which is the immutable system save time.';
  END IF;
END $$;

-- Supports ordering a record's notes by their effective date.
CREATE INDEX IF NOT EXISTS idx_crm_notes_record_note_date
  ON public.crm_notes (record_id, note_date DESC);

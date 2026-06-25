-- Phase 0 / Enrollment Review: add 'pending_review' + 'more_info' review states (ADDITIVE, idempotent). [A3]
-- Project: sffisarikcreyyjzdjvb (PIF-ECO-V2 production)
-- Status: PROMOTED to supabase/migrations/ — applied in version order by `supabase db push` (additive + idempotent).
-- Risk: TIER-1 — step (1) replaces the enrollments_status_check CHECK constraint (DROP IF EXISTS +
--        ADD). It is a *text* CHECK array (NOT a Postgres enum), so this is a metadata-only
--        constraint swap: NO type rewrite, NO data migration, and the new array is a strict
--        SUPERSET of the old (every existing row still validates). Still Tier-1 because a CHECK
--        change can fail the ADD if any pre-existing row violates it — rehearse + dry-run first.
--        Steps (2)-(4) are pure additive (IF NOT EXISTS columns, CREATE OR REPLACE preserving
--        every existing arm, CREATE INDEX IF NOT EXISTS).
-- SAFETY: this migration only widens the *allowed* status vocabulary and stamps timestamps on
--        entry to the two new review states. It does NOT auto-transition any enrollment and does
--        NOT fire approvals — manual EnrollmentActions remain the only way a row reaches these
--        states. No money/state auto-fire here.
-- Rehearsal / dry-run: confirm zero violating rows before ADD CONSTRAINT, e.g.
--        SELECT status, count(*) FROM public.enrollments
--          WHERE status NOT IN ('draft','in_progress','submitted','approved','rejected',
--                               'cancelled','active','inactive','on_hold',
--                               'pending_review','more_info')
--          GROUP BY status;   -- must return 0 rows.
-- Refs: baseline CREATE TABLE public.enrollments L23235; enrollments_status_check L23385
--        (current allowed: draft,in_progress,submitted,approved,rejected,cancelled,active,
--         inactive,on_hold); update_enrollment_status_change() body L21706-21739
--        (BEFORE UPDATE trigger trg_enrollment_status_change L60447, guards OLD<>NEW.status,
--         stamps last_status_change_at + per-status *_at via CASE); profiles FK idiom for
--        enrollments reviewer cols (approved_by L67297 / created_by L67313 /
--        last_modified_by L67329 all REFERENCES public.profiles(id) ON DELETE SET NULL);
--        partial-status index idiom L44949 idx_approval_blocks_status.
-- NOTE: no explicit BEGIN/COMMIT — the Supabase migration runner wraps each file in one
--        transaction (matches existing phase-0 drafts which use only SET lock_timeout).

SET lock_timeout = '5s';

-- (1) EXTEND the status CHECK to add the two review states. text CHECK array (no enum / no rewrite).
--     DROP IF EXISTS + ADD makes this idempotent and the new array is a superset of the old.
ALTER TABLE public.enrollments DROP CONSTRAINT IF EXISTS enrollments_status_check;
ALTER TABLE public.enrollments
  ADD CONSTRAINT enrollments_status_check
  CHECK ((status = ANY (ARRAY[
    'draft'::text,
    'in_progress'::text,
    'submitted'::text,
    'approved'::text,
    'rejected'::text,
    'cancelled'::text,
    'active'::text,
    'inactive'::text,
    'on_hold'::text,
    'pending_review'::text,
    'more_info'::text
  ])));

-- (2) ADD review/triage columns (nullable, additive). assigned_reviewer_id mirrors the existing
--     enrollments->profiles FK idiom (approved_by / created_by / last_modified_by).
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS assigned_reviewer_id      uuid;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS sla_due_at                timestamp with time zone;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS priority                  text;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS pending_review_at         timestamp with time zone;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS more_info_requested_at    timestamp with time zone;

-- (2a) FK for assigned_reviewer_id -> profiles, matching the house idiom (ON DELETE SET NULL).
--      Guarded so re-running is idempotent (ADD CONSTRAINT has no IF NOT EXISTS in this PG line).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'enrollments_assigned_reviewer_id_fkey'
      AND conrelid = 'public.enrollments'::regclass
  ) THEN
    ALTER TABLE public.enrollments
      ADD CONSTRAINT enrollments_assigned_reviewer_id_fkey
      FOREIGN KEY (assigned_reviewer_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END
$$;

-- (3) EXTEND the status-change trigger to stamp the two new review timestamps on entry.
--     CREATE OR REPLACE preserves EVERY existing arm verbatim (submitted/approved/rejected/
--     cancelled) — only two WHEN branches are added. Idempotent stamping (only when *_at IS NULL)
--     matches the existing arms so re-entering a state never clobbers the first-entry timestamp.
CREATE OR REPLACE FUNCTION public.update_enrollment_status_change() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.last_status_change_at := now();

    -- Auto-populate workflow timestamps based on status
    CASE NEW.status
      WHEN 'submitted' THEN
        IF NEW.submitted_at IS NULL THEN
          NEW.submitted_at := now();
        END IF;
      WHEN 'approved' THEN
        IF NEW.approved_at IS NULL THEN
          NEW.approved_at := now();
        END IF;
      WHEN 'rejected' THEN
        IF NEW.rejected_at IS NULL THEN
          NEW.rejected_at := now();
        END IF;
      WHEN 'cancelled' THEN
        IF NEW.cancelled_at IS NULL THEN
          NEW.cancelled_at := now();
        END IF;
      WHEN 'pending_review' THEN
        IF NEW.pending_review_at IS NULL THEN
          NEW.pending_review_at := now();
        END IF;
      WHEN 'more_info' THEN
        IF NEW.more_info_requested_at IS NULL THEN
          NEW.more_info_requested_at := now();
        END IF;
      ELSE
        -- No action for other statuses
    END CASE;
  END IF;

  RETURN NEW;
END;
$$;

-- (4) PARTIAL INDEX for the review queue: open review states ordered by SLA due time.
--     Matches the partial-status index idiom (idx_approval_blocks_status). Keeps the index
--     small (only rows currently awaiting review) for the admin review-queue / SLA sort.
CREATE INDEX IF NOT EXISTS idx_enrollments_review_sla
  ON public.enrollments USING btree (status, sla_due_at)
  WHERE (status = ANY (ARRAY['pending_review'::text, 'more_info'::text]));

-- (4a) Covering index for the new reviewer FK (matches the FK covering-index house idiom).
CREATE INDEX IF NOT EXISTS idx_enrollments_assigned_reviewer_id_fkey
  ON public.enrollments USING btree (assigned_reviewer_id);

NOTIFY pgrst, 'reload schema';

-- Rollback (A3):
--   -- Restore the trigger to its baseline body (drops the two new WHEN arms):
--   --   re-apply the original update_enrollment_status_change() from baseline L21706-21739.
--   DROP INDEX IF EXISTS public.idx_enrollments_review_sla;
--   DROP INDEX IF EXISTS public.idx_enrollments_assigned_reviewer_id_fkey;
--   ALTER TABLE public.enrollments DROP CONSTRAINT IF EXISTS enrollments_assigned_reviewer_id_fkey;
--   -- Restore the original (narrower) status CHECK. Only safe once NO row is in a new state:
--   ALTER TABLE public.enrollments DROP CONSTRAINT IF EXISTS enrollments_status_check;
--   ALTER TABLE public.enrollments
--     ADD CONSTRAINT enrollments_status_check
--     CHECK ((status = ANY (ARRAY['draft'::text,'in_progress'::text,'submitted'::text,
--       'approved'::text,'rejected'::text,'cancelled'::text,'active'::text,'inactive'::text,
--       'on_hold'::text])));
--   -- columns (assigned_reviewer_id / sla_due_at / priority / pending_review_at /
--   -- more_info_requested_at) intentionally NOT dropped on rollback (non-destructive: nullable
--   -- unused columns are safe; dropping could lose triage data). Drop only on explicit approval.

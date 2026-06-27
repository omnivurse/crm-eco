-- Phase A — member-domain referential-integrity hygiene.
--
-- Verified against LIVE prod (sffisarikcreyyjzdjvb) on 2026-06-26 before writing:
--   * default_payment_profile_id / primary_enrollment_id: 0 non-null orphans
--     (FKs validate instantly; near-empty transactional data).
--   * billing_schedules: 0 rows, but carries a DUPLICATE enrollment_id FK
--     (billing_schedules_enrollment_id_fkey = CASCADE  +  fk_billing_schedules_enrollment = SET NULL),
--     an ambiguous delete behaviour. Keep CASCADE (a schedule without its
--     enrollment is meaningless), drop the SET NULL duplicate.
--   * members.merged_into_id already has a self-FK (ON DELETE SET NULL) — left as-is.
--     Merge therefore uses status='inactive' + merged_into_id; no new status enum.
--
-- Fully additive / reversible. No data is modified. Rehearsed in a rolled-back
-- prod transaction prior to apply.

-- 1) Remove the duplicate billing_schedules -> enrollments FK, keeping CASCADE.
ALTER TABLE public.billing_schedules
  DROP CONSTRAINT IF EXISTS fk_billing_schedules_enrollment;

-- 2) members.default_payment_profile_id -> payment_profiles(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.members'::regclass
      AND conname  = 'members_default_payment_profile_id_fkey'
  ) THEN
    ALTER TABLE public.members
      ADD CONSTRAINT members_default_payment_profile_id_fkey
      FOREIGN KEY (default_payment_profile_id)
      REFERENCES public.payment_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3) members.primary_enrollment_id -> enrollments(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.members'::regclass
      AND conname  = 'members_primary_enrollment_id_fkey'
  ) THEN
    ALTER TABLE public.members
      ADD CONSTRAINT members_primary_enrollment_id_fkey
      FOREIGN KEY (primary_enrollment_id)
      REFERENCES public.enrollments(id) ON DELETE SET NULL;
  END IF;
END $$;

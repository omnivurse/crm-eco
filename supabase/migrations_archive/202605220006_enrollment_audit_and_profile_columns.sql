-- ============================================================================
-- Migration: 202605220006_enrollment_audit_and_profile_columns
-- Purpose:   Add the two remaining missing columns on `enrollments` that
--            real production code already writes to (and was silently
--            failing — PGRST204).
--
--            Adds:
--              enrollments.payment_profile_id  uuid REFERENCES payment_profiles(id) ON DELETE SET NULL
--                — written by apps/crm/src/app/crm/enrollment/actions.ts after
--                  Authorize.Net payment-profile creation so future billing
--                  knows which profile to charge.
--              enrollments.created_by          uuid REFERENCES profiles(id) ON DELETE SET NULL
--                — written by apps/crm/src/lib/automation/actions.ts when an
--                  enrollment draft is auto-created by a workflow rule.
--
--            100% additive — no DROP, no rename, no destructive ALTER.
--
-- Audit refs (.audit/findings.json):
--   - "enrollments.payment_profile_id referenced in code but column does not exist"
--   - "enrollments.created_by referenced in code but column does not exist"
--
-- Rollback (rarely needed):
--   BEGIN;
--     ALTER TABLE enrollments DROP COLUMN IF EXISTS payment_profile_id;
--     ALTER TABLE enrollments DROP COLUMN IF EXISTS created_by;
--   COMMIT;
-- ============================================================================

BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'enrollments'
      AND column_name = 'payment_profile_id'
  ) THEN
    ALTER TABLE public.enrollments
      ADD COLUMN payment_profile_id uuid REFERENCES public.payment_profiles(id) ON DELETE SET NULL;
    COMMENT ON COLUMN public.enrollments.payment_profile_id IS
      'Authorize.Net payment profile selected at enrollment time. Future billing uses this to charge.';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'enrollments'
      AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.enrollments
      ADD COLUMN created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
    COMMENT ON COLUMN public.enrollments.created_by IS
      'Profile that created the enrollment. Nullable so portal/website self-serve enrollments without an authenticated CRM user still work.';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS enrollments_payment_profile_id_idx
  ON public.enrollments (payment_profile_id)
  WHERE payment_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS enrollments_created_by_idx
  ON public.enrollments (created_by)
  WHERE created_by IS NOT NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;

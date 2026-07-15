-- Dependents.gender: tighten the CHECK constraint to Male / Female only.
--
-- Companion to 202607140015 (which narrowed the CRM Gender picklist). The
-- member-portal `dependents` table's CHECK still allowed 'Other'. This is a
-- health system: Gender records biological sex for medical / actuarial /
-- eligibility purposes, and the dependents UI already offers only Male/Female —
-- so the DB constraint should match.
--
-- Added NOT VALID so the migration is deploy-safe regardless of existing data:
-- any historical row already storing 'Other' is grandfathered (we never guess a
-- person's sex). New and updated rows must be Male or Female. NULL stays allowed
-- (a CHECK passes when its expression is NULL), matching the column's
-- nullability and the "no gender selected yet" state. Legacy 'Other' rows should
-- be corrected to Male/Female by a human on review; the dependents edit form
-- now blanks any non-Male/Female value so an edit can't re-submit 'Other'.
--
-- Idempotent: drops the prior constraint by name first, then re-adds. Guarded so
-- it no-ops on envs where the table hasn't been created.

SET lock_timeout = '5s';

DO $$
BEGIN
  IF to_regclass('public.dependents') IS NULL THEN
    RAISE NOTICE 'dependents table absent — skipping gender constraint tighten';
    RETURN;
  END IF;

  ALTER TABLE public.dependents DROP CONSTRAINT IF EXISTS dependents_gender_check;

  ALTER TABLE public.dependents
    ADD CONSTRAINT dependents_gender_check
    CHECK (gender = ANY (ARRAY['Male'::text, 'Female'::text])) NOT VALID;

  RAISE NOTICE 'dependents_gender_check tightened to Male/Female (NOT VALID; legacy rows grandfathered)';
END $$;

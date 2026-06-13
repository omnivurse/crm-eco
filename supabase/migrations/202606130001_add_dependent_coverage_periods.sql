-- Add dependent_coverage_periods table for tracking add/remove dates of family members
-- on a membership, with support for back-dating historical logs (school, summer work, etc).
--
-- This is additive. The existing `dependents.included_in_enrollment` flag and
-- `enrollment_dependents` (per-enrollment snapshot with its own coverage_start/end)
-- remain for backward compatibility and enrollment-time modeling.
--
-- Current coverage for a dependent is derived from the existence of a row where
-- effective_from <= current_date AND (effective_to IS NULL OR effective_to >= current_date).
--
-- RLS mirrors dependents: org isolation + role-based admin/advisor + member self-management
-- for their own member's periods.

BEGIN;

-- Table -----------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'dependent_coverage_periods'
  ) THEN
    CREATE TABLE public.dependent_coverage_periods (
      id uuid DEFAULT gen_random_uuid() NOT NULL,
      organization_id uuid NOT NULL,
      member_id uuid NOT NULL,
      dependent_id uuid NOT NULL,
      effective_from date NOT NULL,
      effective_to date,
      reason text,
      notes text,
      source text DEFAULT 'portal'::text,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      created_by uuid,
      updated_at timestamp with time zone DEFAULT now() NOT NULL,

      CONSTRAINT dependent_coverage_periods_pkey PRIMARY KEY (id),

      -- Basic sanity: if both dates present, from <= to
      CONSTRAINT dependent_coverage_periods_dates_check
        CHECK (effective_to IS NULL OR effective_from <= effective_to),

      -- Reasonable source values (extend as needed)
      CONSTRAINT dependent_coverage_periods_source_check
        CHECK (source = ANY (ARRAY['portal','crm','admin','import','system','migration']::text[]))
    );

    COMMENT ON TABLE public.dependent_coverage_periods IS
      'Historical and current coverage periods for dependents on a membership. '
      'Supports add/remove with explicit dates and back-dating for school/summer/etc scenarios. '
      'One dependent can have multiple non-overlapping (or adjacent) periods over time.';

    COMMENT ON COLUMN public.dependent_coverage_periods.effective_from IS
      'Date the family member was added to (or resumed) coverage. Supports past dates for corrections/logs.';
    COMMENT ON COLUMN public.dependent_coverage_periods.effective_to IS
      'Date the family member was removed from coverage (null = still covered / open-ended). Supports past dates for back-dating.';
    COMMENT ON COLUMN public.dependent_coverage_periods.reason IS
      'Structured reason e.g. initial_enrollment, school_break, summer_employment, age_out, marriage, divorce, other.';
    COMMENT ON COLUMN public.dependent_coverage_periods.source IS
      'Originating system/action for auditability.';
  END IF;
END $$;

-- FKs (guarded) ----------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'dependent_coverage_periods_dependent_id_fkey'
  ) THEN
    ALTER TABLE public.dependent_coverage_periods
      ADD CONSTRAINT dependent_coverage_periods_dependent_id_fkey
      FOREIGN KEY (dependent_id) REFERENCES public.dependents(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'dependent_coverage_periods_member_id_fkey'
  ) THEN
    ALTER TABLE public.dependent_coverage_periods
      ADD CONSTRAINT dependent_coverage_periods_member_id_fkey
      FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'dependent_coverage_periods_organization_id_fkey'
  ) THEN
    ALTER TABLE public.dependent_coverage_periods
      ADD CONSTRAINT dependent_coverage_periods_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'dependent_coverage_periods_created_by_fkey'
  ) THEN
    ALTER TABLE public.dependent_coverage_periods
      ADD CONSTRAINT dependent_coverage_periods_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes ----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_dependent_coverage_periods_dependent
  ON public.dependent_coverage_periods USING btree (dependent_id);

CREATE INDEX IF NOT EXISTS idx_dependent_coverage_periods_member
  ON public.dependent_coverage_periods USING btree (member_id);

CREATE INDEX IF NOT EXISTS idx_dependent_coverage_periods_org
  ON public.dependent_coverage_periods USING btree (organization_id);

CREATE INDEX IF NOT EXISTS idx_dependent_coverage_periods_dates
  ON public.dependent_coverage_periods USING btree (effective_from, effective_to);

CREATE INDEX IF NOT EXISTS idx_dependent_coverage_periods_created
  ON public.dependent_coverage_periods USING btree (created_at DESC);

-- RLS --------------------------------------------------------------------------
ALTER TABLE public.dependent_coverage_periods ENABLE ROW LEVEL SECURITY;

-- Drop + recreate policies to keep migration re-runnable / additive
DROP POLICY IF EXISTS "Super admins can manage all dependent coverage periods" ON public.dependent_coverage_periods;
CREATE POLICY "Super admins can manage all dependent coverage periods"
  ON public.dependent_coverage_periods
  TO authenticated
  USING (public.is_super_admin() = true)
  WITH CHECK (public.is_super_admin() = true);

DROP POLICY IF EXISTS "Admins can manage dependent coverage periods in their org" ON public.dependent_coverage_periods;
CREATE POLICY "Admins can manage dependent coverage periods in their org"
  ON public.dependent_coverage_periods
  TO authenticated
  USING (
    (organization_id = public.get_user_organization_id())
    AND (public.get_user_role() = ANY (ARRAY['owner','admin','staff']::text[]))
  )
  WITH CHECK (
    (organization_id = public.get_user_organization_id())
    AND (public.get_user_role() = ANY (ARRAY['owner','admin','staff']::text[]))
  );

DROP POLICY IF EXISTS "Advisors can view their members dependent coverage periods" ON public.dependent_coverage_periods;
CREATE POLICY "Advisors can view their members dependent coverage periods"
  ON public.dependent_coverage_periods
  FOR SELECT
  TO authenticated
  USING (
    (organization_id = public.get_user_organization_id())
    AND (public.get_user_role() = 'advisor'::text)
    AND (member_id IN (
      SELECT m.id FROM public.members m
      WHERE m.advisor_id = public.get_user_advisor_id()
    ))
  );

DROP POLICY IF EXISTS "Users can view dependent coverage periods in their org" ON public.dependent_coverage_periods;
CREATE POLICY "Users can view dependent coverage periods in their org"
  ON public.dependent_coverage_periods
  FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_organization_id());

-- Explicit self-service for the owning member (portal users)
-- A logged-in member (via profiles.user_id = auth.uid() having a member_id) can
-- fully manage periods for dependents that belong to *their* member_id.
DROP POLICY IF EXISTS "Members can manage periods for their own dependents" ON public.dependent_coverage_periods;
CREATE POLICY "Members can manage periods for their own dependents"
  ON public.dependent_coverage_periods
  TO authenticated
  USING (
    member_id = (
      SELECT p.member_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
      LIMIT 1
    )
    AND organization_id = public.get_user_organization_id()
  )
  WITH CHECK (
    member_id = (
      SELECT p.member_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
      LIMIT 1
    )
    AND organization_id = public.get_user_organization_id()
  );

-- Service role (edge functions, imports, etc.)
DROP POLICY IF EXISTS service_role_all_dependent_coverage_periods ON public.dependent_coverage_periods;
CREATE POLICY service_role_all_dependent_coverage_periods
  ON public.dependent_coverage_periods
  TO service_role
  USING (true)
  WITH CHECK (true);

-- updated_at trigger (reuse existing if present) --------------------------------
-- Many tables use a shared update_updated_at_column() trigger.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_dependent_coverage_periods'
  ) THEN
    CREATE TRIGGER set_updated_at_dependent_coverage_periods
      BEFORE UPDATE ON public.dependent_coverage_periods
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

COMMIT;
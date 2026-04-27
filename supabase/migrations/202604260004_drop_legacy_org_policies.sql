-- ============================================================================
-- Drop legacy single-tenant RLS policies that leak across tenants.
--
-- Before this migration `public.organizations` had ten PERMISSIVE policies.
-- Five were single-tenant artefacts that combined under OR with the new
-- multi-tenant policies, creating real cross-tenant data leaks:
--
--   • "Admins can manage organizations"  USING is_admin()
--       → any admin in any org could SELECT/UPDATE/DELETE every org.
--   • "Staff can read organizations"     USING is_staff_or_admin()
--       → any staff member read every org.
--   • "Owners can update their organization"
--       → superseded by organizations_update_owner_admin (multi-tenant).
--   • "Users can view their organization"
--       → superseded by organizations_select_member (multi-tenant).
--   • "Super admins can view all organizations"
--       → kept; intentional global escape hatch for HQ ops.
--
-- Same deal on `public.profiles`:
--   • "Users can view profiles in their organization" used the single-tenant
--     `get_user_organization_id()` helper. Replaced with a SET lookup against
--     `user_organization_ids()` so members of multiple orgs see colleagues
--     across all their tenants — but never outside.
--
-- The new policies were added in 202604260001 / 202604260002 and use the
-- SECURITY DEFINER helpers `public.user_role_in(org_id)` and
-- `public.user_organization_ids()` which join through `organization_members`.
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. organizations: drop legacy permissive policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage organizations"          ON public.organizations;
DROP POLICY IF EXISTS "Owners can update their organization"     ON public.organizations;
DROP POLICY IF EXISTS "Staff can read organizations"             ON public.organizations;
DROP POLICY IF EXISTS "Users can view their organization"        ON public.organizations;

-- Keep the global super-admin policy (`Super admins can view all organizations`)
-- and the service_role bypass (`service_role_all_organizations`) — both are
-- intentional and tenant-safe.

-- ----------------------------------------------------------------------------
-- 2. profiles: replace single-tenant SELECT with multi-tenant version
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;

-- A user can see profiles for any org they actively belong to.
-- `user_organization_ids()` already filters by `is_active = true`.
CREATE POLICY profiles_select_org_members ON public.profiles
  FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ----------------------------------------------------------------------------
-- 3. Final state assertion (raises NOTICE so the push log shows it)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_orgs_count int;
  v_prof_count int;
BEGIN
  SELECT count(*) INTO v_orgs_count
  FROM pg_policies
  WHERE schemaname='public' AND tablename='organizations';

  SELECT count(*) INTO v_prof_count
  FROM pg_policies
  WHERE schemaname='public' AND tablename='profiles';

  RAISE NOTICE 'organizations RLS policies after cleanup: %', v_orgs_count;
  RAISE NOTICE 'profiles RLS policies after cleanup:      %', v_prof_count;
END $$;

NOTIFY pgrst, 'reload schema';

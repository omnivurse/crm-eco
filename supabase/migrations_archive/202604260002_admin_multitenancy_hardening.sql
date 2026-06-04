-- ============================================================================
-- Admin Multi-Tenancy — Hardening Pass
--
-- Closes RLS gaps in 202604260001 surfaced by frontend audit:
--
--   1. switchTenant() server action calls UPDATE on organization_members.
--      Without an UPDATE policy the call silently no-ops (returns 0 rows,
--      no error). Add: members can update their own row; admins can update
--      any row in their org.
--
--   2. organization_members had no DELETE policy. Owners/admins must be
--      able to revoke a membership.
--
--   3. organizations had only SELECT + UPDATE policies. Owners must be able
--      to INSERT new tenants (signup / self-serve onboarding) and archive
--      (DELETE) existing ones. Service role bypasses RLS as before.
--
--   4. The `my_organizations` view ran as SECURITY DEFINER (Postgres ≥ 15
--      default). Switch to `security_invoker = on` so callers' RLS still
--      applies — defence in depth on top of the explicit user_id filter.
--
--   5. Add an UPDATE trigger on organization_members so updated_at always
--      reflects the last write (last_active_at, role changes, etc.).
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. organization_members: UPDATE / DELETE policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS org_members_update_self            ON public.organization_members;
DROP POLICY IF EXISTS org_members_update_admin           ON public.organization_members;
DROP POLICY IF EXISTS org_members_delete_admin           ON public.organization_members;

-- A user may update their own membership row (e.g. last_active_at, is_default).
-- Column-level immutability for `role`, `is_active`, `organization_id`,
-- `user_id` is enforced by the BEFORE UPDATE trigger below — RLS handles
-- row visibility, the trigger handles privilege escalation defence.
CREATE POLICY org_members_update_self ON public.organization_members
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins / owners can update any membership in their org (assign role,
-- toggle is_active, change is_default).
CREATE POLICY org_members_update_admin ON public.organization_members
  FOR UPDATE
  USING (public.user_role_in(organization_id) IN ('owner', 'super_admin', 'admin'))
  WITH CHECK (public.user_role_in(organization_id) IN ('owner', 'super_admin', 'admin'));

-- Only owners / super_admins can revoke memberships (defence: admins
-- cannot kick owners). Service role bypasses RLS.
CREATE POLICY org_members_delete_admin ON public.organization_members
  FOR DELETE
  USING (
    public.user_role_in(organization_id) IN ('owner', 'super_admin')
    -- An owner cannot be removed by a non-owner
    AND (role <> 'owner' OR public.user_role_in(organization_id) = 'owner')
  );

-- ----------------------------------------------------------------------------
-- 2. organizations: INSERT / DELETE policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS organizations_insert_authenticated ON public.organizations;
DROP POLICY IF EXISTS organizations_delete_owner         ON public.organizations;

-- Any authenticated user may create a tenant. The created row must list
-- them as the owner (defence: prevents impersonating another user).
CREATE POLICY organizations_insert_authenticated ON public.organizations
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (owner_user_id IS NULL OR owner_user_id = auth.uid())
  );

-- Only the owner / super_admin of a tenant can delete it. Recommend a
-- soft-delete via status = 'archived' in app code; this enforces the hard
-- path for completeness.
CREATE POLICY organizations_delete_owner ON public.organizations
  FOR DELETE
  USING (public.user_role_in(id) IN ('owner', 'super_admin'));

-- ----------------------------------------------------------------------------
-- 3. my_organizations view: switch to SECURITY INVOKER
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.my_organizations;

CREATE VIEW public.my_organizations
  WITH (security_invoker = on) AS
SELECT
  o.id,
  o.name,
  o.slug,
  o.subdomain,
  o.domain,
  o.plan,
  o.status,
  o.branding,
  m.role,
  m.is_default,
  m.last_active_at
FROM public.organization_members m
JOIN public.organizations o ON o.id = m.organization_id
WHERE m.user_id = auth.uid()
  AND m.is_active = true
  AND o.status = 'active';

GRANT SELECT ON public.my_organizations TO authenticated;

COMMENT ON VIEW public.my_organizations IS
  'Organizations the current auth user actively belongs to. Powers OrganizationSwitcher. SECURITY INVOKER — RLS on organization_members and organizations applies.';

-- ----------------------------------------------------------------------------
-- 4. organization_members: privilege-escalation guard + updated_at touch
-- ----------------------------------------------------------------------------
-- Combined trigger:
--   • Always refresh updated_at.
--   • If the caller is the row's own user (self-update) AND not also an
--     org admin, lock the privileged columns so they can't escalate
--     (role, is_active, organization_id, user_id, invited_by).
CREATE OR REPLACE FUNCTION public._guard_org_members_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  is_self  boolean;
  is_admin boolean;
BEGIN
  NEW.updated_at := now();

  -- Only run guards for end-user calls; service role / SECURITY DEFINER
  -- callers (e.g. provisioning RPCs) skip this check via SET LOCAL ROLE
  -- or by setting auth.uid() = NULL.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  is_self  := (OLD.user_id = auth.uid());
  is_admin := (public.user_role_in(OLD.organization_id) IN ('owner', 'super_admin', 'admin'));

  IF is_self AND NOT is_admin THEN
    IF NEW.role            <> OLD.role            THEN RAISE EXCEPTION 'cannot change role on own membership'           USING ERRCODE='42501'; END IF;
    IF NEW.is_active       <> OLD.is_active       THEN RAISE EXCEPTION 'cannot change is_active on own membership'      USING ERRCODE='42501'; END IF;
    IF NEW.organization_id <> OLD.organization_id THEN RAISE EXCEPTION 'cannot change organization_id'                  USING ERRCODE='42501'; END IF;
    IF NEW.user_id         <> OLD.user_id         THEN RAISE EXCEPTION 'cannot change user_id'                          USING ERRCODE='42501'; END IF;
    IF NEW.invited_by IS DISTINCT FROM OLD.invited_by THEN RAISE EXCEPTION 'cannot change invited_by'                   USING ERRCODE='42501'; END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS org_members_guard_update ON public.organization_members;
CREATE TRIGGER org_members_guard_update
  BEFORE UPDATE ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public._guard_org_members_update();

NOTIFY pgrst, 'reload schema';

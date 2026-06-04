-- Make the CRM RLS helpers (is_crm_member, has_crm_role) honor
-- organization_members in addition to profiles, unlocking multi-org tenant
-- switching for the CRM. Without this change, switching the active org at the
-- application layer has no effect — RLS keeps rejecting reads/writes to any
-- org that isn't profiles.organization_id.
--
-- Behavior:
--   1. Super admins: still short-circuit to true (preserves current behavior).
--   2. Legacy profile path: original predicates kept verbatim, so any user
--      whose profile.organization_id matches still passes. No regression risk.
--   3. New membership path: a user with an active organization_members row
--      for the org is granted membership; admin-tier roles (owner/super_admin/
--      admin) satisfy any CRM role check, staff satisfies crm_agent/crm_viewer,
--      read_only satisfies crm_viewer.
--
-- The membership backfill from 202604260001_admin_multitenancy_foundation.sql
-- copied every existing profile into organization_members, so this is purely
-- additive — no existing user loses access.

CREATE OR REPLACE FUNCTION has_crm_role(p_org_id uuid, p_roles text[])
RETURNS boolean AS $$
DECLARE
  v_is_super boolean;
BEGIN
  -- 1. Super admin short-circuit (unchanged).
  SELECT is_super_admin INTO v_is_super
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_is_super = true THEN
    RETURN true;
  END IF;

  -- 2. Legacy profile path (unchanged).
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
      AND organization_id = p_org_id
      AND crm_role = ANY(p_roles)
  ) THEN
    RETURN true;
  END IF;

  -- 3. organization_members path with membership-role to crm-role mapping.
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid()
      AND organization_id = p_org_id
      AND is_active = true
      AND (
        role IN ('owner', 'super_admin', 'admin')
        OR (role = 'staff' AND ('crm_agent' = ANY(p_roles) OR 'crm_viewer' = ANY(p_roles)))
        OR (role = 'read_only' AND 'crm_viewer' = ANY(p_roles))
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION has_crm_role(uuid, text[]) TO authenticated;


CREATE OR REPLACE FUNCTION is_crm_member(p_org_id uuid)
RETURNS boolean AS $$
DECLARE
  v_is_super boolean;
BEGIN
  -- 1. Super admin short-circuit (unchanged).
  SELECT is_super_admin INTO v_is_super
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_is_super = true THEN
    RETURN true;
  END IF;

  -- 2. Legacy profile path (unchanged).
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
      AND organization_id = p_org_id
      AND crm_role IS NOT NULL
  ) THEN
    RETURN true;
  END IF;

  -- 3. organization_members path — any active member of the org.
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid()
      AND organization_id = p_org_id
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION is_crm_member(uuid) TO authenticated;

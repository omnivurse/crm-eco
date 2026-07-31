-- Backfilled from the production migration ledger.
-- This migration was applied directly to production on 2026-07-26 17:47:44 UTC
-- (outside the repo) and was missing from version control. The SQL below is
-- reproduced verbatim from supabase_migrations.schema_migrations so that a
-- rebuild from migrations reproduces production. Already recorded as applied
-- in production -- it will not re-run there.

-- Candidate 3: Org-scoped permission gate
SET lock_timeout = '5s';

INSERT INTO public.crm_permissions (key, name, description, module, category, is_system)
VALUES
  ('payables.read', 'View payables', 'View payables list and detail', 'payables', 'admin', true),
  ('payables.create', 'Create payables', 'Create new payable records', 'payables', 'admin', true),
  ('payables.approve', 'Approve payables', 'Approve pending payables', 'payables', 'admin', true),
  ('payables.pay', 'Mark payables paid', 'Mark approved payables as paid', 'payables', 'admin', true)
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  module = EXCLUDED.module,
  category = EXCLUDED.category,
  is_system = EXCLUDED.is_system;

CREATE OR REPLACE FUNCTION public._org_role_implies_permission(
  p_org_id uuid,
  p_permission_key text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT m.role INTO v_role
  FROM public.organization_members m
  WHERE m.organization_id = p_org_id
    AND m.user_id = auth.uid()
    AND m.is_active = true
  LIMIT 1;

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  IF v_role IN ('owner', 'super_admin', 'admin') THEN
    RETURN true;
  END IF;

  IF v_role = 'staff' THEN
    RETURN p_permission_key IN ('payables.read', 'payables.create');
  END IF;

  IF v_role = 'read_only' THEN
    RETURN p_permission_key = 'payables.read';
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public._org_role_implies_permission(uuid, text) IS
  'Legacy bridge: map organization_members.role to permission keys until crm_user_roles coverage is complete. Removable per ADR 0002.';

CREATE OR REPLACE FUNCTION public.has_org_permission(
  p_org_id uuid,
  p_permission_key text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super boolean;
BEGIN
  IF auth.uid() IS NULL OR p_org_id IS NULL OR p_permission_key IS NULL THEN
    RETURN false;
  END IF;

  SELECT COALESCE(is_super_admin, false) INTO v_is_super
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_is_super THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.crm_user_roles ur
    JOIN public.crm_roles r ON r.id = ur.role_id
    JOIN public.crm_role_permissions rp ON rp.role_id = r.id
    JOIN public.crm_permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
      AND p.key = p_permission_key
      AND (r.organization_id IS NULL OR r.organization_id = p_org_id)
  ) THEN
    RETURN true;
  END IF;

  RETURN public._org_role_implies_permission(p_org_id, p_permission_key);
END;
$$;

COMMENT ON FUNCTION public.has_org_permission(uuid, text) IS
  'Org-scoped permission check for the current auth.uid(). Prefer this over has_crm_permission for multi-tenant gates.';

CREATE OR REPLACE FUNCTION public.list_org_permissions(p_org_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT p.key
      FROM public.crm_permissions p
      WHERE public.has_org_permission(p_org_id, p.key)
      ORDER BY p.key
    ),
    ARRAY[]::text[]
  );
$$;

COMMENT ON FUNCTION public.list_org_permissions(uuid) IS
  'Returns all crm_permissions.keys the current user holds in the given org.';

REVOKE ALL ON FUNCTION public._org_role_implies_permission(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_org_permission(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_org_permissions(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_org_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_org_permissions(uuid) TO authenticated;

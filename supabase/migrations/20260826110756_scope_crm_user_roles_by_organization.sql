-- Scope catalog-role assignments to the organization that granted them.
--
-- Root cause:
--   crm_roles rows with organization_id IS NULL are global templates, but
--   crm_user_roles previously had no tenant key. An assignment to a template
--   was therefore either rejected by RLS (the current production behavior) or,
--   if inserted with service_role, treated by has_org_permission as valid for
--   every organization.
--
-- Production discovery on 2026-08-26:
--   - 5 global role templates, 0 organization roles
--   - 0 crm_user_roles rows
--   - authenticated write policies reject global-template assignments
--
-- Add the tenant key to the assignment junction, make uniqueness tenant-aware,
-- and require active membership before a catalog grant can authorize access.
-- Existing assignments to organization-owned roles can be backfilled exactly.
-- A pre-existing global-template assignment is ambiguous, so the migration
-- aborts rather than guessing a tenant and silently granting the wrong access.

SET lock_timeout = '5s';

ALTER TABLE public.crm_user_roles
  ADD COLUMN IF NOT EXISTS organization_id uuid;

UPDATE public.crm_user_roles AS ur
SET organization_id = r.organization_id
FROM public.crm_roles AS r
WHERE ur.organization_id IS NULL
  AND r.id = ur.role_id
  AND r.organization_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.crm_user_roles
    WHERE organization_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot scope existing crm_user_roles rows: organization_id is unresolved';
  END IF;
END
$$;

ALTER TABLE public.crm_user_roles
  ALTER COLUMN organization_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.crm_user_roles'::regclass
      AND conname = 'crm_user_roles_organization_id_fkey'
  ) THEN
    ALTER TABLE public.crm_user_roles
      ADD CONSTRAINT crm_user_roles_organization_id_fkey
      FOREIGN KEY (organization_id)
      REFERENCES public.organizations(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

ALTER TABLE public.crm_user_roles
  DROP CONSTRAINT IF EXISTS crm_user_roles_user_id_role_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.crm_user_roles'::regclass
      AND conname = 'crm_user_roles_org_user_role_key'
  ) THEN
    ALTER TABLE public.crm_user_roles
      ADD CONSTRAINT crm_user_roles_org_user_role_key
      UNIQUE (organization_id, user_id, role_id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_crm_user_roles_organization
  ON public.crm_user_roles (organization_id);

COMMENT ON COLUMN public.crm_user_roles.organization_id IS
  'Organization in which this catalog-role assignment applies. Global crm_roles rows remain templates; their assignments are tenant-scoped here.';

-- Replace both the baseline policy names and the split names currently live.
DROP POLICY IF EXISTS crm_user_roles_admin ON public.crm_user_roles;
DROP POLICY IF EXISTS crm_user_roles_admin__insert ON public.crm_user_roles;
DROP POLICY IF EXISTS crm_user_roles_admin__update ON public.crm_user_roles;
DROP POLICY IF EXISTS crm_user_roles_admin__delete ON public.crm_user_roles;
DROP POLICY IF EXISTS crm_user_roles_select ON public.crm_user_roles;

CREATE POLICY crm_user_roles_select
  ON public.crm_user_roles
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR private.has_crm_role(
      organization_id,
      ARRAY['crm_admin'::text]
    )
  );

CREATE POLICY crm_user_roles_admin__insert
  ON public.crm_user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    private.has_crm_role(
      organization_id,
      ARRAY['crm_admin'::text]
    )
    AND EXISTS (
      SELECT 1
      FROM public.crm_roles AS r
      WHERE r.id = role_id
        AND (
          r.organization_id IS NULL
          OR r.organization_id = crm_user_roles.organization_id
        )
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.user_id = crm_user_roles.user_id
          AND p.organization_id = crm_user_roles.organization_id
          AND COALESCE(p.is_active, true)
      )
      OR EXISTS (
        SELECT 1
        FROM public.organization_members AS om
        WHERE om.user_id = crm_user_roles.user_id
          AND om.organization_id = crm_user_roles.organization_id
          AND om.is_active = true
      )
    )
  );

CREATE POLICY crm_user_roles_admin__update
  ON public.crm_user_roles
  FOR UPDATE
  TO authenticated
  USING (
    private.has_crm_role(
      organization_id,
      ARRAY['crm_admin'::text]
    )
  )
  WITH CHECK (
    private.has_crm_role(
      organization_id,
      ARRAY['crm_admin'::text]
    )
    AND EXISTS (
      SELECT 1
      FROM public.crm_roles AS r
      WHERE r.id = role_id
        AND (
          r.organization_id IS NULL
          OR r.organization_id = crm_user_roles.organization_id
        )
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.user_id = crm_user_roles.user_id
          AND p.organization_id = crm_user_roles.organization_id
          AND COALESCE(p.is_active, true)
      )
      OR EXISTS (
        SELECT 1
        FROM public.organization_members AS om
        WHERE om.user_id = crm_user_roles.user_id
          AND om.organization_id = crm_user_roles.organization_id
          AND om.is_active = true
      )
    )
  );

CREATE POLICY crm_user_roles_admin__delete
  ON public.crm_user_roles
  FOR DELETE
  TO authenticated
  USING (
    private.has_crm_role(
      organization_id,
      ARRAY['crm_admin'::text]
    )
  );

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
  v_is_active_member boolean;
BEGIN
  IF auth.uid() IS NULL OR p_org_id IS NULL OR p_permission_key IS NULL THEN
    RETURN false;
  END IF;

  SELECT COALESCE(is_super_admin, false)
  INTO v_is_super
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_is_super THEN
    RETURN true;
  END IF;

  SELECT (
    EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.user_id = auth.uid()
        AND p.organization_id = p_org_id
        AND COALESCE(p.is_active, true)
    )
    OR EXISTS (
      SELECT 1
      FROM public.organization_members AS om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = p_org_id
        AND om.is_active = true
    )
  )
  INTO v_is_active_member;

  IF NOT v_is_active_member THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.crm_user_roles AS ur
    JOIN public.crm_roles AS r ON r.id = ur.role_id
    JOIN public.crm_role_permissions AS rp ON rp.role_id = r.id
    JOIN public.crm_permissions AS p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
      AND ur.organization_id = p_org_id
      AND p.key = p_permission_key
      AND (
        r.organization_id IS NULL
        OR r.organization_id = p_org_id
      )
  ) THEN
    RETURN true;
  END IF;

  RETURN public._org_role_implies_permission(p_org_id, p_permission_key);
END;
$$;

COMMENT ON FUNCTION public.has_org_permission(uuid, text) IS
  'Org-scoped permission check. Catalog assignments and active membership must both match the requested organization.';

REVOKE ALL ON FUNCTION public.has_org_permission(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_org_permission(uuid, text) TO authenticated;

-- Rollback (manual, only while every user has at most one assignment per role):
--   DROP POLICY IF EXISTS crm_user_roles_admin__delete ON public.crm_user_roles;
--   DROP POLICY IF EXISTS crm_user_roles_admin__update ON public.crm_user_roles;
--   DROP POLICY IF EXISTS crm_user_roles_admin__insert ON public.crm_user_roles;
--   DROP POLICY IF EXISTS crm_user_roles_select ON public.crm_user_roles;
--   ALTER TABLE public.crm_user_roles
--     DROP CONSTRAINT IF EXISTS crm_user_roles_org_user_role_key;
--   ALTER TABLE public.crm_user_roles
--     ADD CONSTRAINT crm_user_roles_user_id_role_id_key UNIQUE (user_id, role_id);
--   ALTER TABLE public.crm_user_roles
--     DROP CONSTRAINT IF EXISTS crm_user_roles_organization_id_fkey;
--   DROP INDEX IF EXISTS public.idx_crm_user_roles_organization;
--   ALTER TABLE public.crm_user_roles DROP COLUMN IF EXISTS organization_id;
--   Restore has_org_permission and the four baseline policies from the prior
--   migration. Do not remove organization_id after cross-org assignments exist
--   without first selecting which tenant's assignment to retain.

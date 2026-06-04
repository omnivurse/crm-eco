-- ============================================================================
-- Double Helix Admin — Multi-Tenancy Foundation
-- ----------------------------------------------------------------------------
--   1. Adds tenant identity columns to `organizations` (subdomain, status,
--      branding, plan).
--   2. Introduces `organization_members` for multi-org user membership and
--      switching (a profile may belong to N organizations with N roles).
--   3. Adds `tenant_audit_log` so every organization-scoped action has its
--      own immutable trail per-tenant.
--   4. Creates a SECURITY DEFINER helper `auth.user_organization_ids()`
--      so RLS policies can be written without N+1 lookups.
--   5. Creates a SECURITY DEFINER helper `auth.user_role_in(org_id uuid)`.
--   6. Adds RLS to `organizations` so users only see orgs they belong to.
--
-- Idempotent by design — safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. organizations: tenant identity
-- ----------------------------------------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS subdomain     text UNIQUE,
  ADD COLUMN IF NOT EXISTS status        text NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'paused', 'archived')),
  ADD COLUMN IF NOT EXISTS plan          text NOT NULL DEFAULT 'standard'
                            CHECK (plan IN ('trial', 'standard', 'pro', 'enterprise')),
  ADD COLUMN IF NOT EXISTS branding      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS domain        text UNIQUE,         -- optional vanity (e.g. ops.acme.com)
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_status
  ON public.organizations(status);

-- ----------------------------------------------------------------------------
-- 2. organization_members: many-to-many user ↔ org
--    Allows the same auth user to belong to multiple tenants with
--    different roles in each (super-admins, agency owners, contractors).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id)            ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'staff'
                    CHECK (role IN ('owner', 'super_admin', 'admin', 'staff', 'read_only')),
  is_active       boolean NOT NULL DEFAULT true,
  is_default      boolean NOT NULL DEFAULT false,
  invited_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at      timestamptz,
  joined_at       timestamptz NOT NULL DEFAULT now(),
  last_active_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org  ON public.organization_members(organization_id);

-- One default org per user
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_members_user_default
  ON public.organization_members(user_id) WHERE is_default;

-- Backfill existing profiles → organization_members (idempotent)
INSERT INTO public.organization_members (organization_id, user_id, role, is_default, joined_at)
SELECT p.organization_id, p.user_id, p.role, true, COALESCE(p.created_at, now())
FROM public.profiles p
WHERE p.organization_id IS NOT NULL
  AND p.user_id IS NOT NULL
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. tenant_audit_log — immutable, scoped, append-only
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_audit_log (
  id              bigserial PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email     text,
  action          text NOT NULL,
  resource_type   text,
  resource_id     text,
  meta            jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address      inet,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_audit_org_created
  ON public.tenant_audit_log(organization_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. SECURITY DEFINER helpers used by RLS policies
--    Live in `public` (hosted Supabase forbids writes to the `auth` schema).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_organization_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = auth.uid()
    AND is_active = true;
$$;

REVOKE ALL ON FUNCTION public.user_organization_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_organization_ids() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.user_role_in(org_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.organization_members
  WHERE user_id = auth.uid()
    AND organization_id = org_id
    AND is_active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.user_role_in(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_role_in(uuid) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. RLS — organizations & organization_members
-- ----------------------------------------------------------------------------
ALTER TABLE public.organizations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_audit_log      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_select_member       ON public.organizations;
DROP POLICY IF EXISTS organizations_update_owner_admin  ON public.organizations;
DROP POLICY IF EXISTS org_members_select_self_or_admin  ON public.organization_members;
DROP POLICY IF EXISTS org_members_insert_admin          ON public.organization_members;
DROP POLICY IF EXISTS tenant_audit_select_member        ON public.tenant_audit_log;
DROP POLICY IF EXISTS tenant_audit_insert_member        ON public.tenant_audit_log;

CREATE POLICY organizations_select_member ON public.organizations
  FOR SELECT
  USING (id IN (SELECT public.user_organization_ids()));

CREATE POLICY organizations_update_owner_admin ON public.organizations
  FOR UPDATE
  USING (public.user_role_in(id) IN ('owner', 'super_admin', 'admin'))
  WITH CHECK (public.user_role_in(id) IN ('owner', 'super_admin', 'admin'));

CREATE POLICY org_members_select_self_or_admin ON public.organization_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.user_role_in(organization_id) IN ('owner', 'super_admin', 'admin')
  );

CREATE POLICY org_members_insert_admin ON public.organization_members
  FOR INSERT
  WITH CHECK (public.user_role_in(organization_id) IN ('owner', 'super_admin', 'admin'));

CREATE POLICY tenant_audit_select_member ON public.tenant_audit_log
  FOR SELECT
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- Inserts go through SECURITY DEFINER service path; we still allow
-- authenticated users to write within their own org for in-app actions.
CREATE POLICY tenant_audit_insert_member ON public.tenant_audit_log
  FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

-- ----------------------------------------------------------------------------
-- 6. Convenience view for the OrganizationSwitcher UI
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.my_organizations AS
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
  'Returns the active set of organizations the current auth user belongs to. Drives the org switcher in apps/admin.';

-- ============================================================================
-- Needs: CRM staff can see/create portal rows; members match on member_id
-- ----------------------------------------------------------------------------
-- Same table (`public.needs`) is written by the member-portal share-request
-- wizard and read by /crm/needs. Two RLS gaps blocked that loop:
--
-- 1. Member INSERT/SELECT/UPDATE required members.email = profiles.email.
--    getMemberForUser resolves via profiles.member_id first, so a linked
--    member whose email drifted failed the WITH CHECK and the portal
--    swallowed "Failed to create your request."
-- 2. Staff SELECT required profiles.role IN (owner, admin, staff). CRM
--    authorization is has_crm_role / crm_role. A crm_admin who is not
--    also role=owner could not list portal submissions.
--
-- Additive. No DML. No row move.
--
-- ROLLBACK:
--   DROP POLICY IF EXISTS "CRM staff can view org needs" ON public.needs;
--   DROP POLICY IF EXISTS "CRM staff can insert org needs" ON public.needs;
--   DROP POLICY IF EXISTS "CRM staff can update org needs" ON public.needs;
--   DROP POLICY IF EXISTS "Admins can insert org needs" ON public.needs;
--   DROP POLICY IF EXISTS "Admins can update org needs" ON public.needs;
--   DROP FUNCTION IF EXISTS private.is_current_member(uuid);
--   -- then recreate the three "Members can …" policies from the baseline
--   -- (email-join only).
-- ============================================================================

SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION private.is_current_member(p_member_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'private', 'public', 'pg_catalog'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = (SELECT auth.uid())
      AND p.organization_id IS NOT NULL
      AND p.organization_id = private.get_user_organization_id()
      AND (
        p.member_id = p_member_id
        OR EXISTS (
          SELECT 1
          FROM public.members m
          WHERE m.id = p_member_id
            AND m.organization_id = p.organization_id
            AND lower(btrim(m.email)) = lower(btrim(p.email))
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION private.is_current_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_current_member(uuid) TO authenticated;

COMMENT ON FUNCTION private.is_current_member(uuid) IS
  'True when auth.uid() is this member — profiles.member_id first, email+org fallback.';

DROP POLICY IF EXISTS "Members can create their own needs" ON public.needs;
CREATE POLICY "Members can create their own needs"
  ON public.needs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = private.get_user_organization_id()
    AND private.is_current_member(member_id)
  );

DROP POLICY IF EXISTS "Members can view their own needs" ON public.needs;
CREATE POLICY "Members can view their own needs"
  ON public.needs
  FOR SELECT
  TO authenticated
  USING (
    organization_id = private.get_user_organization_id()
    AND private.is_current_member(member_id)
  );

DROP POLICY IF EXISTS "Members can update their own needs" ON public.needs;
CREATE POLICY "Members can update their own needs"
  ON public.needs
  FOR UPDATE
  TO authenticated
  USING (
    organization_id = private.get_user_organization_id()
    AND private.is_current_member(member_id)
  )
  WITH CHECK (
    organization_id = private.get_user_organization_id()
    AND private.is_current_member(member_id)
  );

DROP POLICY IF EXISTS "CRM staff can view org needs" ON public.needs;
CREATE POLICY "CRM staff can view org needs"
  ON public.needs
  FOR SELECT
  TO authenticated
  USING (
    public.has_crm_role(
      organization_id,
      ARRAY['crm_admin', 'crm_manager', 'crm_agent']::text[]
    )
  );

DROP POLICY IF EXISTS "CRM staff can insert org needs" ON public.needs;
CREATE POLICY "CRM staff can insert org needs"
  ON public.needs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_crm_role(
      organization_id,
      ARRAY['crm_admin', 'crm_manager', 'crm_agent']::text[]
    )
  );

DROP POLICY IF EXISTS "CRM staff can update org needs" ON public.needs;
CREATE POLICY "CRM staff can update org needs"
  ON public.needs
  FOR UPDATE
  TO authenticated
  USING (
    public.has_crm_role(
      organization_id,
      ARRAY['crm_admin', 'crm_manager']::text[]
    )
  )
  WITH CHECK (
    public.has_crm_role(
      organization_id,
      ARRAY['crm_admin', 'crm_manager']::text[]
    )
  );

-- Live staff SELECT/DELETE already use profiles.role (owner|admin|staff).
-- There was no matching INSERT/UPDATE, so Create Need and detail-page save
-- failed closed for every CRM user. Mirror the existing role gate.
DROP POLICY IF EXISTS "Admins can insert org needs" ON public.needs;
CREATE POLICY "Admins can insert org needs"
  ON public.needs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = private.get_user_organization_id()
    AND private.get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])
  );

DROP POLICY IF EXISTS "Admins can update org needs" ON public.needs;
CREATE POLICY "Admins can update org needs"
  ON public.needs
  FOR UPDATE
  TO authenticated
  USING (
    organization_id = private.get_user_organization_id()
    AND private.get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])
  )
  WITH CHECK (
    organization_id = private.get_user_organization_id()
    AND private.get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])
  );

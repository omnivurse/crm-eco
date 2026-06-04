-- ============================================================================
-- DB Health Sweep — Part 3: tighten always-true RLS policies
--
-- Advisor flagged 7 policies on 3 tables that effectively bypass RLS by
-- using a `true` predicate:
--
--   crm_api_logs              api_logs_insert    (WITH CHECK true)
--   crm_contact_groups        groups_select      (USING true)
--   crm_contact_groups        groups_insert      (WITH CHECK true)
--   crm_contact_groups        groups_update      (USING true / CHECK true)
--   crm_contact_groups        groups_delete      (USING true)
--   crm_contact_group_members group_members_*    (USING/CHECK true on all 4 cmds)
--
-- Risk: any authenticated user could read or modify another tenant's contact
-- groups and the writeable api_logs.
--
-- Fix: scope every policy to the user's `organization_id` set returned by
-- `public.user_organization_ids()` (the multi-tenant helper added earlier
-- this session). For group_members we walk through the parent group when
-- the table's own organization_id is missing on the row.
--
-- Idempotent — uses DROP POLICY IF EXISTS / CREATE POLICY.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. crm_api_logs.api_logs_insert  (WITH CHECK true → tenant-scoped)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS api_logs_insert ON public.crm_api_logs;
CREATE POLICY api_logs_insert ON public.crm_api_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

-- ----------------------------------------------------------------------------
-- 2. crm_contact_groups: replace four always-true policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS groups_select ON public.crm_contact_groups;
DROP POLICY IF EXISTS groups_insert ON public.crm_contact_groups;
DROP POLICY IF EXISTS groups_update ON public.crm_contact_groups;
DROP POLICY IF EXISTS groups_delete ON public.crm_contact_groups;

CREATE POLICY groups_select ON public.crm_contact_groups
  FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY groups_insert ON public.crm_contact_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY groups_update ON public.crm_contact_groups
  FOR UPDATE
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY groups_delete ON public.crm_contact_groups
  FOR DELETE
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ----------------------------------------------------------------------------
-- 3. crm_contact_group_members: replace four always-true policies
--    Belt-and-suspenders: scope by both the row's own organization_id AND
--    the parent group's organization_id (defence against any orphan rows).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS group_members_select ON public.crm_contact_group_members;
DROP POLICY IF EXISTS group_members_insert ON public.crm_contact_group_members;
DROP POLICY IF EXISTS group_members_update ON public.crm_contact_group_members;
DROP POLICY IF EXISTS group_members_delete ON public.crm_contact_group_members;

CREATE POLICY group_members_select ON public.crm_contact_group_members
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1 FROM public.crm_contact_groups g
      WHERE g.id = group_id
        AND g.organization_id IN (SELECT public.user_organization_ids())
    )
  );

CREATE POLICY group_members_insert ON public.crm_contact_group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1 FROM public.crm_contact_groups g
      WHERE g.id = group_id
        AND g.organization_id IN (SELECT public.user_organization_ids())
    )
  );

CREATE POLICY group_members_update ON public.crm_contact_group_members
  FOR UPDATE
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY group_members_delete ON public.crm_contact_group_members
  FOR DELETE
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

NOTIFY pgrst, 'reload schema';

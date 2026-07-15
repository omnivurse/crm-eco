-- Phase 3 of the CRM undo-delete system: soft-delete for record links, contact
-- groups, saved views, and carrier contacts — plus closing the RLS role-bypass
-- gaps the audit flagged on links/groups/group-members.
--
-- Soft-delete columns are additive/nullable (inert until the app writes them).
-- The RESTRICTIVE DELETE policies are additive too: they only *tighten* who may
-- hard-DELETE (aligning RLS with the API's existing role gate), and never affect
-- the new soft-delete path (an UPDATE), FK cascades, or the admin/definer purge.

SET lock_timeout = '5s';

-- 1) Soft-delete columns + trash indexes ------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['crm_record_links', 'crm_contact_groups', 'saved_views', 'carrier_contacts'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I
           ADD COLUMN IF NOT EXISTS deleted_at      timestamptz,
           ADD COLUMN IF NOT EXISTS deleted_by      uuid,
           ADD COLUMN IF NOT EXISTS delete_batch_id uuid,
           ADD COLUMN IF NOT EXISTS deleted_origin  text', t);
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (deleted_at) WHERE deleted_at IS NOT NULL',
        'idx_' || t || '_trash', t);
      EXECUTE format(
        'COMMENT ON COLUMN public.%I.deleted_at IS %L', t,
        'Soft-delete timestamp. NULL = live. Non-NULL = in Trash (hidden, restorable).');
    END IF;
  END LOOP;
END $$;

-- 2) Close the RLS role-bypass gaps on hard-DELETE --------------------------
-- These tables have a permissive FOR ALL / no-role DELETE policy that lets any
-- org member hard-delete via PostgREST, bypassing the API's role gate. A
-- RESTRICTIVE policy is AND'd with the permissive ones, so it enforces the role
-- for every direct DELETE without disturbing the soft-delete UPDATE path.

DO $$
BEGIN
  IF to_regclass('public.crm_record_links') IS NOT NULL THEN
    DROP POLICY IF EXISTS crm_record_links_delete_requires_role ON public.crm_record_links;
    CREATE POLICY crm_record_links_delete_requires_role ON public.crm_record_links
      AS RESTRICTIVE FOR DELETE TO authenticated
      USING (public.has_crm_role(org_id, ARRAY['crm_admin'::text, 'crm_manager'::text]));
  END IF;

  IF to_regclass('public.crm_contact_groups') IS NOT NULL THEN
    DROP POLICY IF EXISTS crm_contact_groups_delete_requires_admin ON public.crm_contact_groups;
    CREATE POLICY crm_contact_groups_delete_requires_admin ON public.crm_contact_groups
      AS RESTRICTIVE FOR DELETE TO authenticated
      USING (
        public.has_crm_role(organization_id, ARRAY['crm_admin'::text])
        AND coalesce(is_system, false) = false
      );
  END IF;

  IF to_regclass('public.crm_contact_group_members') IS NOT NULL THEN
    DROP POLICY IF EXISTS crm_contact_group_members_delete_requires_role ON public.crm_contact_group_members;
    CREATE POLICY crm_contact_group_members_delete_requires_role ON public.crm_contact_group_members
      AS RESTRICTIVE FOR DELETE TO authenticated
      USING (public.has_crm_role(organization_id, ARRAY['crm_admin'::text, 'crm_manager'::text, 'crm_agent'::text]));
  END IF;
END $$;

-- 3) Hide soft-deleted groups from the contact-groups list ------------------
-- The list reads the group_contact_counts view, so exclude trashed groups there
-- (same column set as baseline; only a WHERE g.deleted_at IS NULL is added).
CREATE OR REPLACE VIEW public.group_contact_counts WITH (security_invoker='on') AS
 SELECT g.id,
    g.id AS group_id,
    g.organization_id,
    g.group_name,
    g.group_type,
    g.description,
    g.color,
    g.icon,
    g.is_system,
    g.is_active,
    g.display_order,
    count(gm.id) AS member_count
   FROM (public.crm_contact_groups g
     LEFT JOIN public.crm_contact_group_members gm ON ((gm.group_id = g.id)))
  WHERE g.deleted_at IS NULL
  GROUP BY g.id, g.organization_id, g.group_name, g.group_type, g.description, g.color, g.icon, g.is_system, g.is_active, g.display_order;

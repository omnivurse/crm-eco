-- Fix: break the infinite RLS recursion between public.projects and public.project_members.
-- Status: DRAFT — not applied. Separate from the files-tenancy Phase 0 set; found during local
--         validation of Phase 0 (any authenticated SELECT on files via the 'Users can read team
--         files' policy raised 42P17 'infinite recursion detected in policy for relation
--         "project_members"').
-- ROOT CAUSE (verified on the live baseline):
--   * project_members SELECT policy references public.projects (whose SELECT policy references
--     project_members) AND references project_members directly (pm2) -> mutual + self recursion.
--   * projects SELECT/UPDATE policies reference project_members.
-- FIX: replace the recursive EXISTS subqueries with SECURITY DEFINER helpers. The definer
--   (postgres / the migration role) has BYPASSRLS and owns both tables, so the helpers read
--   projects/project_members WITHOUT re-entering their policies -> no recursion.
--   Helpers are single-arg (check the CURRENT auth.uid() only) so they cannot enumerate other
--   users' memberships. ADDITIVE + IDEMPOTENT.
-- Pattern mirrors the existing SECURITY DEFINER RLS helpers (e.g. public.is_crm_member).
-- Behaviour preserved: same own/member read, owner/editor update, owner-manages-members semantics.

SET lock_timeout = '5s';

-- (1) SECURITY DEFINER membership/ownership helpers (no RLS re-entry; search_path pinned empty +
--     fully-qualified refs, the most defensive form).
CREATE OR REPLACE FUNCTION public.is_project_owner(p_project_id uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = p_project_id AND p.owner_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = p_project_id AND pm.user_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_editor(p_project_id uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = p_project_id AND p.owner_id = (SELECT auth.uid())
  ) OR EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = p_project_id AND pm.user_id = (SELECT auth.uid())
      AND pm.role = ANY (ARRAY['owner','editor'])
  );
$$;

REVOKE ALL ON FUNCTION public.is_project_owner(uuid)  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_project_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_project_editor(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_project_owner(uuid)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_project_editor(uuid) TO authenticated, service_role;

-- (2) Rewrite the recursive policies to use the helpers (DROP IF EXISTS + CREATE = idempotent).

-- projects: SELECT (own or member)
DROP POLICY IF EXISTS "Users can read own and member projects" ON public.projects;
CREATE POLICY "Users can read own and member projects" ON public.projects
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()) OR public.is_project_member(id));

-- projects: UPDATE (owner or editor)
DROP POLICY IF EXISTS "Owners and editors can update projects" ON public.projects;
CREATE POLICY "Owners and editors can update projects" ON public.projects
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()) OR public.is_project_editor(id));

-- project_members: SELECT (project owner or any member) — was self + cross recursive
DROP POLICY IF EXISTS "Users can read project members" ON public.project_members;
CREATE POLICY "Users can read project members" ON public.project_members
  FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id) OR public.is_project_member(project_id));

-- project_members: INSERT/UPDATE/DELETE managed by the project owner (was a projects EXISTS that
-- re-entered the projects SELECT policy -> recursion). Same semantics via the owner helper.
DROP POLICY IF EXISTS "Project owners can add members" ON public.project_members;
CREATE POLICY "Project owners can add members" ON public.project_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

DROP POLICY IF EXISTS "Project owners can update members" ON public.project_members;
CREATE POLICY "Project owners can update members" ON public.project_members
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id));

DROP POLICY IF EXISTS "Project owners can remove members" ON public.project_members;
CREATE POLICY "Project owners can remove members" ON public.project_members
  FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

NOTIFY pgrst, 'reload schema';

-- Rollback: DROP the three helper functions and restore the original recursive policy bodies from
--   baseline.sql (projects: "Users can read own and member projects"/"Owners and editors can
--   update projects"; project_members: the four policies). NOTE: rollback reintroduces the
--   recursion bug, so only roll back if a regression in the new policies is found.

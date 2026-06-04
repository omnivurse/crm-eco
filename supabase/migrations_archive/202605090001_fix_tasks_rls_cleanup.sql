-- ============================================================================
-- Fix tasks RLS: Remove stale project-management-era policies
--
-- The tasks table has conflicting RLS policies from two eras:
--   1. Old project/kanban era: references projects, project_members,
--      task_watchers, created_by_id. These policies check
--      `assignee_id = auth.uid()` (comparing a profiles FK to an auth UUID).
--   2. CRM organizer era: `tasks_org_access` – org-scoped via profiles.
--
-- The old policies cause 500 errors for authenticated CRM users because:
--   • `assignee_id` now references profiles(id), not auth.users(id)
--   • The subqueries against project_members/task_watchers may fail when
--     combined with RLS on those tables for the current user context.
--
-- Resolution: Drop the stale policies, keeping only tasks_org_access and
-- the service_role bypass. Then re-add the service_role policy to be safe.
-- ============================================================================

-- Drop stale project-era policies
DROP POLICY IF EXISTS "Users can read relevant tasks" ON public.tasks;
DROP POLICY IF EXISTS "Relevant users can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Creators and project owners can delete tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can create tasks" ON public.tasks;

-- Keep: tasks_org_access (from organizer migration)
-- Keep: service_role_all_tasks

-- Re-create the INSERT policy scoped to the user's organization
-- (the old "Users can create tasks" had no WITH CHECK, which is too permissive)
DROP POLICY IF EXISTS "tasks_org_insert" ON public.tasks;
CREATE POLICY "tasks_org_insert" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Ensure the service_role bypass exists
DROP POLICY IF EXISTS "service_role_all_tasks" ON public.tasks;
CREATE POLICY "service_role_all_tasks" ON public.tasks
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

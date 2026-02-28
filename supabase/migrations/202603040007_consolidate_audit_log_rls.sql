-- ============================================================================
-- Consolidate 4 overlapping SELECT policies on unified_audit_logs into 1
--
-- BEFORE: 4 PERMISSIVE SELECT policies, each with its own subquery on profiles.
--         PostgreSQL evaluates ALL permissive policies per row (OR logic),
--         meaning 4 separate subqueries per row — significant overhead.
--
-- AFTER:  1 unified SELECT policy with a single profiles subquery that checks
--         all role conditions in one pass.
-- ============================================================================

-- Drop the 4 individual SELECT policies
DROP POLICY IF EXISTS "crm_admin_view_audit_logs" ON public.unified_audit_logs;
DROP POLICY IF EXISTS "crm_manager_view_audit_logs" ON public.unified_audit_logs;
DROP POLICY IF EXISTS "admin_portal_view_audit_logs" ON public.unified_audit_logs;
DROP POLICY IF EXISTS "super_admin_view_all_audit_logs" ON public.unified_audit_logs;

-- Create a single consolidated SELECT policy
CREATE POLICY "authorized_users_view_audit_logs"
ON public.unified_audit_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = (SELECT auth.uid())
    AND (
      -- Super admins can view all audit logs across all orgs
      profiles.is_super_admin = true
      -- Org-scoped access for CRM admins/managers and admin portal owners/admins
      OR (
        profiles.organization_id = unified_audit_logs.organization_id
        AND (
          profiles.crm_role IN ('crm_admin', 'crm_manager')
          OR profiles.role IN ('owner', 'admin')
        )
      )
    )
  )
);

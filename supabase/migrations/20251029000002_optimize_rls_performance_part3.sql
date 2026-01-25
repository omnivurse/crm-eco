/*
  # RLS Performance Optimization Part 3 - Final Critical Policies

  Covers the remaining most critical policies including:
  - Team collaboration (meetings, announcements, presence)
  - Tickets and comments
  - Chat features
  - Projects and tasks
  - System health monitoring
*/

-- =============================================
-- TEAMS
-- =============================================

DROP POLICY IF EXISTS "teams_staff_read" ON public.teams;
CREATE POLICY "teams_staff_read"
  ON public.teams FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "teams_admin_manage" ON public.teams;
CREATE POLICY "teams_admin_manage"
  ON public.teams FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- TICKET COMMENTS
-- =============================================

DROP POLICY IF EXISTS "ticket_comments_read" ON public.ticket_comments;
CREATE POLICY "ticket_comments_read"
  ON public.ticket_comments FOR SELECT
  TO authenticated
  USING (
    author_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_comments.ticket_id
      AND (
        t.requester_id = (select auth.uid())
        OR t.assignee_id = (select auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = (select auth.uid())
          AND p.role IN ('agent', 'staff', 'admin', 'super_admin')
        )
      )
    )
  );

DROP POLICY IF EXISTS "ticket_comments_insert" ON public.ticket_comments;
CREATE POLICY "ticket_comments_insert"
  ON public.ticket_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_comments.ticket_id
      AND (
        t.requester_id = (select auth.uid())
        OR t.assignee_id = (select auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = (select auth.uid())
          AND p.role IN ('agent', 'staff', 'admin', 'super_admin')
        )
      )
    )
  );

DROP POLICY IF EXISTS "ticket_comments_update_own" ON public.ticket_comments;
CREATE POLICY "ticket_comments_update_own"
  ON public.ticket_comments FOR UPDATE
  TO authenticated
  USING (author_id = (select auth.uid()))
  WITH CHECK (author_id = (select auth.uid()));

DROP POLICY IF EXISTS "ticket_comments_delete_own" ON public.ticket_comments;
CREATE POLICY "ticket_comments_delete_own"
  ON public.ticket_comments FOR DELETE
  TO authenticated
  USING (author_id = (select auth.uid()));

-- =============================================
-- SERVICES
-- =============================================

DROP POLICY IF EXISTS "services_admin_manage" ON public.services;
CREATE POLICY "services_admin_manage"
  ON public.services FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- SLA TIMERS
-- =============================================

DROP POLICY IF EXISTS "sla_timers_staff_read" ON public.sla_timers;
CREATE POLICY "sla_timers_staff_read"
  ON public.sla_timers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

-- =============================================
-- CATALOG
-- =============================================

DROP POLICY IF EXISTS "catalog_categories_admin_manage" ON public.catalog_categories;
CREATE POLICY "catalog_categories_admin_manage"
  ON public.catalog_categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "catalog_items_admin_manage" ON public.catalog_items;
CREATE POLICY "catalog_items_admin_manage"
  ON public.catalog_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- REQUESTS
-- =============================================

DROP POLICY IF EXISTS "requests_own_read" ON public.requests;
CREATE POLICY "requests_own_read"
  ON public.requests FOR SELECT
  TO authenticated
  USING (requester_id = (select auth.uid()));

DROP POLICY IF EXISTS "requests_own_insert" ON public.requests;
CREATE POLICY "requests_own_insert"
  ON public.requests FOR INSERT
  TO authenticated
  WITH CHECK (requester_id = (select auth.uid()));

DROP POLICY IF EXISTS "requests_staff_manage" ON public.requests;
CREATE POLICY "requests_staff_manage"
  ON public.requests FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

-- =============================================
-- REQUEST APPROVALS
-- =============================================

DROP POLICY IF EXISTS "request_approvals_read" ON public.request_approvals;
CREATE POLICY "request_approvals_read"
  ON public.request_approvals FOR SELECT
  TO authenticated
  USING (
    approver_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "request_approvals_update" ON public.request_approvals;
CREATE POLICY "request_approvals_update"
  ON public.request_approvals FOR UPDATE
  TO authenticated
  USING (approver_id = (select auth.uid()))
  WITH CHECK (approver_id = (select auth.uid()));

-- =============================================
-- PROBLEMS
-- =============================================

DROP POLICY IF EXISTS "problems_staff_access" ON public.problems;
CREATE POLICY "problems_staff_access"
  ON public.problems FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "problem_tickets_staff_access" ON public.problem_tickets;
CREATE POLICY "problem_tickets_staff_access"
  ON public.problem_tickets FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

-- =============================================
-- CHANGES
-- =============================================

DROP POLICY IF EXISTS "changes_staff_access" ON public.changes;
CREATE POLICY "changes_staff_access"
  ON public.changes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "change_approvals_read" ON public.change_approvals;
CREATE POLICY "change_approvals_read"
  ON public.change_approvals FOR SELECT
  TO authenticated
  USING (
    approver_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "change_approvals_update" ON public.change_approvals;
CREATE POLICY "change_approvals_update"
  ON public.change_approvals FOR UPDATE
  TO authenticated
  USING (approver_id = (select auth.uid()))
  WITH CHECK (approver_id = (select auth.uid()));

-- =============================================
-- CMDB & ASSETS
-- =============================================

DROP POLICY IF EXISTS "cmdb_ci_staff_read" ON public.cmdb_ci;
CREATE POLICY "cmdb_ci_staff_read"
  ON public.cmdb_ci FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "cmdb_ci_it_manage" ON public.cmdb_ci;
CREATE POLICY "cmdb_ci_it_manage"
  ON public.cmdb_ci FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('staff', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "ci_relationships_staff_read" ON public.ci_relationships;
CREATE POLICY "ci_relationships_staff_read"
  ON public.ci_relationships FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "assets_staff_read" ON public.assets;
CREATE POLICY "assets_staff_read"
  ON public.assets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "assets_it_manage" ON public.assets;
CREATE POLICY "assets_it_manage"
  ON public.assets FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('staff', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "asset_assignments_read" ON public.asset_assignments;
CREATE POLICY "asset_assignments_read"
  ON public.asset_assignments FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

-- =============================================
-- WORKFLOWS
-- =============================================

DROP POLICY IF EXISTS "workflows_admin_access" ON public.workflows;
CREATE POLICY "workflows_admin_access"
  ON public.workflows FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "workflow_steps_admin_access" ON public.workflow_steps;
CREATE POLICY "workflow_steps_admin_access"
  ON public.workflow_steps FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "workflow_executions_admin_read" ON public.workflow_executions;
CREATE POLICY "workflow_executions_admin_read"
  ON public.workflow_executions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- =============================================
-- METRICS & MONITORING
-- =============================================

DROP POLICY IF EXISTS "metrics_staff_read" ON public.metrics_daily;
CREATE POLICY "metrics_staff_read"
  ON public.metrics_daily FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "ticket_events_access" ON public.ticket_events;
CREATE POLICY "ticket_events_access"
  ON public.ticket_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_events.ticket_id
      AND (
        t.requester_id = (select auth.uid())
        OR t.assignee_id = (select auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = (select auth.uid())
          AND p.role IN ('agent', 'staff', 'admin', 'super_admin')
        )
      )
    )
  );

DROP POLICY IF EXISTS "ticket_files_read" ON public.ticket_files;
CREATE POLICY "ticket_files_read"
  ON public.ticket_files FOR SELECT
  TO authenticated
  USING (
    uploaded_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_files.ticket_id
      AND (
        t.requester_id = (select auth.uid())
        OR t.assignee_id = (select auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = (select auth.uid())
          AND p.role IN ('agent', 'staff', 'admin', 'super_admin')
        )
      )
    )
  );

-- =============================================
-- CANNED RESPONSES
-- =============================================

DROP POLICY IF EXISTS "canned_responses_staff_read" ON public.canned_responses;
CREATE POLICY "canned_responses_staff_read"
  ON public.canned_responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "canned_responses_staff_all" ON public.canned_responses;
CREATE POLICY "canned_responses_staff_all"
  ON public.canned_responses FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

-- =============================================
-- WORKFLOW QUEUE & SLA METRICS
-- =============================================

DROP POLICY IF EXISTS "workflow_queue_admin_access" ON public.workflow_queue;
CREATE POLICY "workflow_queue_admin_access"
  ON public.workflow_queue FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "sla_metrics_view_all" ON public.sla_metrics;
CREATE POLICY "sla_metrics_view_all"
  ON public.sla_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "sla_metrics_system_insert" ON public.sla_metrics;
CREATE POLICY "sla_metrics_system_insert"
  ON public.sla_metrics FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "sla_metrics_system_update" ON public.sla_metrics;
CREATE POLICY "sla_metrics_system_update"
  ON public.sla_metrics FOR UPDATE
  TO service_role
  USING (true);

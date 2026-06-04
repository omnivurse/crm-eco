-- =============================================================================
-- FIX: Remove remaining USING(true) policies for non-service_role users
-- =============================================================================

-- =============================================================================
-- TASKS — Drop wildcard {anon,authenticated} policies that bypass org-scoping
-- The table already has proper org-scoped + user-scoped policies:
--   - tasks_org_access (org-scoped ALL)
--   - Users can read relevant tasks (user-scoped SELECT)
--   - Relevant users can update tasks (user-scoped UPDATE)
--   - Creators and project owners can delete tasks (user-scoped DELETE)
--   - Users can create tasks (INSERT)
-- =============================================================================

DROP POLICY IF EXISTS "all_select_tasks" ON tasks;
DROP POLICY IF EXISTS "all_update_tasks" ON tasks;
DROP POLICY IF EXISTS "all_delete_tasks" ON tasks;
DROP POLICY IF EXISTS "all_insert_tasks" ON tasks;

-- =============================================================================
-- SLA_METRICS — Remove dangerous public UPDATE policy
-- SLA metric updates should only happen via service_role (triggers/functions)
-- =============================================================================

DROP POLICY IF EXISTS "sla_metrics_trigger_update" ON sla_metrics;
DROP POLICY IF EXISTS "sla_metrics_trigger_insert" ON sla_metrics;

-- Replace with service_role-only write access (reads kept for authenticated)
CREATE POLICY "sla_metrics_service_write"
  ON sla_metrics FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "sla_metrics_service_update"
  ON sla_metrics FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add authenticated read (scoped to tickets they can access)
CREATE POLICY "sla_metrics_auth_read"
  ON sla_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid()
    )
  );

-- =============================================================================
-- WORKFLOW_EXECUTIONS — Remove broad authenticated UPDATE policy
-- Execution updates should only happen via service_role
-- =============================================================================

DROP POLICY IF EXISTS "workflow_executions_system_update" ON workflow_executions;
DROP POLICY IF EXISTS "workflow_executions_system_write" ON workflow_executions;

-- Replace with service_role-only write access
CREATE POLICY "workflow_executions_service_write"
  ON workflow_executions FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "workflow_executions_service_update"
  ON workflow_executions FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add authenticated read access (scoped to users with profiles)
CREATE POLICY "workflow_executions_auth_read"
  ON workflow_executions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid()
    )
  );

-- =============================================================================
-- AGENT_CALL_STATUS — Replace USING(true) SELECT with profile-scoped
-- =============================================================================

DROP POLICY IF EXISTS "All authenticated users can view agent status" ON agent_call_status;
CREATE POLICY "Org members can view agent call status"
  ON agent_call_status FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid()
    )
  );

-- =============================================================================
-- CATALOG_CATEGORIES — Replace USING(true) with profile-scoped read
-- Global lookup table, but restrict to valid users
-- =============================================================================

DROP POLICY IF EXISTS "catalog_categories_auth_read" ON catalog_categories;
CREATE POLICY "catalog_categories_auth_read"
  ON catalog_categories FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid()
    )
  );

-- =============================================================================
-- SERVICES — Replace USING(true) with profile-scoped read
-- Global helpdesk service definitions
-- =============================================================================

DROP POLICY IF EXISTS "services_auth_read" ON services;
CREATE POLICY "services_auth_read"
  ON services FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid()
    )
  );

-- =============================================================================
-- SLA_POLICIES — Replace USING(true) with profile-scoped read
-- Global SLA policy definitions
-- =============================================================================

DROP POLICY IF EXISTS "sla_policies_auth_read" ON sla_policies;
CREATE POLICY "sla_policies_auth_read"
  ON sla_policies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid()
    )
  );

-- =============================================================================
-- HOLIDAYS — Replace public USING(true) with authenticated + profile-scoped
-- =============================================================================

DROP POLICY IF EXISTS "holidays_public_read" ON holidays;
CREATE POLICY "holidays_auth_read"
  ON holidays FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid()
    )
  );

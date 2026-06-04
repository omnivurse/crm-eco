-- =============================================================================
-- FIX: Replace all USING(true) policies with org-scoped policies
-- Addresses cross-tenant data exposure on:
--   calendar_sync_state, calendar_list, permissions, role_permissions
-- (crm_territories already fixed in 202603020011_fix_territories_rls.sql)
-- =============================================================================

-- =============================================================================
-- CALENDAR SYNC STATE — scope via integration_connections.organization_id
-- =============================================================================

DROP POLICY IF EXISTS "Users can view sync state for their connections" ON calendar_sync_state;
CREATE POLICY "Users can view sync state for their connections"
  ON calendar_sync_state FOR SELECT
  TO authenticated
  USING (
    connection_id IN (
      SELECT id FROM integration_connections
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can manage sync state for their connections" ON calendar_sync_state;
CREATE POLICY "Users can manage sync state for their connections"
  ON calendar_sync_state FOR ALL
  TO authenticated
  USING (
    connection_id IN (
      SELECT id FROM integration_connections
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    connection_id IN (
      SELECT id FROM integration_connections
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- =============================================================================
-- CALENDAR LIST — scope via integration_connections.organization_id
-- =============================================================================

DROP POLICY IF EXISTS "Users can view calendars for their connections" ON calendar_list;
CREATE POLICY "Users can view calendars for their connections"
  ON calendar_list FOR SELECT
  TO authenticated
  USING (
    connection_id IN (
      SELECT id FROM integration_connections
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can manage calendars for their connections" ON calendar_list;
CREATE POLICY "Users can manage calendars for their connections"
  ON calendar_list FOR ALL
  TO authenticated
  USING (
    connection_id IN (
      SELECT id FROM integration_connections
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    connection_id IN (
      SELECT id FROM integration_connections
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- =============================================================================
-- PERMISSIONS & ROLE_PERMISSIONS
-- These are global system lookup tables (no org_id column) — permission
-- definitions like "agents.read" are shared across all organizations.
-- Restrict to users who have a valid profile (belong to an organization).
-- =============================================================================

DROP POLICY IF EXISTS "Authenticated users can view permissions" ON permissions;
CREATE POLICY "Authenticated users can view permissions"
  ON permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can view role permissions" ON role_permissions;
CREATE POLICY "Authenticated users can view role permissions"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid()
    )
  );

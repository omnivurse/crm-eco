/*
  # Add Missing RLS Policies

  1. Purpose
    - Add RLS policies for tables that have RLS enabled but no policies
    - Ensure data protection for change_tasks, request_tasks, ticket_comments

  2. Tables Updated
    - change_tasks: Add policies for staff access
    - request_tasks: Add policies for staff and assigned users
    - ticket_comments: Add policies for ticket participants and staff

  3. Security Model
    - Staff roles (staff, agent, admin, super_admin) have full access
    - Regular users can only access their assigned tasks/comments
    - All policies use optimized (SELECT auth.uid()) pattern
*/

-- change_tasks policies
CREATE POLICY "change_tasks_staff_read" ON change_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

CREATE POLICY "change_tasks_staff_manage" ON change_tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

CREATE POLICY "change_tasks_assigned_read" ON change_tasks
  FOR SELECT USING (assigned_to = (SELECT auth.uid()));

-- request_tasks policies
CREATE POLICY "request_tasks_staff_read" ON request_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

CREATE POLICY "request_tasks_staff_manage" ON request_tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

CREATE POLICY "request_tasks_assigned_read" ON request_tasks
  FOR SELECT USING (assigned_to = (SELECT auth.uid()));

CREATE POLICY "request_tasks_assigned_update" ON request_tasks
  FOR UPDATE USING (assigned_to = (SELECT auth.uid()));

-- ticket_comments policies
CREATE POLICY "ticket_comments_read" ON ticket_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_comments.ticket_id
      AND (
        t.requester_id = (SELECT auth.uid())
        OR t.assigned_to = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = (SELECT auth.uid())
          AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
        )
      )
    )
    AND (
      NOT is_internal
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
      )
    )
  );

CREATE POLICY "ticket_comments_insert" ON ticket_comments
  FOR INSERT WITH CHECK (
    author_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_comments.ticket_id
      AND (
        t.requester_id = (SELECT auth.uid())
        OR t.assigned_to = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = (SELECT auth.uid())
          AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
        )
      )
    )
  );

CREATE POLICY "ticket_comments_update" ON ticket_comments
  FOR UPDATE USING (
    author_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "ticket_comments_delete" ON ticket_comments
  FOR DELETE USING (
    author_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'super_admin')
    )
  );

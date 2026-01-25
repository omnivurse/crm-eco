/*
  # Add Missing RLS Policies for Unprotected Tables
  
  1. Security Enhancement
    - Adds RLS policies for tables that have RLS enabled but no policies
    - Prevents unauthorized access to sensitive data
    - Protects: change_tasks, request_tasks, ticket_comments
    
  2. Access Control
    - Staff/agents can manage change_tasks and request_tasks
    - Ticket comments are accessible to ticket participants
    
  3. Compliance
    - Ensures all tables with RLS enabled have proper policies
    - Eliminates security gaps
*/

-- Change Tasks Policies
CREATE POLICY "change_tasks_staff_access" ON change_tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

-- Request Tasks Policies
CREATE POLICY "request_tasks_staff_access" ON request_tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

CREATE POLICY "request_tasks_requester_read" ON request_tasks
  FOR SELECT USING (
    request_id IN (
      SELECT id FROM requests 
      WHERE requester_id = auth.uid()
    )
  );

-- Ticket Comments Policies
CREATE POLICY "ticket_comments_read" ON ticket_comments
  FOR SELECT USING (
    ticket_id IN (
      SELECT id FROM tickets 
      WHERE requester_id = auth.uid()
         OR assignee_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

CREATE POLICY "ticket_comments_insert" ON ticket_comments
  FOR INSERT WITH CHECK (
    ticket_id IN (
      SELECT id FROM tickets 
      WHERE requester_id = auth.uid()
         OR assignee_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('agent', 'staff', 'admin', 'super_admin')
    )
  );

CREATE POLICY "ticket_comments_update_own" ON ticket_comments
  FOR UPDATE USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "ticket_comments_delete_own" ON ticket_comments
  FOR DELETE USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );
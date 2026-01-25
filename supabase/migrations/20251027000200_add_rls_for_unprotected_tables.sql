/*
  # Add RLS Policies for Unprotected Tables

  1. Purpose
    - Add Row Level Security policies to tables that currently lack them
    - Ensure all data access is properly controlled and audited
    - Prevent unauthorized data access

  2. Tables Updated
    - change_tasks
    - request_tasks
    - ticket_comments

  3. Security Model
    - change_tasks: Users can only access tasks for changes they can see
    - request_tasks: Users can only access tasks for requests they can see
    - ticket_comments: Users can only access comments on tickets they can see

  4. Notes
    - All policies enforce strict access control
    - Policies check parent entity access before allowing task/comment access
    - Maintains referential integrity and data privacy
*/

-- change_tasks RLS
ALTER TABLE change_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tasks for changes they can access"
  ON change_tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM problems
      WHERE problems.id = change_tasks.change_id
      AND (problems.reporter_id = auth.uid() OR problems.assigned_to = auth.uid())
    )
  );

CREATE POLICY "Assigned users can create tasks"
  ON change_tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM problems
      WHERE problems.id = change_tasks.change_id
      AND problems.assigned_to = auth.uid()
    )
  );

CREATE POLICY "Assigned users can update tasks"
  ON change_tasks FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM problems
      WHERE problems.id = change_tasks.change_id
      AND problems.assigned_to = auth.uid()
    )
  )
  WITH CHECK (
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM problems
      WHERE problems.id = change_tasks.change_id
      AND problems.assigned_to = auth.uid()
    )
  );

CREATE POLICY "Assigned users can delete tasks"
  ON change_tasks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM problems
      WHERE problems.id = change_tasks.change_id
      AND problems.assigned_to = auth.uid()
    )
  );

-- request_tasks RLS
ALTER TABLE request_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tasks for requests they can access"
  ON request_tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = request_tasks.request_id
      AND (requests.requester_id = auth.uid() OR requests.assigned_to = auth.uid())
    )
  );

CREATE POLICY "Assigned users can create request tasks"
  ON request_tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = request_tasks.request_id
      AND requests.assigned_to = auth.uid()
    )
  );

CREATE POLICY "Assigned users can update request tasks"
  ON request_tasks FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = request_tasks.request_id
      AND requests.assigned_to = auth.uid()
    )
  )
  WITH CHECK (
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = request_tasks.request_id
      AND requests.assigned_to = auth.uid()
    )
  );

CREATE POLICY "Assigned users can delete request tasks"
  ON request_tasks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = request_tasks.request_id
      AND requests.assigned_to = auth.uid()
    )
  );

-- ticket_comments RLS
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments on tickets they can access"
  ON ticket_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_comments.ticket_id
      AND (tickets.requester_id = auth.uid() OR tickets.assigned_to = auth.uid())
    )
  );

CREATE POLICY "Users can create comments on accessible tickets"
  ON ticket_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_comments.ticket_id
      AND (tickets.requester_id = auth.uid() OR tickets.assigned_to = auth.uid())
    )
  );

CREATE POLICY "Comment authors can update their comments"
  ON ticket_comments FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Comment authors can delete their comments"
  ON ticket_comments FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());

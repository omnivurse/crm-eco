/*
  # Add RLS Policy for Internal Comments

  1. Purpose
    - Move internal comment filtering from client-side to database level
    - Prevent unauthorized access to internal notes via RLS
    - Ensure only staff can see internal comments

  2. Security Changes
    - Add policy to filter internal comments at database level
    - Restrict internal comment creation to staff roles only
    - Prevent client-side bypass of internal note visibility

  3. Notes
    - Internal comments (is_internal = true) visible only to staff
    - Public comments (is_internal = false) visible to all authenticated users
    - This replaces client-side filtering with server-side security
*/

-- Drop existing ticket_comments SELECT policies to recreate with internal note filtering
DROP POLICY IF EXISTS "Users can view comments on tickets they can access" ON ticket_comments;

-- Create new SELECT policy with internal note filtering
CREATE POLICY "Users can view comments on accessible tickets with internal filtering"
  ON ticket_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_comments.ticket_id
      AND (tickets.requester_id = auth.uid() OR tickets.assignee_id = auth.uid())
    )
    AND (
      -- Non-internal comments visible to all
      is_internal = false
      OR
      -- Internal comments only visible to staff
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('staff', 'agent', 'admin', 'super_admin')
      )
    )
  );

-- Restrict internal comment creation to staff only
CREATE POLICY "Only staff can create internal comments"
  ON ticket_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_comments.ticket_id
      AND (tickets.requester_id = auth.uid() OR tickets.assignee_id = auth.uid())
    )
    AND (
      -- If internal comment, user must be staff
      is_internal = false
      OR
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('staff', 'agent', 'admin', 'super_admin')
      )
    )
  );

COMMENT ON POLICY "Users can view comments on accessible tickets with internal filtering" ON ticket_comments IS 'Filters internal notes at database level for security';
COMMENT ON POLICY "Only staff can create internal comments" ON ticket_comments IS 'Restricts internal note creation to staff roles only';

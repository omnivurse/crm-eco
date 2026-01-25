/*
  # Add foreign key constraint for ticket_actions

  1. Tables
    - `ticket_actions` table already exists
    - Add foreign key constraint to `tickets` table

  2. Security  
    - Add RLS policy for agents/admins to insert breach notifications
    - Add RLS policy for agents/admins to read ticket actions

  3. Indexes
    - Add index for efficient breach detection queries
*/

-- Add foreign key constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'ticket_actions' 
    AND constraint_name = 'ticket_actions_ticket_id_fkey'
  ) THEN
    ALTER TABLE ticket_actions 
    ADD CONSTRAINT ticket_actions_ticket_id_fkey 
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add RLS policies for ticket_actions if not exists
CREATE POLICY IF NOT EXISTS "ticket_actions_agent_insert"
  ON ticket_actions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role IN ('agent', 'admin')
    )
  );

CREATE POLICY IF NOT EXISTS "ticket_actions_agent_select"
  ON ticket_actions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role IN ('agent', 'admin')
    )
  );

-- Add index for SLA breach queries
CREATE INDEX IF NOT EXISTS idx_ticket_actions_breach_lookup
  ON ticket_actions (ticket_id, action, created_at);

-- Add index on tickets for SLA queries
CREATE INDEX IF NOT EXISTS idx_tickets_sla_status
  ON tickets (status, sla_due_at) 
  WHERE sla_due_at IS NOT NULL;
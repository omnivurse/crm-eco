/*
  # Add ticket actions table for SLA breach tracking

  1. New Tables
    - `ticket_actions`
      - `id` (uuid, primary key)
      - `ticket_id` (uuid, foreign key to tickets)
      - `action` (text) - action type like 'sla_breach_notified'
      - `payload` (jsonb) - action metadata
      - `actor_id` (uuid, nullable) - who triggered the action
      - `created_at` (timestamp)

  2. Indexes
    - Index on (ticket_id, action) for efficient lookups

  3. Security
    - Enable RLS on `ticket_actions` table
    - Add policy for agents/admins to insert and read actions
*/

CREATE TABLE IF NOT EXISTS ticket_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  action text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Add foreign key constraint if tickets table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tickets') THEN
    ALTER TABLE ticket_actions 
    ADD CONSTRAINT ticket_actions_ticket_id_fkey 
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key constraint if profiles table exists  
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    ALTER TABLE ticket_actions 
    ADD CONSTRAINT ticket_actions_actor_id_fkey 
    FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ticket_actions_ticket_action
  ON ticket_actions (ticket_id, action);

CREATE INDEX IF NOT EXISTS idx_ticket_actions_ticket
  ON ticket_actions (ticket_id);

-- Enable RLS
ALTER TABLE ticket_actions ENABLE ROW LEVEL SECURITY;

-- Policies for agents/admins to insert and read actions
CREATE POLICY "ticket_actions_insert" ON ticket_actions
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "ticket_actions_read" ON ticket_actions
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() 
      AND p.role IN ('agent', 'admin')
    )
  );
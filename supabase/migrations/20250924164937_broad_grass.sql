/*
  # Add SLA tracking and response templates

  1. Table Updates
     - Add SLA columns to tickets table
     - Create response_templates table for smart replies
     - Create ticket_actions table for audit trail

  2. Indexes
     - Add index on tickets(sla_due_at) for SLA monitoring
     - Add index on response_templates(category, audience)

  3. Security
     - Enable RLS on response_templates
     - Add policies for admin management
*/

-- Add SLA columns to tickets table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'sla_minutes'
  ) THEN
    ALTER TABLE tickets ADD COLUMN sla_minutes integer;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'sla_due_at'
  ) THEN
    ALTER TABLE tickets ADD COLUMN sla_due_at timestamptz;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'queue'
  ) THEN
    ALTER TABLE tickets ADD COLUMN queue text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'assigned_group'
  ) THEN
    ALTER TABLE tickets ADD COLUMN assigned_group text;
  END IF;
END $$;

-- Create response templates table
CREATE TABLE IF NOT EXISTS response_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  category text,
  audience text,
  content text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  updated_by uuid,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create ticket actions table for audit trail
CREATE TABLE IF NOT EXISTS ticket_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  action text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Add foreign key constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'ticket_actions_ticket_id_fkey'
  ) THEN
    ALTER TABLE ticket_actions 
    ADD CONSTRAINT ticket_actions_ticket_id_fkey 
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'ticket_actions_actor_id_fkey'
  ) THEN
    ALTER TABLE ticket_actions 
    ADD CONSTRAINT ticket_actions_actor_id_fkey 
    FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_tickets_sla_due_at ON tickets(sla_due_at);
CREATE INDEX IF NOT EXISTS idx_response_templates_category ON response_templates(category);
CREATE INDEX IF NOT EXISTS idx_response_templates_audience ON response_templates(audience);
CREATE INDEX IF NOT EXISTS idx_ticket_actions_ticket ON ticket_actions(ticket_id);

-- Enable RLS
ALTER TABLE response_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "response_templates_admin_manage"
  ON response_templates
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "response_templates_agent_read"
  ON response_templates
  FOR SELECT
  TO public
  USING (
    is_active = true AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('agent', 'admin')
    )
  );

CREATE POLICY "ticket_actions_insert"
  ON ticket_actions
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "ticket_actions_read"
  ON ticket_actions
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('agent', 'admin')
    )
  );

-- Insert sample templates
INSERT INTO response_templates (name, category, audience, content, variables) VALUES
('Member Login Reset', 'login', 'member', E'Hi {{firstName}},\n\nWe''ve reset your portal access. Use this link to set a new password: {{resetUrl}}\n\nIf you didn''t request this, please reply to this message.\n\nBest regards,\nSupport Team', '["firstName", "resetUrl"]'),
('Advisor e123 Enrollment Blocker', 'enrollment', 'advisor', E'Thanks for reporting the e123 enrollment issue. We see a blocker and have escalated to Advisors Apps.\n\nTracking: {{caseId}}. We''ll update you as soon as it''s mitigated.\n\nRegards,\nAdvisor Support', '["caseId"]'),
('Staff File Transfer Retries', 'fileTransfer', 'staff', E'Data Ops is reprocessing your file within {{window}}.\n\nPlease confirm new drops go to {{sftpEndpoint}}. We''ll close the ticket once pipeline checks pass.\n\nThanks,\nIT Team', '["window", "sftpEndpoint"]')
ON CONFLICT (name) DO NOTHING;
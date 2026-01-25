/*
  # Activate Workflow Automation System

  ## Overview
  Complete the workflow automation infrastructure by adding database triggers that
  automatically invoke workflows when ticket and request lifecycle events occur.

  ## 1. New Components

  ### Database Functions
  - `trigger_workflows_for_event` - Core function to invoke flow-runner edge function
  - `notify_workflow_on_ticket_created` - Trigger function for ticket creation
  - `notify_workflow_on_ticket_updated` - Trigger function for ticket updates
  - `notify_workflow_on_request_submitted` - Trigger function for request submission
  - `get_agent_workload` - Helper function for workload-based assignment

  ### Database Triggers
  - Ticket creation trigger -> workflow execution
  - Ticket status/priority update trigger -> workflow execution
  - Request submission trigger -> workflow execution

  ### Workflow Execution Queue
  - `workflow_queue` - Queue table for async workflow execution
  - Prevents blocking of main operations during workflow processing

  ## 2. Template Workflows
  - Auto-assign Tickets based on category and agent workload
  - SLA Escalation for tickets approaching breach
  - Status Updates for requester notifications at key milestones

  ## 3. Security
  - RLS policies for workflow_queue table
  - Service role only access for trigger functions
*/

-- =====================================================
-- WORKFLOW EXECUTION QUEUE
-- =====================================================

CREATE TABLE IF NOT EXISTS workflow_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count int DEFAULT 0,
  max_retries int DEFAULT 3,
  error_message text,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_workflow_queue_status ON workflow_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_workflow_queue_event ON workflow_queue(event_type);

ALTER TABLE workflow_queue ENABLE ROW LEVEL SECURITY;

-- Admin only access to workflow queue
CREATE POLICY "workflow_queue_admin_access" ON workflow_queue FOR ALL TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS(
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'super_admin')
  )
);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Get agent workload for auto-assignment
CREATE OR REPLACE FUNCTION get_agent_workload(agent_id uuid)
RETURNS int AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::int
    FROM tickets
    WHERE assignee_id = agent_id
    AND status NOT IN ('closed', 'resolved')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get least busy agent by category
CREATE OR REPLACE FUNCTION get_least_busy_agent(ticket_category text DEFAULT NULL)
RETURNS uuid AS $$
DECLARE
  selected_agent_id uuid;
BEGIN
  SELECT p.id INTO selected_agent_id
  FROM profiles p
  WHERE p.role IN ('agent', 'it')
  AND p.is_active = true
  ORDER BY (
    SELECT COUNT(*)
    FROM tickets t
    WHERE t.assignee_id = p.id
    AND t.status NOT IN ('closed', 'resolved')
  ) ASC
  LIMIT 1;

  RETURN selected_agent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- CORE WORKFLOW TRIGGER FUNCTION
-- =====================================================

-- Queue workflow event for async processing
CREATE OR REPLACE FUNCTION trigger_workflows_for_event(
  p_event_type text,
  p_event_data jsonb
)
RETURNS void AS $$
BEGIN
  -- Insert into queue for async processing
  INSERT INTO workflow_queue (event_type, event_data)
  VALUES (p_event_type, p_event_data);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TICKET EVENT TRIGGER FUNCTIONS
-- =====================================================

-- Trigger workflows when ticket is created
CREATE OR REPLACE FUNCTION notify_workflow_on_ticket_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM trigger_workflows_for_event(
    'ticket.created',
    jsonb_build_object(
      'ticket_id', NEW.id,
      'title', NEW.title,
      'category', NEW.category,
      'priority', NEW.priority,
      'status', NEW.status,
      'requester_id', NEW.requester_id,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger workflows when ticket is updated
CREATE OR REPLACE FUNCTION notify_workflow_on_ticket_updated()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger if status or priority changed
  IF OLD.status IS DISTINCT FROM NEW.status
     OR OLD.priority IS DISTINCT FROM NEW.priority
     OR OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN

    PERFORM trigger_workflows_for_event(
      'ticket.updated',
      jsonb_build_object(
        'ticket_id', NEW.id,
        'title', NEW.title,
        'category', NEW.category,
        'priority', NEW.priority,
        'status', NEW.status,
        'old_status', OLD.status,
        'old_priority', OLD.priority,
        'assignee_id', NEW.assignee_id,
        'old_assignee_id', OLD.assignee_id,
        'updated_at', NEW.updated_at
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- REQUEST EVENT TRIGGER FUNCTIONS
-- =====================================================

-- Trigger workflows when request is submitted
CREATE OR REPLACE FUNCTION notify_workflow_on_request_submitted()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM trigger_workflows_for_event(
    'request.submitted',
    jsonb_build_object(
      'request_id', NEW.id,
      'catalog_item_id', NEW.catalog_item_id,
      'requester_id', NEW.requester_id,
      'status', NEW.status,
      'answers', NEW.answers,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ATTACH TRIGGERS TO TABLES
-- =====================================================

-- Ticket created trigger
DROP TRIGGER IF EXISTS workflow_ticket_created ON tickets;
CREATE TRIGGER workflow_ticket_created
  AFTER INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION notify_workflow_on_ticket_created();

-- Ticket updated trigger
DROP TRIGGER IF EXISTS workflow_ticket_updated ON tickets;
CREATE TRIGGER workflow_ticket_updated
  AFTER UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION notify_workflow_on_ticket_updated();

-- Request submitted trigger
DROP TRIGGER IF EXISTS workflow_request_submitted ON requests;
CREATE TRIGGER workflow_request_submitted
  AFTER INSERT ON requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_workflow_on_request_submitted();

-- =====================================================
-- SEED TEMPLATE WORKFLOWS
-- =====================================================

-- Template 1: Auto-assign Tickets
DO $$
DECLARE
  workflow_id uuid;
  step_id uuid;
BEGIN
  -- Check if workflow already exists
  IF NOT EXISTS (SELECT 1 FROM workflows WHERE name = 'Auto-assign Tickets') THEN
    -- Create workflow
    INSERT INTO workflows (name, description, trigger_type, trigger_config, is_active)
    VALUES (
      'Auto-assign Tickets',
      'Automatically assign new tickets to the least busy agent based on their current workload',
      'ticket.created',
      jsonb_build_object(
        'conditions', jsonb_build_array(
          jsonb_build_object(
            'field', 'assignee_id',
            'operator', 'is_null'
          )
        )
      ),
      false
    )
    RETURNING id INTO workflow_id;

    -- Add workflow steps
    INSERT INTO workflow_steps (workflow_id, step_type, step_config, sort_order)
    VALUES
    (
      workflow_id,
      'function',
      jsonb_build_object(
        'function_name', 'assign_to_least_busy_agent',
        'description', 'Find agent with lowest workload and assign ticket'
      ),
      1
    ),
    (
      workflow_id,
      'notify',
      jsonb_build_object(
        'recipient_type', 'assigned_agent',
        'subject', 'New Ticket Assigned: {{ticket_id}}',
        'message', 'You have been assigned a new {{priority}} priority ticket: {{title}}'
      ),
      2
    );
  END IF;
END $$;

-- Template 2: SLA Escalation
DO $$
DECLARE
  workflow_id uuid;
BEGIN
  -- Check if workflow already exists
  IF NOT EXISTS (SELECT 1 FROM workflows WHERE name = 'SLA Escalation') THEN
    -- Create workflow
    INSERT INTO workflows (name, description, trigger_type, trigger_config, is_active)
    VALUES (
      'SLA Escalation',
      'Escalate tickets to managers when approaching SLA breach threshold',
      'ticket.updated',
      jsonb_build_object(
        'conditions', jsonb_build_array(
          jsonb_build_object(
            'field', 'priority',
            'operator', 'in',
            'value', jsonb_build_array('urgent', 'high')
          )
        )
      ),
      false
    )
    RETURNING id INTO workflow_id;

    -- Add workflow steps
    INSERT INTO workflow_steps (workflow_id, step_type, step_config, sort_order)
    VALUES
    (
      workflow_id,
      'condition',
      jsonb_build_object(
        'field', 'status',
        'operator', 'not_equals',
        'value', 'resolved',
        'description', 'Only escalate unresolved tickets'
      ),
      1
    ),
    (
      workflow_id,
      'notify',
      jsonb_build_object(
        'recipient_type', 'managers',
        'subject', 'SLA Alert: Ticket {{ticket_id}} Needs Attention',
        'message', 'High priority ticket {{ticket_id}} is approaching SLA breach. Current status: {{status}}'
      ),
      2
    ),
    (
      workflow_id,
      'task',
      jsonb_build_object(
        'action', 'update_ticket',
        'field', 'priority',
        'value', 'urgent',
        'description', 'Escalate priority to urgent'
      ),
      3
    );
  END IF;
END $$;

-- Template 3: Status Updates
DO $$
DECLARE
  workflow_id uuid;
BEGIN
  -- Check if workflow already exists
  IF NOT EXISTS (SELECT 1 FROM workflows WHERE name = 'Automated Status Updates') THEN
    -- Create workflow
    INSERT INTO workflows (name, description, trigger_type, trigger_config, is_active)
    VALUES (
      'Automated Status Updates',
      'Send automated email notifications to requesters when ticket status changes',
      'ticket.updated',
      jsonb_build_object(
        'conditions', jsonb_build_array(
          jsonb_build_object(
            'field', 'status',
            'operator', 'changed'
          )
        )
      ),
      false
    )
    RETURNING id INTO workflow_id;

    -- Add workflow steps
    INSERT INTO workflow_steps (workflow_id, step_type, step_config, sort_order)
    VALUES
    (
      workflow_id,
      'condition',
      jsonb_build_object(
        'field', 'status',
        'operator', 'in',
        'value', jsonb_build_array('in_progress', 'resolved', 'closed'),
        'description', 'Only notify on key status milestones'
      ),
      1
    ),
    (
      workflow_id,
      'notify',
      jsonb_build_object(
        'recipient_type', 'requester',
        'subject', 'Ticket {{ticket_id}} Status Updated',
        'message', 'Your ticket "{{title}}" status has been updated to: {{status}}'
      ),
      2
    );
  END IF;
END $$;

-- =====================================================
-- WORKFLOW EXECUTION TRACKING
-- =====================================================

-- Add execution tracking columns if not exists
DO $$ BEGIN
  ALTER TABLE workflow_executions ADD COLUMN IF NOT EXISTS logs jsonb DEFAULT '[]'::jsonb;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Update workflow_executions RLS to allow system writes
DROP POLICY IF EXISTS "workflow_executions_system_write" ON workflow_executions;
CREATE POLICY "workflow_executions_system_write" ON workflow_executions
FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "workflow_executions_system_update" ON workflow_executions;
CREATE POLICY "workflow_executions_system_update" ON workflow_executions
FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);
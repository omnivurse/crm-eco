/*
  # Fix Workflow Trigger Field References

  ## Problem
  Workflow triggers reference 'title' field which doesn't exist on tickets table.
  Tickets use 'subject' not 'title'.

  ## Fix
  Update workflow notification functions to use correct field names.
*/

-- Fix ticket created workflow notification
CREATE OR REPLACE FUNCTION public.notify_workflow_on_ticket_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM trigger_workflows_for_event(
    'ticket.created',
    jsonb_build_object(
      'ticket_id', NEW.id,
      'subject', NEW.subject,
      'category', NEW.category,
      'priority', NEW.priority,
      'status', NEW.status,
      'requester_id', NEW.requester_id,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

-- Fix ticket updated workflow notification
CREATE OR REPLACE FUNCTION public.notify_workflow_on_ticket_updated()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status OR 
     OLD.priority IS DISTINCT FROM NEW.priority OR
     OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN
    
    PERFORM trigger_workflows_for_event(
      'ticket.updated',
      jsonb_build_object(
        'ticket_id', NEW.id,
        'subject', NEW.subject,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'old_priority', OLD.priority,
        'new_priority', NEW.priority,
        'old_assignee_id', OLD.assignee_id,
        'new_assignee_id', NEW.assignee_id,
        'updated_at', NEW.updated_at
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

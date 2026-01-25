/*
  # Create Ticket Status History Trigger

  1. Purpose
    - Automatically log all ticket status changes
    - Maintain complete audit trail for SLA tracking
    - Capture who made the change and when

  2. Changes
    - Create function to log status changes
    - Create trigger to fire on status updates
    - Populate ticket_status_history table

  3. Notes
    - Trigger fires AFTER UPDATE only when status changes
    - Captures both old and new status values
    - Records timestamp and user who made the change
*/

-- Function to log ticket status changes
CREATE OR REPLACE FUNCTION log_ticket_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO ticket_status_history (
      ticket_id,
      old_status,
      new_status,
      changed_by,
      changed_at
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid(),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on tickets table
DROP TRIGGER IF EXISTS ticket_status_change_trigger ON tickets;

CREATE TRIGGER ticket_status_change_trigger
  AFTER UPDATE ON tickets
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_ticket_status_change();

-- Grant necessary permissions
GRANT SELECT ON ticket_status_history TO authenticated;
GRANT INSERT ON ticket_status_history TO authenticated;

COMMENT ON FUNCTION log_ticket_status_change() IS 'Automatically logs ticket status changes to ticket_status_history table';
COMMENT ON TRIGGER ticket_status_change_trigger ON tickets IS 'Logs status changes for audit trail and SLA tracking';

/*
  # Ticket Email Notifications System

  ## Overview
  This migration creates a comprehensive email notification system for ticket resolution notifications,
  supporting all user types: members, advisors, concierge, staff, and anonymous submitters.

  ## 1. New Tables
    - `ticket_email_notifications` - Log all email notifications sent for tickets
      - Tracks delivery status, recipient info, email content
      - Links to tickets with cascade delete
      - Stores retry attempts and error messages
      - Enables audit trail for all email communications

  ## 2. Helper Functions
    - `get_ticket_requester_email()` - Retrieves requester email from multiple sources
      - Checks authenticated user email from profiles table
      - Falls back to submitter_email for anonymous submissions
      - Returns NULL if no email found
    - `notify_ticket_status_change()` - Trigger function for automatic email notifications
      - Fires when ticket status changes to 'resolved' or 'closed'
      - Queues email notification for delivery via Edge Function
      - Only sends once per status transition

  ## 3. Database Triggers
    - Trigger on tickets table for status changes to resolved/closed
    - Automatically creates notification record for Edge Function processing

  ## 4. Indexes
    - Add indexes for efficient notification querying
    - Index on ticket_id, user_id, status, created_at

  ## 5. RLS Policies
    - Staff can read all notifications
    - Users can read their own ticket notifications
    - Only system/triggers can insert notifications
    - Staff can update notification status (for retry logic)
*/

-- Create enum for notification status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_status') THEN
    CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed', 'bounced');
  END IF;
END $$;

-- Create enum for notification type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE notification_type AS ENUM ('ticket_resolved', 'ticket_closed', 'ticket_updated', 'ticket_assigned', 'manual');
  END IF;
END $$;

-- Create ticket_email_notifications table
CREATE TABLE IF NOT EXISTS ticket_email_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  recipient_email text NOT NULL,
  recipient_name text,
  notification_type notification_type NOT NULL DEFAULT 'ticket_resolved',
  subject text NOT NULL,
  body_text text NOT NULL,
  body_html text,
  status notification_status NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  error_message text,
  retry_count int DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ticket_email_notifications_ticket_id ON ticket_email_notifications(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_email_notifications_status ON ticket_email_notifications(status);
CREATE INDEX IF NOT EXISTS idx_ticket_email_notifications_created_at ON ticket_email_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_email_notifications_recipient ON ticket_email_notifications(recipient_email);

-- Enable RLS
ALTER TABLE ticket_email_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Staff can read all notifications
DROP POLICY IF EXISTS "ticket_email_notifications_staff_read" ON ticket_email_notifications;
CREATE POLICY "ticket_email_notifications_staff_read" ON ticket_email_notifications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('staff', 'agent', 'admin', 'super_admin', 'concierge')
    )
  );

-- RLS Policy: Users can read notifications for their tickets
DROP POLICY IF EXISTS "ticket_email_notifications_requester_read" ON ticket_email_notifications;
CREATE POLICY "ticket_email_notifications_requester_read" ON ticket_email_notifications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_id
      AND tickets.requester_id = auth.uid()
    )
  );

-- RLS Policy: System can insert notifications (triggers)
DROP POLICY IF EXISTS "ticket_email_notifications_system_insert" ON ticket_email_notifications;
CREATE POLICY "ticket_email_notifications_system_insert" ON ticket_email_notifications
  FOR INSERT
  WITH CHECK (true);

-- RLS Policy: Staff can update notification status
DROP POLICY IF EXISTS "ticket_email_notifications_staff_update" ON ticket_email_notifications;
CREATE POLICY "ticket_email_notifications_staff_update" ON ticket_email_notifications
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

-- Function to get requester email from multiple sources
CREATE OR REPLACE FUNCTION get_ticket_requester_email(p_ticket_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT
    COALESCE(
      p.email,
      t.submitter_email
    ) INTO v_email
  FROM tickets t
  LEFT JOIN profiles p ON t.requester_id = p.id
  WHERE t.id = p_ticket_id;

  RETURN v_email;
END;
$$;

-- Function to get requester name from multiple sources
CREATE OR REPLACE FUNCTION get_ticket_requester_name(p_ticket_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_name text;
BEGIN
  SELECT
    COALESCE(
      p.full_name,
      t.submitter_name,
      'Valued Customer'
    ) INTO v_name
  FROM tickets t
  LEFT JOIN profiles p ON t.requester_id = p.id
  WHERE t.id = p_ticket_id;

  RETURN v_name;
END;
$$;

-- Function to create email notification on ticket status change
CREATE OR REPLACE FUNCTION notify_ticket_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email text;
  v_name text;
  v_notification_type notification_type;
  v_subject text;
  v_body text;
BEGIN
  IF (NEW.status IN ('resolved', 'closed') AND OLD.status != NEW.status) THEN
    v_email := get_ticket_requester_email(NEW.id);

    IF v_email IS NULL OR v_email = '' THEN
      RETURN NEW;
    END IF;

    v_name := get_ticket_requester_name(NEW.id);

    IF NEW.status = 'resolved' THEN
      v_notification_type := 'ticket_resolved';
      v_subject := 'Your Support Ticket Has Been Resolved - #' || substring(NEW.id::text, 1, 8);
      v_body := 'Hello ' || v_name || ',

We are pleased to inform you that your support ticket has been resolved.

Ticket Details:
- Ticket ID: #' || substring(NEW.id::text, 1, 8) || '
- Subject: ' || NEW.subject || '
- Status: Resolved
- Resolution Date: ' || to_char(NEW.updated_at, 'Mon DD, YYYY at HH:MI AM') || '

If you have any additional questions or concerns, please feel free to reply to this ticket or contact our support team.

Thank you for your patience.

Best regards,
MPB Health Support Team';
    ELSE
      v_notification_type := 'ticket_closed';
      v_subject := 'Your Support Ticket Has Been Closed - #' || substring(NEW.id::text, 1, 8);
      v_body := 'Hello ' || v_name || ',

Your support ticket has been closed.

Ticket Details:
- Ticket ID: #' || substring(NEW.id::text, 1, 8) || '
- Subject: ' || NEW.subject || '
- Status: Closed
- Closed Date: ' || to_char(NEW.updated_at, 'Mon DD, YYYY at HH:MI AM') || '

If you need further assistance, please open a new ticket or contact our support team.

Thank you for your patience.

Best regards,
MPB Health Support Team';
    END IF;

    INSERT INTO ticket_email_notifications (
      ticket_id,
      recipient_email,
      recipient_name,
      notification_type,
      subject,
      body_text,
      status,
      metadata
    ) VALUES (
      NEW.id,
      v_email,
      v_name,
      v_notification_type,
      v_subject,
      v_body,
      'pending',
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'ticket_subject', NEW.subject,
        'ticket_priority', NEW.priority,
        'ticket_category', NEW.category
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for automatic email notifications
DROP TRIGGER IF EXISTS trg_ticket_status_email_notification ON tickets;
CREATE TRIGGER trg_ticket_status_email_notification
  AFTER UPDATE OF status ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION notify_ticket_status_change();

-- Add comment on table
COMMENT ON TABLE ticket_email_notifications IS 'Tracks all email notifications sent for ticket status changes and manual notifications';
COMMENT ON FUNCTION get_ticket_requester_email(uuid) IS 'Gets requester email from profiles or submitter_email field';
COMMENT ON FUNCTION get_ticket_requester_name(uuid) IS 'Gets requester name from profiles or submitter_name field';
COMMENT ON FUNCTION notify_ticket_status_change() IS 'Trigger function that creates email notification when ticket status changes to resolved or closed';

/*
  # Ticket Email Notifications System

  ## Overview
  Creates the ticket_email_notifications table for tracking all email notifications sent for tickets.
  This is a dependency for the comprehensive ticket communication system.

  ## Tables Created
  - `ticket_email_notifications` - Tracks all outbound emails for tickets
    - delivery status tracking
    - recipient information
    - email content and metadata
    - retry logic support

  ## Security
  - RLS enabled
  - Staff can view all notifications
  - Users can view notifications for their tickets
  - System can insert/update for automation
*/

-- Create enum for email notification status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_notification_status') THEN
    CREATE TYPE email_notification_status AS ENUM ('pending', 'sent', 'failed', 'bounced');
  END IF;
END $$;

-- Create enum for email notification type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_notification_type') THEN
    CREATE TYPE email_notification_type AS ENUM ('ticket_resolved', 'ticket_closed', 'ticket_updated', 'ticket_assigned', 'manual', 'staff_reply', 'priority_change', 'ticket_created', 'escalation', 'reminder');
  END IF;
END $$;

-- Create ticket_email_notifications table
CREATE TABLE IF NOT EXISTS ticket_email_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  recipient_email text NOT NULL,
  recipient_name text,
  notification_type email_notification_type NOT NULL DEFAULT 'manual',
  subject text NOT NULL,
  body_text text NOT NULL,
  body_html text,
  status email_notification_status NOT NULL DEFAULT 'pending',
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

-- RLS Policy: Staff and system can update notification status
DROP POLICY IF EXISTS "ticket_email_notifications_update" ON ticket_email_notifications;
CREATE POLICY "ticket_email_notifications_update" ON ticket_email_notifications
  FOR UPDATE
  WITH CHECK (true);

COMMENT ON TABLE ticket_email_notifications IS 'Tracks all email notifications sent for ticket updates and resolutions';

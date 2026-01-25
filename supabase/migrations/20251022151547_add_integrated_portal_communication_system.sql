/*
  # Integrated Multi-Portal Communication and Ticketing System
  
  ## Overview
  This migration creates a comprehensive communication system enabling all portal users
  (advisors, members, concierge, staff) to track their tickets and communicate with the IT team.
  
  ## 1. New Tables
  
  ### `ticket_watchers`
  Users who are following a ticket for updates
  - `id` (uuid, primary key)
  - `ticket_id` (uuid, references tickets)
  - `user_id` (uuid, references profiles)
  - `created_at` (timestamptz)
  
  ### `ticket_read_status`
  Tracks which users have read which messages
  - `id` (uuid, primary key)
  - `ticket_id` (uuid, references tickets)
  - `user_id` (uuid, references profiles)
  - `last_read_at` (timestamptz)
  - `unread_count` (integer)
  
  ### `notification_preferences`
  User preferences for notifications
  - `id` (uuid, primary key)
  - `user_id` (uuid, references profiles)
  - `email_notifications` (boolean)
  - `in_app_notifications` (boolean)
  - `notification_frequency` (text) - instant, hourly, daily
  - `do_not_disturb_start` (time)
  - `do_not_disturb_end` (time)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### `ticket_notifications`
  Queue for pending notifications
  - `id` (uuid, primary key)
  - `ticket_id` (uuid, references tickets)
  - `user_id` (uuid, references profiles)
  - `notification_type` (text) - new_message, status_change, assignment, etc.
  - `title` (text)
  - `message` (text)
  - `is_read` (boolean)
  - `created_at` (timestamptz)
  
  ### `ticket_status_history`
  Audit trail of all ticket status changes
  - `id` (uuid, primary key)
  - `ticket_id` (uuid, references tickets)
  - `changed_by` (uuid, references profiles)
  - `old_status` (ticket_status)
  - `new_status` (ticket_status)
  - `comment` (text)
  - `created_at` (timestamptz)
  
  ### `canned_responses`
  Pre-written responses for common questions
  - `id` (uuid, primary key)
  - `title` (text)
  - `content` (text)
  - `category` (text)
  - `created_by` (uuid, references profiles)
  - `is_active` (boolean)
  - `created_at` (timestamptz)
  
  ## 2. Extended Columns
  - Add `last_message_at` to tickets for sorting
  - Add `response_count` to tickets for activity tracking
  - Add `satisfaction_rating` to tickets (1-5)
  - Add `satisfaction_comment` to tickets
  
  ## 3. Security
  - Enable RLS on all new tables
  - Users can only see notifications for tickets they have access to
  - Only staff can create canned responses
  - Watchers can view tickets they're watching
  
  ## 4. Functions
  - Auto-update last_message_at when messages are added
  - Auto-create notifications when messages are sent
  - Auto-track status changes in history table
  
  ## 5. Indexes
  - Performance indexes on all foreign keys and frequently queried fields
*/

-- Create ticket_watchers table
CREATE TABLE IF NOT EXISTS ticket_watchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(ticket_id, user_id)
);

-- Create ticket_read_status table
CREATE TABLE IF NOT EXISTS ticket_read_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  last_read_at timestamptz DEFAULT now(),
  unread_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(ticket_id, user_id)
);

-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email_notifications boolean DEFAULT true,
  in_app_notifications boolean DEFAULT true,
  notification_frequency text DEFAULT 'instant' CHECK (notification_frequency IN ('instant', 'hourly', 'daily')),
  do_not_disturb_start time,
  do_not_disturb_end time,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create ticket_notifications table
CREATE TABLE IF NOT EXISTS ticket_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  notification_type text NOT NULL,
  title text NOT NULL,
  message text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create ticket_status_history table
CREATE TABLE IF NOT EXISTS ticket_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  changed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  old_status ticket_status,
  new_status ticket_status NOT NULL,
  comment text,
  created_at timestamptz DEFAULT now()
);

-- Create canned_responses table
CREATE TABLE IF NOT EXISTS canned_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  category text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Add new columns to tickets table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'last_message_at'
  ) THEN
    ALTER TABLE tickets ADD COLUMN last_message_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'response_count'
  ) THEN
    ALTER TABLE tickets ADD COLUMN response_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'satisfaction_rating'
  ) THEN
    ALTER TABLE tickets ADD COLUMN satisfaction_rating integer CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'satisfaction_comment'
  ) THEN
    ALTER TABLE tickets ADD COLUMN satisfaction_comment text;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ticket_watchers_ticket ON ticket_watchers(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_watchers_user ON ticket_watchers(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_read_status_ticket ON ticket_read_status(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_read_status_user ON ticket_read_status(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_notifications_ticket ON ticket_notifications(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_notifications_user ON ticket_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_notifications_read ON ticket_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_ticket_status_history_ticket ON ticket_status_history(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tickets_last_message_at ON tickets(last_message_at);
CREATE INDEX IF NOT EXISTS idx_canned_responses_active ON canned_responses(is_active);

-- Enable Row Level Security
ALTER TABLE ticket_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_read_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE canned_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ticket_watchers

-- Users can view watchers for tickets they have access to
CREATE POLICY "ticket_watchers_view_accessible" ON ticket_watchers
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_id
      AND (
        t.requester_id = auth.uid()
        OR t.assignee_id = auth.uid()
        OR t.submitted_by_concierge = auth.uid()
        OR user_id = auth.uid()
        OR EXISTS(
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role IN ('agent', 'it', 'staff', 'admin', 'super_admin')
        )
      )
    )
  );

-- Users can watch tickets they have access to
CREATE POLICY "ticket_watchers_insert" ON ticket_watchers
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS(
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_id
      AND (
        t.requester_id = auth.uid()
        OR t.assignee_id = auth.uid()
        OR t.submitted_by_concierge = auth.uid()
        OR EXISTS(
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role IN ('agent', 'it', 'staff', 'admin', 'super_admin')
        )
      )
    )
  );

-- Users can remove themselves from watching
CREATE POLICY "ticket_watchers_delete" ON ticket_watchers
  FOR DELETE
  USING (user_id = auth.uid());

-- RLS Policies for ticket_read_status

-- Users can view their own read status
CREATE POLICY "ticket_read_status_self" ON ticket_read_status
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for notification_preferences

-- Users can manage their own preferences
CREATE POLICY "notification_preferences_self" ON notification_preferences
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for ticket_notifications

-- Users can view their own notifications
CREATE POLICY "ticket_notifications_self_read" ON ticket_notifications
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can update their own notifications
CREATE POLICY "ticket_notifications_self_update" ON ticket_notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- System can create notifications for any user
CREATE POLICY "ticket_notifications_insert" ON ticket_notifications
  FOR INSERT
  WITH CHECK (true);

-- RLS Policies for ticket_status_history

-- Users can view status history for tickets they have access to
CREATE POLICY "ticket_status_history_view" ON ticket_status_history
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_id
      AND (
        t.requester_id = auth.uid()
        OR t.assignee_id = auth.uid()
        OR t.submitted_by_concierge = auth.uid()
        OR EXISTS(
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role IN ('agent', 'it', 'staff', 'admin', 'super_admin')
        )
      )
    )
  );

-- System can insert status history
CREATE POLICY "ticket_status_history_insert" ON ticket_status_history
  FOR INSERT
  WITH CHECK (true);

-- RLS Policies for canned_responses

-- Staff can view active canned responses
CREATE POLICY "canned_responses_staff_read" ON canned_responses
  FOR SELECT
  USING (
    is_active = true
    AND EXISTS(
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('agent', 'it', 'staff', 'admin', 'super_admin')
    )
  );

-- Staff can manage canned responses
CREATE POLICY "canned_responses_staff_all" ON canned_responses
  FOR ALL
  USING (
    EXISTS(
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('agent', 'it', 'staff', 'admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('agent', 'it', 'staff', 'admin', 'super_admin')
    )
  );

-- Function to update last_message_at on tickets
CREATE OR REPLACE FUNCTION update_ticket_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE tickets
  SET 
    last_message_at = NEW.created_at,
    response_count = response_count + 1
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_message_at when comments are added
DROP TRIGGER IF EXISTS update_ticket_last_message_trigger ON ticket_comments;
CREATE TRIGGER update_ticket_last_message_trigger
  AFTER INSERT ON ticket_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_last_message();

-- Trigger to update last_message_at when channel messages are added
DROP TRIGGER IF EXISTS update_ticket_last_message_from_channel ON channel_messages;
CREATE TRIGGER update_ticket_last_message_from_channel
  AFTER INSERT ON channel_messages
  FOR EACH ROW
  WHEN (NEW.ticket_id IS NOT NULL)
  EXECUTE FUNCTION update_ticket_last_message();

-- Function to track ticket status changes
CREATE OR REPLACE FUNCTION track_ticket_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO ticket_status_history (
      ticket_id,
      changed_by,
      old_status,
      new_status
    ) VALUES (
      NEW.id,
      auth.uid(),
      OLD.status,
      NEW.status
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to track status changes
DROP TRIGGER IF EXISTS track_ticket_status_change_trigger ON tickets;
CREATE TRIGGER track_ticket_status_change_trigger
  AFTER UPDATE ON tickets
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION track_ticket_status_change();

-- Function to create notifications for ticket updates
CREATE OR REPLACE FUNCTION create_ticket_notification()
RETURNS TRIGGER AS $$
DECLARE
  ticket_record RECORD;
  notification_title text;
  notification_message text;
  recipient_id uuid;
BEGIN
  -- Get ticket details
  SELECT * INTO ticket_record FROM tickets WHERE id = NEW.ticket_id;
  
  -- Create notification for requester (if different from author)
  IF ticket_record.requester_id IS NOT NULL AND ticket_record.requester_id != NEW.author_id THEN
    notification_title := 'New message on your ticket';
    notification_message := LEFT(NEW.body, 100);
    
    INSERT INTO ticket_notifications (
      ticket_id,
      user_id,
      notification_type,
      title,
      message
    ) VALUES (
      NEW.ticket_id,
      ticket_record.requester_id,
      'new_message',
      notification_title,
      notification_message
    );
  END IF;
  
  -- Create notification for assignee (if different from author and requester)
  IF ticket_record.assignee_id IS NOT NULL 
     AND ticket_record.assignee_id != NEW.author_id 
     AND ticket_record.assignee_id != ticket_record.requester_id THEN
    
    INSERT INTO ticket_notifications (
      ticket_id,
      user_id,
      notification_type,
      title,
      message
    ) VALUES (
      NEW.ticket_id,
      ticket_record.assignee_id,
      'new_message',
      notification_title,
      notification_message
    );
  END IF;
  
  -- Create notification for concierge who submitted (if applicable)
  IF ticket_record.submitted_by_concierge IS NOT NULL 
     AND ticket_record.submitted_by_concierge != NEW.author_id THEN
    
    INSERT INTO ticket_notifications (
      ticket_id,
      user_id,
      notification_type,
      title,
      message
    ) VALUES (
      NEW.ticket_id,
      ticket_record.submitted_by_concierge,
      'new_message',
      'New message on ticket you submitted',
      notification_message
    );
  END IF;
  
  -- Create notifications for watchers (excluding author)
  INSERT INTO ticket_notifications (
    ticket_id,
    user_id,
    notification_type,
    title,
    message
  )
  SELECT
    NEW.ticket_id,
    tw.user_id,
    'new_message',
    'New message on watched ticket',
    notification_message
  FROM ticket_watchers tw
  WHERE tw.ticket_id = NEW.ticket_id
    AND tw.user_id != NEW.author_id
    AND tw.user_id NOT IN (
      ticket_record.requester_id,
      ticket_record.assignee_id,
      COALESCE(ticket_record.submitted_by_concierge, '00000000-0000-0000-0000-000000000000'::uuid)
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create notifications on new comments
DROP TRIGGER IF EXISTS create_ticket_notification_trigger ON ticket_comments;
CREATE TRIGGER create_ticket_notification_trigger
  AFTER INSERT ON ticket_comments
  FOR EACH ROW
  WHEN (NEW.is_internal = false)
  EXECUTE FUNCTION create_ticket_notification();

-- Insert some default canned responses
INSERT INTO canned_responses (title, content, category, is_active)
VALUES 
  ('Thank you for contacting us', 'Thank you for reaching out to MPB Health IT Support. We have received your request and will respond shortly.', 'greeting', true),
  ('More information needed', 'Thank you for your ticket. To better assist you, could you please provide more details about the issue you are experiencing?', 'follow-up', true),
  ('Issue resolved', 'We are happy to inform you that your issue has been resolved. If you experience any further problems, please do not hesitate to reach out.', 'resolution', true),
  ('Password reset instructions', 'To reset your password, please visit the login page and click on "Forgot Password". Follow the instructions sent to your email.', 'password', true),
  ('Under investigation', 'We are currently investigating your issue. We will update you as soon as we have more information. Thank you for your patience.', 'status-update', true)
ON CONFLICT DO NOTHING;

-- Create view for ticket with unread counts
CREATE OR REPLACE VIEW tickets_with_unread AS
SELECT 
  t.*,
  COALESCE(trs.unread_count, 0) as unread_count,
  COALESCE(trs.last_read_at, t.created_at) as last_read_at
FROM tickets t
LEFT JOIN ticket_read_status trs ON trs.ticket_id = t.id AND trs.user_id = auth.uid();

-- Create view for user's accessible tickets
CREATE OR REPLACE VIEW my_accessible_tickets AS
SELECT DISTINCT
  t.*,
  COALESCE(trs.unread_count, 0) as unread_count,
  p_req.full_name as requester_name,
  p_req.email as requester_email,
  p_asn.full_name as assignee_name,
  p_asn.email as assignee_email
FROM tickets t
LEFT JOIN ticket_read_status trs ON trs.ticket_id = t.id AND trs.user_id = auth.uid()
LEFT JOIN profiles p_req ON p_req.id = t.requester_id
LEFT JOIN profiles p_asn ON p_asn.id = t.assignee_id
WHERE 
  t.requester_id = auth.uid()
  OR t.assignee_id = auth.uid()
  OR t.submitted_by_concierge = auth.uid()
  OR EXISTS(
    SELECT 1 FROM ticket_watchers tw
    WHERE tw.ticket_id = t.id AND tw.user_id = auth.uid()
  )
  OR EXISTS(
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('agent', 'it', 'staff', 'admin', 'super_admin')
  )
  OR (t.origin IN ('member', 'concierge') AND t.submitter_email IS NOT NULL);

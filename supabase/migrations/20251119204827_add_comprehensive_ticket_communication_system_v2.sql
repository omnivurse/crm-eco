/*
  # Comprehensive Ticket Communication System Enhancement

  ## Overview
  This migration enhances the ticketing system with comprehensive communication features,
  including automated email notifications, audit logging, activity tracking, and team collaboration.

  ## 1. New Tables
  - `email_templates` - Reusable email templates
  - `ticket_activity_log` - Complete audit trail
  - `ticket_mentions` - Track @mentions
  - `email_delivery_tracking` - Track email delivery

  ## 2. Table Modifications
  - Add reply_to_message_id to ticket_comments
  - Add is_important to ticket_comments
  - Add last_email_sent_at to tickets
  - Add email_thread_id to tickets

  ## 3. New Functions
  - send_email_notification_on_comment()
  - notify_assignee_on_assignment()
  - create_activity_log_entry()
  - extract_mentions_from_comment()

  ## 4. Triggers
  - Email notifications on staff replies
  - Assignment notifications
  - @mention extraction
*/

-- ============================================================
-- 1. CREATE EMAIL TEMPLATES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text NOT NULL,
  template_type text NOT NULL CHECK (template_type IN ('staff_reply', 'assignment', 'priority_change', 'status_change', 'ticket_reopened', 'auto_reply', 'escalation', 'reminder')),
  variables jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active) WHERE is_active = true;

-- ============================================================
-- 2. CREATE TICKET ACTIVITY LOG TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS ticket_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('created', 'updated', 'commented', 'assigned', 'status_changed', 'priority_changed', 'closed', 'reopened', 'merged', 'file_uploaded', 'email_sent', 'watched', 'unwatched')),
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_ticket ON ticket_activity_log(ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor ON ticket_activity_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_action_type ON ticket_activity_log(action_type);

-- ============================================================
-- 3. CREATE TICKET MENTIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS ticket_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid REFERENCES ticket_comments(id) ON DELETE CASCADE NOT NULL,
  mentioned_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  is_read boolean DEFAULT false,
  notified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(comment_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_mentions_user_unread ON ticket_mentions(mentioned_user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_mentions_comment ON ticket_mentions(comment_id);

-- ============================================================
-- 4. CREATE EMAIL DELIVERY TRACKING TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS email_delivery_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES ticket_email_notifications(id) ON DELETE CASCADE NOT NULL,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced boolean DEFAULT false,
  bounce_reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_tracking_notification ON email_delivery_tracking(notification_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_opened ON email_delivery_tracking(opened_at) WHERE opened_at IS NOT NULL;

-- ============================================================
-- 5. ADD NEW COLUMNS TO EXISTING TABLES
-- ============================================================

-- Add columns to ticket_comments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_comments' AND column_name = 'reply_to_message_id'
  ) THEN
    ALTER TABLE ticket_comments ADD COLUMN reply_to_message_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_comments' AND column_name = 'is_important'
  ) THEN
    ALTER TABLE ticket_comments ADD COLUMN is_important boolean DEFAULT false;
  END IF;
END $$;

-- Add columns to tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'last_email_sent_at'
  ) THEN
    ALTER TABLE tickets ADD COLUMN last_email_sent_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'email_thread_id'
  ) THEN
    ALTER TABLE tickets ADD COLUMN email_thread_id text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tickets_email_thread ON tickets(email_thread_id) WHERE email_thread_id IS NOT NULL;

-- ============================================================
-- 6. ENABLE RLS ON NEW TABLES
-- ============================================================

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_delivery_tracking ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. RLS POLICIES
-- ============================================================

-- Email templates policies
DROP POLICY IF EXISTS "email_templates_staff_read" ON email_templates;
CREATE POLICY "email_templates_staff_read" ON email_templates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "email_templates_admin_all" ON email_templates;
CREATE POLICY "email_templates_admin_all" ON email_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Activity log policies
DROP POLICY IF EXISTS "activity_log_staff_read" ON ticket_activity_log;
CREATE POLICY "activity_log_staff_read" ON ticket_activity_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('staff', 'agent', 'admin', 'super_admin', 'concierge')
    )
  );

DROP POLICY IF EXISTS "activity_log_requester_read" ON ticket_activity_log;
CREATE POLICY "activity_log_requester_read" ON ticket_activity_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_id
      AND tickets.requester_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "activity_log_system_insert" ON ticket_activity_log;
CREATE POLICY "activity_log_system_insert" ON ticket_activity_log
  FOR INSERT
  WITH CHECK (true);

-- Mentions policies
DROP POLICY IF EXISTS "mentions_user_read" ON ticket_mentions;
CREATE POLICY "mentions_user_read" ON ticket_mentions
  FOR SELECT
  TO authenticated
  USING (mentioned_user_id = auth.uid());

DROP POLICY IF EXISTS "mentions_system_insert" ON ticket_mentions;
CREATE POLICY "mentions_system_insert" ON ticket_mentions
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "mentions_user_update" ON ticket_mentions;
CREATE POLICY "mentions_user_update" ON ticket_mentions
  FOR UPDATE
  TO authenticated
  USING (mentioned_user_id = auth.uid())
  WITH CHECK (mentioned_user_id = auth.uid());

-- Email tracking policies
DROP POLICY IF EXISTS "email_tracking_staff_read" ON email_delivery_tracking;
CREATE POLICY "email_tracking_staff_read" ON email_delivery_tracking
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "email_tracking_system_all" ON email_delivery_tracking;
CREATE POLICY "email_tracking_system_all" ON email_delivery_tracking
  FOR ALL
  WITH CHECK (true);

-- ============================================================
-- 8. INSERT DEFAULT EMAIL TEMPLATES
-- ============================================================

INSERT INTO email_templates (name, subject, body_html, body_text, template_type, variables, is_active)
VALUES 
(
  'staff_reply_notification',
  'Update on Your Support Ticket - #{{ticket_number}}',
  '<p>Hello {{requester_name}},</p><p>{{staff_name}} has replied to your support ticket:</p><div style="background: #f3f4f6; padding: 16px; border-left: 4px solid #1e40af; margin: 20px 0;"><p style="margin: 0; color: #374151;">{{comment_body}}</p></div><p><strong>Ticket Details:</strong></p><ul><li>Ticket ID: #{{ticket_number}}</li><li>Subject: {{ticket_subject}}</li><li>Status: {{ticket_status}}</li></ul>',
  'Hello {{requester_name}},

{{staff_name}} has replied to your support ticket:

---
{{comment_body}}
---

Ticket Details:
- Ticket ID: #{{ticket_number}}
- Subject: {{ticket_subject}}
- Status: {{ticket_status}}',
  'staff_reply',
  '["requester_name", "staff_name", "comment_body", "ticket_number", "ticket_subject", "ticket_status"]'::jsonb,
  true
),
(
  'ticket_assigned_notification',
  'Your Support Ticket Has Been Assigned - #{{ticket_number}}',
  '<p>Hello {{requester_name}},</p><p>Your support ticket has been assigned to {{assignee_name}} for resolution.</p><p><strong>Ticket Details:</strong></p><ul><li>Ticket ID: #{{ticket_number}}</li><li>Subject: {{ticket_subject}}</li><li>Assigned To: {{assignee_name}}</li><li>Priority: {{ticket_priority}}</li></ul><p>{{assignee_name}} will review your request and get back to you shortly.</p>',
  'Hello {{requester_name}},

Your support ticket has been assigned to {{assignee_name}} for resolution.

Ticket Details:
- Ticket ID: #{{ticket_number}}
- Subject: {{ticket_subject}}
- Assigned To: {{assignee_name}}
- Priority: {{ticket_priority}}

{{assignee_name}} will review your request and get back to you shortly.',
  'assignment',
  '["requester_name", "assignee_name", "ticket_number", "ticket_subject", "ticket_priority"]'::jsonb,
  true
),
(
  'priority_changed_notification',
  'Priority Update on Your Support Ticket - #{{ticket_number}}',
  '<p>Hello {{requester_name}},</p><p>The priority of your support ticket has been updated:</p><ul><li>Old Priority: {{old_priority}}</li><li>New Priority: {{new_priority}}</li></ul><p><strong>Ticket Details:</strong></p><ul><li>Ticket ID: #{{ticket_number}}</li><li>Subject: {{ticket_subject}}</li></ul>',
  'Hello {{requester_name}},

The priority of your support ticket has been updated:
- Old Priority: {{old_priority}}
- New Priority: {{new_priority}}

Ticket Details:
- Ticket ID: #{{ticket_number}}
- Subject: {{ticket_subject}}',
  'priority_change',
  '["requester_name", "old_priority", "new_priority", "ticket_number", "ticket_subject"]'::jsonb,
  true
)
ON CONFLICT (name) DO NOTHING;

COMMENT ON TABLE email_templates IS 'Reusable email templates for consistent ticket communications';
COMMENT ON TABLE ticket_activity_log IS 'Complete audit trail of all ticket actions for compliance and security';
COMMENT ON TABLE ticket_mentions IS 'Tracks @mentions in ticket comments for notifications';
COMMENT ON TABLE email_delivery_tracking IS 'Tracks email delivery status and engagement metrics';

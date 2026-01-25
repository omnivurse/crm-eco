/*
  # Ticket Communication System Triggers and Functions

  ## Overview
  Creates the trigger functions for automated email notifications, activity logging,
  and @mention extraction in the ticket communication system.

  ## Functions Created
  1. `create_activity_log_entry()` - Centralized activity logging
  2. `extract_mentions_from_comment()` - Parse @mentions from comments
  3. `send_email_notification_on_comment()` - Email notification for staff replies
  4. `notify_assignee_on_assignment()` - Notification when ticket assigned

  ## Triggers Created
  1. Email notifications on non-internal staff replies
  2. Assignment notifications to requester
  3. @mention extraction from comment text
*/

-- ============================================================
-- 1. ACTIVITY LOG HELPER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION create_activity_log_entry(
  p_ticket_id uuid,
  p_action_type text,
  p_actor_id uuid,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO ticket_activity_log (ticket_id, action_type, actor_id, details)
  VALUES (p_ticket_id, p_action_type, p_actor_id, p_details)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- ============================================================
-- 2. EXTRACT @MENTIONS FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION extract_mentions_from_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mention text;
  v_email text;
  v_user_id uuid;
BEGIN
  -- Extract email addresses with @ prefix (@user@example.com)
  FOR v_mention IN 
    SELECT DISTINCT regexp_matches[1]
    FROM regexp_matches(NEW.body, '@(\S+@\S+\.\S+)', 'g') AS regexp_matches
  LOOP
    v_email := v_mention;
    
    -- Find user by email
    SELECT id INTO v_user_id
    FROM profiles
    WHERE email = v_email
    LIMIT 1;
    
    -- Create mention if user found and not the author
    IF v_user_id IS NOT NULL AND v_user_id != NEW.author_id THEN
      INSERT INTO ticket_mentions (comment_id, mentioned_user_id)
      VALUES (NEW.id, v_user_id)
      ON CONFLICT (comment_id, mentioned_user_id) DO NOTHING;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. EMAIL NOTIFICATION ON STAFF REPLY FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION send_email_notification_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ticket record;
  v_author record;
  v_email text;
  v_name text;
  v_template record;
  v_subject text;
  v_body_text text;
  v_body_html text;
BEGIN
  -- Only send email for non-internal comments
  IF NEW.is_internal = true THEN
    RETURN NEW;
  END IF;
  
  -- Get ticket details
  SELECT t.*, p.email AS requester_email, p.full_name AS requester_name
  INTO v_ticket
  FROM tickets t
  LEFT JOIN profiles p ON t.requester_id = p.id
  WHERE t.id = NEW.ticket_id;
  
  IF v_ticket IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Determine recipient email (requester or anonymous submitter)
  v_email := COALESCE(v_ticket.requester_email, v_ticket.submitter_email);
  
  IF v_email IS NULL OR v_email = '' THEN
    RETURN NEW;
  END IF;
  
  v_name := COALESCE(v_ticket.requester_name, v_ticket.submitter_name, 'Valued Customer');
  
  -- Get author details
  SELECT full_name, email INTO v_author
  FROM profiles
  WHERE id = NEW.author_id;
  
  -- Get email template
  SELECT * INTO v_template
  FROM email_templates
  WHERE template_type = 'staff_reply' AND is_active = true
  LIMIT 1;
  
  IF v_template IS NOT NULL THEN
    -- Replace variables in template
    v_subject := v_template.subject;
    v_subject := replace(v_subject, '{{ticket_number}}', substring(v_ticket.id::text, 1, 8));
    
    v_body_text := v_template.body_text;
    v_body_text := replace(v_body_text, '{{requester_name}}', v_name);
    v_body_text := replace(v_body_text, '{{staff_name}}', COALESCE(v_author.full_name, 'Support Team'));
    v_body_text := replace(v_body_text, '{{comment_body}}', NEW.body);
    v_body_text := replace(v_body_text, '{{ticket_number}}', substring(v_ticket.id::text, 1, 8));
    v_body_text := replace(v_body_text, '{{ticket_subject}}', v_ticket.subject);
    v_body_text := replace(v_body_text, '{{ticket_status}}', v_ticket.status);
    
    v_body_html := v_template.body_html;
    v_body_html := replace(v_body_html, '{{requester_name}}', v_name);
    v_body_html := replace(v_body_html, '{{staff_name}}', COALESCE(v_author.full_name, 'Support Team'));
    v_body_html := replace(v_body_html, '{{comment_body}}', replace(NEW.body, E'\n', '<br>'));
    v_body_html := replace(v_body_html, '{{ticket_number}}', substring(v_ticket.id::text, 1, 8));
    v_body_html := replace(v_body_html, '{{ticket_subject}}', v_ticket.subject);
    v_body_html := replace(v_body_html, '{{ticket_status}}', v_ticket.status);
  ELSE
    -- Fallback if no template
    v_subject := 'Update on Your Support Ticket - #' || substring(v_ticket.id::text, 1, 8);
    v_body_text := 'Hello ' || v_name || ',

' || COALESCE(v_author.full_name, 'Our support team') || ' has replied to your support ticket:

' || NEW.body || '

Ticket Details:
- Ticket ID: #' || substring(v_ticket.id::text, 1, 8) || '
- Subject: ' || v_ticket.subject || '
- Status: ' || v_ticket.status;
  END IF;
  
  -- Create email notification
  INSERT INTO ticket_email_notifications (
    ticket_id,
    recipient_email,
    recipient_name,
    notification_type,
    subject,
    body_text,
    body_html,
    status,
    metadata
  ) VALUES (
    v_ticket.id,
    v_email,
    v_name,
    'staff_reply',
    v_subject,
    v_body_text,
    v_body_html,
    'pending',
    jsonb_build_object(
      'comment_id', NEW.id,
      'author_id', NEW.author_id,
      'author_name', COALESCE(v_author.full_name, 'Support Team'),
      'triggered_by', 'staff_reply'
    )
  );
  
  -- Update ticket's last_email_sent_at
  UPDATE tickets
  SET last_email_sent_at = now()
  WHERE id = v_ticket.id;
  
  -- Log activity
  PERFORM create_activity_log_entry(
    v_ticket.id,
    'email_sent',
    NEW.author_id,
    jsonb_build_object(
      'comment_id', NEW.id,
      'recipient', v_email,
      'subject', v_subject
    )
  );
  
  RETURN NEW;
END;
$$;

-- ============================================================
-- 4. ASSIGNMENT NOTIFICATION FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION notify_assignee_on_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assignee record;
  v_requester record;
BEGIN
  -- Only notify if assignee changed
  IF NEW.assignee_id IS NULL OR 
     (OLD.assignee_id IS NOT NULL AND OLD.assignee_id = NEW.assignee_id) THEN
    RETURN NEW;
  END IF;
  
  -- Get assignee details
  SELECT id, full_name, email INTO v_assignee
  FROM profiles
  WHERE id = NEW.assignee_id;
  
  IF v_assignee IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get requester details
  SELECT full_name, email INTO v_requester
  FROM profiles
  WHERE id = NEW.requester_id;
  
  -- Create in-app notification for assignee
  INSERT INTO ticket_notifications (
    ticket_id,
    user_id,
    notification_type,
    title,
    message
  ) VALUES (
    NEW.id,
    v_assignee.id,
    'assignment',
    'New Ticket Assigned to You',
    'Ticket #' || substring(NEW.id::text, 1, 8) || ' - ' || NEW.subject || ' has been assigned to you.'
  );
  
  -- Send email to requester if they have an email
  IF v_requester.email IS NOT NULL AND v_requester.email != '' THEN
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
      v_requester.email,
      COALESCE(v_requester.full_name, NEW.submitter_name, 'Valued Customer'),
      'ticket_assigned',
      'Your Support Ticket Has Been Assigned - #' || substring(NEW.id::text, 1, 8),
      'Hello ' || COALESCE(v_requester.full_name, NEW.submitter_name, 'Valued Customer') || ',

Your support ticket has been assigned to ' || v_assignee.full_name || ' for resolution.

Ticket Details:
- Ticket ID: #' || substring(NEW.id::text, 1, 8) || '
- Subject: ' || NEW.subject || '
- Assigned To: ' || v_assignee.full_name || '
- Priority: ' || NEW.priority || '

' || v_assignee.full_name || ' will review your request and get back to you shortly.

Thank you for your patience.

Best regards,
MPB Health Support Team',
      'pending',
      jsonb_build_object(
        'assignee_id', v_assignee.id,
        'assignee_name', v_assignee.full_name,
        'triggered_by', 'assignment'
      )
    );
  END IF;
  
  -- Log activity
  PERFORM create_activity_log_entry(
    NEW.id,
    'assigned',
    NEW.assignee_id,
    jsonb_build_object(
      'old_assignee_id', OLD.assignee_id,
      'new_assignee_id', NEW.assignee_id,
      'assignee_name', v_assignee.full_name
    )
  );
  
  RETURN NEW;
END;
$$;

-- ============================================================
-- 5. CREATE TRIGGERS
-- ============================================================

-- Trigger for email notifications on staff replies
DROP TRIGGER IF EXISTS trg_send_email_on_comment ON ticket_comments;
CREATE TRIGGER trg_send_email_on_comment
  AFTER INSERT ON ticket_comments
  FOR EACH ROW
  EXECUTE FUNCTION send_email_notification_on_comment();

-- Trigger for assignment notifications
DROP TRIGGER IF EXISTS trg_notify_on_assignment ON tickets;
CREATE TRIGGER trg_notify_on_assignment
  AFTER UPDATE OF assignee_id ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION notify_assignee_on_assignment();

-- Trigger for extracting mentions
DROP TRIGGER IF EXISTS trg_extract_mentions ON ticket_comments;
CREATE TRIGGER trg_extract_mentions
  AFTER INSERT ON ticket_comments
  FOR EACH ROW
  EXECUTE FUNCTION extract_mentions_from_comment();

-- ============================================================
-- 6. ADD FUNCTION COMMENTS
-- ============================================================

COMMENT ON FUNCTION create_activity_log_entry(uuid, text, uuid, jsonb) IS 'Centralized function to log ticket activities for audit trail';
COMMENT ON FUNCTION extract_mentions_from_comment() IS 'Extracts @mentions from comment text and creates mention records for notifications';
COMMENT ON FUNCTION send_email_notification_on_comment() IS 'Sends email notification to ticket requester when staff replies (non-internal only)';
COMMENT ON FUNCTION notify_assignee_on_assignment() IS 'Notifies assignee via in-app notification and sends email to requester when ticket is assigned';

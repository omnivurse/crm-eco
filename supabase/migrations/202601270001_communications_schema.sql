-- ============================================================================
-- PHASE 5: COMMUNICATIONS SCHEMA
-- Email templates, sent emails tracking, and notification preferences
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTION: GET USER PROFILE ID
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_profile_id()
RETURNS uuid AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION get_user_profile_id() TO authenticated;

-- ============================================================================
-- EMAIL TEMPLATES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Template identification
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  
  -- Email content
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text,
  
  -- Sender info (can override org defaults)
  from_name text,
  from_email text,
  reply_to text,
  
  -- Template variables (for documentation/validation)
  variables jsonb DEFAULT '[]',
  
  -- Status
  is_active boolean DEFAULT true,
  is_system boolean DEFAULT false, -- System templates can't be deleted
  
  -- Metadata
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(organization_id, slug)
);

CREATE INDEX idx_email_templates_org ON email_templates(organization_id);
CREATE INDEX idx_email_templates_slug ON email_templates(slug);
CREATE INDEX idx_email_templates_category ON email_templates(category);
CREATE INDEX idx_email_templates_active ON email_templates(is_active);

-- ============================================================================
-- SENT EMAILS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS sent_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Recipient info
  recipient_email text NOT NULL,
  recipient_name text,
  recipient_type text, -- 'member', 'advisor', 'lead', 'other'
  recipient_id uuid, -- Reference to member/advisor/lead id
  
  -- Email content
  template_id uuid REFERENCES email_templates(id) ON DELETE SET NULL,
  subject text NOT NULL,
  body_html text,
  body_text text,
  
  -- Sender info
  from_name text,
  from_email text NOT NULL,
  reply_to text,
  
  -- Delivery tracking
  status text NOT NULL DEFAULT 'pending',
  -- Status values: 'pending', 'queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'spam'
  
  resend_id text, -- Resend API message ID
  resend_response jsonb,
  
  -- Delivery events
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  failed_at timestamptz,
  
  -- Error info
  error_code text,
  error_message text,
  
  -- Context
  triggered_by text, -- 'manual', 'system', 'automation', 'api'
  triggered_by_profile_id uuid REFERENCES profiles(id),
  context jsonb DEFAULT '{}', -- Additional context data
  
  -- Metadata
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_sent_emails_org ON sent_emails(organization_id);
CREATE INDEX idx_sent_emails_recipient ON sent_emails(recipient_email);
CREATE INDEX idx_sent_emails_recipient_id ON sent_emails(recipient_id);
CREATE INDEX idx_sent_emails_template ON sent_emails(template_id);
CREATE INDEX idx_sent_emails_status ON sent_emails(status);
CREATE INDEX idx_sent_emails_created ON sent_emails(created_at);
CREATE INDEX idx_sent_emails_resend_id ON sent_emails(resend_id);

-- ============================================================================
-- NOTIFICATION PREFERENCES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Who this preference belongs to
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  
  -- Notification type
  notification_type text NOT NULL,
  -- Types: 'enrollment_confirmation', 'enrollment_approved', 'payment_reminder', 
  --        'payment_receipt', 'payment_failed', 'renewal_reminder', 'welcome',
  --        'password_reset', 'account_update', 'marketing', 'newsletter'
  
  -- Channels
  email_enabled boolean DEFAULT true,
  sms_enabled boolean DEFAULT false,
  push_enabled boolean DEFAULT false,
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Only one preference per user/type combo
  UNIQUE(profile_id, notification_type),
  UNIQUE(member_id, notification_type),
  
  -- Must have either profile_id or member_id
  CHECK (profile_id IS NOT NULL OR member_id IS NOT NULL)
);

CREATE INDEX idx_notification_prefs_org ON notification_preferences(organization_id);
CREATE INDEX idx_notification_prefs_profile ON notification_preferences(profile_id);
CREATE INDEX idx_notification_prefs_member ON notification_preferences(member_id);
CREATE INDEX idx_notification_prefs_type ON notification_preferences(notification_type);

-- ============================================================================
-- EMAIL QUEUE TABLE (for async sending)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Email details
  to_email text NOT NULL,
  to_name text,
  from_email text NOT NULL,
  from_name text,
  reply_to text,
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text,
  
  -- Template reference (optional)
  template_id uuid REFERENCES email_templates(id) ON DELETE SET NULL,
  template_data jsonb DEFAULT '{}',
  
  -- Context for tracking
  recipient_type text,
  recipient_id uuid,
  triggered_by text,
  triggered_by_profile_id uuid REFERENCES profiles(id),
  
  -- Queue status
  status text NOT NULL DEFAULT 'pending',
  -- Status: 'pending', 'processing', 'sent', 'failed'
  
  priority integer DEFAULT 0, -- Higher = more important
  scheduled_for timestamptz DEFAULT now(),
  attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 3,
  last_attempt_at timestamptz,
  
  -- Result
  sent_email_id uuid REFERENCES sent_emails(id),
  error_message text,
  
  -- Metadata
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_email_queue_org ON email_queue(organization_id);
CREATE INDEX idx_email_queue_status ON email_queue(status);
CREATE INDEX idx_email_queue_scheduled ON email_queue(scheduled_for);
CREATE INDEX idx_email_queue_priority ON email_queue(priority DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sent_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- Email Templates Policies
CREATE POLICY "Users can view email templates for their org"
  ON email_templates FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage email templates"
  ON email_templates FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- Sent Emails Policies
CREATE POLICY "Admins can view sent emails for their org"
  ON sent_emails FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

CREATE POLICY "System can insert sent emails"
  ON sent_emails FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

-- Notification Preferences Policies
CREATE POLICY "Users can view their own notification preferences"
  ON notification_preferences FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND (
      profile_id = get_user_profile_id()
      OR get_user_role() IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can manage their own notification preferences"
  ON notification_preferences FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND (
      profile_id = get_user_profile_id()
      OR get_user_role() IN ('owner', 'admin')
    )
  );

-- Email Queue Policies
CREATE POLICY "Admins can view email queue"
  ON email_queue FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

CREATE POLICY "System can manage email queue"
  ON email_queue FOR ALL
  USING (organization_id = get_user_organization_id());

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated_at trigger for email_templates
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Updated_at trigger for notification_preferences
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DEFAULT EMAIL TEMPLATES
-- ============================================================================

-- Note: These will be inserted per-organization when needed
-- This is just the structure definition

COMMENT ON TABLE email_templates IS 'Stores email templates for the organization';
COMMENT ON TABLE sent_emails IS 'Tracks all sent emails for analytics and debugging';
COMMENT ON TABLE notification_preferences IS 'User preferences for different notification types';
COMMENT ON TABLE email_queue IS 'Queue for async email sending with retry logic';

-- ============================================================================
-- EMAIL LOGGING & SYSTEM SETTINGS
-- Track sent emails and configure system-wide settings
-- ============================================================================

-- ============================================================================
-- EMAIL TEMPLATES (Configurable email templates)
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text,
  available_variables jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  is_system boolean DEFAULT false,
  version integer DEFAULT 1,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_email_templates_organization_id ON email_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_is_active ON email_templates(is_active);

-- ============================================================================
-- EXTEND SENT EMAILS TABLE (if it exists)
-- ============================================================================
DO $$
BEGIN
  -- Check if sent_emails exists and add columns if needed
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sent_emails') THEN
    -- First add the core columns that indexes depend on
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sent_emails' AND column_name = 'email_type') THEN
      ALTER TABLE sent_emails ADD COLUMN email_type text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sent_emails' AND column_name = 'member_id') THEN
      ALTER TABLE sent_emails ADD COLUMN member_id uuid REFERENCES members(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sent_emails' AND column_name = 'advisor_id') THEN
      ALTER TABLE sent_emails ADD COLUMN advisor_id uuid REFERENCES advisors(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sent_emails' AND column_name = 'enrollment_id') THEN
      ALTER TABLE sent_emails ADD COLUMN enrollment_id uuid REFERENCES enrollments(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sent_emails' AND column_name = 'billing_id') THEN
      ALTER TABLE sent_emails ADD COLUMN billing_id uuid;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sent_emails' AND column_name = 'template_id') THEN
      ALTER TABLE sent_emails ADD COLUMN template_id uuid REFERENCES email_templates(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sent_emails' AND column_name = 'recipient_name') THEN
      ALTER TABLE sent_emails ADD COLUMN recipient_name text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sent_emails' AND column_name = 'cc_emails') THEN
      ALTER TABLE sent_emails ADD COLUMN cc_emails text[];
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sent_emails' AND column_name = 'bcc_emails') THEN
      ALTER TABLE sent_emails ADD COLUMN bcc_emails text[];
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sent_emails' AND column_name = 'body_html') THEN
      ALTER TABLE sent_emails ADD COLUMN body_html text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sent_emails' AND column_name = 'body_text') THEN
      ALTER TABLE sent_emails ADD COLUMN body_text text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sent_emails' AND column_name = 'from_name') THEN
      ALTER TABLE sent_emails ADD COLUMN from_name text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sent_emails' AND column_name = 'reply_to') THEN
      ALTER TABLE sent_emails ADD COLUMN reply_to text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sent_emails' AND column_name = 'provider_message_id') THEN
      ALTER TABLE sent_emails ADD COLUMN provider_message_id text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sent_emails' AND column_name = 'provider_response') THEN
      ALTER TABLE sent_emails ADD COLUMN provider_response jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sent_emails' AND column_name = 'status_reason') THEN
      ALTER TABLE sent_emails ADD COLUMN status_reason text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sent_emails' AND column_name = 'delivered_at') THEN
      ALTER TABLE sent_emails ADD COLUMN delivered_at timestamptz;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sent_emails' AND column_name = 'opened_at') THEN
      ALTER TABLE sent_emails ADD COLUMN opened_at timestamptz;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sent_emails' AND column_name = 'clicked_at') THEN
      ALTER TABLE sent_emails ADD COLUMN clicked_at timestamptz;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sent_emails' AND column_name = 'bounced_at') THEN
      ALTER TABLE sent_emails ADD COLUMN bounced_at timestamptz;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sent_emails' AND column_name = 'complained_at') THEN
      ALTER TABLE sent_emails ADD COLUMN complained_at timestamptz;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sent_emails' AND column_name = 'open_count') THEN
      ALTER TABLE sent_emails ADD COLUMN open_count integer DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sent_emails' AND column_name = 'click_count') THEN
      ALTER TABLE sent_emails ADD COLUMN click_count integer DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sent_emails' AND column_name = 'error_code') THEN
      ALTER TABLE sent_emails ADD COLUMN error_code text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sent_emails' AND column_name = 'error_message') THEN
      ALTER TABLE sent_emails ADD COLUMN error_message text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sent_emails' AND column_name = 'retry_count') THEN
      ALTER TABLE sent_emails ADD COLUMN retry_count integer DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sent_emails' AND column_name = 'max_retries') THEN
      ALTER TABLE sent_emails ADD COLUMN max_retries integer DEFAULT 3;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sent_emails' AND column_name = 'next_retry_at') THEN
      ALTER TABLE sent_emails ADD COLUMN next_retry_at timestamptz;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sent_emails' AND column_name = 'metadata') THEN
      ALTER TABLE sent_emails ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
    END IF;
  ELSE
    -- Create table if it doesn't exist
    CREATE TABLE sent_emails (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      member_id uuid REFERENCES members(id) ON DELETE SET NULL,
      advisor_id uuid REFERENCES advisors(id) ON DELETE SET NULL,
      enrollment_id uuid REFERENCES enrollments(id) ON DELETE SET NULL,
      billing_id uuid,
      template_id uuid REFERENCES email_templates(id) ON DELETE SET NULL,
      email_type text NOT NULL,
      recipient_email text NOT NULL,
      recipient_name text,
      cc_emails text[],
      bcc_emails text[],
      subject text NOT NULL,
      body_html text,
      body_text text,
      from_email text NOT NULL,
      from_name text,
      reply_to text,
      provider text DEFAULT 'resend',
      provider_message_id text,
      provider_response jsonb,
      status text DEFAULT 'pending',
      status_reason text,
      sent_at timestamptz,
      delivered_at timestamptz,
      opened_at timestamptz,
      clicked_at timestamptz,
      bounced_at timestamptz,
      complained_at timestamptz,
      open_count integer DEFAULT 0,
      click_count integer DEFAULT 0,
      error_code text,
      error_message text,
      retry_count integer DEFAULT 0,
      max_retries integer DEFAULT 3,
      next_retry_at timestamptz,
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
  END IF;
END $$;

-- Create indexes only if columns exist
CREATE INDEX IF NOT EXISTS idx_sent_emails_organization_id ON sent_emails(organization_id);
CREATE INDEX IF NOT EXISTS idx_sent_emails_email_type ON sent_emails(email_type);
CREATE INDEX IF NOT EXISTS idx_sent_emails_status ON sent_emails(status);
CREATE INDEX IF NOT EXISTS idx_sent_emails_recipient_email ON sent_emails(recipient_email);
CREATE INDEX IF NOT EXISTS idx_sent_emails_sent_at ON sent_emails(sent_at DESC);

-- ============================================================================
-- EMAIL EVENTS (Webhook events for email tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_email_id uuid REFERENCES sent_emails(id) ON DELETE CASCADE,
  provider_message_id text,
  event_type text NOT NULL,
  event_data jsonb,
  occurred_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_events_sent_email_id ON email_events(sent_email_id);
CREATE INDEX IF NOT EXISTS idx_email_events_provider_message_id ON email_events(provider_message_id);
CREATE INDEX IF NOT EXISTS idx_email_events_event_type ON email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_occurred_at ON email_events(occurred_at DESC);

-- ============================================================================
-- SYSTEM SETTINGS (Global configuration)
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  setting_key text NOT NULL,
  setting_value text,
  setting_type text DEFAULT 'string',
  category text NOT NULL,
  subcategory text,
  label text NOT NULL,
  description text,
  placeholder text,
  is_required boolean DEFAULT false,
  validation_rules jsonb,
  allowed_values jsonb,
  is_active boolean DEFAULT true,
  is_sensitive boolean DEFAULT false,
  last_changed_by uuid REFERENCES profiles(id),
  last_changed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_system_settings_organization_id ON system_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);
CREATE INDEX IF NOT EXISTS idx_system_settings_setting_key ON system_settings(setting_key);

-- ============================================================================
-- NOTIFICATION PREFERENCES (User notification settings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  email_enabled boolean DEFAULT true,
  sms_enabled boolean DEFAULT false,
  push_enabled boolean DEFAULT false,
  in_app_enabled boolean DEFAULT true,
  frequency text DEFAULT 'immediate',
  unsubscribed boolean DEFAULT false,
  unsubscribed_at timestamptz,
  unsubscribe_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_organization_id ON notification_preferences(organization_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_profile_id ON notification_preferences(profile_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_member_id ON notification_preferences(member_id);

-- ============================================================================
-- NOTIFICATION QUEUE (Pending notifications)
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_type text NOT NULL,
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  advisor_id uuid REFERENCES advisors(id) ON DELETE CASCADE,
  email_address text,
  notification_type text NOT NULL,
  channel text NOT NULL,
  subject text,
  body text NOT NULL,
  body_html text,
  template_id uuid REFERENCES email_templates(id),
  template_data jsonb,
  priority text DEFAULT 'normal',
  scheduled_for timestamptz DEFAULT now(),
  status text DEFAULT 'pending',
  attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 3,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  error_message text,
  sent_email_id uuid REFERENCES sent_emails(id),
  sent_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_organization_id ON notification_queue(organization_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled_for ON notification_queue(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notification_queue_next_attempt_at ON notification_queue(next_attempt_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notification_queue_priority ON notification_queue(priority);

-- ============================================================================
-- WEBHOOKS (Outbound webhook configurations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  url text NOT NULL,
  events text[] NOT NULL,
  auth_type text,
  auth_value text,
  custom_headers jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  timeout_seconds integer DEFAULT 30,
  retry_count integer DEFAULT 3,
  total_calls integer DEFAULT 0,
  successful_calls integer DEFAULT 0,
  failed_calls integer DEFAULT 0,
  last_called_at timestamptz,
  last_status_code integer,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_organization_id ON webhooks(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_is_active ON webhooks(is_active) WHERE is_active = true;

-- ============================================================================
-- WEBHOOK LOGS (Outbound webhook call history)
-- ============================================================================
CREATE TABLE IF NOT EXISTS webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  request_headers jsonb,
  status_code integer,
  response_body text,
  response_headers jsonb,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  status text DEFAULT 'pending',
  error_message text,
  attempt_number integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_id ON webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_type ON webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to update sent_emails stats on email event
CREATE OR REPLACE FUNCTION update_sent_email_on_event()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sent_emails
  SET
    status = CASE
      WHEN NEW.event_type = 'delivered' THEN 'delivered'
      WHEN NEW.event_type = 'bounced' THEN 'bounced'
      WHEN NEW.event_type = 'complained' THEN 'complained'
      ELSE status
    END,
    delivered_at = CASE WHEN NEW.event_type = 'delivered' THEN NEW.occurred_at ELSE delivered_at END,
    opened_at = CASE WHEN NEW.event_type = 'opened' AND opened_at IS NULL THEN NEW.occurred_at ELSE opened_at END,
    clicked_at = CASE WHEN NEW.event_type = 'clicked' AND clicked_at IS NULL THEN NEW.occurred_at ELSE clicked_at END,
    bounced_at = CASE WHEN NEW.event_type = 'bounced' THEN NEW.occurred_at ELSE bounced_at END,
    complained_at = CASE WHEN NEW.event_type = 'complained' THEN NEW.occurred_at ELSE complained_at END,
    open_count = CASE WHEN NEW.event_type = 'opened' THEN open_count + 1 ELSE open_count END,
    click_count = CASE WHEN NEW.event_type = 'clicked' THEN click_count + 1 ELSE click_count END
  WHERE id = NEW.sent_email_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS email_event_update_trigger ON email_events;
CREATE TRIGGER email_event_update_trigger
  AFTER INSERT ON email_events
  FOR EACH ROW EXECUTE FUNCTION update_sent_email_on_event();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sent_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Email Templates policies
DROP POLICY IF EXISTS "Users can view email templates" ON email_templates;
CREATE POLICY "Users can view email templates"
  ON email_templates FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage email templates" ON email_templates;
CREATE POLICY "Admins can manage email templates"
  ON email_templates FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- Sent Emails policies
DROP POLICY IF EXISTS "Admins can view sent emails" ON sent_emails;
CREATE POLICY "Admins can view sent emails"
  ON sent_emails FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

DROP POLICY IF EXISTS "System can manage sent emails" ON sent_emails;
CREATE POLICY "System can manage sent emails"
  ON sent_emails FOR ALL
  USING (organization_id = get_user_organization_id());

-- Email Events policies
DROP POLICY IF EXISTS "Admins can view email events" ON email_events;
CREATE POLICY "Admins can view email events"
  ON email_events FOR SELECT
  USING (
    sent_email_id IN (SELECT id FROM sent_emails WHERE organization_id = get_user_organization_id())
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

DROP POLICY IF EXISTS "System can insert email events" ON email_events;
CREATE POLICY "System can insert email events"
  ON email_events FOR INSERT
  WITH CHECK (true);

-- System Settings policies
DROP POLICY IF EXISTS "Users can view non-sensitive settings" ON system_settings;
CREATE POLICY "Users can view non-sensitive settings"
  ON system_settings FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND (NOT is_sensitive OR get_user_role() IN ('owner', 'admin'))
  );

DROP POLICY IF EXISTS "Admins can manage settings" ON system_settings;
CREATE POLICY "Admins can manage settings"
  ON system_settings FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- Notification Preferences policies
DROP POLICY IF EXISTS "Users can view their preferences" ON notification_preferences;
CREATE POLICY "Users can view their preferences"
  ON notification_preferences FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR get_user_role() IN ('owner', 'admin'))
  );

DROP POLICY IF EXISTS "Users can manage their preferences" ON notification_preferences;
CREATE POLICY "Users can manage their preferences"
  ON notification_preferences FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR get_user_role() IN ('owner', 'admin'))
  );

-- Notification Queue policies
DROP POLICY IF EXISTS "Admins can view notification queue" ON notification_queue;
CREATE POLICY "Admins can view notification queue"
  ON notification_queue FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "System can manage notification queue" ON notification_queue;
CREATE POLICY "System can manage notification queue"
  ON notification_queue FOR ALL
  USING (organization_id = get_user_organization_id());

-- Webhooks policies
DROP POLICY IF EXISTS "Admins can view webhooks" ON webhooks;
CREATE POLICY "Admins can view webhooks"
  ON webhooks FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "Admins can manage webhooks" ON webhooks;
CREATE POLICY "Admins can manage webhooks"
  ON webhooks FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- Webhook Logs policies
DROP POLICY IF EXISTS "Admins can view webhook logs" ON webhook_logs;
CREATE POLICY "Admins can view webhook logs"
  ON webhook_logs FOR SELECT
  USING (
    webhook_id IN (SELECT id FROM webhooks WHERE organization_id = get_user_organization_id())
    AND get_user_role() IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "System can insert webhook logs" ON webhook_logs;
CREATE POLICY "System can insert webhook logs"
  ON webhook_logs FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- SEED DEFAULT SYSTEM SETTINGS
-- ============================================================================
CREATE OR REPLACE FUNCTION seed_default_settings(p_organization_id uuid)
RETURNS void AS $$
BEGIN
  -- Payment settings
  INSERT INTO system_settings (organization_id, setting_key, setting_value, setting_type, category, label, description)
  VALUES
    (p_organization_id, 'payment_gateway', 'authorize_net', 'string', 'payment', 'Payment Gateway', 'Primary payment gateway'),
    (p_organization_id, 'payment_retry_days', '[1,3,5,7]', 'json', 'payment', 'Payment Retry Schedule', 'Days to retry failed payments'),
    (p_organization_id, 'payment_max_retries', '4', 'number', 'payment', 'Max Payment Retries', 'Maximum retry attempts for failed payments')
  ON CONFLICT DO NOTHING;

  -- Email settings
  INSERT INTO system_settings (organization_id, setting_key, setting_value, setting_type, category, label, description)
  VALUES
    (p_organization_id, 'email_provider', 'resend', 'string', 'email', 'Email Provider', 'Email service provider'),
    (p_organization_id, 'email_from_address', 'noreply@example.com', 'string', 'email', 'From Email', 'Default sender email address'),
    (p_organization_id, 'email_from_name', 'CRM System', 'string', 'email', 'From Name', 'Default sender name'),
    (p_organization_id, 'email_admin_recipients', '[]', 'json', 'email', 'Admin Email Recipients', 'Emails to receive admin notifications')
  ON CONFLICT DO NOTHING;

  -- Commission settings
  INSERT INTO system_settings (organization_id, setting_key, setting_value, setting_type, category, label, description)
  VALUES
    (p_organization_id, 'commission_payment_day', '25', 'number', 'commission', 'Commission Payment Day', 'Day of month when commissions are paid'),
    (p_organization_id, 'commission_hold_days', '30', 'number', 'commission', 'Commission Hold Period', 'Days to hold commissions before payment eligibility')
  ON CONFLICT DO NOTHING;

  -- Enrollment settings
  INSERT INTO system_settings (organization_id, setting_key, setting_value, setting_type, category, label, description)
  VALUES
    (p_organization_id, 'enrollment_max_age', '64', 'number', 'enrollment', 'Maximum Enrollment Age', 'Maximum age for enrollment'),
    (p_organization_id, 'enrollment_age_65_buffer_days', '30', 'number', 'enrollment', 'Age 65 Buffer Days', 'Days before 65th birthday to allow enrollment'),
    (p_organization_id, 'enrollment_wizard_expiry_hours', '24', 'number', 'enrollment', 'Wizard Session Expiry', 'Hours until enrollment wizard session expires')
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SEED DEFAULT EMAIL TEMPLATES
-- ============================================================================
CREATE OR REPLACE FUNCTION seed_default_email_templates(p_organization_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO email_templates (organization_id, name, slug, subject, body_html, is_system, available_variables)
  VALUES
    (p_organization_id, 'Welcome Email', 'welcome_email',
     'Welcome to {{organization_name}}!',
     '<h1>Welcome, {{member_name}}!</h1><p>Thank you for enrolling. Your coverage begins on {{effective_date}}.</p>',
     true, '["member_name", "organization_name", "effective_date", "plan_name"]'::jsonb),

    (p_organization_id, 'Payment Receipt', 'payment_receipt',
     'Payment Receipt - {{amount}}',
     '<h1>Payment Confirmation</h1><p>Thank you for your payment of {{amount}} on {{payment_date}}.</p><p>Transaction ID: {{transaction_id}}</p>',
     true, '["member_name", "amount", "payment_date", "transaction_id"]'::jsonb),

    (p_organization_id, 'Payment Failed', 'payment_failed',
     'Action Required: Payment Failed',
     '<h1>Payment Failed</h1><p>We were unable to process your payment of {{amount}}. Please update your payment method.</p><p>Error: {{error_message}}</p>',
     true, '["member_name", "amount", "error_message", "retry_date"]'::jsonb),

    (p_organization_id, 'Enrollment Confirmation', 'enrollment_confirmation',
     'Enrollment Confirmed - {{plan_name}}',
     '<h1>Enrollment Confirmed!</h1><p>Your enrollment in {{plan_name}} has been confirmed. Coverage begins {{effective_date}}.</p>',
     true, '["member_name", "plan_name", "effective_date", "monthly_cost"]'::jsonb),

    (p_organization_id, 'Cancellation Notice', 'cancellation_notice',
     'Coverage Cancellation Notice',
     '<h1>Cancellation Confirmed</h1><p>Your coverage has been cancelled effective {{termination_date}}.</p><p>Reason: {{cancellation_reason}}</p>',
     true, '["member_name", "termination_date", "cancellation_reason"]'::jsonb),

    (p_organization_id, 'Advisor Invitation', 'advisor_invitation',
     'You''re Invited to Join {{organization_name}}',
     '<h1>Join Our Team!</h1><p>You''ve been invited to join {{organization_name}} as an advisor.</p><p><a href="{{signup_url}}">Click here to create your account</a></p>',
     true, '["advisor_name", "organization_name", "signup_url", "inviter_name"]'::jsonb)

  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE email_templates IS 'Configurable email templates';
COMMENT ON TABLE sent_emails IS 'Log of all sent emails with tracking';
COMMENT ON TABLE email_events IS 'Email delivery events (opens, clicks, bounces)';
COMMENT ON TABLE system_settings IS 'Organization-wide configuration settings';
COMMENT ON TABLE notification_preferences IS 'User notification channel preferences';
COMMENT ON TABLE notification_queue IS 'Pending notifications to be sent';
COMMENT ON TABLE webhooks IS 'Outbound webhook configurations';
COMMENT ON TABLE webhook_logs IS 'Webhook call history';

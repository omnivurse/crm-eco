-- ============================================================================
-- PHASE W13: EMAIL SEND + THREAD SYNC
-- Real email sending and Gmail/Outlook inbox sync
-- ============================================================================

-- ============================================================================
-- EMAIL CONNECTIONS TABLE
-- User mailbox OAuth connections for Gmail/Outlook sync
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Provider info
  provider text NOT NULL,
  -- Providers: google, microsoft
  
  -- Account info
  email_address text NOT NULL,
  account_name text,
  
  -- OAuth tokens (to be encrypted in W20)
  access_token_enc text,
  refresh_token_enc text,
  token_expires_at timestamptz,
  scopes text[],
  
  -- Sync configuration
  sync_enabled boolean DEFAULT true,
  sync_folders text[] DEFAULT '{"INBOX"}',
  sync_since timestamptz,
  
  -- Sync state
  status text DEFAULT 'active',
  -- Status: active, paused, error, revoked
  
  last_sync_at timestamptz,
  sync_cursor text,
  sync_error text,
  
  -- Settings
  settings jsonb DEFAULT '{}'::jsonb,
  -- { auto_link: true, create_contacts: true, sync_sent: true }
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  UNIQUE(org_id, user_id, provider, email_address)
);

CREATE INDEX idx_email_connections_org ON email_connections(org_id);
CREATE INDEX idx_email_connections_user ON email_connections(user_id);
CREATE INDEX idx_email_connections_provider ON email_connections(provider);
CREATE INDEX idx_email_connections_email ON email_connections(email_address);
CREATE INDEX idx_email_connections_status ON email_connections(status);

COMMENT ON TABLE email_connections IS 'User mailbox OAuth connections for email sync';

-- ============================================================================
-- EMAIL THREADS TABLE
-- Synced email threads from connected mailboxes
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES email_connections(id) ON DELETE CASCADE,
  
  -- External reference
  provider text NOT NULL,
  external_thread_id text NOT NULL,
  
  -- Thread info
  subject text,
  snippet text,
  
  -- Participants
  participants jsonb DEFAULT '[]'::jsonb,
  -- [{ email, name, type: 'from'|'to'|'cc' }]
  
  -- Stats
  message_count int DEFAULT 0,
  unread_count int DEFAULT 0,
  has_attachments boolean DEFAULT false,
  
  -- Timestamps
  first_message_at timestamptz,
  last_message_at timestamptz,
  
  -- Linked CRM records
  linked_contact_id uuid,
  linked_lead_id uuid,
  linked_deal_id uuid,
  linked_account_id uuid,
  
  -- Labels/folders
  labels text[] DEFAULT '{}',
  is_starred boolean DEFAULT false,
  is_important boolean DEFAULT false,
  is_archived boolean DEFAULT false,
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  UNIQUE(org_id, connection_id, external_thread_id)
);

CREATE INDEX idx_email_threads_org ON email_threads(org_id);
CREATE INDEX idx_email_threads_connection ON email_threads(connection_id);
CREATE INDEX idx_email_threads_external ON email_threads(provider, external_thread_id);
CREATE INDEX idx_email_threads_contact ON email_threads(linked_contact_id);
CREATE INDEX idx_email_threads_lead ON email_threads(linked_lead_id);
CREATE INDEX idx_email_threads_deal ON email_threads(linked_deal_id);
CREATE INDEX idx_email_threads_last_message ON email_threads(org_id, last_message_at DESC);

COMMENT ON TABLE email_threads IS 'Synced email threads from connected mailboxes';

-- ============================================================================
-- EMAIL MESSAGES TABLE
-- Individual messages in threads
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
  
  -- External reference
  external_message_id text NOT NULL,
  
  -- Direction
  direction text NOT NULL,
  -- Direction: inbound, outbound
  
  -- Envelope
  from_email text,
  from_name text,
  to_emails jsonb DEFAULT '[]'::jsonb,
  cc_emails jsonb DEFAULT '[]'::jsonb,
  bcc_emails jsonb DEFAULT '[]'::jsonb,
  reply_to text,
  
  -- Content
  subject text,
  body_text text,
  body_html text,
  
  -- Attachments
  attachments jsonb DEFAULT '[]'::jsonb,
  -- [{ filename, content_type, size, storage_path }]
  
  -- Headers
  message_id_header text,
  in_reply_to text,
  references_header text,
  
  -- Timestamps
  sent_at timestamptz NOT NULL,
  received_at timestamptz,
  
  -- Tracking (for sent emails)
  tracking_id uuid,
  opened_at timestamptz,
  open_count int DEFAULT 0,
  clicked_at timestamptz,
  click_count int DEFAULT 0,
  
  -- Status
  status text DEFAULT 'delivered',
  -- Status: draft, queued, sent, delivered, opened, clicked, bounced, failed
  
  bounce_type text,
  bounce_reason text,
  
  -- Labels
  labels text[] DEFAULT '{}',
  is_read boolean DEFAULT false,
  is_starred boolean DEFAULT false,
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  
  -- Constraints
  UNIQUE(thread_id, external_message_id)
);

CREATE INDEX idx_email_messages_org ON email_messages(org_id);
CREATE INDEX idx_email_messages_thread ON email_messages(thread_id);
CREATE INDEX idx_email_messages_external ON email_messages(external_message_id);
CREATE INDEX idx_email_messages_from ON email_messages(from_email);
CREATE INDEX idx_email_messages_sent ON email_messages(sent_at DESC);
CREATE INDEX idx_email_messages_tracking ON email_messages(tracking_id);
CREATE INDEX idx_email_messages_status ON email_messages(status);

COMMENT ON TABLE email_messages IS 'Individual messages within email threads';

-- ============================================================================
-- EMAIL TRACKING TABLE
-- Track open/click events for sent emails
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES email_messages(id) ON DELETE CASCADE,
  tracking_id uuid NOT NULL,
  
  -- Event info
  event_type text NOT NULL,
  -- Types: open, click, bounce, complaint, unsubscribe
  
  -- Details
  ip_address inet,
  user_agent text,
  clicked_url text,
  
  -- Bounce details
  bounce_type text,
  bounce_subtype text,
  bounce_reason text,
  
  -- Timestamp
  occurred_at timestamptz DEFAULT now()
);

CREATE INDEX idx_email_tracking_org ON email_tracking_events(org_id);
CREATE INDEX idx_email_tracking_message ON email_tracking_events(message_id);
CREATE INDEX idx_email_tracking_id ON email_tracking_events(tracking_id);
CREATE INDEX idx_email_tracking_type ON email_tracking_events(event_type);

COMMENT ON TABLE email_tracking_events IS 'Track open/click events for sent emails';

-- ============================================================================
-- SENT EMAILS LOG TABLE
-- Log of all emails sent through the system
-- ============================================================================

CREATE TABLE IF NOT EXISTS sent_emails_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Sender
  sent_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  from_email text NOT NULL,
  from_name text,
  
  -- Recipients
  to_emails text[] NOT NULL,
  cc_emails text[],
  bcc_emails text[],
  
  -- Content
  subject text NOT NULL,
  body_html text,
  body_text text,
  
  -- Template
  template_id uuid,
  template_variables jsonb,
  
  -- Provider
  provider text NOT NULL,
  -- Providers: sendgrid, resend, smtp
  
  provider_message_id text,
  
  -- Status
  status text DEFAULT 'queued',
  -- Status: queued, sent, delivered, opened, clicked, bounced, failed
  
  error_message text,
  
  -- Tracking
  tracking_id uuid DEFAULT gen_random_uuid(),
  
  -- CRM links
  linked_contact_id uuid,
  linked_lead_id uuid,
  linked_deal_id uuid,
  
  -- Timestamps
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_sent_emails_org ON sent_emails_log(org_id);
CREATE INDEX idx_sent_emails_sent_by ON sent_emails_log(sent_by);
CREATE INDEX idx_sent_emails_tracking ON sent_emails_log(tracking_id);
CREATE INDEX idx_sent_emails_status ON sent_emails_log(status);
CREATE INDEX idx_sent_emails_created ON sent_emails_log(created_at DESC);

COMMENT ON TABLE sent_emails_log IS 'Log of all emails sent through the system';

-- ============================================================================
-- SMS LOG TABLE
-- Log of all SMS messages sent through the system
-- ============================================================================

CREATE TABLE IF NOT EXISTS sent_sms_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Sender
  sent_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  from_number text NOT NULL,
  
  -- Recipient
  to_number text NOT NULL,
  
  -- Content
  body text NOT NULL,
  
  -- Provider
  provider text NOT NULL,
  -- Providers: twilio, etc
  
  provider_message_id text,
  
  -- Status
  status text DEFAULT 'queued',
  -- Status: queued, sent, delivered, failed
  
  error_message text,
  
  -- CRM links
  linked_contact_id uuid,
  linked_lead_id uuid,
  linked_deal_id uuid,
  
  -- Timestamps
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_sent_sms_org ON sent_sms_log(org_id);
CREATE INDEX idx_sent_sms_sent_by ON sent_sms_log(sent_by);
CREATE INDEX idx_sent_sms_to ON sent_sms_log(to_number);
CREATE INDEX idx_sent_sms_status ON sent_sms_log(status);
CREATE INDEX idx_sent_sms_created ON sent_sms_log(created_at DESC);

COMMENT ON TABLE sent_sms_log IS 'Log of all SMS messages sent through the system';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE email_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sent_emails_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sent_sms_log ENABLE ROW LEVEL SECURITY;

-- Email Connections Policies
CREATE POLICY "Users can view their own email connections"
  ON email_connections FOR SELECT
  USING (user_id = get_user_profile_id());

CREATE POLICY "Users can manage their own email connections"
  ON email_connections FOR ALL
  USING (user_id = get_user_profile_id());

-- Email Threads Policies
CREATE POLICY "Users can view email threads for their org"
  ON email_threads FOR SELECT
  USING (org_id = get_user_organization_id());

CREATE POLICY "System can manage email threads"
  ON email_threads FOR ALL
  USING (org_id = get_user_organization_id());

-- Email Messages Policies
CREATE POLICY "Users can view email messages for their org"
  ON email_messages FOR SELECT
  USING (org_id = get_user_organization_id());

CREATE POLICY "System can manage email messages"
  ON email_messages FOR ALL
  USING (org_id = get_user_organization_id());

-- Tracking Events Policies
CREATE POLICY "Users can view tracking events for their org"
  ON email_tracking_events FOR SELECT
  USING (org_id = get_user_organization_id());

CREATE POLICY "System can insert tracking events"
  ON email_tracking_events FOR INSERT
  WITH CHECK (true);

-- Sent Emails Log Policies
CREATE POLICY "Users can view sent emails for their org"
  ON sent_emails_log FOR SELECT
  USING (org_id = get_user_organization_id());

CREATE POLICY "Users can send emails for their org"
  ON sent_emails_log FOR INSERT
  WITH CHECK (org_id = get_user_organization_id());

-- Sent SMS Log Policies
CREATE POLICY "Users can view sent SMS for their org"
  ON sent_sms_log FOR SELECT
  USING (org_id = get_user_organization_id());

CREATE POLICY "Users can send SMS for their org"
  ON sent_sms_log FOR INSERT
  WITH CHECK (org_id = get_user_organization_id());

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER update_email_connections_updated_at
  BEFORE UPDATE ON email_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_threads_updated_at
  BEFORE UPDATE ON email_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to find or create contact by email
CREATE OR REPLACE FUNCTION find_or_create_contact_by_email(
  p_org_id uuid,
  p_email text,
  p_name text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_contact_id uuid;
  v_contacts_module_id uuid;
BEGIN
  -- Get contacts module
  SELECT id INTO v_contacts_module_id 
  FROM crm_modules 
  WHERE organization_id = p_org_id AND module_key = 'Contacts';
  
  IF v_contacts_module_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Try to find existing contact
  SELECT id INTO v_contact_id
  FROM crm_records
  WHERE organization_id = p_org_id
    AND module_id = v_contacts_module_id
    AND data->>'Email' = p_email
  LIMIT 1;
  
  -- Return existing contact if found
  IF v_contact_id IS NOT NULL THEN
    RETURN v_contact_id;
  END IF;
  
  -- Create new contact
  INSERT INTO crm_records (organization_id, module_id, data, record_name)
  VALUES (
    p_org_id,
    v_contacts_module_id,
    jsonb_build_object('Email', p_email, 'First_Name', COALESCE(p_name, split_part(p_email, '@', 1))),
    COALESCE(p_name, p_email)
  )
  RETURNING id INTO v_contact_id;
  
  RETURN v_contact_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-link email thread to CRM records
CREATE OR REPLACE FUNCTION auto_link_email_thread()
RETURNS TRIGGER AS $$
DECLARE
  v_participant record;
  v_contact_id uuid;
BEGIN
  -- Try to find contact by participant email
  FOR v_participant IN SELECT * FROM jsonb_array_elements(NEW.participants)
  LOOP
    SELECT id INTO v_contact_id
    FROM crm_records cr
    JOIN crm_modules cm ON cr.module_id = cm.id
    WHERE cr.organization_id = NEW.org_id
      AND cm.module_key = 'Contacts'
      AND cr.data->>'Email' = v_participant.value->>'email'
    LIMIT 1;
    
    IF v_contact_id IS NOT NULL THEN
      NEW.linked_contact_id := v_contact_id;
      EXIT;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_link_email_thread
  BEFORE INSERT ON email_threads
  FOR EACH ROW EXECUTE FUNCTION auto_link_email_thread();

-- Function to update thread stats
CREATE OR REPLACE FUNCTION update_email_thread_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE email_threads
  SET 
    message_count = (SELECT COUNT(*) FROM email_messages WHERE thread_id = NEW.thread_id),
    unread_count = (SELECT COUNT(*) FROM email_messages WHERE thread_id = NEW.thread_id AND NOT is_read),
    has_attachments = EXISTS(
      SELECT 1 FROM email_messages 
      WHERE thread_id = NEW.thread_id 
      AND jsonb_array_length(attachments) > 0
    ),
    last_message_at = (SELECT MAX(sent_at) FROM email_messages WHERE thread_id = NEW.thread_id),
    updated_at = now()
  WHERE id = NEW.thread_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_thread_stats
  AFTER INSERT ON email_messages
  FOR EACH ROW EXECUTE FUNCTION update_email_thread_stats();

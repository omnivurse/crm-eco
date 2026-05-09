-- ============================================================================
-- UNBUILT FEATURES PROMOTION — bundled
--
-- Promotes 5 drafts from supabase/migrations_temp/ with fixes applied:
--   * 202699999002_email_thread_sync       (Part 1)
--   * 202699999005_slack_integration       (Part 2)
--   * 202699999006_documents_esign         (Part 3)
--   * 202699999007_enterprise_approvals    (Part 4)
--   * 202699999008_forecasting_playbooks   (Part 5)
--
-- Fixes applied across all parts:
--   * CREATE INDEX -> CREATE INDEX IF NOT EXISTS
--   * CREATE POLICY  wrapped in DO blocks with pg_policies guards
--   * CREATE TRIGGER wrapped in DO blocks with pg_trigger guards
--
-- Per-part fixes:
--   Part 1 (email): rewrote find_or_create_contact_by_email and
--     auto_link_email_thread to use crm_records.org_id (not organization_id),
--     crm_records.title (not record_name), crm_modules.key (not module_key).
--   Part 2 (slack): slack_connections.access_token_enc made nullable to allow
--     row creation before OAuth completes.
--   Part 3 (esign): dropped the no-op ALTER TABLE crm_documents block —
--     crm_documents does not exist; if it's later added, link the
--     template_id FK in a follow-up migration.
-- ============================================================================


-- ============================================================================
-- PART 1: EMAIL SEND + THREAD SYNC
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider text NOT NULL,
  email_address text NOT NULL,
  account_name text,
  access_token_enc text,
  refresh_token_enc text,
  token_expires_at timestamptz,
  scopes text[],
  sync_enabled boolean DEFAULT true,
  sync_folders text[] DEFAULT '{"INBOX"}',
  sync_since timestamptz,
  status text DEFAULT 'active',
  last_sync_at timestamptz,
  sync_cursor text,
  sync_error text,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, user_id, provider, email_address)
);

CREATE INDEX IF NOT EXISTS idx_email_connections_org ON email_connections(org_id);
CREATE INDEX IF NOT EXISTS idx_email_connections_user ON email_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_email_connections_provider ON email_connections(provider);
CREATE INDEX IF NOT EXISTS idx_email_connections_email ON email_connections(email_address);
CREATE INDEX IF NOT EXISTS idx_email_connections_status ON email_connections(status);

COMMENT ON TABLE email_connections IS 'User mailbox OAuth connections for email sync';

CREATE TABLE IF NOT EXISTS email_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES email_connections(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_thread_id text NOT NULL,
  subject text,
  snippet text,
  participants jsonb DEFAULT '[]'::jsonb,
  message_count int DEFAULT 0,
  unread_count int DEFAULT 0,
  has_attachments boolean DEFAULT false,
  first_message_at timestamptz,
  last_message_at timestamptz,
  linked_contact_id uuid,
  linked_lead_id uuid,
  linked_deal_id uuid,
  linked_account_id uuid,
  labels text[] DEFAULT '{}',
  is_starred boolean DEFAULT false,
  is_important boolean DEFAULT false,
  is_archived boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, connection_id, external_thread_id)
);

CREATE INDEX IF NOT EXISTS idx_email_threads_org ON email_threads(org_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_connection ON email_threads(connection_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_external ON email_threads(provider, external_thread_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_contact ON email_threads(linked_contact_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_lead ON email_threads(linked_lead_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_deal ON email_threads(linked_deal_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_last_message ON email_threads(org_id, last_message_at DESC);

COMMENT ON TABLE email_threads IS 'Synced email threads from connected mailboxes';

CREATE TABLE IF NOT EXISTS email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
  external_message_id text NOT NULL,
  direction text NOT NULL,
  from_email text,
  from_name text,
  to_emails jsonb DEFAULT '[]'::jsonb,
  cc_emails jsonb DEFAULT '[]'::jsonb,
  bcc_emails jsonb DEFAULT '[]'::jsonb,
  reply_to text,
  subject text,
  body_text text,
  body_html text,
  attachments jsonb DEFAULT '[]'::jsonb,
  message_id_header text,
  in_reply_to text,
  references_header text,
  sent_at timestamptz NOT NULL,
  received_at timestamptz,
  tracking_id uuid,
  opened_at timestamptz,
  open_count int DEFAULT 0,
  clicked_at timestamptz,
  click_count int DEFAULT 0,
  status text DEFAULT 'delivered',
  bounce_type text,
  bounce_reason text,
  labels text[] DEFAULT '{}',
  is_read boolean DEFAULT false,
  is_starred boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(thread_id, external_message_id)
);

CREATE INDEX IF NOT EXISTS idx_email_messages_org ON email_messages(org_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread ON email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_external ON email_messages(external_message_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_from ON email_messages(from_email);
CREATE INDEX IF NOT EXISTS idx_email_messages_sent ON email_messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_tracking ON email_messages(tracking_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_status ON email_messages(status);

COMMENT ON TABLE email_messages IS 'Individual messages within email threads';

CREATE TABLE IF NOT EXISTS email_tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES email_messages(id) ON DELETE CASCADE,
  tracking_id uuid NOT NULL,
  event_type text NOT NULL,
  ip_address inet,
  user_agent text,
  clicked_url text,
  bounce_type text,
  bounce_subtype text,
  bounce_reason text,
  occurred_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_tracking_org ON email_tracking_events(org_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_message ON email_tracking_events(message_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_id ON email_tracking_events(tracking_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_type ON email_tracking_events(event_type);

COMMENT ON TABLE email_tracking_events IS 'Track open/click events for sent emails';

CREATE TABLE IF NOT EXISTS sent_emails_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sent_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  from_email text NOT NULL,
  from_name text,
  to_emails text[] NOT NULL,
  cc_emails text[],
  bcc_emails text[],
  subject text NOT NULL,
  body_html text,
  body_text text,
  template_id uuid,
  template_variables jsonb,
  provider text NOT NULL,
  provider_message_id text,
  status text DEFAULT 'queued',
  error_message text,
  tracking_id uuid DEFAULT gen_random_uuid(),
  linked_contact_id uuid,
  linked_lead_id uuid,
  linked_deal_id uuid,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sent_emails_org ON sent_emails_log(org_id);
CREATE INDEX IF NOT EXISTS idx_sent_emails_sent_by ON sent_emails_log(sent_by);
CREATE INDEX IF NOT EXISTS idx_sent_emails_tracking ON sent_emails_log(tracking_id);
CREATE INDEX IF NOT EXISTS idx_sent_emails_status ON sent_emails_log(status);
CREATE INDEX IF NOT EXISTS idx_sent_emails_created ON sent_emails_log(created_at DESC);

COMMENT ON TABLE sent_emails_log IS 'Log of all emails sent through the system';

CREATE TABLE IF NOT EXISTS sent_sms_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sent_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  from_number text NOT NULL,
  to_number text NOT NULL,
  body text NOT NULL,
  provider text NOT NULL,
  provider_message_id text,
  status text DEFAULT 'queued',
  error_message text,
  linked_contact_id uuid,
  linked_lead_id uuid,
  linked_deal_id uuid,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sent_sms_org ON sent_sms_log(org_id);
CREATE INDEX IF NOT EXISTS idx_sent_sms_sent_by ON sent_sms_log(sent_by);
CREATE INDEX IF NOT EXISTS idx_sent_sms_to ON sent_sms_log(to_number);
CREATE INDEX IF NOT EXISTS idx_sent_sms_status ON sent_sms_log(status);
CREATE INDEX IF NOT EXISTS idx_sent_sms_created ON sent_sms_log(created_at DESC);

COMMENT ON TABLE sent_sms_log IS 'Log of all SMS messages sent through the system';

ALTER TABLE email_connections      ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_threads          ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_tracking_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sent_emails_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sent_sms_log           ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_connections' AND policyname='Users can view their own email connections') THEN
    CREATE POLICY "Users can view their own email connections"
      ON email_connections FOR SELECT
      USING (user_id = (SELECT get_user_profile_id()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_connections' AND policyname='Users can manage their own email connections') THEN
    CREATE POLICY "Users can manage their own email connections"
      ON email_connections FOR ALL
      USING (user_id = (SELECT get_user_profile_id()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_threads' AND policyname='Users can view email threads for their org') THEN
    CREATE POLICY "Users can view email threads for their org"
      ON email_threads FOR SELECT
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_threads' AND policyname='System can manage email threads') THEN
    CREATE POLICY "System can manage email threads"
      ON email_threads FOR ALL
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_messages' AND policyname='Users can view email messages for their org') THEN
    CREATE POLICY "Users can view email messages for their org"
      ON email_messages FOR SELECT
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_messages' AND policyname='System can manage email messages') THEN
    CREATE POLICY "System can manage email messages"
      ON email_messages FOR ALL
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_tracking_events' AND policyname='Users can view tracking events for their org') THEN
    CREATE POLICY "Users can view tracking events for their org"
      ON email_tracking_events FOR SELECT
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_tracking_events' AND policyname='System can insert tracking events') THEN
    CREATE POLICY "System can insert tracking events"
      ON email_tracking_events FOR INSERT
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sent_emails_log' AND policyname='Users can view sent emails for their org') THEN
    CREATE POLICY "Users can view sent emails for their org"
      ON sent_emails_log FOR SELECT
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sent_emails_log' AND policyname='Users can send emails for their org') THEN
    CREATE POLICY "Users can send emails for their org"
      ON sent_emails_log FOR INSERT
      WITH CHECK (org_id = (SELECT get_user_organization_id()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sent_sms_log' AND policyname='Users can view sent SMS for their org') THEN
    CREATE POLICY "Users can view sent SMS for their org"
      ON sent_sms_log FOR SELECT
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sent_sms_log' AND policyname='Users can send SMS for their org') THEN
    CREATE POLICY "Users can send SMS for their org"
      ON sent_sms_log FOR INSERT
      WITH CHECK (org_id = (SELECT get_user_organization_id()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_email_connections_updated_at') THEN
    CREATE TRIGGER update_email_connections_updated_at
      BEFORE UPDATE ON email_connections
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_email_threads_updated_at') THEN
    CREATE TRIGGER update_email_threads_updated_at
      BEFORE UPDATE ON email_threads
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Helper: find or create a contact by email.
-- Fixed from draft: crm_modules.key (was module_key), crm_records.org_id
-- (was organization_id), crm_records.title (was record_name).
CREATE OR REPLACE FUNCTION find_or_create_contact_by_email(
  p_org_id uuid,
  p_email text,
  p_name text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_contact_id uuid;
  v_contacts_module_id uuid;
BEGIN
  SELECT id INTO v_contacts_module_id
  FROM crm_modules
  WHERE org_id = p_org_id AND key = 'Contacts';

  IF v_contacts_module_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_contact_id
  FROM crm_records
  WHERE org_id = p_org_id
    AND module_id = v_contacts_module_id
    AND data->>'Email' = p_email
  LIMIT 1;

  IF v_contact_id IS NOT NULL THEN
    RETURN v_contact_id;
  END IF;

  INSERT INTO crm_records (org_id, module_id, data, title)
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

-- Trigger fn: auto-link inbound email thread to a contact.
-- Fixed from draft: cr.org_id (was organization_id), cm.key (was module_key).
CREATE OR REPLACE FUNCTION auto_link_email_thread()
RETURNS TRIGGER AS $$
DECLARE
  v_participant record;
  v_contact_id uuid;
BEGIN
  FOR v_participant IN SELECT * FROM jsonb_array_elements(NEW.participants)
  LOOP
    SELECT cr.id INTO v_contact_id
    FROM crm_records cr
    JOIN crm_modules cm ON cr.module_id = cm.id
    WHERE cr.org_id = NEW.org_id
      AND cm.key = 'Contacts'
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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_auto_link_email_thread') THEN
    CREATE TRIGGER trigger_auto_link_email_thread
      BEFORE INSERT ON email_threads
      FOR EACH ROW EXECUTE FUNCTION auto_link_email_thread();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_thread_stats') THEN
    CREATE TRIGGER trigger_update_thread_stats
      AFTER INSERT ON email_messages
      FOR EACH ROW EXECUTE FUNCTION update_email_thread_stats();
  END IF;
END $$;


-- ============================================================================
-- PART 2: SLACK INTEGRATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS slack_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Fixed from draft: nullable so an OAuth flow can create-then-fill the row.
  access_token_enc text,
  team_id text NOT NULL,
  team_name text,
  team_domain text,
  bot_user_id text,
  bot_access_token_enc text,
  default_channel_id text,
  default_channel_name text,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_slack_connections_org ON slack_connections(org_id);

CREATE TABLE IF NOT EXISTS slack_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES slack_connections(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  channel_id text NOT NULL,
  channel_name text,
  message_template text,
  include_details boolean DEFAULT true,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(org_id, event_type, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_slack_subscriptions_org   ON slack_subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_slack_subscriptions_event ON slack_subscriptions(event_type) WHERE enabled;

CREATE TABLE IF NOT EXISTS slack_messages_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES slack_connections(id) ON DELETE SET NULL,
  channel_id text NOT NULL,
  message_text text,
  message_blocks jsonb,
  status text DEFAULT 'sent',
  slack_ts text,
  error_message text,
  source_type text,
  source_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slack_messages_org     ON slack_messages_log(org_id);
CREATE INDEX IF NOT EXISTS idx_slack_messages_created ON slack_messages_log(created_at DESC);

ALTER TABLE slack_connections   ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_messages_log  ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='slack_connections' AND policyname='Users can view slack connections for their org') THEN
    CREATE POLICY "Users can view slack connections for their org"
      ON slack_connections FOR SELECT
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='slack_connections' AND policyname='Admins can manage slack connections') THEN
    CREATE POLICY "Admins can manage slack connections"
      ON slack_connections FOR ALL
      USING (
        org_id = (SELECT get_user_organization_id())
        AND (SELECT get_user_role()) IN ('owner', 'admin')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='slack_subscriptions' AND policyname='Users can view slack subscriptions for their org') THEN
    CREATE POLICY "Users can view slack subscriptions for their org"
      ON slack_subscriptions FOR SELECT
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='slack_subscriptions' AND policyname='Admins can manage slack subscriptions') THEN
    CREATE POLICY "Admins can manage slack subscriptions"
      ON slack_subscriptions FOR ALL
      USING (
        org_id = (SELECT get_user_organization_id())
        AND (SELECT get_user_role()) IN ('owner', 'admin')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='slack_messages_log' AND policyname='Users can view slack messages for their org') THEN
    CREATE POLICY "Users can view slack messages for their org"
      ON slack_messages_log FOR SELECT
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;
END $$;


-- ============================================================================
-- PART 3: DOCUMENTS + E-SIGN
-- (Dropped the no-op ALTER TABLE crm_documents block from the draft —
--  crm_documents does not exist; the conditional silently no-ops anyway.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text DEFAULT 'proposal',
  content_html text NOT NULL,
  content_variables jsonb DEFAULT '[]'::jsonb,
  header_html text,
  footer_html text,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_templates_org ON document_templates(org_id);

CREATE TABLE IF NOT EXISTS esign_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  access_token_enc text,
  refresh_token_enc text,
  token_expires_at timestamptz,
  account_id text,
  account_name text,
  settings jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_esign_connections_org ON esign_connections(org_id);

CREATE TABLE IF NOT EXISTS esign_envelopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES esign_connections(id) ON DELETE SET NULL,
  document_id uuid,
  deal_id uuid,
  contact_id uuid,
  provider text NOT NULL,
  external_id text NOT NULL,
  subject text NOT NULL,
  message text,
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text DEFAULT 'created',
  sent_at timestamptz,
  viewed_at timestamptz,
  completed_at timestamptz,
  signed_document_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_esign_envelopes_org      ON esign_envelopes(org_id);
CREATE INDEX IF NOT EXISTS idx_esign_envelopes_deal     ON esign_envelopes(deal_id);
CREATE INDEX IF NOT EXISTS idx_esign_envelopes_external ON esign_envelopes(provider, external_id);
CREATE INDEX IF NOT EXISTS idx_esign_envelopes_status   ON esign_envelopes(status);

ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE esign_connections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE esign_envelopes    ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='document_templates' AND policyname='Users can view document templates for their org') THEN
    CREATE POLICY "Users can view document templates for their org"
      ON document_templates FOR SELECT
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='document_templates' AND policyname='Admins can manage document templates') THEN
    CREATE POLICY "Admins can manage document templates"
      ON document_templates FOR ALL
      USING (
        org_id = (SELECT get_user_organization_id())
        AND (SELECT get_user_role()) IN ('owner', 'admin')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='esign_connections' AND policyname='Users can view esign connections for their org') THEN
    CREATE POLICY "Users can view esign connections for their org"
      ON esign_connections FOR SELECT
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='esign_connections' AND policyname='Admins can manage esign connections') THEN
    CREATE POLICY "Admins can manage esign connections"
      ON esign_connections FOR ALL
      USING (
        org_id = (SELECT get_user_organization_id())
        AND (SELECT get_user_role()) IN ('owner', 'admin')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='esign_envelopes' AND policyname='Users can view esign envelopes for their org') THEN
    CREATE POLICY "Users can view esign envelopes for their org"
      ON esign_envelopes FOR SELECT
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='esign_envelopes' AND policyname='Users can manage esign envelopes for their org') THEN
    CREATE POLICY "Users can manage esign envelopes for their org"
      ON esign_envelopes FOR ALL
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;
END $$;


-- ============================================================================
-- PART 4: ENTERPRISE APPROVALS + DISCOUNT GUARDS
-- ============================================================================

CREATE TABLE IF NOT EXISTS approval_guard_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  guard_type text NOT NULL,
  entity_type text NOT NULL,
  trigger_conditions jsonb NOT NULL,
  approval_type text DEFAULT 'single',
  approvers jsonb NOT NULL DEFAULT '[]'::jsonb,
  auto_approve_below_threshold boolean DEFAULT false,
  threshold_amount numeric,
  is_active boolean DEFAULT true,
  priority int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_guard_rules_org    ON approval_guard_rules(org_id);
CREATE INDEX IF NOT EXISTS idx_approval_guard_rules_type   ON approval_guard_rules(guard_type);
CREATE INDEX IF NOT EXISTS idx_approval_guard_rules_entity ON approval_guard_rules(entity_type);

CREATE TABLE IF NOT EXISTS approval_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES approval_guard_rules(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  blocked_action text NOT NULL,
  blocked_data jsonb NOT NULL,
  approval_id uuid REFERENCES crm_approvals(id) ON DELETE SET NULL,
  status text DEFAULT 'pending',
  resolved_by uuid REFERENCES profiles(id),
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_blocks_org    ON approval_blocks(org_id);
CREATE INDEX IF NOT EXISTS idx_approval_blocks_entity ON approval_blocks(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_approval_blocks_status ON approval_blocks(status) WHERE status = 'pending';

CREATE OR REPLACE FUNCTION check_approval_required(
  p_org_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_data jsonb
) RETURNS TABLE (
  required boolean,
  rule_id uuid,
  rule_name text
) AS $$
DECLARE
  v_rule record;
BEGIN
  FOR v_rule IN
    SELECT agr.id, agr.name, agr.trigger_conditions
    FROM approval_guard_rules agr
    WHERE agr.org_id = p_org_id
      AND agr.entity_type = p_entity_type
      AND agr.is_active = true
    ORDER BY agr.priority DESC
  LOOP
    IF p_data ? (v_rule.trigger_conditions->>'field') THEN
      required := true;
      rule_id := v_rule.id;
      rule_name := v_rule.name;
      RETURN NEXT;
      RETURN;
    END IF;
  END LOOP;

  required := false;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE approval_guard_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_blocks      ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='approval_guard_rules' AND policyname='Users can view approval guard rules for their org') THEN
    CREATE POLICY "Users can view approval guard rules for their org"
      ON approval_guard_rules FOR SELECT
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='approval_guard_rules' AND policyname='Admins can manage approval guard rules') THEN
    CREATE POLICY "Admins can manage approval guard rules"
      ON approval_guard_rules FOR ALL
      USING (
        org_id = (SELECT get_user_organization_id())
        AND (SELECT get_user_role()) IN ('owner', 'admin')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='approval_blocks' AND policyname='Users can view approval blocks for their org') THEN
    CREATE POLICY "Users can view approval blocks for their org"
      ON approval_blocks FOR SELECT
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='approval_blocks' AND policyname='System can manage approval blocks') THEN
    CREATE POLICY "System can manage approval blocks"
      ON approval_blocks FOR ALL
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;
END $$;


-- ============================================================================
-- PART 5: FORECASTING, PLAYBOOKS, DEAL WAR ROOM
-- ============================================================================

CREATE TABLE IF NOT EXISTS forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  period_type text DEFAULT 'month',
  forecast_type text DEFAULT 'pipeline',
  data jsonb NOT NULL,
  previous_forecast_id uuid REFERENCES forecasts(id),
  actual_amount numeric,
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forecasts_org    ON forecasts(org_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_period ON forecasts(period_start, period_end);

CREATE TABLE IF NOT EXISTS playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  content jsonb NOT NULL DEFAULT '[]'::jsonb,
  stage_attachments jsonb DEFAULT '[]'::jsonb,
  target_modules text[] DEFAULT '{"Deals"}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_playbooks_org ON playbooks(org_id);

CREATE TABLE IF NOT EXISTS playbook_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  playbook_id uuid NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
  section text NOT NULL,
  title text NOT NULL,
  description text,
  item_type text DEFAULT 'task',
  sort_order int DEFAULT 0,
  is_required boolean DEFAULT false,
  resource_url text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_playbook_checklists_playbook ON playbook_checklists(playbook_id);

CREATE TABLE IF NOT EXISTS playbook_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- deal_id is a soft ref to crm_records.id; matches the linked_*_id pattern
  -- used by email_threads. No hard FK by design.
  deal_id uuid NOT NULL,
  playbook_id uuid NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
  completed_items uuid[] DEFAULT '{}',
  item_notes jsonb DEFAULT '{}'::jsonb,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(deal_id, playbook_id)
);

CREATE INDEX IF NOT EXISTS idx_playbook_progress_deal ON playbook_progress(deal_id);

CREATE TABLE IF NOT EXISTS deal_war_room_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL,
  category text DEFAULT 'general',
  content text NOT NULL,
  is_pinned boolean DEFAULT false,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_war_room_notes_deal ON deal_war_room_notes(deal_id);

CREATE TABLE IF NOT EXISTS deal_blockers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  severity text DEFAULT 'medium',
  status text DEFAULT 'open',
  resolution_notes text,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES profiles(id),
  owner_id uuid REFERENCES profiles(id),
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_blockers_deal   ON deal_blockers(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_blockers_status ON deal_blockers(status) WHERE status = 'open';

ALTER TABLE forecasts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbooks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_checklists  ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_progress    ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_war_room_notes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_blockers        ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='forecasts' AND policyname='Users can view forecasts for their org') THEN
    CREATE POLICY "Users can view forecasts for their org"
      ON forecasts FOR SELECT
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='forecasts' AND policyname='Admins can manage forecasts') THEN
    CREATE POLICY "Admins can manage forecasts"
      ON forecasts FOR ALL
      USING (
        org_id = (SELECT get_user_organization_id())
        AND (SELECT get_user_role()) IN ('owner', 'admin')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='playbooks' AND policyname='Users can view playbooks for their org') THEN
    CREATE POLICY "Users can view playbooks for their org"
      ON playbooks FOR SELECT
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='playbooks' AND policyname='Admins can manage playbooks') THEN
    CREATE POLICY "Admins can manage playbooks"
      ON playbooks FOR ALL
      USING (
        org_id = (SELECT get_user_organization_id())
        AND (SELECT get_user_role()) IN ('owner', 'admin')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='playbook_checklists' AND policyname='Users can view playbook checklists') THEN
    CREATE POLICY "Users can view playbook checklists"
      ON playbook_checklists FOR SELECT
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='playbook_progress' AND policyname='Users can view playbook progress') THEN
    CREATE POLICY "Users can view playbook progress"
      ON playbook_progress FOR SELECT
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='playbook_progress' AND policyname='Users can manage playbook progress') THEN
    CREATE POLICY "Users can manage playbook progress"
      ON playbook_progress FOR ALL
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deal_war_room_notes' AND policyname='Users can view war room notes') THEN
    CREATE POLICY "Users can view war room notes"
      ON deal_war_room_notes FOR SELECT
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deal_war_room_notes' AND policyname='Users can manage war room notes') THEN
    CREATE POLICY "Users can manage war room notes"
      ON deal_war_room_notes FOR ALL
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deal_blockers' AND policyname='Users can view deal blockers') THEN
    CREATE POLICY "Users can view deal blockers"
      ON deal_blockers FOR SELECT
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deal_blockers' AND policyname='Users can manage deal blockers') THEN
    CREATE POLICY "Users can manage deal blockers"
      ON deal_blockers FOR ALL
      USING (org_id = (SELECT get_user_organization_id()));
  END IF;
END $$;

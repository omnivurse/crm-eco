-- ============================================================================
-- MODULE 3: Channels (Communications Hub)
-- Unified channel registry, credential vault, inbound message routing
-- Extends existing crm_message_providers / crm_messages / crm_webforms
-- ============================================================================

-- ============================================================================
-- 1. CRM CHANNELS — Unified channel registry
-- Central table for all communication channel types
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_channels (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel_type    text         NOT NULL CHECK (channel_type IN (
                      'email','sms','telephony','chat','webform','social','portal'
                    )),
  provider        text         NOT NULL,  -- resend, smtp, twilio, telnyx, twilio_voice, webchat, facebook, etc.
  display_name    text         NOT NULL,
  config          jsonb        NOT NULL DEFAULT '{}',  -- non-sensitive provider config
  is_active       boolean      NOT NULL DEFAULT true,
  is_default      boolean      NOT NULL DEFAULT false,
  inbound_enabled boolean      NOT NULL DEFAULT false,
  inbound_address text,         -- e.g. inbound email address, webhook URL, phone number
  metadata        jsonb        DEFAULT '{}',
  created_by      uuid         REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT uq_channels_org_type_provider
    UNIQUE (organization_id, channel_type, provider)
);

CREATE INDEX IF NOT EXISTS idx_crm_channels_org
  ON crm_channels(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_channels_org_type
  ON crm_channels(organization_id, channel_type);
CREATE INDEX IF NOT EXISTS idx_crm_channels_org_default
  ON crm_channels(organization_id, channel_type, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_crm_channels_active
  ON crm_channels(organization_id, is_active) WHERE is_active = true;

COMMENT ON TABLE crm_channels IS 'Unified registry for all communication channels (email, SMS, telephony, chat, webform, social, portal)';

-- ============================================================================
-- 2. CRM CHANNEL CREDENTIALS — Encrypted credential vault
-- Secrets stored separately with restricted access
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_channel_credentials (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id      uuid         NOT NULL REFERENCES crm_channels(id) ON DELETE CASCADE,
  organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  credential_key  text         NOT NULL,   -- e.g. api_key, auth_token, account_sid
  credential_value text        NOT NULL,   -- encrypted at application layer before storage
  is_encrypted    boolean      NOT NULL DEFAULT true,
  expires_at      timestamptz,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT uq_channel_cred_key
    UNIQUE (channel_id, credential_key)
);

CREATE INDEX IF NOT EXISTS idx_crm_channel_creds_channel
  ON crm_channel_credentials(channel_id);
CREATE INDEX IF NOT EXISTS idx_crm_channel_creds_org
  ON crm_channel_credentials(organization_id);

COMMENT ON TABLE crm_channel_credentials IS 'Encrypted credential storage for channel providers — values encrypted at app layer';
COMMENT ON COLUMN crm_channel_credentials.credential_value IS 'Application-layer encrypted value. Never return raw to client.';

-- ============================================================================
-- 3. CRM INBOUND MESSAGES — Inbound message intake with contact matching
-- Captures messages received from any channel before CRM routing
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_inbound_messages (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel_id      uuid         REFERENCES crm_channels(id) ON DELETE SET NULL,
  channel_type    text         NOT NULL CHECK (channel_type IN (
                      'email','sms','telephony','chat','webform','social','portal'
                    )),
  -- Sender identification
  from_address    text         NOT NULL,  -- email, phone, social handle
  from_name       text,
  to_address      text,
  -- Content
  subject         text,
  body            text,
  body_html       text,
  attachments     jsonb        DEFAULT '[]',
  -- Contact matching
  matched_record_id uuid      REFERENCES crm_records(id) ON DELETE SET NULL,
  matched_at      timestamptz,
  match_method    text         CHECK (match_method IS NULL OR match_method IN (
                      'email_exact','phone_exact','social_handle','manual','auto_created'
                    )),
  -- Processing
  status          text         NOT NULL DEFAULT 'pending' CHECK (status IN (
                      'pending','matched','unmatched','processed','ignored','failed'
                    )),
  thread_id       uuid         REFERENCES crm_message_threads(id) ON DELETE SET NULL,
  provider_message_id text,    -- external provider message ID
  raw_payload     jsonb,       -- full raw inbound payload for debugging
  metadata        jsonb        DEFAULT '{}',
  processed_at    timestamptz,
  created_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_inbound_org_status
  ON crm_inbound_messages(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_inbound_org_date
  ON crm_inbound_messages(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_inbound_from
  ON crm_inbound_messages(organization_id, from_address);
CREATE INDEX IF NOT EXISTS idx_crm_inbound_matched
  ON crm_inbound_messages(matched_record_id) WHERE matched_record_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_inbound_channel
  ON crm_inbound_messages(channel_id);

COMMENT ON TABLE crm_inbound_messages IS 'Inbound messages from all channels — staged for contact matching and CRM routing';

-- ============================================================================
-- 4. EXPAND CHANNEL TYPES on existing tables
-- Add telephony/chat/social/portal/webform to crm_message_threads & crm_messages
-- ============================================================================
ALTER TABLE crm_message_threads
  DROP CONSTRAINT IF EXISTS crm_message_threads_channel_check;
ALTER TABLE crm_message_threads
  ADD CONSTRAINT crm_message_threads_channel_check
  CHECK (channel IN ('email','sms','telephony','chat','webform','social','portal'));

ALTER TABLE crm_messages
  DROP CONSTRAINT IF EXISTS crm_messages_channel_check;
ALTER TABLE crm_messages
  ADD CONSTRAINT crm_messages_channel_check
  CHECK (channel IN ('email','sms','telephony','chat','webform','social','portal'));

ALTER TABLE crm_message_templates
  DROP CONSTRAINT IF EXISTS crm_message_templates_channel_check;
ALTER TABLE crm_message_templates
  ADD CONSTRAINT crm_message_templates_channel_check
  CHECK (channel IN ('email','sms','telephony','chat','webform','social','portal'));

-- ============================================================================
-- 5. CONTACT MATCHING FUNCTION
-- Matches inbound from_address to CRM records by email or phone
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_match_inbound_to_contact(
  p_org_id uuid,
  p_from_address text,
  p_channel_type text
)
RETURNS TABLE(record_id uuid, match_method text) AS $$
BEGIN
  -- Email matching
  IF p_channel_type IN ('email', 'webform', 'portal') THEN
    RETURN QUERY
      SELECT r.id, 'email_exact'::text
      FROM crm_records r
      JOIN crm_modules m ON m.id = r.module_id
      WHERE r.org_id = p_org_id
        AND m.key IN ('contacts', 'leads')
        AND (
          r.data->>'email' = lower(p_from_address) OR
          r.data->>'secondary_email' = lower(p_from_address)
        )
      LIMIT 1;
    RETURN;
  END IF;

  -- Phone matching (SMS, telephony)
  IF p_channel_type IN ('sms', 'telephony') THEN
    RETURN QUERY
      SELECT r.id, 'phone_exact'::text
      FROM crm_records r
      JOIN crm_modules m ON m.id = r.module_id
      WHERE r.org_id = p_org_id
        AND m.key IN ('contacts', 'leads')
        AND (
          r.data->>'phone' = p_from_address OR
          r.data->>'mobile' = p_from_address
        )
      LIMIT 1;
    RETURN;
  END IF;

  -- Social matching
  IF p_channel_type = 'social' THEN
    RETURN QUERY
      SELECT r.id, 'social_handle'::text
      FROM crm_records r
      JOIN crm_modules m ON m.id = r.module_id
      WHERE r.org_id = p_org_id
        AND m.key IN ('contacts', 'leads')
        AND (
          r.data->>'social_handle' = p_from_address OR
          r.data->>'twitter' = p_from_address OR
          r.data->>'linkedin' = p_from_address
        )
      LIMIT 1;
    RETURN;
  END IF;

  RETURN;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION fn_match_inbound_to_contact IS 'Matches inbound sender address to CRM contact/lead records';

-- ============================================================================
-- 6. AUTO-MATCH TRIGGER — attempt contact match on inbound insert
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_auto_match_inbound()
RETURNS trigger AS $$
DECLARE
  v_match RECORD;
BEGIN
  IF NEW.matched_record_id IS NULL AND NEW.status = 'pending' THEN
    SELECT * INTO v_match
    FROM fn_match_inbound_to_contact(NEW.organization_id, NEW.from_address, NEW.channel_type)
    LIMIT 1;

    IF v_match IS NOT NULL THEN
      NEW.matched_record_id := v_match.record_id;
      NEW.match_method := v_match.match_method;
      NEW.matched_at := now();
      NEW.status := 'matched';
    ELSE
      NEW.status := 'unmatched';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_auto_match_inbound
  BEFORE INSERT ON crm_inbound_messages
  FOR EACH ROW EXECUTE FUNCTION fn_auto_match_inbound();

-- ============================================================================
-- 7. AUDIT TRIGGER — log channel configuration changes
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_audit_channel_changes()
RETURNS trigger AS $$
BEGIN
  INSERT INTO unified_audit_logs (
    organization_id, app_source, actor_id,
    action, action_category, risk_level, details, changes
  ) VALUES (
    COALESCE(NEW.organization_id, OLD.organization_id),
    'crm',
    COALESCE(
      (SELECT id FROM profiles WHERE user_id = (SELECT auth.uid()) LIMIT 1),
      NULL
    ),
    TG_TABLE_NAME || '.' || lower(TG_OP),
    'configuration',
    CASE WHEN TG_TABLE_NAME = 'crm_channel_credentials' THEN 'critical' ELSE 'medium' END,
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'channel_type', COALESCE(NEW.channel_type, OLD.channel_type, 'n/a'),
      'provider', CASE WHEN TG_TABLE_NAME = 'crm_channels'
        THEN COALESCE(NEW.provider, OLD.provider)
        ELSE NULL END
    ),
    CASE TG_OP
      WHEN 'INSERT' THEN jsonb_build_object('new', to_jsonb(NEW))
      WHEN 'UPDATE' THEN jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
      WHEN 'DELETE' THEN jsonb_build_object('old', to_jsonb(OLD))
    END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_audit_crm_channels
  AFTER INSERT OR UPDATE OR DELETE ON crm_channels
  FOR EACH ROW EXECUTE FUNCTION fn_audit_channel_changes();

CREATE TRIGGER trg_audit_crm_channel_credentials
  AFTER INSERT OR UPDATE OR DELETE ON crm_channel_credentials
  FOR EACH ROW EXECUTE FUNCTION fn_audit_channel_changes();

-- ============================================================================
-- 8. AUTO-UPDATE TRIGGERS
-- ============================================================================
CREATE TRIGGER update_crm_channels_updated_at
  BEFORE UPDATE ON crm_channels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_channel_credentials_updated_at
  BEFORE UPDATE ON crm_channel_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 9. ROW LEVEL SECURITY
-- ============================================================================

-- ── crm_channels: org-scoped read, admin write ───────────────────────────
ALTER TABLE crm_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "channels_select" ON crm_channels;
CREATE POLICY "channels_select" ON crm_channels
  FOR SELECT TO authenticated
  USING (is_crm_member(organization_id));

DROP POLICY IF EXISTS "channels_admin_insert" ON crm_channels;
CREATE POLICY "channels_admin_insert" ON crm_channels
  FOR INSERT TO authenticated
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "channels_admin_update" ON crm_channels;
CREATE POLICY "channels_admin_update" ON crm_channels
  FOR UPDATE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']))
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "channels_admin_delete" ON crm_channels;
CREATE POLICY "channels_admin_delete" ON crm_channels
  FOR DELETE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "channels_service" ON crm_channels;
CREATE POLICY "channels_service" ON crm_channels
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── crm_channel_credentials: admin only (no general read) ────────────────
ALTER TABLE crm_channel_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "creds_admin_select" ON crm_channel_credentials;
CREATE POLICY "creds_admin_select" ON crm_channel_credentials
  FOR SELECT TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "creds_admin_insert" ON crm_channel_credentials;
CREATE POLICY "creds_admin_insert" ON crm_channel_credentials
  FOR INSERT TO authenticated
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "creds_admin_update" ON crm_channel_credentials;
CREATE POLICY "creds_admin_update" ON crm_channel_credentials
  FOR UPDATE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']))
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "creds_admin_delete" ON crm_channel_credentials;
CREATE POLICY "creds_admin_delete" ON crm_channel_credentials
  FOR DELETE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "creds_service" ON crm_channel_credentials;
CREATE POLICY "creds_service" ON crm_channel_credentials
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── crm_inbound_messages: org-scoped read, service/agent write ───────────
ALTER TABLE crm_inbound_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inbound_select" ON crm_inbound_messages;
CREATE POLICY "inbound_select" ON crm_inbound_messages
  FOR SELECT TO authenticated
  USING (is_crm_member(organization_id));

DROP POLICY IF EXISTS "inbound_insert" ON crm_inbound_messages;
CREATE POLICY "inbound_insert" ON crm_inbound_messages
  FOR INSERT TO authenticated
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

DROP POLICY IF EXISTS "inbound_update" ON crm_inbound_messages;
CREATE POLICY "inbound_update" ON crm_inbound_messages
  FOR UPDATE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

DROP POLICY IF EXISTS "inbound_service" ON crm_inbound_messages;
CREATE POLICY "inbound_service" ON crm_inbound_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- END MODULE 3
-- ============================================================================

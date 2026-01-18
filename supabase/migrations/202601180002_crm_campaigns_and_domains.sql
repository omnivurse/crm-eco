-- ============================================================================
-- CRM-ECO: Email Campaigns, Custom Domains, and Advanced Filtering
--
-- This migration creates:
-- 1. Email Campaigns system for mass email sending
-- 2. Campaign Recipients tracking with engagement metrics
-- 3. Custom Email Domains for branded sending
-- 4. Sender Addresses management
-- 5. Recent Views tracking for "Recently Viewed" filter
-- 6. Email Tracking extensions for campaign analytics
-- ============================================================================

-- ============================================================================
-- PART 1: EMAIL CAMPAIGNS
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text,
  from_name text,
  from_email text,
  reply_to text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'sending', 'paused', 'sent', 'cancelled')),
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  total_recipients int DEFAULT 0,
  sent_count int DEFAULT 0,
  delivered_count int DEFAULT 0,
  opened_count int DEFAULT 0,
  clicked_count int DEFAULT 0,
  bounced_count int DEFAULT 0,
  unsubscribed_count int DEFAULT 0,
  failed_count int DEFAULT 0,
  module_key text, -- contacts, leads, deals, accounts
  view_id uuid, -- optional: source view for recipients
  filter_config jsonb DEFAULT '[]'::jsonb, -- filters applied when selecting recipients
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_campaigns_org ON email_campaigns(org_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(org_id, status);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_created_by ON email_campaigns(created_by);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_scheduled ON email_campaigns(scheduled_at) WHERE status = 'scheduled';

-- Enable RLS
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view campaigns in their org" ON email_campaigns;
CREATE POLICY "Users can view campaigns in their org"
  ON email_campaigns FOR SELECT
  TO authenticated
  USING (org_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can create campaigns in their org" ON email_campaigns;
CREATE POLICY "Users can create campaigns in their org"
  ON email_campaigns FOR INSERT
  TO authenticated
  WITH CHECK (org_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update campaigns in their org" ON email_campaigns;
CREATE POLICY "Users can update campaigns in their org"
  ON email_campaigns FOR UPDATE
  TO authenticated
  USING (org_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete draft campaigns in their org" ON email_campaigns;
CREATE POLICY "Users can delete draft campaigns in their org"
  ON email_campaigns FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
    AND status = 'draft'
  );

-- ============================================================================
-- PART 2: CAMPAIGN RECIPIENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  record_id uuid NOT NULL,
  module_key text NOT NULL,
  email text NOT NULL,
  first_name text,
  last_name text,
  merge_data jsonb DEFAULT '{}'::jsonb, -- additional merge fields
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'queued', 'sending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'unsubscribed', 'skipped')),
  skip_reason text, -- why skipped (unsubscribed, invalid email, etc.)
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  open_count int DEFAULT 0,
  last_opened_at timestamptz,
  clicked_at timestamptz,
  click_count int DEFAULT 0,
  last_clicked_at timestamptz,
  bounced_at timestamptz,
  bounce_type text, -- hard, soft
  bounce_reason text,
  unsubscribed_at timestamptz,
  failed_at timestamptz,
  error_message text,
  provider_message_id text,
  tracking_id uuid DEFAULT gen_random_uuid(), -- unique ID for tracking pixel/links
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON email_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON email_campaign_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_email ON email_campaign_recipients(email);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_tracking ON email_campaign_recipients(tracking_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_record ON email_campaign_recipients(record_id, module_key);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_pending ON email_campaign_recipients(campaign_id)
  WHERE status IN ('pending', 'queued');

-- Enable RLS
ALTER TABLE email_campaign_recipients ENABLE ROW LEVEL SECURITY;

-- RLS Policies (via campaign org_id)
DROP POLICY IF EXISTS "Users can view recipients for their campaigns" ON email_campaign_recipients;
CREATE POLICY "Users can view recipients for their campaigns"
  ON email_campaign_recipients FOR SELECT
  TO authenticated
  USING (campaign_id IN (
    SELECT id FROM email_campaigns WHERE org_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS "Users can manage recipients for their campaigns" ON email_campaign_recipients;
CREATE POLICY "Users can manage recipients for their campaigns"
  ON email_campaign_recipients FOR ALL
  TO authenticated
  USING (campaign_id IN (
    SELECT id FROM email_campaigns WHERE org_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  ));

-- ============================================================================
-- PART 3: CUSTOM EMAIL DOMAINS
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  domain text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verifying', 'verified', 'failed')),
  -- DNS verification records
  dkim_selector text,
  dkim_value text, -- the CNAME/TXT value to add
  dkim_verified boolean DEFAULT false,
  dkim_verified_at timestamptz,
  spf_value text, -- the TXT value for SPF
  spf_verified boolean DEFAULT false,
  spf_verified_at timestamptz,
  dmarc_value text, -- the TXT value for DMARC
  dmarc_verified boolean DEFAULT false,
  dmarc_verified_at timestamptz,
  verification_token text, -- random token for TXT record verification
  verification_attempts int DEFAULT 0,
  last_verification_at timestamptz,
  error_message text,
  -- Provider-specific
  sendgrid_domain_id text, -- if using SendGrid domain authentication
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, domain)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_domains_org ON email_domains(org_id);
CREATE INDEX IF NOT EXISTS idx_email_domains_status ON email_domains(org_id, status);
CREATE INDEX IF NOT EXISTS idx_email_domains_domain ON email_domains(domain);

-- Enable RLS
ALTER TABLE email_domains ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view domains in their org" ON email_domains;
CREATE POLICY "Users can view domains in their org"
  ON email_domains FOR SELECT
  TO authenticated
  USING (org_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Admins can manage domains in their org" ON email_domains;
CREATE POLICY "Admins can manage domains in their org"
  ON email_domains FOR ALL
  TO authenticated
  USING (org_id IN (
    SELECT organization_id FROM profiles
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- ============================================================================
-- PART 4: SENDER ADDRESSES
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_sender_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  domain_id uuid REFERENCES email_domains(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text, -- display name for "From"
  reply_to text, -- optional different reply-to
  is_default boolean DEFAULT false,
  is_verified boolean DEFAULT false,
  verified_at timestamptz,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, email)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sender_addresses_org ON email_sender_addresses(org_id);
CREATE INDEX IF NOT EXISTS idx_sender_addresses_domain ON email_sender_addresses(domain_id);
CREATE INDEX IF NOT EXISTS idx_sender_addresses_default ON email_sender_addresses(org_id, is_default) WHERE is_default = true;

-- Enable RLS
ALTER TABLE email_sender_addresses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view sender addresses in their org" ON email_sender_addresses;
CREATE POLICY "Users can view sender addresses in their org"
  ON email_sender_addresses FOR SELECT
  TO authenticated
  USING (org_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Admins can manage sender addresses in their org" ON email_sender_addresses;
CREATE POLICY "Admins can manage sender addresses in their org"
  ON email_sender_addresses FOR ALL
  TO authenticated
  USING (org_id IN (
    SELECT organization_id FROM profiles
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- Ensure only one default per org
CREATE OR REPLACE FUNCTION ensure_single_default_sender()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE email_sender_addresses
    SET is_default = false, updated_at = now()
    WHERE org_id = NEW.org_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ensure_single_default_sender ON email_sender_addresses;
CREATE TRIGGER trigger_ensure_single_default_sender
  BEFORE INSERT OR UPDATE ON email_sender_addresses
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_sender();

-- ============================================================================
-- PART 5: RECENT VIEWS TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_recent_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  record_id uuid NOT NULL,
  module_id uuid NOT NULL REFERENCES crm_modules(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now(),
  view_count int DEFAULT 1,
  UNIQUE(user_id, record_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recent_views_user ON crm_recent_views(user_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_recent_views_module ON crm_recent_views(user_id, module_id, viewed_at DESC);

-- Enable RLS
ALTER TABLE crm_recent_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own recent views" ON crm_recent_views;
CREATE POLICY "Users can view their own recent views"
  ON crm_recent_views FOR SELECT
  TO authenticated
  USING (user_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can manage their own recent views" ON crm_recent_views;
CREATE POLICY "Users can manage their own recent views"
  ON crm_recent_views FOR ALL
  TO authenticated
  USING (user_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

-- Function to upsert recent view
CREATE OR REPLACE FUNCTION upsert_recent_view(
  p_org_id uuid,
  p_user_id uuid,
  p_record_id uuid,
  p_module_id uuid
)
RETURNS void AS $$
BEGIN
  INSERT INTO crm_recent_views (org_id, user_id, record_id, module_id, viewed_at, view_count)
  VALUES (p_org_id, p_user_id, p_record_id, p_module_id, now(), 1)
  ON CONFLICT (user_id, record_id)
  DO UPDATE SET
    viewed_at = now(),
    view_count = crm_recent_views.view_count + 1;

  -- Cleanup: keep only last 100 records per user
  DELETE FROM crm_recent_views
  WHERE user_id = p_user_id
    AND id NOT IN (
      SELECT id FROM crm_recent_views
      WHERE user_id = p_user_id
      ORDER BY viewed_at DESC
      LIMIT 100
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION upsert_recent_view(uuid, uuid, uuid, uuid) TO authenticated;

-- ============================================================================
-- PART 6: CAMPAIGN TRACKING EVENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaign_tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES email_campaign_recipients(id) ON DELETE CASCADE,
  tracking_id uuid NOT NULL,
  event_type text NOT NULL
    CHECK (event_type IN ('open', 'click', 'unsubscribe')),
  ip_address text,
  user_agent text,
  clicked_url text, -- for click events
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tracking_events_campaign ON campaign_tracking_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_recipient ON campaign_tracking_events(recipient_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_tracking_id ON campaign_tracking_events(tracking_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_type ON campaign_tracking_events(campaign_id, event_type);

-- Enable RLS
ALTER TABLE campaign_tracking_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy
DROP POLICY IF EXISTS "Users can view tracking events for their campaigns" ON campaign_tracking_events;
CREATE POLICY "Users can view tracking events for their campaigns"
  ON campaign_tracking_events FOR SELECT
  TO authenticated
  USING (org_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));

-- Function to record tracking event
CREATE OR REPLACE FUNCTION record_tracking_event(
  p_tracking_id uuid,
  p_event_type text,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_clicked_url text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_recipient email_campaign_recipients%ROWTYPE;
  v_campaign email_campaigns%ROWTYPE;
BEGIN
  -- Find recipient by tracking ID
  SELECT * INTO v_recipient
  FROM email_campaign_recipients
  WHERE tracking_id = p_tracking_id;

  IF v_recipient.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Tracking ID not found');
  END IF;

  -- Get campaign
  SELECT * INTO v_campaign
  FROM email_campaigns
  WHERE id = v_recipient.campaign_id;

  -- Record the event
  INSERT INTO campaign_tracking_events (
    org_id, campaign_id, recipient_id, tracking_id,
    event_type, ip_address, user_agent, clicked_url
  ) VALUES (
    v_campaign.org_id, v_recipient.campaign_id, v_recipient.id, p_tracking_id,
    p_event_type, p_ip_address, p_user_agent, p_clicked_url
  );

  -- Update recipient stats
  IF p_event_type = 'open' THEN
    UPDATE email_campaign_recipients
    SET
      opened_at = COALESCE(opened_at, now()),
      last_opened_at = now(),
      open_count = open_count + 1,
      status = CASE WHEN status NOT IN ('clicked', 'unsubscribed') THEN 'opened' ELSE status END
    WHERE id = v_recipient.id;

    -- Update campaign stats (only increment unique opens)
    IF v_recipient.opened_at IS NULL THEN
      UPDATE email_campaigns
      SET opened_count = opened_count + 1
      WHERE id = v_recipient.campaign_id;
    END IF;

  ELSIF p_event_type = 'click' THEN
    UPDATE email_campaign_recipients
    SET
      clicked_at = COALESCE(clicked_at, now()),
      last_clicked_at = now(),
      click_count = click_count + 1,
      opened_at = COALESCE(opened_at, now()), -- click implies open
      status = CASE WHEN status != 'unsubscribed' THEN 'clicked' ELSE status END
    WHERE id = v_recipient.id;

    -- Update campaign stats (only increment unique clicks)
    IF v_recipient.clicked_at IS NULL THEN
      UPDATE email_campaigns
      SET
        clicked_count = clicked_count + 1,
        opened_count = CASE WHEN v_recipient.opened_at IS NULL
                       THEN opened_count + 1 ELSE opened_count END
      WHERE id = v_recipient.campaign_id;
    END IF;

  ELSIF p_event_type = 'unsubscribe' THEN
    UPDATE email_campaign_recipients
    SET
      unsubscribed_at = now(),
      status = 'unsubscribed'
    WHERE id = v_recipient.id;

    UPDATE email_campaigns
    SET unsubscribed_count = unsubscribed_count + 1
    WHERE id = v_recipient.campaign_id;
  END IF;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 7: GLOBAL UNSUBSCRIBE LIST
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_unsubscribes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  reason text, -- user-provided reason
  source text, -- campaign, manual, import
  source_campaign_id uuid REFERENCES email_campaigns(id) ON DELETE SET NULL,
  unsubscribed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(org_id, email)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_unsubscribes_org ON email_unsubscribes(org_id);
CREATE INDEX IF NOT EXISTS idx_unsubscribes_email ON email_unsubscribes(org_id, email);

-- Enable RLS
ALTER TABLE email_unsubscribes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view unsubscribes in their org" ON email_unsubscribes;
CREATE POLICY "Users can view unsubscribes in their org"
  ON email_unsubscribes FOR SELECT
  TO authenticated
  USING (org_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can manage unsubscribes in their org" ON email_unsubscribes;
CREATE POLICY "Users can manage unsubscribes in their org"
  ON email_unsubscribes FOR ALL
  TO authenticated
  USING (org_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));

-- ============================================================================
-- PART 8: ENABLE REALTIME FOR CAMPAIGNS
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE email_campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE email_campaign_recipients;

-- ============================================================================
-- PART 9: HELPER FUNCTIONS
-- ============================================================================

-- Get campaign stats summary
CREATE OR REPLACE FUNCTION get_campaign_stats(p_campaign_id uuid)
RETURNS json AS $$
DECLARE
  v_stats json;
BEGIN
  SELECT json_build_object(
    'total', total_recipients,
    'sent', sent_count,
    'delivered', delivered_count,
    'opened', opened_count,
    'clicked', clicked_count,
    'bounced', bounced_count,
    'unsubscribed', unsubscribed_count,
    'failed', failed_count,
    'pending', total_recipients - sent_count,
    'delivery_rate', CASE WHEN sent_count > 0
      THEN ROUND((delivered_count::numeric / sent_count) * 100, 2) ELSE 0 END,
    'open_rate', CASE WHEN delivered_count > 0
      THEN ROUND((opened_count::numeric / delivered_count) * 100, 2) ELSE 0 END,
    'click_rate', CASE WHEN delivered_count > 0
      THEN ROUND((clicked_count::numeric / delivered_count) * 100, 2) ELSE 0 END,
    'bounce_rate', CASE WHEN sent_count > 0
      THEN ROUND((bounced_count::numeric / sent_count) * 100, 2) ELSE 0 END
  ) INTO v_stats
  FROM email_campaigns
  WHERE id = p_campaign_id;

  RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_campaign_stats(uuid) TO authenticated;

-- Check if email is unsubscribed
CREATE OR REPLACE FUNCTION is_email_unsubscribed(p_org_id uuid, p_email text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM email_unsubscribes
    WHERE org_id = p_org_id AND LOWER(email) = LOWER(p_email)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION is_email_unsubscribed(uuid, text) TO authenticated;

-- ============================================================================
-- DONE
-- ============================================================================

SELECT 'CRM Campaigns and Domains Migration Complete!' as status;

-- ============================================================================
-- PHASE W16: SLACK INTEGRATION
-- Slack OAuth, notifications, and channel subscriptions
-- ============================================================================

-- ============================================================================
-- SLACK CONNECTIONS
-- Slack workspace OAuth connections
-- ============================================================================

CREATE TABLE IF NOT EXISTS slack_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- OAuth tokens
  access_token_enc text NOT NULL,
  
  -- Workspace info
  team_id text NOT NULL,
  team_name text,
  team_domain text,
  
  -- Bot info
  bot_user_id text,
  bot_access_token_enc text,
  
  -- Default channel
  default_channel_id text,
  default_channel_name text,
  
  -- Status
  status text DEFAULT 'active', -- active, error, revoked
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(org_id, team_id)
);

CREATE INDEX idx_slack_connections_org ON slack_connections(org_id);

-- ============================================================================
-- SLACK SUBSCRIPTIONS
-- Event subscriptions for Slack notifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS slack_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES slack_connections(id) ON DELETE CASCADE,
  
  -- Subscription details
  event_type text NOT NULL,
  -- Events: deal.won, deal.lost, lead.created, task.overdue, approval.requested, daily_briefing
  
  channel_id text NOT NULL,
  channel_name text,
  
  -- Configuration
  message_template text,
  include_details boolean DEFAULT true,
  
  -- Status
  enabled boolean DEFAULT true,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(org_id, event_type, channel_id)
);

CREATE INDEX idx_slack_subscriptions_org ON slack_subscriptions(org_id);
CREATE INDEX idx_slack_subscriptions_event ON slack_subscriptions(event_type) WHERE enabled;

-- ============================================================================
-- SLACK MESSAGES LOG
-- Log of messages sent to Slack
-- ============================================================================

CREATE TABLE IF NOT EXISTS slack_messages_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES slack_connections(id) ON DELETE SET NULL,
  
  -- Message details
  channel_id text NOT NULL,
  message_text text,
  message_blocks jsonb,
  
  -- Status
  status text DEFAULT 'sent', -- sent, failed
  slack_ts text,
  error_message text,
  
  -- Source
  source_type text, -- automation, manual, system
  source_id uuid,
  
  -- Timestamps
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_slack_messages_org ON slack_messages_log(org_id);
CREATE INDEX idx_slack_messages_created ON slack_messages_log(created_at DESC);

-- RLS
ALTER TABLE slack_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_messages_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view slack connections for their org"
  ON slack_connections FOR SELECT USING (org_id = get_user_organization_id());

CREATE POLICY "Admins can manage slack connections"
  ON slack_connections FOR ALL USING (org_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

CREATE POLICY "Users can view slack subscriptions for their org"
  ON slack_subscriptions FOR SELECT USING (org_id = get_user_organization_id());

CREATE POLICY "Admins can manage slack subscriptions"
  ON slack_subscriptions FOR ALL USING (org_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

CREATE POLICY "Users can view slack messages for their org"
  ON slack_messages_log FOR SELECT USING (org_id = get_user_organization_id());

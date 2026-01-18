-- OAuth Foundation for Integration Marketplace
-- Adds OAuth state management and enhances integration_connections

-- OAuth state management (CSRF protection during OAuth flows)
CREATE TABLE IF NOT EXISTS oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text UNIQUE NOT NULL,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  connection_type text NOT NULL DEFAULT 'default',
  redirect_uri text,
  code_verifier text, -- For PKCE flows
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Indexes for OAuth states
CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_states_org ON oauth_states(org_id);

-- Clean up expired states automatically (can be run by cron)
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
  DELETE FROM oauth_states WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add scopes column to integration_connections if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_connections'
    AND column_name = 'scopes'
  ) THEN
    ALTER TABLE integration_connections ADD COLUMN scopes text[];
  END IF;
END $$;

-- Add refresh_token_expires_at for providers that have separate refresh token expiry
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_connections'
    AND column_name = 'refresh_token_expires_at'
  ) THEN
    ALTER TABLE integration_connections ADD COLUMN refresh_token_expires_at timestamptz;
  END IF;
END $$;

-- RLS for oauth_states
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

-- Only admins can manage OAuth states for their org
CREATE POLICY "Admins can manage oauth states" ON oauth_states
  FOR ALL
  USING (
    org_id IN (
      SELECT organization_id FROM profiles
      WHERE user_id = auth.uid()
      AND crm_role = 'crm_admin'
    )
  );

-- Service role has full access for OAuth callback processing
CREATE POLICY "Service role full access to oauth states" ON oauth_states
  FOR ALL
  USING (auth.role() = 'service_role');

-- Add comment
COMMENT ON TABLE oauth_states IS 'Temporary storage for OAuth flow state parameters (CSRF protection)';

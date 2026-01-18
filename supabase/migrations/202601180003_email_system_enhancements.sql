-- ============================================================================
-- EMAIL SYSTEM ENHANCEMENTS
-- Adds signatures, assets, attachments, and per-user settings
-- ============================================================================

-- ============================================================================
-- PART 1: EMAIL SIGNATURES
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default',
  content_html text NOT NULL,
  content_text text,
  is_default boolean DEFAULT false,
  include_in_replies boolean DEFAULT true,
  include_in_new boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, name)
);

CREATE INDEX IF NOT EXISTS idx_email_signatures_profile ON email_signatures(profile_id);
CREATE INDEX IF NOT EXISTS idx_email_signatures_org ON email_signatures(org_id);

-- Ensure only one default per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_signatures_default
  ON email_signatures(profile_id)
  WHERE is_default = true;

-- Link signatures to sender addresses (optional override)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_sender_addresses' AND column_name = 'default_signature_id'
  ) THEN
    ALTER TABLE email_sender_addresses
      ADD COLUMN default_signature_id uuid REFERENCES email_signatures(id) ON DELETE SET NULL;
  END IF;
END $$;

-- RLS Policies
ALTER TABLE email_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view signatures in their org" ON email_signatures;
CREATE POLICY "Users can view signatures in their org"
  ON email_signatures FOR SELECT
  TO authenticated
  USING (org_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can manage own signatures" ON email_signatures;
CREATE POLICY "Users can manage own signatures"
  ON email_signatures FOR ALL
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

-- ============================================================================
-- PART 2: EMAIL ASSETS (Image/File Library)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  bucket_path text NOT NULL,
  file_size integer NOT NULL,
  mime_type text NOT NULL,
  width integer,
  height integer,
  alt_text text,
  folder text DEFAULT 'general',
  tags text[] DEFAULT '{}',
  is_public boolean DEFAULT false,
  public_url text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_assets_org ON email_assets(org_id);
CREATE INDEX IF NOT EXISTS idx_email_assets_folder ON email_assets(org_id, folder);
CREATE INDEX IF NOT EXISTS idx_email_assets_tags ON email_assets USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_email_assets_created_by ON email_assets(created_by);

-- RLS Policies
ALTER TABLE email_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view assets in their org" ON email_assets;
CREATE POLICY "Users can view assets in their org"
  ON email_assets FOR SELECT
  TO authenticated
  USING (org_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can upload assets" ON email_assets;
CREATE POLICY "Users can upload assets"
  ON email_assets FOR INSERT
  TO authenticated
  WITH CHECK (org_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update own assets" ON email_assets;
CREATE POLICY "Users can update own assets"
  ON email_assets FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
    AND (
      created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
    )
  );

DROP POLICY IF EXISTS "Admins can delete assets" ON email_assets;
CREATE POLICY "Admins can delete assets"
  ON email_assets FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
    AND (
      created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
    )
  );

-- ============================================================================
-- PART 3: EMAIL ATTACHMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email_id uuid, -- Reference to sent email (nullable for drafts)
  campaign_id uuid REFERENCES email_campaigns(id) ON DELETE CASCADE,
  sequence_step_id uuid, -- Reference to sequence step (if applicable)
  template_id uuid, -- Reference to template (if applicable)
  file_name text NOT NULL,
  file_path text NOT NULL,
  bucket_path text NOT NULL,
  file_size integer NOT NULL,
  mime_type text NOT NULL,
  content_id text, -- For inline images (CID)
  is_inline boolean DEFAULT false,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_attachments_org ON email_attachments(org_id);
CREATE INDEX IF NOT EXISTS idx_email_attachments_campaign ON email_attachments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_attachments_email ON email_attachments(email_id);
CREATE INDEX IF NOT EXISTS idx_email_attachments_template ON email_attachments(template_id);

-- Add attachment count to campaigns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_campaigns' AND column_name = 'attachment_count'
  ) THEN
    ALTER TABLE email_campaigns ADD COLUMN attachment_count integer DEFAULT 0;
  END IF;
END $$;

-- Add attachment IDs to sequence steps (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_sequence_steps') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'email_sequence_steps' AND column_name = 'attachment_ids'
    ) THEN
      ALTER TABLE email_sequence_steps ADD COLUMN attachment_ids uuid[] DEFAULT '{}';
    END IF;
  END IF;
END $$;

-- RLS Policies
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view attachments in their org" ON email_attachments;
CREATE POLICY "Users can view attachments in their org"
  ON email_attachments FOR SELECT
  TO authenticated
  USING (org_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can manage attachments" ON email_attachments;
CREATE POLICY "Users can manage attachments"
  ON email_attachments FOR ALL
  TO authenticated
  USING (org_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));

-- ============================================================================
-- PART 4: USER EMAIL SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Default sender configuration
  default_sender_address_id uuid REFERENCES email_sender_addresses(id) ON DELETE SET NULL,
  default_signature_id uuid REFERENCES email_signatures(id) ON DELETE SET NULL,

  -- Allowed domains for this user (empty = all org domains)
  allowed_domain_ids uuid[] DEFAULT '{}',

  -- Sending preferences
  default_reply_to text,
  default_cc text[],
  default_bcc text[],

  -- Tracking preferences
  track_opens boolean DEFAULT true,
  track_clicks boolean DEFAULT true,

  -- Scheduling preferences
  preferred_send_time time,
  timezone text DEFAULT 'America/New_York',

  -- Limits
  daily_send_limit integer DEFAULT 500,
  emails_sent_today integer DEFAULT 0,
  last_send_reset_at date DEFAULT CURRENT_DATE,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(profile_id)
);

CREATE INDEX IF NOT EXISTS idx_user_email_settings_profile ON user_email_settings(profile_id);
CREATE INDEX IF NOT EXISTS idx_user_email_settings_org ON user_email_settings(org_id);

-- RLS Policies
ALTER TABLE user_email_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own email settings" ON user_email_settings;
CREATE POLICY "Users can view own email settings"
  ON user_email_settings FOR SELECT
  TO authenticated
  USING (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR org_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Users can manage own email settings" ON user_email_settings;
CREATE POLICY "Users can manage own email settings"
  ON user_email_settings FOR ALL
  TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage all email settings" ON user_email_settings;
CREATE POLICY "Admins can manage all email settings"
  ON user_email_settings FOR ALL
  TO authenticated
  USING (org_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- ============================================================================
-- PART 5: USER DOMAIN ASSIGNMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_domain_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  domain_id uuid NOT NULL REFERENCES email_domains(id) ON DELETE CASCADE,
  sender_addresses text[] DEFAULT '{}', -- Specific addresses allowed, empty = all
  is_primary boolean DEFAULT false,
  assigned_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, domain_id)
);

CREATE INDEX IF NOT EXISTS idx_user_domain_assignments_profile ON user_domain_assignments(profile_id);
CREATE INDEX IF NOT EXISTS idx_user_domain_assignments_domain ON user_domain_assignments(domain_id);
CREATE INDEX IF NOT EXISTS idx_user_domain_assignments_org ON user_domain_assignments(org_id);

-- Ensure only one primary per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_domain_assignments_primary
  ON user_domain_assignments(profile_id)
  WHERE is_primary = true;

-- RLS Policies
ALTER TABLE user_domain_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own domain assignments" ON user_domain_assignments;
CREATE POLICY "Users can view own domain assignments"
  ON user_domain_assignments FOR SELECT
  TO authenticated
  USING (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR org_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can manage domain assignments" ON user_domain_assignments;
CREATE POLICY "Admins can manage domain assignments"
  ON user_domain_assignments FOR ALL
  TO authenticated
  USING (org_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- ============================================================================
-- PART 6: HELPER FUNCTIONS
-- ============================================================================

-- Get user's default signature
CREATE OR REPLACE FUNCTION get_user_default_signature(p_profile_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  content_html text,
  content_text text
) AS $$
BEGIN
  RETURN QUERY
  SELECT es.id, es.name, es.content_html, es.content_text
  FROM email_signatures es
  WHERE es.profile_id = p_profile_id AND es.is_default = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_default_signature(uuid) TO authenticated;

-- Get user's allowed sender addresses
CREATE OR REPLACE FUNCTION get_user_sender_addresses(p_profile_id uuid)
RETURNS TABLE (
  id uuid,
  email text,
  name text,
  domain text,
  is_default boolean
) AS $$
DECLARE
  v_org_id uuid;
  v_allowed_domain_ids uuid[];
BEGIN
  -- Get user's org and allowed domains
  SELECT organization_id INTO v_org_id FROM profiles WHERE id = p_profile_id;
  SELECT allowed_domain_ids INTO v_allowed_domain_ids FROM user_email_settings WHERE profile_id = p_profile_id;

  -- If no specific domains assigned, return all verified senders
  IF v_allowed_domain_ids IS NULL OR array_length(v_allowed_domain_ids, 1) IS NULL THEN
    RETURN QUERY
    SELECT esa.id, esa.email, esa.name, ed.domain, esa.is_default
    FROM email_sender_addresses esa
    JOIN email_domains ed ON esa.domain_id = ed.id
    WHERE esa.org_id = v_org_id
      AND ed.status = 'verified'
      AND esa.is_verified = true
    ORDER BY esa.is_default DESC, esa.email;
  ELSE
    -- Return only senders from assigned domains
    RETURN QUERY
    SELECT esa.id, esa.email, esa.name, ed.domain, esa.is_default
    FROM email_sender_addresses esa
    JOIN email_domains ed ON esa.domain_id = ed.id
    WHERE esa.org_id = v_org_id
      AND ed.id = ANY(v_allowed_domain_ids)
      AND ed.status = 'verified'
      AND esa.is_verified = true
    ORDER BY esa.is_default DESC, esa.email;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_sender_addresses(uuid) TO authenticated;

-- Reset daily email count at midnight
CREATE OR REPLACE FUNCTION reset_daily_email_counts()
RETURNS void AS $$
BEGIN
  UPDATE user_email_settings
  SET emails_sent_today = 0, last_send_reset_at = CURRENT_DATE
  WHERE last_send_reset_at < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can send email (within daily limit)
CREATE OR REPLACE FUNCTION can_user_send_email(p_profile_id uuid)
RETURNS boolean AS $$
DECLARE
  v_settings user_email_settings%ROWTYPE;
BEGIN
  SELECT * INTO v_settings FROM user_email_settings WHERE profile_id = p_profile_id;

  -- No settings = no restrictions
  IF v_settings.id IS NULL THEN
    RETURN true;
  END IF;

  -- Reset if new day
  IF v_settings.last_send_reset_at < CURRENT_DATE THEN
    UPDATE user_email_settings
    SET emails_sent_today = 0, last_send_reset_at = CURRENT_DATE
    WHERE profile_id = p_profile_id;
    RETURN true;
  END IF;

  -- Check limit
  RETURN v_settings.emails_sent_today < v_settings.daily_send_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION can_user_send_email(uuid) TO authenticated;

-- Increment email sent count
CREATE OR REPLACE FUNCTION increment_user_email_count(p_profile_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO user_email_settings (org_id, profile_id, emails_sent_today, last_send_reset_at)
  SELECT organization_id, id, 1, CURRENT_DATE
  FROM profiles WHERE id = p_profile_id
  ON CONFLICT (profile_id)
  DO UPDATE SET
    emails_sent_today = CASE
      WHEN user_email_settings.last_send_reset_at < CURRENT_DATE THEN 1
      ELSE user_email_settings.emails_sent_today + 1
    END,
    last_send_reset_at = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION increment_user_email_count(uuid) TO authenticated;

-- ============================================================================
-- DONE
-- ============================================================================

SELECT 'Email System Enhancements Migration Complete!' as status;

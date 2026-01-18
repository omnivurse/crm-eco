-- ============================================================================
-- Email System Championship Upgrade Migration
-- Phase 2-5: Assets, Signatures, User Settings
-- ============================================================================

-- ============================================================================
-- 1. EMAIL ASSETS LIBRARY
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
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_assets_org ON email_assets(org_id);
CREATE INDEX IF NOT EXISTS idx_email_assets_folder ON email_assets(org_id, folder);
CREATE INDEX IF NOT EXISTS idx_email_assets_tags ON email_assets USING gin(tags);

-- RLS for email_assets
ALTER TABLE email_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "CRM members can view assets" ON email_assets;
CREATE POLICY "CRM members can view assets"
  ON email_assets FOR SELECT
  USING (is_crm_member(org_id));

DROP POLICY IF EXISTS "CRM agents can upload assets" ON email_assets;
CREATE POLICY "CRM agents can upload assets"
  ON email_assets FOR INSERT
  WITH CHECK (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

DROP POLICY IF EXISTS "CRM agents can update assets" ON email_assets;
CREATE POLICY "CRM agents can update assets"
  ON email_assets FOR UPDATE
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

DROP POLICY IF EXISTS "CRM managers can delete assets" ON email_assets;
CREATE POLICY "CRM managers can delete assets"
  ON email_assets FOR DELETE
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']));

-- ============================================================================
-- 2. EMAIL ATTACHMENTS (for campaigns, templates, sequences)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email_id uuid, -- Reference to sent email (nullable for drafts)
  campaign_id uuid REFERENCES email_campaigns(id) ON DELETE CASCADE,
  sequence_step_id uuid REFERENCES email_sequence_steps(id) ON DELETE CASCADE,
  template_id uuid REFERENCES email_templates(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  bucket_path text NOT NULL,
  file_size integer NOT NULL,
  mime_type text NOT NULL,
  content_id text, -- For inline images (CID)
  is_inline boolean DEFAULT false,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_attachments_org ON email_attachments(org_id);
CREATE INDEX IF NOT EXISTS idx_email_attachments_campaign ON email_attachments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_attachments_sequence ON email_attachments(sequence_step_id);
CREATE INDEX IF NOT EXISTS idx_email_attachments_template ON email_attachments(template_id);

-- RLS for email_attachments
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "CRM members can view attachments" ON email_attachments;
CREATE POLICY "CRM members can view attachments"
  ON email_attachments FOR SELECT
  USING (is_crm_member(org_id));

DROP POLICY IF EXISTS "CRM agents can create attachments" ON email_attachments;
CREATE POLICY "CRM agents can create attachments"
  ON email_attachments FOR INSERT
  WITH CHECK (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

DROP POLICY IF EXISTS "CRM managers can delete attachments" ON email_attachments;
CREATE POLICY "CRM managers can delete attachments"
  ON email_attachments FOR DELETE
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']));

-- Add attachment_count to campaigns if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_campaigns' AND column_name = 'attachment_count'
  ) THEN
    ALTER TABLE email_campaigns ADD COLUMN attachment_count integer DEFAULT 0;
  END IF;
END $$;

-- ============================================================================
-- 3. EMAIL SIGNATURES (per-user)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default',
  content_html text NOT NULL,
  content_text text,
  logo_url text,
  photo_url text,
  social_links jsonb DEFAULT '{}', -- {linkedin, twitter, facebook, instagram}
  is_default boolean DEFAULT false,
  include_in_replies boolean DEFAULT true,
  include_in_new boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, name)
);

CREATE INDEX IF NOT EXISTS idx_email_signatures_org ON email_signatures(org_id);
CREATE INDEX IF NOT EXISTS idx_email_signatures_profile ON email_signatures(profile_id);

-- Ensure only one default signature per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_signatures_default
  ON email_signatures(profile_id)
  WHERE is_default = true;

-- RLS for email_signatures
ALTER TABLE email_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view org signatures" ON email_signatures;
CREATE POLICY "Users can view org signatures"
  ON email_signatures FOR SELECT
  USING (is_crm_member(org_id));

DROP POLICY IF EXISTS "Users can manage own signatures" ON email_signatures;
CREATE POLICY "Users can manage own signatures"
  ON email_signatures FOR INSERT
  WITH CHECK (profile_id = auth.uid() AND is_crm_member(org_id));

DROP POLICY IF EXISTS "Users can update own signatures" ON email_signatures;
CREATE POLICY "Users can update own signatures"
  ON email_signatures FOR UPDATE
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own signatures" ON email_signatures;
CREATE POLICY "Users can delete own signatures"
  ON email_signatures FOR DELETE
  USING (profile_id = auth.uid());

-- Link signatures to sender addresses
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

-- ============================================================================
-- 4. USER EMAIL SETTINGS (per-agent configuration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Default sender configuration
  default_sender_address_id uuid REFERENCES email_sender_addresses(id) ON DELETE SET NULL,
  default_signature_id uuid REFERENCES email_signatures(id) ON DELETE SET NULL,

  -- Sending preferences
  default_reply_to text,
  default_cc text[] DEFAULT '{}',
  default_bcc text[] DEFAULT '{}',

  -- Tracking preferences
  track_opens boolean DEFAULT true,
  track_clicks boolean DEFAULT true,

  -- Scheduling preferences
  preferred_send_time time,
  timezone text DEFAULT 'America/New_York',

  -- Limits
  daily_send_limit integer DEFAULT 500,
  emails_sent_today integer DEFAULT 0,
  last_send_date date,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(profile_id)
);

CREATE INDEX IF NOT EXISTS idx_user_email_settings_org ON user_email_settings(org_id);
CREATE INDEX IF NOT EXISTS idx_user_email_settings_profile ON user_email_settings(profile_id);

-- RLS for user_email_settings
ALTER TABLE user_email_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own email settings" ON user_email_settings;
CREATE POLICY "Users can view own email settings"
  ON user_email_settings FOR SELECT
  USING (profile_id = auth.uid() OR has_crm_role(org_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "Users can manage own email settings" ON user_email_settings;
CREATE POLICY "Users can manage own email settings"
  ON user_email_settings FOR INSERT
  WITH CHECK (profile_id = auth.uid() AND is_crm_member(org_id));

DROP POLICY IF EXISTS "Users can update own email settings" ON user_email_settings;
CREATE POLICY "Users can update own email settings"
  ON user_email_settings FOR UPDATE
  USING (profile_id = auth.uid() OR has_crm_role(org_id, ARRAY['crm_admin']));

-- ============================================================================
-- 5. USER DOMAIN ASSIGNMENTS (assign domains to specific users)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_domain_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  domain_id uuid NOT NULL REFERENCES email_domains(id) ON DELETE CASCADE,
  sender_addresses text[] DEFAULT '{}', -- Specific addresses allowed, empty = all
  is_primary boolean DEFAULT false,
  assigned_by uuid REFERENCES profiles(id),
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, domain_id)
);

CREATE INDEX IF NOT EXISTS idx_user_domain_assignments_org ON user_domain_assignments(org_id);
CREATE INDEX IF NOT EXISTS idx_user_domain_assignments_profile ON user_domain_assignments(profile_id);
CREATE INDEX IF NOT EXISTS idx_user_domain_assignments_domain ON user_domain_assignments(domain_id);

-- Ensure only one primary domain per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_domain_assignments_primary
  ON user_domain_assignments(profile_id)
  WHERE is_primary = true;

-- RLS for user_domain_assignments
ALTER TABLE user_domain_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view domain assignments" ON user_domain_assignments;
CREATE POLICY "Users can view domain assignments"
  ON user_domain_assignments FOR SELECT
  USING (profile_id = auth.uid() OR is_crm_member(org_id));

DROP POLICY IF EXISTS "Admins can manage domain assignments" ON user_domain_assignments;
CREATE POLICY "Admins can manage domain assignments"
  ON user_domain_assignments FOR ALL
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']));

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function to get user's available sender addresses
CREATE OR REPLACE FUNCTION get_user_sender_addresses(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  email text,
  name text,
  domain text,
  is_default boolean,
  is_verified boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sa.id,
    sa.email,
    sa.name,
    ed.domain,
    sa.is_default,
    sa.is_verified
  FROM email_sender_addresses sa
  JOIN email_domains ed ON sa.domain_id = ed.id
  LEFT JOIN user_domain_assignments uda ON uda.domain_id = ed.id AND uda.profile_id = p_user_id
  WHERE sa.org_id = (SELECT organization_id FROM profiles WHERE id = p_user_id)
    AND ed.status = 'verified'
    AND (
      -- User has specific domain assignment
      uda.id IS NOT NULL
      -- Or no assignments exist for this user (allow all org domains)
      OR NOT EXISTS (
        SELECT 1 FROM user_domain_assignments WHERE profile_id = p_user_id
      )
    )
  ORDER BY sa.is_default DESC, sa.email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset daily email counts (run via cron)
CREATE OR REPLACE FUNCTION reset_daily_email_counts()
RETURNS void AS $$
BEGIN
  UPDATE user_email_settings
  SET emails_sent_today = 0,
      last_send_date = CURRENT_DATE
  WHERE last_send_date < CURRENT_DATE OR last_send_date IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment user's daily send count
CREATE OR REPLACE FUNCTION increment_user_email_count(p_user_id uuid)
RETURNS boolean AS $$
DECLARE
  v_limit integer;
  v_count integer;
BEGIN
  -- Get or create settings
  INSERT INTO user_email_settings (org_id, profile_id)
  SELECT organization_id, id FROM profiles WHERE id = p_user_id
  ON CONFLICT (profile_id) DO NOTHING;

  -- Check limit
  SELECT daily_send_limit, emails_sent_today INTO v_limit, v_count
  FROM user_email_settings
  WHERE profile_id = p_user_id;

  IF v_count >= v_limit THEN
    RETURN false;
  END IF;

  -- Increment count
  UPDATE user_email_settings
  SET emails_sent_today = emails_sent_today + 1,
      last_send_date = CURRENT_DATE
  WHERE profile_id = p_user_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. TRIGGERS
-- ============================================================================

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_email_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS email_assets_updated_at ON email_assets;
CREATE TRIGGER email_assets_updated_at
  BEFORE UPDATE ON email_assets
  FOR EACH ROW EXECUTE FUNCTION update_email_updated_at();

DROP TRIGGER IF EXISTS email_signatures_updated_at ON email_signatures;
CREATE TRIGGER email_signatures_updated_at
  BEFORE UPDATE ON email_signatures
  FOR EACH ROW EXECUTE FUNCTION update_email_updated_at();

DROP TRIGGER IF EXISTS user_email_settings_updated_at ON user_email_settings;
CREATE TRIGGER user_email_settings_updated_at
  BEFORE UPDATE ON user_email_settings
  FOR EACH ROW EXECUTE FUNCTION update_email_updated_at();

-- Trigger to ensure only one default signature per user
CREATE OR REPLACE FUNCTION ensure_single_default_signature()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE email_signatures
    SET is_default = false
    WHERE profile_id = NEW.profile_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_single_default_signature_trigger ON email_signatures;
CREATE TRIGGER ensure_single_default_signature_trigger
  BEFORE INSERT OR UPDATE ON email_signatures
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_signature();

-- Trigger to ensure only one primary domain per user
CREATE OR REPLACE FUNCTION ensure_single_primary_domain()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE user_domain_assignments
    SET is_primary = false
    WHERE profile_id = NEW.profile_id
      AND id != NEW.id
      AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_single_primary_domain_trigger ON user_domain_assignments;
CREATE TRIGGER ensure_single_primary_domain_trigger
  BEFORE INSERT OR UPDATE ON user_domain_assignments
  FOR EACH ROW
  WHEN (NEW.is_primary = true)
  EXECUTE FUNCTION ensure_single_primary_domain();

-- ============================================================================
-- 8. STORAGE BUCKETS (via Supabase dashboard or CLI)
-- Note: These need to be created in Supabase Storage settings
-- ============================================================================
-- Bucket: email-assets
--   - Max file size: 5MB
--   - Allowed MIME types: image/jpeg, image/png, image/gif, image/webp, image/svg+xml
--   - Public: true (for email rendering)

-- Bucket: email-attachments
--   - Max file size: 10MB
--   - Allowed MIME types: application/pdf, image/*, application/msword,
--     application/vnd.openxmlformats-officedocument.*, text/*, application/zip
--   - Public: false (use signed URLs)

COMMENT ON TABLE email_assets IS 'Library of reusable images for email content';
COMMENT ON TABLE email_attachments IS 'File attachments for emails, campaigns, and templates';
COMMENT ON TABLE email_signatures IS 'Per-user email signatures with rich content';
COMMENT ON TABLE user_email_settings IS 'Per-user email sending preferences and limits';
COMMENT ON TABLE user_domain_assignments IS 'Assigns verified domains to specific users';

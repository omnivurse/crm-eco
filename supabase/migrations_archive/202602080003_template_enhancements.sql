-- ============================================================================
-- Template Enhancements for Phase 2
-- Adds category, thumbnail, system templates, and usage tracking
-- ============================================================================

-- Add new columns to crm_message_templates
ALTER TABLE crm_message_templates
ADD COLUMN IF NOT EXISTS category text,
ADD COLUMN IF NOT EXISTS thumbnail_url text,
ADD COLUMN IF NOT EXISTS is_system boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS usage_count int DEFAULT 0;

-- Add index for category filtering
CREATE INDEX IF NOT EXISTS idx_crm_message_templates_category
ON crm_message_templates(org_id, category);

-- Add index for system templates
CREATE INDEX IF NOT EXISTS idx_crm_message_templates_system
ON crm_message_templates(is_system) WHERE is_system = true;

COMMENT ON COLUMN crm_message_templates.category IS 'Template category: sales, marketing, support, follow-up, onboarding';
COMMENT ON COLUMN crm_message_templates.thumbnail_url IS 'Preview thumbnail for template gallery';
COMMENT ON COLUMN crm_message_templates.is_system IS 'System-provided templates cannot be deleted';
COMMENT ON COLUMN crm_message_templates.usage_count IS 'Number of times this template has been used';

-- ============================================================================
-- Email Domains for Custom Sending
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  domain text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'verifying', 'verified', 'failed')),
  dkim_selector text,
  dkim_public_key text,
  dkim_verified boolean DEFAULT false,
  spf_verified boolean DEFAULT false,
  dmarc_verified boolean DEFAULT false,
  mx_verified boolean DEFAULT false,
  verification_token text,
  last_verified_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_email_domains_org ON email_domains(org_id);
CREATE INDEX IF NOT EXISTS idx_email_domains_status ON email_domains(org_id, status);

COMMENT ON TABLE email_domains IS 'Custom email domains for organization email sending';

-- ============================================================================
-- Email Sender Addresses
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_sender_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  domain_id uuid REFERENCES email_domains(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  is_default boolean DEFAULT false,
  is_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(org_id, email)
);

CREATE INDEX IF NOT EXISTS idx_email_sender_addresses_org ON email_sender_addresses(org_id);
CREATE INDEX IF NOT EXISTS idx_email_sender_addresses_domain ON email_sender_addresses(domain_id);

COMMENT ON TABLE email_sender_addresses IS 'Sender email addresses for campaigns and communications';

-- ============================================================================
-- Row Level Security for new tables
-- ============================================================================

-- Enable RLS
ALTER TABLE email_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sender_addresses ENABLE ROW LEVEL SECURITY;

-- Policies for email_domains
CREATE POLICY "Users can view their org email domains"
ON email_domains FOR SELECT
USING (
  org_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage their org email domains"
ON email_domains FOR ALL
USING (
  org_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  )
);

-- Policies for email_sender_addresses
CREATE POLICY "Users can view their org sender addresses"
ON email_sender_addresses FOR SELECT
USING (
  org_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage their org sender addresses"
ON email_sender_addresses FOR ALL
USING (
  org_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  )
);

-- ============================================================================
-- Insert Default System Templates
-- ============================================================================

-- These will be populated by seed script or manually
-- Example structure:
-- INSERT INTO crm_message_templates (org_id, channel, name, subject, body, category, is_system)
-- VALUES
-- (NULL, 'email', 'Welcome Email', 'Welcome to {{company.name}}!',
--  '<p>Hi {{contact.first_name}},</p><p>Welcome aboard!</p>', 'onboarding', true);

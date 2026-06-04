-- ============================================================================
-- MODULE 9: Marketplace — Extensions Framework
-- Creates extension registry, installation tracking, and configuration system
-- Complements existing: integration_connections, integration_webhooks,
--   integration_logs, integration_sync_jobs
-- ============================================================================

-- ============================================================================
-- 1. CRM EXTENSIONS — Extension registry / catalog
-- Defines available extensions (first-party, third-party, custom)
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_extensions (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identity
  name            text         NOT NULL,
  key             text         NOT NULL UNIQUE,  -- Globally unique extension key (e.g. "dhh.email-sync")
  slug            text         NOT NULL UNIQUE,  -- URL-safe slug
  description     text,
  long_description text,       -- Markdown-formatted detailed description
  -- Provider / author
  provider        text         NOT NULL DEFAULT 'dhh',  -- Publisher ID
  provider_name   text         NOT NULL DEFAULT 'DHH',  -- Display name of publisher
  provider_url    text,        -- Publisher website
  -- Categorization
  category        text         NOT NULL DEFAULT 'utility' CHECK (category IN (
                    'communication', 'analytics', 'automation', 'data',
                    'finance', 'compliance', 'productivity', 'utility', 'custom'
                  )),
  tags            text[]       DEFAULT '{}',
  -- Versioning
  version         text         NOT NULL DEFAULT '1.0.0',
  min_app_version text,        -- Minimum CRM version required
  changelog       jsonb        DEFAULT '[]',  -- [{version, date, notes}]
  -- Visual
  icon            text         DEFAULT 'puzzle',
  icon_url        text,        -- URL to extension icon
  banner_url      text,        -- URL to banner image
  screenshots     text[]       DEFAULT '{}',  -- URLs to screenshots
  color           text         DEFAULT '#6366f1',
  -- Configuration schema (JSON Schema for install-time config)
  config_schema   jsonb        DEFAULT '{}',  -- JSON Schema for extension settings
  default_config  jsonb        DEFAULT '{}',  -- Default configuration values
  -- Permissions / scopes the extension requires
  required_scopes text[]       DEFAULT '{}',  -- e.g., ['records:read', 'records:write', 'webhooks:manage']
  -- Extension type and capabilities
  extension_type  text         NOT NULL DEFAULT 'plugin' CHECK (extension_type IN (
                    'plugin',       -- Standard feature extension
                    'integration',  -- Third-party service connector
                    'theme',        -- UI theme/branding
                    'widget',       -- Dashboard/sidebar widget
                    'automation',   -- Workflow automation extension
                    'report'        -- Custom report/analytics
                  )),
  -- Entry points
  entry_points    jsonb        DEFAULT '{}',  -- {settings_url, widget_url, webhook_path, api_prefix}
  -- Lifecycle hooks
  hooks           jsonb        DEFAULT '{}',  -- {on_install, on_uninstall, on_enable, on_disable, on_upgrade}
  -- Status
  status          text         NOT NULL DEFAULT 'published' CHECK (status IN (
                    'draft', 'review', 'published', 'deprecated', 'archived'
                  )),
  is_featured     boolean      NOT NULL DEFAULT false,
  is_verified     boolean      NOT NULL DEFAULT false,  -- Verified by DHH team
  is_free         boolean      NOT NULL DEFAULT true,
  -- Pricing (for paid extensions)
  price_monthly   numeric(10,2),
  price_yearly    numeric(10,2),
  trial_days      int          DEFAULT 0,
  -- Stats
  install_count   bigint       NOT NULL DEFAULT 0,
  rating_avg      numeric(3,2) DEFAULT 0,
  rating_count    int          NOT NULL DEFAULT 0,
  -- Metadata
  documentation_url text,
  support_url     text,
  source_url      text,        -- Open-source repo URL
  privacy_url     text,
  terms_url       text,
  metadata        jsonb        DEFAULT '{}',
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_extensions_key
  ON crm_extensions(key);
CREATE INDEX IF NOT EXISTS idx_crm_extensions_slug
  ON crm_extensions(slug);
CREATE INDEX IF NOT EXISTS idx_crm_extensions_category
  ON crm_extensions(category);
CREATE INDEX IF NOT EXISTS idx_crm_extensions_type
  ON crm_extensions(extension_type);
CREATE INDEX IF NOT EXISTS idx_crm_extensions_status
  ON crm_extensions(status) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_crm_extensions_featured
  ON crm_extensions(is_featured) WHERE is_featured = true AND status = 'published';
CREATE INDEX IF NOT EXISTS idx_crm_extensions_provider
  ON crm_extensions(provider);

COMMENT ON TABLE crm_extensions IS 'Extension catalog — defines available marketplace extensions with versioning, configuration schemas, and pricing';
COMMENT ON COLUMN crm_extensions.key IS 'Globally unique extension identifier (e.g., "dhh.email-sync")';
COMMENT ON COLUMN crm_extensions.config_schema IS 'JSON Schema defining the extension settings form';
COMMENT ON COLUMN crm_extensions.required_scopes IS 'Permissions the extension needs: records:read, records:write, webhooks:manage, etc.';
COMMENT ON COLUMN crm_extensions.entry_points IS 'Extension entry points: {settings_url, widget_url, webhook_path, api_prefix}';

-- ============================================================================
-- 2. CRM EXTENSION INSTALLS — Per-organization installations
-- Tracks which extensions are installed, their config, and status
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_extension_installs (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  extension_id    uuid         NOT NULL REFERENCES crm_extensions(id) ON DELETE CASCADE,
  -- Installed version
  installed_version text       NOT NULL,
  -- Organization-specific configuration
  config          jsonb        NOT NULL DEFAULT '{}',  -- Validated against extension config_schema
  -- Granted scopes (subset of required_scopes)
  granted_scopes  text[]       DEFAULT '{}',
  -- Status
  status          text         NOT NULL DEFAULT 'active' CHECK (status IN (
                    'active', 'disabled', 'suspended', 'pending_upgrade',
                    'trial', 'expired', 'error'
                  )),
  error_message   text,
  -- Licensing / billing
  license_key     text,
  trial_ends_at   timestamptz,
  subscription_id text,        -- External billing reference
  -- Usage tracking
  last_used_at    timestamptz,
  usage_count     bigint       NOT NULL DEFAULT 0,
  -- Audit
  installed_by    uuid         REFERENCES profiles(id) ON DELETE SET NULL,
  installed_at    timestamptz  NOT NULL DEFAULT now(),
  enabled_at      timestamptz,
  disabled_at     timestamptz,
  updated_at      timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT uq_extension_install
    UNIQUE (organization_id, extension_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_ext_installs_org
  ON crm_extension_installs(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_ext_installs_extension
  ON crm_extension_installs(extension_id);
CREATE INDEX IF NOT EXISTS idx_crm_ext_installs_status
  ON crm_extension_installs(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_ext_installs_active
  ON crm_extension_installs(organization_id)
  WHERE status IN ('active', 'trial');

COMMENT ON TABLE crm_extension_installs IS 'Per-organization extension installations with config, scopes, and status tracking';
COMMENT ON COLUMN crm_extension_installs.config IS 'Organization-specific configuration validated against extension config_schema';
COMMENT ON COLUMN crm_extension_installs.granted_scopes IS 'Scopes actually granted to this install (may be subset of required)';

-- ============================================================================
-- 3. CRM EXTENSION REVIEWS — User ratings and reviews
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_extension_reviews (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  extension_id    uuid         NOT NULL REFERENCES crm_extensions(id) ON DELETE CASCADE,
  organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reviewer_id     uuid         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating          int          NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title           text,
  body            text,
  is_verified     boolean      NOT NULL DEFAULT false,  -- Verified purchase
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT uq_extension_review
    UNIQUE (extension_id, organization_id)  -- One review per org per extension
);

CREATE INDEX IF NOT EXISTS idx_crm_ext_reviews_extension
  ON crm_extension_reviews(extension_id);
CREATE INDEX IF NOT EXISTS idx_crm_ext_reviews_rating
  ON crm_extension_reviews(extension_id, rating);

COMMENT ON TABLE crm_extension_reviews IS 'User ratings and reviews for marketplace extensions';

-- ============================================================================
-- 4. INSTALL / UNINSTALL HELPERS
-- ============================================================================

-- Install an extension for an organization
CREATE OR REPLACE FUNCTION fn_install_extension(
  p_org_id uuid,
  p_extension_id uuid,
  p_installed_by uuid,
  p_config jsonb DEFAULT '{}',
  p_granted_scopes text[] DEFAULT '{}'
)
RETURNS uuid AS $$
DECLARE
  v_ext RECORD;
  v_install_id uuid;
  v_existing uuid;
BEGIN
  -- Get extension
  SELECT * INTO v_ext FROM crm_extensions WHERE id = p_extension_id AND status = 'published';
  IF v_ext IS NULL THEN
    RAISE EXCEPTION 'Extension not found or not published';
  END IF;

  -- Check if already installed
  SELECT id INTO v_existing
  FROM crm_extension_installs
  WHERE organization_id = p_org_id AND extension_id = p_extension_id;

  IF v_existing IS NOT NULL THEN
    -- Re-enable if previously disabled
    UPDATE crm_extension_installs
    SET status = CASE WHEN v_ext.is_free THEN 'active'
                      WHEN v_ext.trial_days > 0 THEN 'trial'
                      ELSE 'active'
                 END,
        config = COALESCE(NULLIF(p_config::text, '{}')::jsonb, config),
        granted_scopes = CASE WHEN array_length(p_granted_scopes, 1) > 0
                              THEN p_granted_scopes
                              ELSE granted_scopes
                         END,
        enabled_at = now(),
        disabled_at = NULL,
        error_message = NULL,
        updated_at = now()
    WHERE id = v_existing;
    RETURN v_existing;
  END IF;

  -- Create new install
  INSERT INTO crm_extension_installs (
    organization_id, extension_id, installed_version, config,
    granted_scopes, status, installed_by, enabled_at,
    trial_ends_at
  ) VALUES (
    p_org_id, p_extension_id, v_ext.version,
    COALESCE(NULLIF(p_config::text, '{}')::jsonb, v_ext.default_config),
    CASE WHEN array_length(p_granted_scopes, 1) > 0
         THEN p_granted_scopes
         ELSE v_ext.required_scopes
    END,
    CASE WHEN v_ext.is_free THEN 'active'
         WHEN v_ext.trial_days > 0 THEN 'trial'
         ELSE 'active'
    END,
    p_installed_by,
    now(),
    CASE WHEN v_ext.trial_days > 0 AND NOT v_ext.is_free
         THEN now() + (v_ext.trial_days || ' days')::interval
         ELSE NULL
    END
  )
  RETURNING id INTO v_install_id;

  -- Increment install count
  UPDATE crm_extensions
  SET install_count = install_count + 1
  WHERE id = p_extension_id;

  RETURN v_install_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION fn_install_extension IS
  'Installs an extension for an organization with config and scopes. Re-enables if previously installed.';

-- Uninstall an extension
CREATE OR REPLACE FUNCTION fn_uninstall_extension(
  p_org_id uuid,
  p_extension_id uuid
)
RETURNS boolean AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM crm_extension_installs
  WHERE organization_id = p_org_id
    AND extension_id = p_extension_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted > 0 THEN
    UPDATE crm_extensions
    SET install_count = GREATEST(install_count - 1, 0)
    WHERE id = p_extension_id;
  END IF;

  RETURN v_deleted > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION fn_uninstall_extension IS
  'Uninstalls an extension and decrements the install count';

-- Update extension rating aggregates
CREATE OR REPLACE FUNCTION fn_update_extension_rating()
RETURNS trigger AS $$
BEGIN
  UPDATE crm_extensions
  SET rating_avg = (
        SELECT COALESCE(AVG(rating), 0)
        FROM crm_extension_reviews
        WHERE extension_id = COALESCE(NEW.extension_id, OLD.extension_id)
      ),
      rating_count = (
        SELECT COUNT(*)
        FROM crm_extension_reviews
        WHERE extension_id = COALESCE(NEW.extension_id, OLD.extension_id)
      )
  WHERE id = COALESCE(NEW.extension_id, OLD.extension_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_update_extension_rating
  AFTER INSERT OR UPDATE OR DELETE ON crm_extension_reviews
  FOR EACH ROW EXECUTE FUNCTION fn_update_extension_rating();

-- ============================================================================
-- 5. SEED FIRST-PARTY EXTENSIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION seed_default_extensions()
RETURNS void AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM crm_extensions WHERE provider = 'dhh') THEN
    RETURN;
  END IF;

  INSERT INTO crm_extensions (
    name, key, slug, description, provider, provider_name,
    category, extension_type, icon, color, version,
    is_featured, is_verified, is_free, required_scopes, status
  ) VALUES
    ('Email Sync',         'dhh.email-sync',         'email-sync',
     'Two-way email synchronization with Gmail and Outlook',
     'dhh', 'DHH', 'communication', 'integration', 'mail', '#3b82f6', '1.0.0',
     true, true, true, ARRAY['records:read', 'email:send', 'email:read'], 'published'),

    ('Advanced Analytics',  'dhh.advanced-analytics',  'advanced-analytics',
     'Custom dashboards, cohort analysis, and predictive scoring',
     'dhh', 'DHH', 'analytics', 'report', 'bar-chart-3', '#8b5cf6', '1.0.0',
     true, true, true, ARRAY['records:read', 'analytics:read'], 'published'),

    ('Bulk SMS',           'dhh.bulk-sms',            'bulk-sms',
     'Send bulk SMS campaigns to contacts and advisors',
     'dhh', 'DHH', 'communication', 'plugin', 'message-square', '#22c55e', '1.0.0',
     false, true, true, ARRAY['records:read', 'sms:send'], 'published'),

    ('Document Signing',   'dhh.document-signing',    'document-signing',
     'DocuSign and HelloSign integration for e-signatures',
     'dhh', 'DHH', 'productivity', 'integration', 'file-signature', '#f59e0b', '1.0.0',
     true, true, true, ARRAY['records:read', 'documents:manage'], 'published'),

    ('Compliance Monitor', 'dhh.compliance-monitor',  'compliance-monitor',
     'Automated compliance checks, license tracking, and audit preparation',
     'dhh', 'DHH', 'compliance', 'automation', 'shield-check', '#ef4444', '1.0.0',
     true, true, true, ARRAY['records:read', 'compliance:manage'], 'published'),

    ('Stripe Payments',    'dhh.stripe-payments',     'stripe-payments',
     'Process payments, manage subscriptions, and sync invoices via Stripe',
     'dhh', 'DHH', 'finance', 'integration', 'credit-card', '#6366f1', '1.0.0',
     true, true, true, ARRAY['payments:manage', 'records:read'], 'published'),

    ('Zoom Meetings',      'dhh.zoom-meetings',       'zoom-meetings',
     'Schedule and track Zoom meetings linked to CRM records',
     'dhh', 'DHH', 'productivity', 'integration', 'video', '#2563eb', '1.0.0',
     false, true, true, ARRAY['calendar:manage', 'records:read'], 'published'),

    ('Slack Notifications','dhh.slack-notifications',  'slack-notifications',
     'Push CRM notifications and alerts to Slack channels',
     'dhh', 'DHH', 'communication', 'plugin', 'hash', '#e11d48', '1.0.0',
     false, true, true, ARRAY['notifications:send'], 'published');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Run seed
SELECT seed_default_extensions();

-- ============================================================================
-- 6. AUDIT TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_audit_marketplace_changes()
RETURNS trigger AS $$
BEGIN
  INSERT INTO unified_audit_logs (
    organization_id, app_source, actor_id,
    action, action_category, risk_level, details, changes
  ) VALUES (
    CASE
      WHEN TG_TABLE_NAME = 'crm_extension_installs'
        THEN COALESCE(NEW.organization_id, OLD.organization_id)
      WHEN TG_TABLE_NAME = 'crm_extension_reviews'
        THEN COALESCE(NEW.organization_id, OLD.organization_id)
      ELSE NULL
    END,
    'crm',
    COALESCE(
      (SELECT id FROM profiles WHERE user_id = (SELECT auth.uid()) LIMIT 1),
      NULL
    ),
    TG_TABLE_NAME || '.' || lower(TG_OP),
    'marketplace',
    CASE
      WHEN TG_TABLE_NAME = 'crm_extension_installs' AND TG_OP = 'DELETE' THEN 'high'
      WHEN TG_TABLE_NAME = 'crm_extension_installs' THEN 'medium'
      ELSE 'low'
    END,
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'extension_id', CASE
        WHEN TG_TABLE_NAME IN ('crm_extension_installs', 'crm_extension_reviews')
          THEN COALESCE(NEW.extension_id, OLD.extension_id)
        ELSE COALESCE(NEW.id, OLD.id)
      END
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

CREATE TRIGGER trg_audit_crm_extension_installs
  AFTER INSERT OR UPDATE OR DELETE ON crm_extension_installs
  FOR EACH ROW EXECUTE FUNCTION fn_audit_marketplace_changes();

CREATE TRIGGER trg_audit_crm_extension_reviews
  AFTER INSERT OR UPDATE OR DELETE ON crm_extension_reviews
  FOR EACH ROW EXECUTE FUNCTION fn_audit_marketplace_changes();

-- ============================================================================
-- 7. UPDATED_AT TRIGGERS
-- ============================================================================
CREATE TRIGGER update_crm_extensions_updated_at
  BEFORE UPDATE ON crm_extensions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_extension_installs_updated_at
  BEFORE UPDATE ON crm_extension_installs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_extension_reviews_updated_at
  BEFORE UPDATE ON crm_extension_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================================

-- ── crm_extensions (catalog — read by anyone, write by service_role) ────
ALTER TABLE crm_extensions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "extensions_select" ON crm_extensions;
CREATE POLICY "extensions_select" ON crm_extensions
  FOR SELECT TO authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS "extensions_service" ON crm_extensions;
CREATE POLICY "extensions_service" ON crm_extensions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── crm_extension_installs ──────────────────────────────────────────
ALTER TABLE crm_extension_installs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ext_installs_select" ON crm_extension_installs;
CREATE POLICY "ext_installs_select" ON crm_extension_installs
  FOR SELECT TO authenticated
  USING (is_crm_member(organization_id));

DROP POLICY IF EXISTS "ext_installs_insert" ON crm_extension_installs;
CREATE POLICY "ext_installs_insert" ON crm_extension_installs
  FOR INSERT TO authenticated
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "ext_installs_update" ON crm_extension_installs;
CREATE POLICY "ext_installs_update" ON crm_extension_installs
  FOR UPDATE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "ext_installs_delete" ON crm_extension_installs;
CREATE POLICY "ext_installs_delete" ON crm_extension_installs
  FOR DELETE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "ext_installs_service" ON crm_extension_installs;
CREATE POLICY "ext_installs_service" ON crm_extension_installs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── crm_extension_reviews ───────────────────────────────────────────
ALTER TABLE crm_extension_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ext_reviews_select" ON crm_extension_reviews;
CREATE POLICY "ext_reviews_select" ON crm_extension_reviews
  FOR SELECT TO authenticated
  USING (true);  -- Reviews are public

DROP POLICY IF EXISTS "ext_reviews_insert" ON crm_extension_reviews;
CREATE POLICY "ext_reviews_insert" ON crm_extension_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    reviewer_id = (SELECT id FROM profiles WHERE user_id = (SELECT auth.uid()) LIMIT 1)
  );

DROP POLICY IF EXISTS "ext_reviews_update" ON crm_extension_reviews;
CREATE POLICY "ext_reviews_update" ON crm_extension_reviews
  FOR UPDATE TO authenticated
  USING (
    reviewer_id = (SELECT id FROM profiles WHERE user_id = (SELECT auth.uid()) LIMIT 1)
  );

DROP POLICY IF EXISTS "ext_reviews_delete" ON crm_extension_reviews;
CREATE POLICY "ext_reviews_delete" ON crm_extension_reviews
  FOR DELETE TO authenticated
  USING (
    reviewer_id = (SELECT id FROM profiles WHERE user_id = (SELECT auth.uid()) LIMIT 1)
  );

DROP POLICY IF EXISTS "ext_reviews_service" ON crm_extension_reviews;
CREATE POLICY "ext_reviews_service" ON crm_extension_reviews
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- END MODULE 9
-- ============================================================================

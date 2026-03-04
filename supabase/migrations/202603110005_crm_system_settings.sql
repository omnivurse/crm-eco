-- ============================================================================
-- MODULE 1: Core Configuration Engine — crm_system_settings
-- Centralized key-value configuration store for all CRM modules
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_system_settings (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid       NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category       text         NOT NULL CHECK (category IN (
                     'general','security','channels','customization',
                     'automation','process','data_admin','experience','developer'
                   )),
  setting_key    text         NOT NULL,
  setting_value  jsonb        NOT NULL DEFAULT '{}',
  description    text,
  is_sensitive   boolean      NOT NULL DEFAULT false,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now(),
  updated_by     uuid         REFERENCES profiles(id),

  CONSTRAINT uq_system_settings_org_cat_key
    UNIQUE (organization_id, category, setting_key)
);

COMMENT ON TABLE  crm_system_settings IS 'Centralized key-value configuration for all CRM modules';
COMMENT ON COLUMN crm_system_settings.category IS 'Module category this setting belongs to';
COMMENT ON COLUMN crm_system_settings.setting_key IS 'Unique key within category (e.g. session_timeout_minutes)';
COMMENT ON COLUMN crm_system_settings.setting_value IS 'JSONB value — supports scalars, arrays, and objects';
COMMENT ON COLUMN crm_system_settings.is_sensitive IS 'If true, value is redacted in non-admin reads';

-- ----------------------------------------------------------------------------
-- 2. Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_system_settings_org_cat
  ON crm_system_settings (organization_id, category);

CREATE INDEX IF NOT EXISTS idx_system_settings_org_key
  ON crm_system_settings (organization_id, setting_key);

-- ----------------------------------------------------------------------------
-- 3. Auto-update trigger (reuse existing function)
-- ----------------------------------------------------------------------------
CREATE TRIGGER update_crm_system_settings_updated_at
  BEFORE UPDATE ON crm_system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 4. Audit trigger — logs every change to unified_audit_logs
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_system_settings()
RETURNS trigger AS $$
BEGIN
  INSERT INTO unified_audit_logs (
    organization_id, app_source, actor_id,
    action, action_category, risk_level, details, changes
  ) VALUES (
    COALESCE(NEW.organization_id, OLD.organization_id),
    'crm',
    COALESCE(NEW.updated_by, OLD.updated_by),
    CASE TG_OP
      WHEN 'INSERT' THEN 'setting_created'
      WHEN 'UPDATE' THEN 'setting_updated'
      WHEN 'DELETE' THEN 'setting_deleted'
    END,
    'configuration',
    CASE WHEN COALESCE(NEW.is_sensitive, OLD.is_sensitive) THEN 'high' ELSE 'medium' END,
    jsonb_build_object(
      'category', COALESCE(NEW.category, OLD.category),
      'setting_key', COALESCE(NEW.setting_key, OLD.setting_key)
    ),
    CASE TG_OP
      WHEN 'INSERT' THEN jsonb_build_object('new', NEW.setting_value)
      WHEN 'UPDATE' THEN jsonb_build_object('old', OLD.setting_value, 'new', NEW.setting_value)
      WHEN 'DELETE' THEN jsonb_build_object('old', OLD.setting_value)
    END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_audit_system_settings
  AFTER INSERT OR UPDATE OR DELETE ON crm_system_settings
  FOR EACH ROW EXECUTE FUNCTION fn_audit_system_settings();

-- ----------------------------------------------------------------------------
-- 5. RLS policies
-- ----------------------------------------------------------------------------
ALTER TABLE crm_system_settings ENABLE ROW LEVEL SECURITY;

-- All org members can read settings
DROP POLICY IF EXISTS "settings_select_org_member" ON crm_system_settings;
CREATE POLICY "settings_select_org_member" ON crm_system_settings
  FOR SELECT TO authenticated
  USING (is_crm_member(organization_id));

-- Only admins can insert
DROP POLICY IF EXISTS "settings_insert_admin" ON crm_system_settings;
CREATE POLICY "settings_insert_admin" ON crm_system_settings
  FOR INSERT TO authenticated
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin']));

-- Only admins can update
DROP POLICY IF EXISTS "settings_update_admin" ON crm_system_settings;
CREATE POLICY "settings_update_admin" ON crm_system_settings
  FOR UPDATE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']))
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin']));

-- Only admins can delete
DROP POLICY IF EXISTS "settings_delete_admin" ON crm_system_settings;
CREATE POLICY "settings_delete_admin" ON crm_system_settings
  FOR DELETE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']));

-- Service role bypass
DROP POLICY IF EXISTS "settings_service" ON crm_system_settings;
CREATE POLICY "settings_service" ON crm_system_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- END MODULE 1
-- ============================================================================

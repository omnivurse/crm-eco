-- ============================================================================
-- MODULE 4: CRM Customization Engine
-- Adds crm_field_options (normalized picklist management), json field type,
-- and audit trail for field/module config changes.
-- Existing tables: crm_modules, crm_fields, crm_layouts, crm_validation_rules
-- ============================================================================

-- ============================================================================
-- 1. ADD json FIELD TYPE to crm_fields
-- ============================================================================
ALTER TABLE crm_fields DROP CONSTRAINT IF EXISTS crm_fields_type_check;
ALTER TABLE crm_fields ADD CONSTRAINT crm_fields_type_check CHECK (type IN (
  'text', 'textarea', 'number', 'date', 'datetime',
  'select', 'multiselect', 'boolean', 'email', 'phone',
  'url', 'currency', 'lookup', 'user', 'json'
));

-- ============================================================================
-- 2. CRM FIELD OPTIONS — Normalized picklist/select options
-- Enables reusable option sets, colored tags, and dependency chains
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_field_options (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  field_id        uuid         NOT NULL REFERENCES crm_fields(id) ON DELETE CASCADE,
  value           text         NOT NULL,   -- stored value
  label           text         NOT NULL,   -- display label
  color           text,                     -- hex color for UI tags (e.g. #22c55e)
  icon            text,                     -- optional icon key
  is_default      boolean      NOT NULL DEFAULT false,
  is_active       boolean      NOT NULL DEFAULT true,
  display_order   integer      NOT NULL DEFAULT 0,
  metadata        jsonb        DEFAULT '{}',
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT uq_field_options_field_value
    UNIQUE (field_id, value)
);

CREATE INDEX IF NOT EXISTS idx_crm_field_options_field
  ON crm_field_options(field_id);
CREATE INDEX IF NOT EXISTS idx_crm_field_options_org
  ON crm_field_options(org_id);
CREATE INDEX IF NOT EXISTS idx_crm_field_options_active
  ON crm_field_options(field_id, is_active, display_order)
  WHERE is_active = true;

COMMENT ON TABLE crm_field_options IS 'Normalized picklist options for select/multiselect fields — supports colors, icons, ordering';
COMMENT ON COLUMN crm_field_options.value IS 'Stored value (written to crm_records.data)';
COMMENT ON COLUMN crm_field_options.label IS 'Display label shown in UI';
COMMENT ON COLUMN crm_field_options.color IS 'Hex color for tag/badge rendering';

-- ============================================================================
-- 3. AUTO-UPDATE TRIGGER
-- ============================================================================
CREATE TRIGGER update_crm_field_options_updated_at
  BEFORE UPDATE ON crm_field_options
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. AUDIT TRIGGER — log field option changes
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_audit_field_options()
RETURNS trigger AS $$
BEGIN
  INSERT INTO unified_audit_logs (
    organization_id, app_source, actor_id,
    action, action_category, risk_level, details, changes
  ) VALUES (
    COALESCE(NEW.org_id, OLD.org_id),
    'crm',
    (SELECT id FROM profiles WHERE user_id = (SELECT auth.uid()) LIMIT 1),
    'field_option.' || lower(TG_OP),
    'configuration',
    'low',
    jsonb_build_object(
      'field_id', COALESCE(NEW.field_id, OLD.field_id),
      'value', COALESCE(NEW.value, OLD.value),
      'label', COALESCE(NEW.label, OLD.label)
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

CREATE TRIGGER trg_audit_field_options
  AFTER INSERT OR UPDATE OR DELETE ON crm_field_options
  FOR EACH ROW EXECUTE FUNCTION fn_audit_field_options();

-- ============================================================================
-- 5. AUDIT TRIGGERS for crm_modules and crm_fields changes
-- (config-level audit — not record-level which already exists)
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_audit_customization_changes()
RETURNS trigger AS $$
BEGIN
  INSERT INTO unified_audit_logs (
    organization_id, app_source, actor_id,
    action, action_category, risk_level, details, changes
  ) VALUES (
    COALESCE(NEW.org_id, OLD.org_id),
    'crm',
    (SELECT id FROM profiles WHERE user_id = (SELECT auth.uid()) LIMIT 1),
    TG_TABLE_NAME || '.' || lower(TG_OP),
    'configuration',
    'medium',
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'key', COALESCE(NEW.key, OLD.key),
      'name', CASE WHEN TG_TABLE_NAME = 'crm_modules'
        THEN COALESCE(NEW.name, OLD.name)
        ELSE COALESCE(NEW.label, OLD.label)
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

-- Only create if not already exists (check by trigger name)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_crm_modules') THEN
    CREATE TRIGGER trg_audit_crm_modules
      AFTER INSERT OR UPDATE OR DELETE ON crm_modules
      FOR EACH ROW EXECUTE FUNCTION fn_audit_customization_changes();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_crm_fields') THEN
    CREATE TRIGGER trg_audit_crm_fields
      AFTER INSERT OR UPDATE OR DELETE ON crm_fields
      FOR EACH ROW EXECUTE FUNCTION fn_audit_customization_changes();
  END IF;
END $$;

-- ============================================================================
-- 6. ROW LEVEL SECURITY — crm_field_options
-- ============================================================================
ALTER TABLE crm_field_options ENABLE ROW LEVEL SECURITY;

-- All org members can read field options
DROP POLICY IF EXISTS "field_options_select" ON crm_field_options;
CREATE POLICY "field_options_select" ON crm_field_options
  FOR SELECT TO authenticated
  USING (is_crm_member(org_id));

-- Only admins can manage field options
DROP POLICY IF EXISTS "field_options_admin_insert" ON crm_field_options;
CREATE POLICY "field_options_admin_insert" ON crm_field_options
  FOR INSERT TO authenticated
  WITH CHECK (has_crm_role(org_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "field_options_admin_update" ON crm_field_options;
CREATE POLICY "field_options_admin_update" ON crm_field_options
  FOR UPDATE TO authenticated
  USING (has_crm_role(org_id, ARRAY['crm_admin']))
  WITH CHECK (has_crm_role(org_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "field_options_admin_delete" ON crm_field_options;
CREATE POLICY "field_options_admin_delete" ON crm_field_options
  FOR DELETE TO authenticated
  USING (has_crm_role(org_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "field_options_service" ON crm_field_options;
CREATE POLICY "field_options_service" ON crm_field_options
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 7. HELPER: Get active options for a field (ordered)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_field_options(p_field_id uuid)
RETURNS TABLE(value text, label text, color text, icon text) AS $$
  SELECT fo.value, fo.label, fo.color, fo.icon
  FROM crm_field_options fo
  WHERE fo.field_id = p_field_id
    AND fo.is_active = true
  ORDER BY fo.display_order, fo.label;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION get_field_options IS 'Returns active options for a select/multiselect field, ordered by display_order';

-- ============================================================================
-- END MODULE 4
-- ============================================================================

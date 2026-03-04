-- ============================================================================
-- MODULE: Contact Grouping System
-- Allows contacts to be sorted into multiple groups for segmentation
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Table — crm_contact_groups
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_contact_groups (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  group_name       text         NOT NULL,
  group_type       text         NOT NULL DEFAULT 'custom',
  description      text,
  color            text         NOT NULL DEFAULT '#6366f1',
  icon             text         NOT NULL DEFAULT 'Users',
  is_system        boolean      NOT NULL DEFAULT false,
  is_active        boolean      NOT NULL DEFAULT true,
  display_order    int          NOT NULL DEFAULT 0,
  created_by       uuid         REFERENCES profiles(id),
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT uq_contact_groups_org_name
    UNIQUE (organization_id, group_name)
);

COMMENT ON TABLE  crm_contact_groups IS 'Named groups for categorizing contacts (e.g. Active Members, Leads, Medicaid)';
COMMENT ON COLUMN crm_contact_groups.group_type IS 'Classification: status | product | source | custom';
COMMENT ON COLUMN crm_contact_groups.is_system IS 'System groups cannot be deleted by users';

-- ----------------------------------------------------------------------------
-- 2. Table — crm_contact_group_members
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_contact_group_members (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id         uuid         NOT NULL REFERENCES crm_contact_groups(id) ON DELETE CASCADE,
  record_id        uuid         NOT NULL REFERENCES crm_records(id) ON DELETE CASCADE,
  organization_id  uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  added_by         uuid         REFERENCES profiles(id),
  added_at         timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT uq_group_member
    UNIQUE (group_id, record_id)
);

COMMENT ON TABLE  crm_contact_group_members IS 'Many-to-many link: contacts belong to multiple groups';

-- ----------------------------------------------------------------------------
-- 3. Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_contact_groups_org
  ON crm_contact_groups (organization_id);

CREATE INDEX IF NOT EXISTS idx_contact_groups_type
  ON crm_contact_groups (organization_id, group_type);

CREATE INDEX IF NOT EXISTS idx_group_members_group
  ON crm_contact_group_members (group_id);

CREATE INDEX IF NOT EXISTS idx_group_members_record
  ON crm_contact_group_members (record_id);

CREATE INDEX IF NOT EXISTS idx_group_members_org
  ON crm_contact_group_members (organization_id);

-- ----------------------------------------------------------------------------
-- 4. Auto-update triggers
-- ----------------------------------------------------------------------------
CREATE TRIGGER update_crm_contact_groups_updated_at
  BEFORE UPDATE ON crm_contact_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 5. Audit trigger — crm_contact_groups
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_contact_groups()
RETURNS trigger AS $$
BEGIN
  INSERT INTO unified_audit_logs (
    organization_id, app_source, actor_id,
    action, action_category, risk_level, details, changes
  ) VALUES (
    COALESCE(NEW.organization_id, OLD.organization_id),
    'crm',
    COALESCE(NEW.created_by, OLD.created_by),
    CASE TG_OP
      WHEN 'INSERT' THEN 'contact_group_created'
      WHEN 'UPDATE' THEN 'contact_group_updated'
      WHEN 'DELETE' THEN 'contact_group_deleted'
    END,
    'contact_management',
    'low',
    jsonb_build_object(
      'group_name', COALESCE(NEW.group_name, OLD.group_name),
      'group_type', COALESCE(NEW.group_type, OLD.group_type)
    ),
    CASE TG_OP
      WHEN 'INSERT' THEN jsonb_build_object('new', row_to_json(NEW))
      WHEN 'UPDATE' THEN jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW))
      WHEN 'DELETE' THEN jsonb_build_object('old', row_to_json(OLD))
    END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_audit_contact_groups
  AFTER INSERT OR UPDATE OR DELETE ON crm_contact_groups
  FOR EACH ROW EXECUTE FUNCTION fn_audit_contact_groups();

-- Audit for membership changes
CREATE OR REPLACE FUNCTION fn_audit_group_members()
RETURNS trigger AS $$
BEGIN
  INSERT INTO unified_audit_logs (
    organization_id, app_source, actor_id,
    action, action_category, risk_level, details
  ) VALUES (
    COALESCE(NEW.organization_id, OLD.organization_id),
    'crm',
    COALESCE(NEW.added_by, OLD.added_by),
    CASE TG_OP
      WHEN 'INSERT' THEN 'group_member_added'
      WHEN 'DELETE' THEN 'group_member_removed'
    END,
    'contact_management',
    'low',
    jsonb_build_object(
      'group_id', COALESCE(NEW.group_id, OLD.group_id),
      'record_id', COALESCE(NEW.record_id, OLD.record_id)
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_audit_group_members
  AFTER INSERT OR DELETE ON crm_contact_group_members
  FOR EACH ROW EXECUTE FUNCTION fn_audit_group_members();

-- ----------------------------------------------------------------------------
-- 6. RLS — crm_contact_groups
-- ----------------------------------------------------------------------------
ALTER TABLE crm_contact_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact_groups_select_member" ON crm_contact_groups;
CREATE POLICY "contact_groups_select_member" ON crm_contact_groups
  FOR SELECT TO authenticated
  USING (is_crm_member(organization_id));

DROP POLICY IF EXISTS "contact_groups_insert_manager" ON crm_contact_groups;
CREATE POLICY "contact_groups_insert_manager" ON crm_contact_groups
  FOR INSERT TO authenticated
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "contact_groups_update_manager" ON crm_contact_groups;
CREATE POLICY "contact_groups_update_manager" ON crm_contact_groups
  FOR UPDATE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']))
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "contact_groups_delete_admin" ON crm_contact_groups;
CREATE POLICY "contact_groups_delete_admin" ON crm_contact_groups
  FOR DELETE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']) AND is_system = false);

DROP POLICY IF EXISTS "contact_groups_service" ON crm_contact_groups;
CREATE POLICY "contact_groups_service" ON crm_contact_groups
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 7. RLS — crm_contact_group_members
-- ----------------------------------------------------------------------------
ALTER TABLE crm_contact_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_members_select_member" ON crm_contact_group_members;
CREATE POLICY "group_members_select_member" ON crm_contact_group_members
  FOR SELECT TO authenticated
  USING (is_crm_member(organization_id));

DROP POLICY IF EXISTS "group_members_insert_agent" ON crm_contact_group_members;
CREATE POLICY "group_members_insert_agent" ON crm_contact_group_members
  FOR INSERT TO authenticated
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

DROP POLICY IF EXISTS "group_members_delete_agent" ON crm_contact_group_members;
CREATE POLICY "group_members_delete_agent" ON crm_contact_group_members
  FOR DELETE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

DROP POLICY IF EXISTS "group_members_service" ON crm_contact_group_members;
CREATE POLICY "group_members_service" ON crm_contact_group_members
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 8. Summary view — group_contact_counts
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW group_contact_counts AS
SELECT
  g.id                AS group_id,
  g.organization_id,
  g.group_name,
  g.group_type,
  g.color,
  g.icon,
  g.is_system,
  g.is_active,
  g.display_order,
  COUNT(gm.id)        AS member_count
FROM crm_contact_groups g
LEFT JOIN crm_contact_group_members gm ON gm.group_id = g.id
GROUP BY g.id, g.organization_id, g.group_name, g.group_type, g.color, g.icon,
         g.is_system, g.is_active, g.display_order;

COMMENT ON VIEW group_contact_counts IS 'Contact groups with member counts for list views';

-- ============================================================================
-- END MODULE: Contact Grouping System
-- ============================================================================

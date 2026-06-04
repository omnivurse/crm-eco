-- ============================================================================
-- FIX: Ensure contact groups tables + view exist in production
-- This is a reconciliation migration — all statements are idempotent
-- ============================================================================

-- 1. Tables
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
  created_by       uuid,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_contact_group_members (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id         uuid         NOT NULL REFERENCES crm_contact_groups(id) ON DELETE CASCADE,
  record_id        uuid         NOT NULL REFERENCES crm_records(id) ON DELETE CASCADE,
  organization_id  uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  added_by         uuid,
  added_at         timestamptz  NOT NULL DEFAULT now()
);

-- 2. Indexes
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

-- 3. Unique constraint (idempotent)
DO $$ BEGIN
  ALTER TABLE crm_contact_groups
    ADD CONSTRAINT uq_contact_groups_org_name UNIQUE (organization_id, group_name);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE crm_contact_group_members
    ADD CONSTRAINT uq_group_member UNIQUE (group_id, record_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. RLS
ALTER TABLE crm_contact_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contact_group_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "groups_select" ON crm_contact_groups
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "groups_insert" ON crm_contact_groups
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "groups_update" ON crm_contact_groups
    FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "groups_delete" ON crm_contact_groups
    FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "group_members_select" ON crm_contact_group_members
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "group_members_insert" ON crm_contact_group_members
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "group_members_update" ON crm_contact_group_members
    FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "group_members_delete" ON crm_contact_group_members
    FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. The critical view that the API depends on
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

NOTIFY pgrst, 'reload schema';

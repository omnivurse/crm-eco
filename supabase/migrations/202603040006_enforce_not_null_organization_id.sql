-- ============================================================================
-- Enforce NOT NULL on organization_id for core multi-tenant tables
-- These tables were created with nullable organization_id, which allows
-- records to bypass all org-scoped RLS policies.
-- ============================================================================

-- Step 1: Delete orphaned rows with NULL organization_id (cannot be assigned)
DELETE FROM activities WHERE organization_id IS NULL;
DELETE FROM custom_field_definitions WHERE organization_id IS NULL;
DELETE FROM need_events WHERE organization_id IS NULL;

-- For advisors/members/leads/needs, delete only if no child references remain
DELETE FROM needs WHERE organization_id IS NULL;
DELETE FROM leads WHERE organization_id IS NULL;
DELETE FROM members WHERE organization_id IS NULL;
DELETE FROM advisors WHERE organization_id IS NULL;

-- Step 2: Add NOT NULL constraints to core business tables
ALTER TABLE advisors ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE members ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE leads ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE needs ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE activities ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE custom_field_definitions ALTER COLUMN organization_id SET NOT NULL;

-- Step 3: need_events — backfill from parent needs table, then enforce NOT NULL
UPDATE need_events ne
SET organization_id = n.organization_id
FROM needs n
WHERE ne.need_id = n.id
  AND ne.organization_id IS NULL;

-- Delete any need_events that still have NULL (orphaned from deleted needs)
DELETE FROM need_events WHERE organization_id IS NULL;

ALTER TABLE need_events ALTER COLUMN organization_id SET NOT NULL;

-- Note: profiles.organization_id is intentionally kept nullable because
-- super_admin users may not belong to a specific organization.

-- Recover crm_segmentations + crm_segment_members on production.
--
-- Diagnosis: /api/crm/segmentations was returning HTTP 500 with PostgREST
-- error PGRST205 ("Could not find the table 'public.crm_segmentations' in
-- the schema cache"). Migration 202603110012_crm_experience_center is
-- recorded as applied in supabase_migrations.schema_migrations, but the
-- two segmentation tables it defines do not exist on the remote — the
-- migration row was likely repaired (`supabase migration repair`) without
-- the SQL ever running, or applied inside a transaction that errored out.
--
-- This migration recreates only the two tables, their indexes, and their
-- RLS policies — the minimum needed to unblock the segmentations API.
-- (crm_signals / crm_signal_events / RPCs from 202603110012 are left for
-- a follow-up if monitoring shows they are also missing.)
--
-- Every statement is idempotent (`CREATE TABLE IF NOT EXISTS`,
-- `DROP POLICY IF EXISTS / CREATE POLICY`) so this is safe to re-run.

-- ============================================================================
-- crm_segmentations
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_segmentations (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id       uuid         REFERENCES crm_modules(id) ON DELETE SET NULL,
  name            text         NOT NULL,
  key             text         NOT NULL,
  description     text,
  segment_type    text         NOT NULL DEFAULT 'dynamic' CHECK (segment_type IN (
                    'dynamic', 'static', 'smart'
                  )),
  icon            text         DEFAULT 'users',
  color           text         DEFAULT '#6366f1',
  criteria        jsonb        NOT NULL DEFAULT '{}',
  required_signals text[]      DEFAULT '{}',
  excluded_signals text[]      DEFAULT '{}',
  min_score       int,
  max_score       int,
  score_field     text         DEFAULT 'score',
  member_count    int          NOT NULL DEFAULT 0,
  last_computed_at timestamptz,
  compute_interval_hours int   DEFAULT 24,
  is_active       boolean      NOT NULL DEFAULT true,
  is_system       boolean      NOT NULL DEFAULT false,
  tags            text[]       DEFAULT '{}',
  config          jsonb        DEFAULT '{}',
  created_by      uuid         REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT uq_segment_org_key UNIQUE (organization_id, key)
);

CREATE INDEX IF NOT EXISTS idx_crm_segmentations_org
  ON crm_segmentations(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_segmentations_module
  ON crm_segmentations(organization_id, module_id) WHERE module_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_segmentations_type
  ON crm_segmentations(organization_id, segment_type);
CREATE INDEX IF NOT EXISTS idx_crm_segmentations_active
  ON crm_segmentations(organization_id, is_active) WHERE is_active = true;

-- ============================================================================
-- crm_segment_members
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_segment_members (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id      uuid         NOT NULL REFERENCES crm_segmentations(id) ON DELETE CASCADE,
  record_id       uuid         NOT NULL REFERENCES crm_records(id) ON DELETE CASCADE,
  organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  added_by        text         NOT NULL DEFAULT 'system' CHECK (added_by IN ('system', 'manual', 'import')),
  added_at        timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT uq_segment_member UNIQUE (segment_id, record_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_segment_members_segment
  ON crm_segment_members(segment_id);
CREATE INDEX IF NOT EXISTS idx_crm_segment_members_record
  ON crm_segment_members(record_id);
CREATE INDEX IF NOT EXISTS idx_crm_segment_members_org
  ON crm_segment_members(organization_id);

-- ============================================================================
-- RLS — crm_segmentations
-- ============================================================================
ALTER TABLE crm_segmentations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "segments_select" ON crm_segmentations;
CREATE POLICY "segments_select" ON crm_segmentations
  FOR SELECT TO authenticated
  USING (is_crm_member(organization_id));

DROP POLICY IF EXISTS "segments_admin_insert" ON crm_segmentations;
CREATE POLICY "segments_admin_insert" ON crm_segmentations
  FOR INSERT TO authenticated
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "segments_admin_update" ON crm_segmentations;
CREATE POLICY "segments_admin_update" ON crm_segmentations
  FOR UPDATE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']))
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "segments_admin_delete" ON crm_segmentations;
CREATE POLICY "segments_admin_delete" ON crm_segmentations
  FOR DELETE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']) AND NOT is_system);

DROP POLICY IF EXISTS "segments_service" ON crm_segmentations;
CREATE POLICY "segments_service" ON crm_segmentations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- RLS — crm_segment_members
-- ============================================================================
ALTER TABLE crm_segment_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "segment_members_select" ON crm_segment_members;
CREATE POLICY "segment_members_select" ON crm_segment_members
  FOR SELECT TO authenticated
  USING (is_crm_member(organization_id));

DROP POLICY IF EXISTS "segment_members_manage" ON crm_segment_members;
CREATE POLICY "segment_members_manage" ON crm_segment_members
  FOR ALL TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "segment_members_service" ON crm_segment_members;
CREATE POLICY "segment_members_service" ON crm_segment_members
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Refresh PostgREST schema cache so the API can see the tables immediately.
NOTIFY pgrst, 'reload schema';

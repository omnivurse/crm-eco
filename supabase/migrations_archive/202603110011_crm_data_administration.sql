-- ============================================================================
-- MODULE 7: Data Administration — Import/Export System
-- Creates crm_export_jobs for generic record export tracking
-- Extends existing import infrastructure with audit triggers and service_role
-- Existing tables: crm_import_jobs, crm_import_rows, crm_import_sources,
--   crm_import_mappings, warehouse_exports
-- ============================================================================

-- ============================================================================
-- 1. CRM EXPORT JOBS — Generic record export tracking
-- Tracks CSV/JSON/XLSX exports with column selection, filters, and progress
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_export_jobs (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id       uuid         REFERENCES crm_modules(id) ON DELETE SET NULL,
  -- Export configuration
  name            text,        -- User-provided label or auto-generated
  export_type     text         NOT NULL DEFAULT 'records' CHECK (export_type IN (
                    'records', 'report', 'audit_logs', 'analytics', 'backup'
                  )),
  format          text         NOT NULL DEFAULT 'csv' CHECK (format IN (
                    'csv', 'json', 'xlsx'
                  )),
  -- Column selection
  columns         text[],      -- Ordered list of field keys to export (NULL = all)
  column_labels   jsonb        DEFAULT '{}',  -- Override labels: {field_key: "Display Name"}
  -- Filters applied
  filters         jsonb        NOT NULL DEFAULT '{}',  -- Filter criteria: {status: "active", date_range: {...}}
  sort_by         text,
  sort_order      text         DEFAULT 'asc' CHECK (sort_order IN ('asc', 'desc')),
  -- Progress tracking
  status          text         NOT NULL DEFAULT 'pending' CHECK (status IN (
                    'pending', 'processing', 'completed', 'failed', 'cancelled', 'expired'
                  )),
  total_rows      int          NOT NULL DEFAULT 0,
  processed_rows  int          NOT NULL DEFAULT 0,
  -- File output
  file_url        text,        -- Signed URL to the exported file
  file_name       text,        -- Generated filename
  file_size_bytes bigint,
  -- Expiry
  expires_at      timestamptz, -- When the download link expires
  -- Metadata
  error_message   text,
  stats           jsonb        DEFAULT '{}',
  created_by      uuid         REFERENCES profiles(id) ON DELETE SET NULL,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_export_jobs_org
  ON crm_export_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_export_jobs_module
  ON crm_export_jobs(module_id) WHERE module_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_export_jobs_status
  ON crm_export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_crm_export_jobs_created
  ON crm_export_jobs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_export_jobs_user
  ON crm_export_jobs(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_export_jobs_expiry
  ON crm_export_jobs(expires_at) WHERE status = 'completed' AND expires_at IS NOT NULL;

COMMENT ON TABLE crm_export_jobs IS 'Tracks CRM data export jobs with column selection, filtering, and file output';
COMMENT ON COLUMN crm_export_jobs.columns IS 'Ordered field keys to include in export (NULL = all module fields)';
COMMENT ON COLUMN crm_export_jobs.filters IS 'Filter criteria applied to the export query';
COMMENT ON COLUMN crm_export_jobs.file_url IS 'Signed URL to download the exported file (expires per expires_at)';

-- ============================================================================
-- 2. EXTEND crm_import_jobs — add missing columns
-- ============================================================================

-- Add file_url for uploaded source file reference
ALTER TABLE crm_import_jobs
  ADD COLUMN IF NOT EXISTS file_url text;

-- Add import mode: insert-only, upsert, update-only
ALTER TABLE crm_import_jobs
  ADD COLUMN IF NOT EXISTS import_mode text DEFAULT 'upsert'
  CHECK (import_mode IS NULL OR import_mode IN ('insert', 'upsert', 'update'));

-- Add rollback capability tracking
ALTER TABLE crm_import_jobs
  ADD COLUMN IF NOT EXISTS can_rollback boolean DEFAULT false;

ALTER TABLE crm_import_jobs
  ADD COLUMN IF NOT EXISTS rolled_back_at timestamptz;

COMMENT ON COLUMN crm_import_jobs.import_mode IS 'Import behavior: insert (new only), upsert (insert+update), update (existing only)';
COMMENT ON COLUMN crm_import_jobs.can_rollback IS 'Whether this import can be rolled back (record IDs tracked)';

-- ============================================================================
-- 3. CRM DATA CLEANUP JOBS — Dedup, merge, enrich tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_data_jobs (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id       uuid         REFERENCES crm_modules(id) ON DELETE SET NULL,
  job_type        text         NOT NULL CHECK (job_type IN (
                    'deduplicate', 'merge', 'mass_update', 'mass_delete', 'enrich'
                  )),
  name            text,
  status          text         NOT NULL DEFAULT 'pending' CHECK (status IN (
                    'pending', 'processing', 'completed', 'failed', 'cancelled', 'review'
                  )),
  -- Config
  config          jsonb        NOT NULL DEFAULT '{}',  -- Job-specific config
  filters         jsonb        DEFAULT '{}',           -- Record selection criteria
  -- Progress
  total_records   int          NOT NULL DEFAULT 0,
  processed       int          NOT NULL DEFAULT 0,
  affected        int          NOT NULL DEFAULT 0,     -- Records actually changed
  skipped         int          NOT NULL DEFAULT 0,
  error_count     int          NOT NULL DEFAULT 0,
  -- Results
  results         jsonb        DEFAULT '{}',
  error_message   text,
  -- Audit
  created_by      uuid         REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by     uuid         REFERENCES profiles(id) ON DELETE SET NULL,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_data_jobs_org
  ON crm_data_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_data_jobs_type
  ON crm_data_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_crm_data_jobs_status
  ON crm_data_jobs(status);
CREATE INDEX IF NOT EXISTS idx_crm_data_jobs_created
  ON crm_data_jobs(organization_id, created_at DESC);

COMMENT ON TABLE crm_data_jobs IS 'Tracks data administration jobs: deduplication, mass updates, merges, enrichment';
COMMENT ON COLUMN crm_data_jobs.job_type IS 'deduplicate: find/merge duplicates, merge: merge records, mass_update: bulk field update, mass_delete: bulk delete, enrich: data enrichment';

-- ============================================================================
-- 4. EXPORT HELPER — Generate export filename
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_generate_export_filename(
  p_module_name text,
  p_format text,
  p_org_id uuid
)
RETURNS text AS $$
DECLARE
  v_org_slug text;
BEGIN
  SELECT slug INTO v_org_slug FROM organizations WHERE id = p_org_id;
  RETURN COALESCE(v_org_slug, 'export') || '_' ||
         COALESCE(lower(replace(p_module_name, ' ', '_')), 'data') || '_' ||
         to_char(now(), 'YYYYMMDD_HH24MI') || '.' || p_format;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION fn_generate_export_filename IS
  'Generates a consistent filename for export jobs: org_module_date.format';

-- ============================================================================
-- 5. IMPORT ROLLBACK FUNCTION
-- Deletes records created by an import job (if can_rollback = true)
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_rollback_import(p_job_id uuid)
RETURNS TABLE(deleted_count int, error_message text) AS $$
DECLARE
  v_job RECORD;
  v_deleted int := 0;
BEGIN
  -- Get the job
  SELECT * INTO v_job FROM crm_import_jobs WHERE id = p_job_id;

  IF v_job IS NULL THEN
    error_message := 'Import job not found';
    deleted_count := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  IF NOT v_job.can_rollback THEN
    error_message := 'This import job cannot be rolled back';
    deleted_count := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_job.rolled_back_at IS NOT NULL THEN
    error_message := 'This import was already rolled back';
    deleted_count := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Delete records created by this import (only inserted, not updated)
  DELETE FROM crm_records
  WHERE id IN (
    SELECT r.record_id FROM crm_import_rows r
    WHERE r.job_id = p_job_id
      AND r.status = 'inserted'
      AND r.record_id IS NOT NULL
  );
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Mark job as rolled back
  UPDATE crm_import_jobs
  SET rolled_back_at = now(),
      status = 'cancelled'
  WHERE id = p_job_id;

  -- Update import rows
  UPDATE crm_import_rows
  SET status = 'skipped'
  WHERE job_id = p_job_id AND status = 'inserted';

  deleted_count := v_deleted;
  error_message := NULL;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION fn_rollback_import IS
  'Rolls back an import by deleting records that were inserted (not updated)';

-- ============================================================================
-- 6. AUDIT TRIGGERS — log import/export operations
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_audit_data_admin_changes()
RETURNS trigger AS $$
BEGIN
  INSERT INTO unified_audit_logs (
    organization_id, app_source, actor_id,
    action, action_category, risk_level, details, changes
  ) VALUES (
    COALESCE(
      CASE WHEN TG_TABLE_NAME IN ('crm_import_jobs', 'crm_import_sources', 'crm_import_mappings', 'crm_data_jobs')
        THEN COALESCE(NEW.org_id, OLD.org_id)
        ELSE NULL
      END,
      CASE WHEN TG_TABLE_NAME IN ('crm_export_jobs')
        THEN COALESCE(NEW.organization_id, OLD.organization_id)
        ELSE NULL
      END
    ),
    'crm',
    COALESCE(
      (SELECT id FROM profiles WHERE user_id = (SELECT auth.uid()) LIMIT 1),
      NULL
    ),
    TG_TABLE_NAME || '.' || lower(TG_OP),
    'data_admin',
    CASE
      WHEN TG_TABLE_NAME = 'crm_data_jobs' AND (NEW.job_type = 'mass_delete' OR OLD.job_type = 'mass_delete') THEN 'critical'
      WHEN TG_TABLE_NAME IN ('crm_import_jobs', 'crm_export_jobs') THEN 'high'
      ELSE 'medium'
    END,
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'status', COALESCE(NEW.status, OLD.status, 'n/a'),
      'entity_name', CASE
        WHEN TG_TABLE_NAME = 'crm_import_jobs' THEN COALESCE(NEW.file_name, OLD.file_name)
        WHEN TG_TABLE_NAME = 'crm_export_jobs' THEN COALESCE(NEW.name, OLD.name, NEW.file_name, OLD.file_name)
        WHEN TG_TABLE_NAME = 'crm_data_jobs' THEN COALESCE(NEW.name, OLD.name)
        WHEN TG_TABLE_NAME = 'crm_import_mappings' THEN COALESCE(NEW.name, OLD.name)
        WHEN TG_TABLE_NAME = 'crm_import_sources' THEN COALESCE(NEW.name, OLD.name)
        ELSE NULL
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

COMMENT ON FUNCTION fn_audit_data_admin_changes IS
  'Audit trigger for import/export/data administration operations → unified_audit_logs';

CREATE TRIGGER trg_audit_crm_import_jobs
  AFTER INSERT OR UPDATE OR DELETE ON crm_import_jobs
  FOR EACH ROW EXECUTE FUNCTION fn_audit_data_admin_changes();

CREATE TRIGGER trg_audit_crm_export_jobs
  AFTER INSERT OR UPDATE OR DELETE ON crm_export_jobs
  FOR EACH ROW EXECUTE FUNCTION fn_audit_data_admin_changes();

CREATE TRIGGER trg_audit_crm_data_jobs
  AFTER INSERT OR UPDATE OR DELETE ON crm_data_jobs
  FOR EACH ROW EXECUTE FUNCTION fn_audit_data_admin_changes();

CREATE TRIGGER trg_audit_crm_import_mappings
  AFTER INSERT OR UPDATE OR DELETE ON crm_import_mappings
  FOR EACH ROW EXECUTE FUNCTION fn_audit_data_admin_changes();

CREATE TRIGGER trg_audit_crm_import_sources
  AFTER INSERT OR UPDATE OR DELETE ON crm_import_sources
  FOR EACH ROW EXECUTE FUNCTION fn_audit_data_admin_changes();

-- ============================================================================
-- 7. ROW LEVEL SECURITY — crm_export_jobs
-- ============================================================================
ALTER TABLE crm_export_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "export_jobs_select" ON crm_export_jobs;
CREATE POLICY "export_jobs_select" ON crm_export_jobs
  FOR SELECT TO authenticated
  USING (is_crm_member(organization_id));

DROP POLICY IF EXISTS "export_jobs_insert" ON crm_export_jobs;
CREATE POLICY "export_jobs_insert" ON crm_export_jobs
  FOR INSERT TO authenticated
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "export_jobs_update" ON crm_export_jobs;
CREATE POLICY "export_jobs_update" ON crm_export_jobs
  FOR UPDATE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "export_jobs_delete" ON crm_export_jobs;
CREATE POLICY "export_jobs_delete" ON crm_export_jobs
  FOR DELETE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "export_jobs_service" ON crm_export_jobs;
CREATE POLICY "export_jobs_service" ON crm_export_jobs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── crm_data_jobs: admin/manager read, admin write ───────────────────
ALTER TABLE crm_data_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "data_jobs_select" ON crm_data_jobs;
CREATE POLICY "data_jobs_select" ON crm_data_jobs
  FOR SELECT TO authenticated
  USING (is_crm_member(organization_id));

DROP POLICY IF EXISTS "data_jobs_insert" ON crm_data_jobs;
CREATE POLICY "data_jobs_insert" ON crm_data_jobs
  FOR INSERT TO authenticated
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "data_jobs_update" ON crm_data_jobs;
CREATE POLICY "data_jobs_update" ON crm_data_jobs
  FOR UPDATE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "data_jobs_delete" ON crm_data_jobs;
CREATE POLICY "data_jobs_delete" ON crm_data_jobs
  FOR DELETE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "data_jobs_service" ON crm_data_jobs;
CREATE POLICY "data_jobs_service" ON crm_data_jobs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 8. SERVICE ROLE BYPASS on existing import tables
-- ============================================================================
DROP POLICY IF EXISTS "import_sources_service" ON crm_import_sources;
CREATE POLICY "import_sources_service" ON crm_import_sources
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "import_mappings_service" ON crm_import_mappings;
CREATE POLICY "import_mappings_service" ON crm_import_mappings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "import_jobs_service" ON crm_import_jobs;
CREATE POLICY "import_jobs_service" ON crm_import_jobs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "import_rows_service" ON crm_import_rows;
CREATE POLICY "import_rows_service" ON crm_import_rows
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- END MODULE 7
-- ============================================================================

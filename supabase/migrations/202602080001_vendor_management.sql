-- ============================================================================
-- VENDOR MANAGEMENT SYSTEM
-- Centralized vendor enrollments, file uploads, and change detection
-- ============================================================================

-- ============================================================================
-- VENDORS TABLE
-- Master table for vendor profiles
-- ============================================================================
CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Basic Info
  name text NOT NULL,
  code text NOT NULL,
  description text,
  vendor_type text NOT NULL DEFAULT 'health_plan',
  -- Types: health_plan, insurance, pharmacy_benefit, ancillary, other

  -- Status
  status text NOT NULL DEFAULT 'active',
  -- Status: active, inactive, pending, suspended

  -- Contact Info
  contact_name text,
  contact_email text,
  contact_phone text,
  website_url text,

  -- Integration Settings
  connection_type text DEFAULT 'manual',
  -- Types: manual, sftp, api, webhook
  api_endpoint text,
  api_key_enc text,
  sftp_host text,
  sftp_username text,
  sftp_password_enc text,
  sftp_path text,

  -- Sync Configuration
  sync_enabled boolean DEFAULT false,
  sync_schedule text, -- cron expression
  last_sync_at timestamptz,
  last_sync_status text,
  last_sync_error text,

  -- File Processing Settings
  default_file_format text DEFAULT 'csv',
  -- Formats: csv, xlsx, xml, json
  file_delimiter text DEFAULT ',',
  has_header_row boolean DEFAULT true,
  date_format text DEFAULT 'YYYY-MM-DD',

  -- Column Mapping (stored as JSONB)
  column_mapping jsonb DEFAULT '{}'::jsonb,
  -- e.g., { "member_id": "MemberNumber", "effective_date": "EffDate" }

  -- Metadata
  logo_url text,
  settings jsonb DEFAULT '{}'::jsonb,

  -- Audit
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Constraints
  UNIQUE(org_id, code)
);

CREATE INDEX idx_vendors_org ON vendors(org_id);
CREATE INDEX idx_vendors_status ON vendors(status);
CREATE INDEX idx_vendors_type ON vendors(vendor_type);
CREATE INDEX idx_vendors_code ON vendors(org_id, code);

-- ============================================================================
-- VENDOR FILES TABLE
-- Track uploaded/ingested files
-- ============================================================================
CREATE TABLE IF NOT EXISTS vendor_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,

  -- File Info
  file_name text NOT NULL,
  file_type text NOT NULL,
  -- Types: enrollment, pricing, roster, termination, change, other
  file_format text DEFAULT 'csv',
  file_size_bytes bigint,
  storage_path text,
  storage_bucket text DEFAULT 'vendor-files',

  -- Source
  upload_source text NOT NULL DEFAULT 'manual',
  -- Sources: manual, sftp, api, email, webhook

  -- Processing Status
  status text NOT NULL DEFAULT 'pending',
  -- Status: pending, validating, processing, completed, failed, partially_completed

  -- Counts
  total_rows integer DEFAULT 0,
  processed_rows integer DEFAULT 0,
  valid_rows integer DEFAULT 0,
  error_rows integer DEFAULT 0,
  new_records integer DEFAULT 0,
  updated_records integer DEFAULT 0,
  unchanged_records integer DEFAULT 0,

  -- Processing Details
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  error_details jsonb,

  -- Validation Results
  validation_errors jsonb DEFAULT '[]'::jsonb,
  validation_warnings jsonb DEFAULT '[]'::jsonb,

  -- Processing Options
  duplicate_strategy text DEFAULT 'update',
  -- Strategies: skip, update, error
  detect_changes boolean DEFAULT true,

  -- Audit
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_vendor_files_org ON vendor_files(org_id);
CREATE INDEX idx_vendor_files_vendor ON vendor_files(vendor_id);
CREATE INDEX idx_vendor_files_status ON vendor_files(status);
CREATE INDEX idx_vendor_files_created ON vendor_files(created_at DESC);
CREATE INDEX idx_vendor_files_type ON vendor_files(file_type);

-- ============================================================================
-- VENDOR FILE ROWS TABLE
-- Individual rows from processed files
-- ============================================================================
CREATE TABLE IF NOT EXISTS vendor_file_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES vendor_files(id) ON DELETE CASCADE,

  -- Row Info
  row_index integer NOT NULL,
  raw_data jsonb NOT NULL,
  normalized_data jsonb,

  -- Processing Status
  status text NOT NULL DEFAULT 'pending',
  -- Status: pending, valid, invalid, processed, skipped, error

  -- Matching
  matched_entity_type text,
  -- Types: member, enrollment, membership, plan, null
  matched_entity_id uuid,
  match_confidence numeric(5,2),
  match_method text,
  -- Methods: exact, fuzzy, external_id, null

  -- Validation
  validation_errors jsonb DEFAULT '[]'::jsonb,
  validation_warnings jsonb DEFAULT '[]'::jsonb,

  -- Processing Result
  action_taken text,
  -- Actions: inserted, updated, skipped, error
  error_message text,

  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX idx_vendor_file_rows_file ON vendor_file_rows(file_id);
CREATE INDEX idx_vendor_file_rows_status ON vendor_file_rows(status);
CREATE INDEX idx_vendor_file_rows_entity ON vendor_file_rows(matched_entity_type, matched_entity_id);

-- ============================================================================
-- VENDOR CHANGES TABLE
-- Detected changes log
-- ============================================================================
CREATE TABLE IF NOT EXISTS vendor_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  file_id uuid REFERENCES vendor_files(id) ON DELETE SET NULL,
  file_row_id uuid REFERENCES vendor_file_rows(id) ON DELETE SET NULL,

  -- Change Info
  change_type text NOT NULL,
  -- Types: new_enrollment, termination, demographic_update, plan_change,
  --        address_change, status_change, dependent_add, dependent_remove, other

  -- Entity Reference
  entity_type text NOT NULL,
  -- Types: member, enrollment, membership, dependent
  entity_id uuid,
  external_id text,

  -- Change Details
  field_changed text,
  old_value text,
  new_value text,
  change_data jsonb DEFAULT '{}'::jsonb,

  -- Status
  status text NOT NULL DEFAULT 'pending',
  -- Status: pending, reviewed, approved, rejected, applied, ignored

  -- Review Info
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,

  -- Severity/Priority
  severity text DEFAULT 'normal',
  -- Severity: low, normal, high, critical

  detected_at timestamptz DEFAULT now(),
  applied_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_vendor_changes_org ON vendor_changes(org_id);
CREATE INDEX idx_vendor_changes_vendor ON vendor_changes(vendor_id);
CREATE INDEX idx_vendor_changes_file ON vendor_changes(file_id);
CREATE INDEX idx_vendor_changes_status ON vendor_changes(status);
CREATE INDEX idx_vendor_changes_type ON vendor_changes(change_type);
CREATE INDEX idx_vendor_changes_entity ON vendor_changes(entity_type, entity_id);
CREATE INDEX idx_vendor_changes_detected ON vendor_changes(detected_at DESC);
CREATE INDEX idx_vendor_changes_pending ON vendor_changes(org_id, status) WHERE status = 'pending';

-- ============================================================================
-- VENDOR CONNECTORS TABLE
-- Ingestion profile configurations
-- ============================================================================
CREATE TABLE IF NOT EXISTS vendor_connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,

  -- Connector Info
  name text NOT NULL,
  connector_type text NOT NULL,
  -- Types: enrollment_feed, pricing_feed, roster_sync, termination_feed,
  --        eligibility_check, claim_submission

  -- Status
  is_active boolean DEFAULT true,

  -- Schedule
  schedule_type text DEFAULT 'manual',
  -- Types: manual, daily, weekly, monthly, real_time
  schedule_cron text,
  last_run_at timestamptz,
  next_run_at timestamptz,

  -- Configuration
  config jsonb DEFAULT '{}'::jsonb,
  -- e.g., { "file_pattern": "*.csv", "archive_after_process": true }

  -- Column Mapping (overrides vendor default)
  column_mapping jsonb DEFAULT '{}'::jsonb,

  -- Validation Rules
  validation_rules jsonb DEFAULT '[]'::jsonb,
  -- e.g., [{ "field": "email", "rule": "required" }, { "field": "dob", "rule": "date" }]

  -- Transformation Rules
  transformations jsonb DEFAULT '[]'::jsonb,
  -- e.g., [{ "field": "status", "map": { "A": "active", "T": "terminated" } }]

  -- Error Handling
  error_threshold integer DEFAULT 10,
  error_action text DEFAULT 'continue',
  -- Actions: continue, pause, abort
  notification_emails text[],

  -- Stats
  total_runs integer DEFAULT 0,
  successful_runs integer DEFAULT 0,
  failed_runs integer DEFAULT 0,

  -- Audit
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_vendor_connectors_org ON vendor_connectors(org_id);
CREATE INDEX idx_vendor_connectors_vendor ON vendor_connectors(vendor_id);
CREATE INDEX idx_vendor_connectors_active ON vendor_connectors(is_active);
CREATE INDEX idx_vendor_connectors_next_run ON vendor_connectors(next_run_at) WHERE is_active = true;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_file_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_connectors ENABLE ROW LEVEL SECURITY;

-- Vendors Policies
DROP POLICY IF EXISTS "Users can view vendors" ON vendors;
CREATE POLICY "Users can view vendors"
  ON vendors FOR SELECT
  USING (org_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage vendors" ON vendors;
CREATE POLICY "Admins can manage vendors"
  ON vendors FOR ALL
  USING (org_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

-- Vendor Files Policies
DROP POLICY IF EXISTS "Users can view vendor files" ON vendor_files;
CREATE POLICY "Users can view vendor files"
  ON vendor_files FOR SELECT
  USING (org_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage vendor files" ON vendor_files;
CREATE POLICY "Admins can manage vendor files"
  ON vendor_files FOR ALL
  USING (org_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

-- Vendor File Rows Policies
DROP POLICY IF EXISTS "Users can view vendor file rows" ON vendor_file_rows;
CREATE POLICY "Users can view vendor file rows"
  ON vendor_file_rows FOR SELECT
  USING (org_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage vendor file rows" ON vendor_file_rows;
CREATE POLICY "Admins can manage vendor file rows"
  ON vendor_file_rows FOR ALL
  USING (org_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

-- Vendor Changes Policies
DROP POLICY IF EXISTS "Users can view vendor changes" ON vendor_changes;
CREATE POLICY "Users can view vendor changes"
  ON vendor_changes FOR SELECT
  USING (org_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage vendor changes" ON vendor_changes;
CREATE POLICY "Admins can manage vendor changes"
  ON vendor_changes FOR ALL
  USING (org_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

-- Vendor Connectors Policies
DROP POLICY IF EXISTS "Users can view vendor connectors" ON vendor_connectors;
CREATE POLICY "Users can view vendor connectors"
  ON vendor_connectors FOR SELECT
  USING (org_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage vendor connectors" ON vendor_connectors;
CREATE POLICY "Admins can manage vendor connectors"
  ON vendor_connectors FOR ALL
  USING (org_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

-- ============================================================================
-- TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_vendors_updated_at ON vendors;
CREATE TRIGGER update_vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendor_files_updated_at ON vendor_files;
CREATE TRIGGER update_vendor_files_updated_at
  BEFORE UPDATE ON vendor_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendor_connectors_updated_at ON vendor_connectors;
CREATE TRIGGER update_vendor_connectors_updated_at
  BEFORE UPDATE ON vendor_connectors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get vendor stats summary
CREATE OR REPLACE FUNCTION get_vendor_stats(p_org_id uuid)
RETURNS TABLE (
  total_vendors bigint,
  active_vendors bigint,
  files_in_progress bigint,
  changes_last_7_days bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM vendors WHERE org_id = p_org_id)::bigint as total_vendors,
    (SELECT COUNT(*) FROM vendors WHERE org_id = p_org_id AND status = 'active')::bigint as active_vendors,
    (SELECT COUNT(*) FROM vendor_files WHERE org_id = p_org_id AND status IN ('pending', 'validating', 'processing'))::bigint as files_in_progress,
    (SELECT COUNT(*) FROM vendor_changes WHERE org_id = p_org_id AND detected_at > now() - interval '7 days')::bigint as changes_last_7_days;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log vendor change
CREATE OR REPLACE FUNCTION log_vendor_change(
  p_org_id uuid,
  p_vendor_id uuid,
  p_file_id uuid,
  p_change_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_field_changed text,
  p_old_value text,
  p_new_value text,
  p_severity text DEFAULT 'normal'
)
RETURNS uuid AS $$
DECLARE
  v_change_id uuid;
BEGIN
  INSERT INTO vendor_changes (
    org_id, vendor_id, file_id, change_type, entity_type,
    entity_id, field_changed, old_value, new_value, severity
  ) VALUES (
    p_org_id, p_vendor_id, p_file_id, p_change_type, p_entity_type,
    p_entity_id, p_field_changed, p_old_value, p_new_value, p_severity
  )
  RETURNING id INTO v_change_id;

  RETURN v_change_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

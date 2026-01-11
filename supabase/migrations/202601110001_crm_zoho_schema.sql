-- CRM-ECO: Enterprise CRM Zoho-Style Schema Migration
-- Implements configurable modules, custom fields, dynamic records, and import system

-- ============================================================================
-- PROFILES ENHANCEMENT: Add CRM-specific role
-- ============================================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS crm_role text 
  CHECK (crm_role IS NULL OR crm_role IN ('crm_admin', 'crm_manager', 'crm_agent', 'crm_viewer'));

CREATE INDEX IF NOT EXISTS idx_profiles_crm_role ON profiles(crm_role) WHERE crm_role IS NOT NULL;

-- ============================================================================
-- CRM MODULES
-- Defines configurable CRM modules (Contacts, Leads, Deals, etc.)
-- ============================================================================
CREATE TABLE crm_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  name_plural text,
  icon text DEFAULT 'file',
  description text,
  is_system boolean DEFAULT false,
  is_enabled boolean DEFAULT true,
  display_order integer DEFAULT 0,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, key)
);

CREATE INDEX idx_crm_modules_org ON crm_modules(org_id);
CREATE INDEX idx_crm_modules_key ON crm_modules(org_id, key);
CREATE INDEX idx_crm_modules_enabled ON crm_modules(org_id, is_enabled);

-- ============================================================================
-- CRM FIELDS
-- Field definitions per module (Zoho-style customization)
-- ============================================================================
CREATE TABLE crm_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES crm_modules(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  type text NOT NULL CHECK (type IN (
    'text', 'textarea', 'number', 'date', 'datetime', 
    'select', 'multiselect', 'boolean', 'email', 'phone', 
    'url', 'currency', 'lookup', 'user'
  )),
  required boolean DEFAULT false,
  is_system boolean DEFAULT false,
  is_indexed boolean DEFAULT false,
  is_title_field boolean DEFAULT false,
  options jsonb DEFAULT '[]'::jsonb,
  validation jsonb DEFAULT '{}'::jsonb,
  default_value text,
  tooltip text,
  display_order integer DEFAULT 0,
  section text DEFAULT 'main',
  width text DEFAULT 'full',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(module_id, key)
);

CREATE INDEX idx_crm_fields_module ON crm_fields(module_id);
CREATE INDEX idx_crm_fields_org ON crm_fields(org_id);
CREATE INDEX idx_crm_fields_system ON crm_fields(module_id, is_system);

-- ============================================================================
-- CRM LAYOUTS
-- Page layouts for record forms (sections, field arrangement)
-- ============================================================================
CREATE TABLE crm_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES crm_modules(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_default boolean DEFAULT false,
  config jsonb NOT NULL DEFAULT '{
    "sections": [
      {"key": "main", "label": "General Information", "columns": 2},
      {"key": "address", "label": "Address", "columns": 2},
      {"key": "additional", "label": "Additional Information", "columns": 2}
    ]
  }'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_layouts_module ON crm_layouts(module_id);
CREATE INDEX idx_crm_layouts_default ON crm_layouts(module_id, is_default);

-- ============================================================================
-- CRM VIEWS
-- Saved list views with column configs, filters, and sorts
-- ============================================================================
CREATE TABLE crm_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES crm_modules(id) ON DELETE CASCADE,
  name text NOT NULL,
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  filters jsonb DEFAULT '[]'::jsonb,
  sort jsonb DEFAULT '[]'::jsonb,
  is_default boolean DEFAULT false,
  is_shared boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_views_module ON crm_views(module_id);
CREATE INDEX idx_crm_views_default ON crm_views(module_id, is_default);
CREATE INDEX idx_crm_views_created_by ON crm_views(created_by);

-- ============================================================================
-- CRM RECORDS
-- Core flexible record storage (Zoho-style with indexed system fields)
-- ============================================================================
CREATE TABLE crm_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES crm_modules(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Indexed system fields for quick queries
  title text,
  status text,
  stage text,
  email text,
  phone text,
  
  -- Flexible storage
  system jsonb DEFAULT '{}'::jsonb,
  data jsonb DEFAULT '{}'::jsonb,
  
  -- Full-text search vector
  search tsvector GENERATED ALWAYS AS (
    to_tsvector('english', 
      coalesce(title, '') || ' ' || 
      coalesce(data->>'first_name', '') || ' ' || 
      coalesce(data->>'last_name', '') || ' ' ||
      coalesce(email, '') || ' ' ||
      coalesce(phone, '')
    )
  ) STORED,
  
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_records_org_module ON crm_records(org_id, module_id);
CREATE INDEX idx_crm_records_owner ON crm_records(owner_id);
CREATE INDEX idx_crm_records_status ON crm_records(status);
CREATE INDEX idx_crm_records_stage ON crm_records(stage);
CREATE INDEX idx_crm_records_email ON crm_records(email);
CREATE INDEX idx_crm_records_phone ON crm_records(phone);
CREATE INDEX idx_crm_records_title ON crm_records(title);
CREATE INDEX idx_crm_records_search ON crm_records USING gin(search);
CREATE INDEX idx_crm_records_data ON crm_records USING gin(data jsonb_path_ops);
CREATE INDEX idx_crm_records_created_at ON crm_records(created_at DESC);

-- ============================================================================
-- CRM NOTES
-- Notes attached to records
-- ============================================================================
CREATE TABLE crm_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  record_id uuid NOT NULL REFERENCES crm_records(id) ON DELETE CASCADE,
  body text NOT NULL,
  is_pinned boolean DEFAULT false,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_notes_record ON crm_notes(record_id);
CREATE INDEX idx_crm_notes_created_at ON crm_notes(record_id, created_at DESC);

-- ============================================================================
-- CRM TASKS
-- Tasks attached to records or standalone
-- ============================================================================
CREATE TABLE crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  record_id uuid REFERENCES crm_records(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_at timestamptz,
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_tasks_record ON crm_tasks(record_id);
CREATE INDEX idx_crm_tasks_assigned ON crm_tasks(assigned_to);
CREATE INDEX idx_crm_tasks_status ON crm_tasks(status);
CREATE INDEX idx_crm_tasks_due ON crm_tasks(due_at) WHERE status != 'completed';

-- ============================================================================
-- CRM ATTACHMENTS
-- File attachments on records
-- ============================================================================
CREATE TABLE crm_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  record_id uuid NOT NULL REFERENCES crm_records(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer,
  mime_type text,
  meta jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_attachments_record ON crm_attachments(record_id);

-- ============================================================================
-- CRM RELATIONS
-- Record-to-record relationships
-- ============================================================================
CREATE TABLE crm_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  from_record_id uuid NOT NULL REFERENCES crm_records(id) ON DELETE CASCADE,
  to_record_id uuid NOT NULL REFERENCES crm_records(id) ON DELETE CASCADE,
  relation_type text NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(from_record_id, to_record_id, relation_type)
);

CREATE INDEX idx_crm_relations_from ON crm_relations(from_record_id);
CREATE INDEX idx_crm_relations_to ON crm_relations(to_record_id);

-- ============================================================================
-- CRM AUDIT LOG
-- Change tracking for compliance and history
-- ============================================================================
CREATE TABLE crm_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete', 'import', 'export', 'bulk_update')),
  entity text NOT NULL,
  entity_id uuid NOT NULL,
  diff jsonb,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_audit_org ON crm_audit_log(org_id);
CREATE INDEX idx_crm_audit_entity ON crm_audit_log(entity, entity_id);
CREATE INDEX idx_crm_audit_actor ON crm_audit_log(actor_id);
CREATE INDEX idx_crm_audit_created ON crm_audit_log(created_at DESC);

-- ============================================================================
-- CRM IMPORT SOURCES
-- Reusable import source configurations
-- ============================================================================
CREATE TABLE crm_import_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('csv', 'zoho', 'salesforce', 'hubspot', 'api')),
  name text NOT NULL,
  config jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_import_sources_org ON crm_import_sources(org_id);

-- ============================================================================
-- CRM IMPORT MAPPINGS
-- Reusable field mapping templates
-- ============================================================================
CREATE TABLE crm_import_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES crm_modules(id) ON DELETE CASCADE,
  source_id uuid REFERENCES crm_import_sources(id) ON DELETE SET NULL,
  name text NOT NULL,
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  transforms jsonb DEFAULT '{}'::jsonb,
  dedupe_fields text[] DEFAULT '{}',
  is_default boolean DEFAULT false,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, module_id, name)
);

CREATE INDEX idx_crm_import_mappings_module ON crm_import_mappings(module_id);

-- ============================================================================
-- CRM IMPORT JOBS
-- Import job tracking
-- ============================================================================
CREATE TABLE crm_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES crm_modules(id) ON DELETE CASCADE,
  mapping_id uuid REFERENCES crm_import_mappings(id) ON DELETE SET NULL,
  source_type text NOT NULL,
  file_name text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'validating', 'processing', 'completed', 'failed', 'cancelled')),
  total_rows integer DEFAULT 0,
  processed_rows integer DEFAULT 0,
  inserted_count integer DEFAULT 0,
  updated_count integer DEFAULT 0,
  skipped_count integer DEFAULT 0,
  error_count integer DEFAULT 0,
  stats jsonb DEFAULT '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_import_jobs_org ON crm_import_jobs(org_id);
CREATE INDEX idx_crm_import_jobs_module ON crm_import_jobs(module_id);
CREATE INDEX idx_crm_import_jobs_status ON crm_import_jobs(status);
CREATE INDEX idx_crm_import_jobs_created ON crm_import_jobs(created_at DESC);

-- ============================================================================
-- CRM IMPORT ROWS
-- Individual row tracking for imports
-- ============================================================================
CREATE TABLE crm_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES crm_import_jobs(id) ON DELETE CASCADE,
  row_index integer NOT NULL,
  raw jsonb NOT NULL,
  normalized jsonb,
  record_id uuid REFERENCES crm_records(id) ON DELETE SET NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'inserted', 'updated', 'skipped', 'error')),
  match_type text CHECK (match_type IS NULL OR match_type IN ('new', 'exact_match', 'fuzzy_match', 'duplicate')),
  error text,
  warnings jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_import_rows_job ON crm_import_rows(job_id);
CREATE INDEX idx_crm_import_rows_status ON crm_import_rows(job_id, status);

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================
CREATE TRIGGER update_crm_modules_updated_at 
  BEFORE UPDATE ON crm_modules 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_fields_updated_at 
  BEFORE UPDATE ON crm_fields 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_layouts_updated_at 
  BEFORE UPDATE ON crm_layouts 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_views_updated_at 
  BEFORE UPDATE ON crm_views 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_records_updated_at 
  BEFORE UPDATE ON crm_records 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_notes_updated_at 
  BEFORE UPDATE ON crm_notes 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_tasks_updated_at 
  BEFORE UPDATE ON crm_tasks 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_import_sources_updated_at 
  BEFORE UPDATE ON crm_import_sources 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_import_mappings_updated_at 
  BEFORE UPDATE ON crm_import_mappings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if user has specific CRM role(s) in an organization
CREATE OR REPLACE FUNCTION has_crm_role(p_org_id uuid, p_roles text[])
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
      AND organization_id = p_org_id
      AND crm_role = ANY(p_roles)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is a CRM member (has any CRM role) in an organization
CREATE OR REPLACE FUNCTION is_crm_member(p_org_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
      AND organization_id = p_org_id
      AND crm_role IS NOT NULL
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get current user's CRM role for an organization
CREATE OR REPLACE FUNCTION get_user_crm_role(p_org_id uuid)
RETURNS text AS $$
  SELECT crm_role FROM profiles 
  WHERE user_id = auth.uid() 
    AND organization_id = p_org_id
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Generate record title from data
CREATE OR REPLACE FUNCTION generate_record_title(p_data jsonb)
RETURNS text AS $$
BEGIN
  -- Try common title patterns
  IF p_data->>'title' IS NOT NULL THEN
    RETURN p_data->>'title';
  ELSIF p_data->>'name' IS NOT NULL THEN
    RETURN p_data->>'name';
  ELSIF p_data->>'first_name' IS NOT NULL AND p_data->>'last_name' IS NOT NULL THEN
    RETURN trim(coalesce(p_data->>'first_name', '') || ' ' || coalesce(p_data->>'last_name', ''));
  ELSIF p_data->>'company' IS NOT NULL THEN
    RETURN p_data->>'company';
  ELSIF p_data->>'email' IS NOT NULL THEN
    RETURN p_data->>'email';
  ELSE
    RETURN 'Untitled';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Auto-set record title trigger
CREATE OR REPLACE FUNCTION set_record_title()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.title IS NULL OR NEW.title = '' THEN
    NEW.title := generate_record_title(NEW.data);
  END IF;
  
  -- Also extract email and phone if present
  IF NEW.email IS NULL AND NEW.data->>'email' IS NOT NULL THEN
    NEW.email := NEW.data->>'email';
  END IF;
  
  IF NEW.phone IS NULL THEN
    NEW.phone := coalesce(NEW.data->>'phone', NEW.data->>'mobile');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_crm_record_title
  BEFORE INSERT OR UPDATE ON crm_records
  FOR EACH ROW EXECUTE FUNCTION set_record_title();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all CRM tables
ALTER TABLE crm_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_import_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_import_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_import_rows ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CRM MODULES POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view modules"
  ON crm_modules FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM admins can manage modules"
  ON crm_modules FOR ALL
  USING (has_crm_role(org_id, ARRAY['crm_admin']));

-- ============================================================================
-- CRM FIELDS POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view fields"
  ON crm_fields FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM admins can manage fields"
  ON crm_fields FOR ALL
  USING (has_crm_role(org_id, ARRAY['crm_admin']));

-- ============================================================================
-- CRM LAYOUTS POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view layouts"
  ON crm_layouts FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM admins can manage layouts"
  ON crm_layouts FOR ALL
  USING (has_crm_role(org_id, ARRAY['crm_admin']));

-- ============================================================================
-- CRM VIEWS POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view shared views"
  ON crm_views FOR SELECT
  USING (is_crm_member(org_id) AND (is_shared = true OR created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())));

CREATE POLICY "CRM members can create views"
  ON crm_views FOR INSERT
  WITH CHECK (is_crm_member(org_id));

CREATE POLICY "CRM members can update their own views"
  ON crm_views FOR UPDATE
  USING (
    is_crm_member(org_id) AND 
    (created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR has_crm_role(org_id, ARRAY['crm_admin']))
  );

CREATE POLICY "CRM admins or owners can delete views"
  ON crm_views FOR DELETE
  USING (
    created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR 
    has_crm_role(org_id, ARRAY['crm_admin'])
  );

-- ============================================================================
-- CRM RECORDS POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view records"
  ON crm_records FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM managers and admins can create records"
  ON crm_records FOR INSERT
  WITH CHECK (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

CREATE POLICY "CRM managers and admins can update records"
  ON crm_records FOR UPDATE
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

CREATE POLICY "CRM admins can delete records"
  ON crm_records FOR DELETE
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']));

-- ============================================================================
-- CRM NOTES POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view notes"
  ON crm_notes FOR SELECT
  USING (org_id IN (SELECT org_id FROM crm_records WHERE id = record_id) AND is_crm_member(org_id));

CREATE POLICY "CRM members can create notes"
  ON crm_notes FOR INSERT
  WITH CHECK (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

CREATE POLICY "Note creators and admins can update notes"
  ON crm_notes FOR UPDATE
  USING (
    created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR 
    has_crm_role(org_id, ARRAY['crm_admin'])
  );

CREATE POLICY "Note creators and admins can delete notes"
  ON crm_notes FOR DELETE
  USING (
    created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR 
    has_crm_role(org_id, ARRAY['crm_admin'])
  );

-- ============================================================================
-- CRM TASKS POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view tasks"
  ON crm_tasks FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM members can create tasks"
  ON crm_tasks FOR INSERT
  WITH CHECK (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

CREATE POLICY "Task assignees and managers can update tasks"
  ON crm_tasks FOR UPDATE
  USING (
    assigned_to IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
    created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
    has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager'])
  );

CREATE POLICY "CRM admins can delete tasks"
  ON crm_tasks FOR DELETE
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']));

-- ============================================================================
-- CRM ATTACHMENTS POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view attachments"
  ON crm_attachments FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM agents can create attachments"
  ON crm_attachments FOR INSERT
  WITH CHECK (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

CREATE POLICY "CRM admins can delete attachments"
  ON crm_attachments FOR DELETE
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']));

-- ============================================================================
-- CRM RELATIONS POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view relations"
  ON crm_relations FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM agents can create relations"
  ON crm_relations FOR INSERT
  WITH CHECK (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

CREATE POLICY "CRM admins can delete relations"
  ON crm_relations FOR DELETE
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']));

-- ============================================================================
-- CRM AUDIT LOG POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view audit logs"
  ON crm_audit_log FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "System can create audit logs"
  ON crm_audit_log FOR INSERT
  WITH CHECK (is_crm_member(org_id));

-- ============================================================================
-- CRM IMPORT SOURCES POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view import sources"
  ON crm_import_sources FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM admins can manage import sources"
  ON crm_import_sources FOR ALL
  USING (has_crm_role(org_id, ARRAY['crm_admin']));

-- ============================================================================
-- CRM IMPORT MAPPINGS POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view import mappings"
  ON crm_import_mappings FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM admins can manage import mappings"
  ON crm_import_mappings FOR ALL
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']));

-- ============================================================================
-- CRM IMPORT JOBS POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view import jobs"
  ON crm_import_jobs FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM admins can create import jobs"
  ON crm_import_jobs FOR INSERT
  WITH CHECK (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']));

CREATE POLICY "CRM admins can update import jobs"
  ON crm_import_jobs FOR UPDATE
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']));

-- ============================================================================
-- CRM IMPORT ROWS POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view import rows"
  ON crm_import_rows FOR SELECT
  USING (
    job_id IN (SELECT id FROM crm_import_jobs WHERE is_crm_member(org_id))
  );

CREATE POLICY "System can manage import rows"
  ON crm_import_rows FOR ALL
  USING (
    job_id IN (SELECT id FROM crm_import_jobs WHERE has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']))
  );

-- ============================================================================
-- ENROLLMENT INTEGRATION VIEWS
-- Read-only views for CRM to access enrollment data
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS crm_ext;

CREATE OR REPLACE VIEW crm_ext.members AS
  SELECT 
    id,
    organization_id,
    first_name,
    last_name,
    email,
    phone,
    date_of_birth,
    address_line1,
    city,
    state,
    zip_code,
    status,
    plan_name,
    plan_type,
    effective_date,
    termination_date,
    monthly_share,
    created_at,
    updated_at
  FROM members;

CREATE OR REPLACE VIEW crm_ext.enrollments AS
  SELECT 
    id,
    organization_id,
    enrollment_number,
    primary_member_id,
    advisor_id,
    status,
    selected_plan_id,
    effective_date,
    household_size,
    created_at,
    updated_at
  FROM enrollments;

CREATE OR REPLACE VIEW crm_ext.advisors AS
  SELECT 
    id,
    organization_id,
    first_name,
    last_name,
    email,
    phone,
    status,
    license_number,
    license_states,
    commission_tier,
    created_at
  FROM advisors;

-- Grant select on views to authenticated users (RLS on base tables still applies)
GRANT USAGE ON SCHEMA crm_ext TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA crm_ext TO authenticated;

-- ============================================================================
-- AUDIT LOGGING TRIGGER
-- Automatically log changes to crm_records
-- ============================================================================
CREATE OR REPLACE FUNCTION log_crm_record_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_id uuid;
  v_action text;
  v_diff jsonb;
BEGIN
  -- Get actor ID
  SELECT id INTO v_actor_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
  
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_diff := jsonb_build_object('new', row_to_json(NEW)::jsonb);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_diff := jsonb_build_object(
      'old', row_to_json(OLD)::jsonb,
      'new', row_to_json(NEW)::jsonb
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_diff := jsonb_build_object('old', row_to_json(OLD)::jsonb);
  END IF;
  
  INSERT INTO crm_audit_log (org_id, actor_id, action, entity, entity_id, diff)
  VALUES (
    COALESCE(NEW.org_id, OLD.org_id),
    v_actor_id,
    v_action,
    'crm_records',
    COALESCE(NEW.id, OLD.id),
    v_diff
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_crm_records
  AFTER INSERT OR UPDATE OR DELETE ON crm_records
  FOR EACH ROW EXECUTE FUNCTION log_crm_record_changes();

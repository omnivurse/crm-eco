-- ============================================================================
-- CRM-ECO: CONSOLIDATED MIGRATIONS + SEED
-- Run this in Supabase SQL Editor to set up the entire CRM system
-- ============================================================================

-- NOTE: Run these migrations in ORDER. If any fail, check if the object already exists.

-- ============================================================================
-- PRE-FLIGHT: Create update_updated_at_column if not exists
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. ORGANIZATIONS (if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- ============================================================================
-- 2. PROFILES - Add CRM role (ADD column if not exists)
-- ============================================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS crm_role text 
  CHECK (crm_role IS NULL OR crm_role IN ('crm_admin', 'crm_manager', 'crm_agent', 'crm_viewer'));

CREATE INDEX IF NOT EXISTS idx_profiles_crm_role ON profiles(crm_role) WHERE crm_role IS NOT NULL;

-- ============================================================================
-- 3. CRM MODULES
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_modules (
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

CREATE INDEX IF NOT EXISTS idx_crm_modules_org ON crm_modules(org_id);
CREATE INDEX IF NOT EXISTS idx_crm_modules_key ON crm_modules(org_id, key);
CREATE INDEX IF NOT EXISTS idx_crm_modules_enabled ON crm_modules(org_id, is_enabled);

-- ============================================================================
-- 4. CRM FIELDS
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_fields (
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

CREATE INDEX IF NOT EXISTS idx_crm_fields_module ON crm_fields(module_id);
CREATE INDEX IF NOT EXISTS idx_crm_fields_org ON crm_fields(org_id);

-- ============================================================================
-- 5. CRM LAYOUTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES crm_modules(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_default boolean DEFAULT false,
  config jsonb NOT NULL DEFAULT '{
    "sections": [
      {"key": "main", "label": "General Information", "columns": 2}
    ]
  }'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_layouts_module ON crm_layouts(module_id);

-- ============================================================================
-- 6. CRM VIEWS
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_views (
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

CREATE INDEX IF NOT EXISTS idx_crm_views_module ON crm_views(module_id);

-- ============================================================================
-- 7. CRM RECORDS
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES crm_modules(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  title text,
  status text,
  stage text,
  email text,
  phone text,
  system jsonb DEFAULT '{}'::jsonb,
  data jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_records_org_module ON crm_records(org_id, module_id);
CREATE INDEX IF NOT EXISTS idx_crm_records_owner ON crm_records(owner_id);
CREATE INDEX IF NOT EXISTS idx_crm_records_status ON crm_records(status);
CREATE INDEX IF NOT EXISTS idx_crm_records_email ON crm_records(email);
CREATE INDEX IF NOT EXISTS idx_crm_records_created_at ON crm_records(created_at DESC);

-- ============================================================================
-- 8. CRM NOTES
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  record_id uuid NOT NULL REFERENCES crm_records(id) ON DELETE CASCADE,
  body text NOT NULL,
  is_pinned boolean DEFAULT false,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_notes_record ON crm_notes(record_id);

-- ============================================================================
-- 9. CRM TASKS
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_tasks (
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

CREATE INDEX IF NOT EXISTS idx_crm_tasks_record ON crm_tasks(record_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_assigned ON crm_tasks(assigned_to);

-- ============================================================================
-- 10. CRM AUDIT LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_audit_log (
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

CREATE INDEX IF NOT EXISTS idx_crm_audit_org ON crm_audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_crm_audit_created ON crm_audit_log(created_at DESC);

-- ============================================================================
-- 11. CRM IMPORT JOBS
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES crm_modules(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_crm_import_jobs_org ON crm_import_jobs(org_id);

-- ============================================================================
-- 12. HELPER FUNCTIONS
-- ============================================================================

-- Check if user has CRM role
CREATE OR REPLACE FUNCTION has_crm_role(p_org_id uuid, p_roles text[])
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
      AND organization_id = p_org_id
      AND crm_role = ANY(p_roles)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is CRM member
CREATE OR REPLACE FUNCTION is_crm_member(p_org_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
      AND organization_id = p_org_id
      AND crm_role IS NOT NULL
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Generate record title
CREATE OR REPLACE FUNCTION generate_record_title(p_data jsonb)
RETURNS text AS $$
BEGIN
  IF p_data->>'title' IS NOT NULL THEN
    RETURN p_data->>'title';
  ELSIF p_data->>'name' IS NOT NULL THEN
    RETURN p_data->>'name';
  ELSIF p_data->>'first_name' IS NOT NULL AND p_data->>'last_name' IS NOT NULL THEN
    RETURN trim(coalesce(p_data->>'first_name', '') || ' ' || coalesce(p_data->>'last_name', ''));
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
  IF NEW.email IS NULL AND NEW.data->>'email' IS NOT NULL THEN
    NEW.email := NEW.data->>'email';
  END IF;
  IF NEW.phone IS NULL THEN
    NEW.phone := coalesce(NEW.data->>'phone', NEW.data->>'mobile');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_crm_record_title ON crm_records;
CREATE TRIGGER set_crm_record_title
  BEFORE INSERT OR UPDATE ON crm_records
  FOR EACH ROW EXECUTE FUNCTION set_record_title();

-- ============================================================================
-- 13. ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS
ALTER TABLE crm_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_import_jobs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies and recreate (safe for re-runs)
DROP POLICY IF EXISTS "CRM members can view modules" ON crm_modules;
DROP POLICY IF EXISTS "CRM admins can manage modules" ON crm_modules;
DROP POLICY IF EXISTS "CRM members can view fields" ON crm_fields;
DROP POLICY IF EXISTS "CRM admins can manage fields" ON crm_fields;
DROP POLICY IF EXISTS "CRM members can view layouts" ON crm_layouts;
DROP POLICY IF EXISTS "CRM admins can manage layouts" ON crm_layouts;
DROP POLICY IF EXISTS "CRM members can view views" ON crm_views;
DROP POLICY IF EXISTS "CRM members can view records" ON crm_records;
DROP POLICY IF EXISTS "CRM agents can create records" ON crm_records;
DROP POLICY IF EXISTS "CRM agents can update records" ON crm_records;
DROP POLICY IF EXISTS "CRM admins can delete records" ON crm_records;

-- CRM Modules policies
CREATE POLICY "CRM members can view modules"
  ON crm_modules FOR SELECT USING (is_crm_member(org_id));
CREATE POLICY "CRM admins can manage modules"
  ON crm_modules FOR ALL USING (has_crm_role(org_id, ARRAY['crm_admin']));

-- CRM Fields policies
CREATE POLICY "CRM members can view fields"
  ON crm_fields FOR SELECT USING (is_crm_member(org_id));
CREATE POLICY "CRM admins can manage fields"
  ON crm_fields FOR ALL USING (has_crm_role(org_id, ARRAY['crm_admin']));

-- CRM Layouts policies
CREATE POLICY "CRM members can view layouts"
  ON crm_layouts FOR SELECT USING (is_crm_member(org_id));
CREATE POLICY "CRM admins can manage layouts"
  ON crm_layouts FOR ALL USING (has_crm_role(org_id, ARRAY['crm_admin']));

-- CRM Views policies  
CREATE POLICY "CRM members can view views"
  ON crm_views FOR SELECT USING (is_crm_member(org_id));

-- CRM Records policies
CREATE POLICY "CRM members can view records"
  ON crm_records FOR SELECT USING (is_crm_member(org_id));
CREATE POLICY "CRM agents can create records"
  ON crm_records FOR INSERT WITH CHECK (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));
CREATE POLICY "CRM agents can update records"
  ON crm_records FOR UPDATE USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));
CREATE POLICY "CRM admins can delete records"
  ON crm_records FOR DELETE USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']));

-- ============================================================================
-- 14. UPDATED_AT TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_crm_modules_updated_at ON crm_modules;
DROP TRIGGER IF EXISTS update_crm_fields_updated_at ON crm_fields;
DROP TRIGGER IF EXISTS update_crm_layouts_updated_at ON crm_layouts;
DROP TRIGGER IF EXISTS update_crm_views_updated_at ON crm_views;
DROP TRIGGER IF EXISTS update_crm_records_updated_at ON crm_records;
DROP TRIGGER IF EXISTS update_crm_notes_updated_at ON crm_notes;
DROP TRIGGER IF EXISTS update_crm_tasks_updated_at ON crm_tasks;

CREATE TRIGGER update_crm_modules_updated_at BEFORE UPDATE ON crm_modules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_crm_fields_updated_at BEFORE UPDATE ON crm_fields FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_crm_layouts_updated_at BEFORE UPDATE ON crm_layouts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_crm_views_updated_at BEFORE UPDATE ON crm_views FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_crm_records_updated_at BEFORE UPDATE ON crm_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_crm_notes_updated_at BEFORE UPDATE ON crm_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_crm_tasks_updated_at BEFORE UPDATE ON crm_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DONE! Now run the CRM Seed script separately.
-- ============================================================================
SELECT 'CRM Schema migration complete! Now run supabase/seed/crm_seed.sql to create modules.' as status;

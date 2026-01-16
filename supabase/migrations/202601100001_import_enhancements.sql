-- CRM-ECO: Import System Enhancements Migration
-- Adds field mappings, import snapshots, and enhanced import job tracking

-- ============================================================================
-- FIELD MAPPINGS
-- Stores reusable column mappings per entity type and source (e.g., Zoho CRM)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.field_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  entity_type text NOT NULL CHECK (entity_type IN ('member', 'advisor', 'lead', 'plan', 'membership')),
  source_name text NOT NULL,  -- e.g., 'zoho_crm', 'legacy_system'
  name text NOT NULL,  -- Human-readable name for the mapping
  
  -- Mapping configuration: { "source_column": "target_db_column" }
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Column metadata from source (for UI display)
  source_columns jsonb DEFAULT '[]'::jsonb,
  
  -- Target columns available for this entity type
  target_columns jsonb DEFAULT '[]'::jsonb,
  
  is_default boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(organization_id, entity_type, source_name, name)
);

CREATE INDEX IF NOT EXISTS idx_field_mappings_org ON public.field_mappings(organization_id);
CREATE INDEX IF NOT EXISTS idx_field_mappings_entity_type ON public.field_mappings(entity_type);
CREATE INDEX IF NOT EXISTS idx_field_mappings_source ON public.field_mappings(source_name);

-- ============================================================================
-- IMPORT SNAPSHOTS
-- Stores pre-import state for rollback capability
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.import_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  import_job_id uuid NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  import_job_row_id uuid REFERENCES public.import_job_rows(id) ON DELETE SET NULL,
  
  entity_type text NOT NULL CHECK (entity_type IN ('member', 'advisor', 'lead', 'plan', 'membership')),
  entity_id uuid NOT NULL,
  
  action text NOT NULL CHECK (action IN ('insert', 'update')),
  
  -- State before the import (null for inserts)
  data_before jsonb,
  
  -- State after the import
  data_after jsonb NOT NULL,
  
  -- Rollback status
  is_rolled_back boolean DEFAULT false,
  rolled_back_at timestamptz,
  
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_snapshots_org ON public.import_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_import_snapshots_job ON public.import_snapshots(import_job_id);
CREATE INDEX IF NOT EXISTS idx_import_snapshots_entity ON public.import_snapshots(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_import_snapshots_rollback ON public.import_snapshots(is_rolled_back);

-- ============================================================================
-- IMPORT JOBS ENHANCEMENTS
-- Add columns for preview, incremental, and rollback support
-- ============================================================================
ALTER TABLE public.import_jobs 
  ADD COLUMN IF NOT EXISTS is_preview boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_incremental boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_rollback boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS rollback_status text DEFAULT NULL 
    CHECK (rollback_status IS NULL OR rollback_status IN ('pending', 'in_progress', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS rollback_at timestamptz,
  ADD COLUMN IF NOT EXISTS field_mapping_id uuid REFERENCES public.field_mappings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validation_errors jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS warnings_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duplicate_strategy text DEFAULT 'update' 
    CHECK (duplicate_strategy IN ('skip', 'update', 'error'));

-- ============================================================================
-- IMPORT JOB ROWS ENHANCEMENTS
-- Add columns for detailed validation and linking info
-- ============================================================================
ALTER TABLE public.import_job_rows
  ADD COLUMN IF NOT EXISTS validation_errors jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS warnings jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS linked_entity_ids jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS match_type text DEFAULT NULL
    CHECK (match_type IS NULL OR match_type IN ('new', 'exact_match', 'fuzzy_match', 'duplicate'));

-- ============================================================================
-- UPDATE TRIGGERS
-- ============================================================================
CREATE TRIGGER update_field_mappings_updated_at 
  BEFORE UPDATE ON field_mappings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_snapshots ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- FIELD MAPPINGS POLICIES
-- ============================================================================
CREATE POLICY "Users can view field mappings in their organization"
  ON field_mappings FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage field mappings"
  ON field_mappings FOR ALL
  USING (
    organization_id = get_user_organization_id() 
    AND get_user_role() IN ('owner', 'admin')
  );

-- ============================================================================
-- IMPORT SNAPSHOTS POLICIES
-- ============================================================================
CREATE POLICY "Users can view import snapshots in their organization"
  ON import_snapshots FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "System can create import snapshots"
  ON import_snapshots FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Admins can update import snapshots"
  ON import_snapshots FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- ============================================================================
-- HELPER FUNCTION: Get entity columns for mapping UI
-- ============================================================================
CREATE OR REPLACE FUNCTION get_entity_columns(p_entity_type text)
RETURNS jsonb AS $$
BEGIN
  CASE p_entity_type
    WHEN 'member' THEN
      RETURN jsonb_build_array(
        jsonb_build_object('column', 'first_name', 'label', 'First Name', 'required', true, 'type', 'text'),
        jsonb_build_object('column', 'last_name', 'label', 'Last Name', 'required', true, 'type', 'text'),
        jsonb_build_object('column', 'email', 'label', 'Email', 'required', true, 'type', 'email'),
        jsonb_build_object('column', 'phone', 'label', 'Phone', 'required', false, 'type', 'phone'),
        jsonb_build_object('column', 'date_of_birth', 'label', 'Date of Birth', 'required', false, 'type', 'date'),
        jsonb_build_object('column', 'address_line1', 'label', 'Address Line 1', 'required', false, 'type', 'text'),
        jsonb_build_object('column', 'address_line2', 'label', 'Address Line 2', 'required', false, 'type', 'text'),
        jsonb_build_object('column', 'city', 'label', 'City', 'required', false, 'type', 'text'),
        jsonb_build_object('column', 'state', 'label', 'State', 'required', false, 'type', 'text'),
        jsonb_build_object('column', 'zip_code', 'label', 'ZIP Code', 'required', false, 'type', 'text'),
        jsonb_build_object('column', 'member_number', 'label', 'Member Number', 'required', false, 'type', 'text'),
        jsonb_build_object('column', 'status', 'label', 'Status', 'required', false, 'type', 'select'),
        jsonb_build_object('column', 'gender', 'label', 'Gender', 'required', false, 'type', 'text'),
        jsonb_build_object('column', 'plan_name', 'label', 'Plan Name', 'required', false, 'type', 'text'),
        jsonb_build_object('column', 'plan_type', 'label', 'Plan Type', 'required', false, 'type', 'text'),
        jsonb_build_object('column', 'effective_date', 'label', 'Effective Date', 'required', false, 'type', 'date'),
        jsonb_build_object('column', 'termination_date', 'label', 'Termination Date', 'required', false, 'type', 'date'),
        jsonb_build_object('column', 'monthly_share', 'label', 'Monthly Share', 'required', false, 'type', 'number'),
        jsonb_build_object('column', 'advisor_email', 'label', 'Advisor Email (for linking)', 'required', false, 'type', 'email'),
        jsonb_build_object('column', 'advisor_code', 'label', 'Advisor Code (for linking)', 'required', false, 'type', 'text')
      );
    WHEN 'advisor' THEN
      RETURN jsonb_build_array(
        jsonb_build_object('column', 'first_name', 'label', 'First Name', 'required', true, 'type', 'text'),
        jsonb_build_object('column', 'last_name', 'label', 'Last Name', 'required', true, 'type', 'text'),
        jsonb_build_object('column', 'email', 'label', 'Email', 'required', true, 'type', 'email'),
        jsonb_build_object('column', 'phone', 'label', 'Phone', 'required', false, 'type', 'phone'),
        jsonb_build_object('column', 'license_number', 'label', 'License Number', 'required', false, 'type', 'text'),
        jsonb_build_object('column', 'license_states', 'label', 'License States', 'required', false, 'type', 'text'),
        jsonb_build_object('column', 'status', 'label', 'Status', 'required', false, 'type', 'select'),
        jsonb_build_object('column', 'commission_tier', 'label', 'Commission Tier', 'required', false, 'type', 'text'),
        jsonb_build_object('column', 'advisor_code', 'label', 'Advisor Code', 'required', false, 'type', 'text'),
        jsonb_build_object('column', 'npn', 'label', 'NPN', 'required', false, 'type', 'text'),
        jsonb_build_object('column', 'parent_advisor_email', 'label', 'Parent Advisor Email', 'required', false, 'type', 'email')
      );
    WHEN 'lead' THEN
      RETURN jsonb_build_array(
        jsonb_build_object('column', 'first_name', 'label', 'First Name', 'required', true, 'type', 'text'),
        jsonb_build_object('column', 'last_name', 'label', 'Last Name', 'required', true, 'type', 'text'),
        jsonb_build_object('column', 'email', 'label', 'Email', 'required', true, 'type', 'email'),
        jsonb_build_object('column', 'phone', 'label', 'Phone', 'required', false, 'type', 'phone'),
        jsonb_build_object('column', 'source', 'label', 'Lead Source', 'required', false, 'type', 'text'),
        jsonb_build_object('column', 'status', 'label', 'Status', 'required', false, 'type', 'select'),
        jsonb_build_object('column', 'notes', 'label', 'Notes', 'required', false, 'type', 'text'),
        jsonb_build_object('column', 'state', 'label', 'State', 'required', false, 'type', 'text'),
        jsonb_build_object('column', 'advisor_email', 'label', 'Advisor Email (for linking)', 'required', false, 'type', 'email')
      );
    WHEN 'plan' THEN
      RETURN jsonb_build_array(
        jsonb_build_object('column', 'name', 'label', 'Plan Name', 'required', true, 'type', 'text'),
        jsonb_build_object('column', 'code', 'label', 'Plan Code', 'required', true, 'type', 'text'),
        jsonb_build_object('column', 'description', 'label', 'Description', 'required', false, 'type', 'text'),
        jsonb_build_object('column', 'product_line', 'label', 'Product Line', 'required', false, 'type', 'text'),
        jsonb_build_object('column', 'coverage_category', 'label', 'Coverage Category', 'required', false, 'type', 'text'),
        jsonb_build_object('column', 'monthly_share', 'label', 'Monthly Share', 'required', false, 'type', 'number'),
        jsonb_build_object('column', 'enrollment_fee', 'label', 'Enrollment Fee', 'required', false, 'type', 'number'),
        jsonb_build_object('column', 'iua_amount', 'label', 'IUA Amount', 'required', false, 'type', 'number'),
        jsonb_build_object('column', 'is_active', 'label', 'Is Active', 'required', false, 'type', 'boolean')
      );
    WHEN 'membership' THEN
      RETURN jsonb_build_array(
        jsonb_build_object('column', 'member_email', 'label', 'Member Email (for linking)', 'required', true, 'type', 'email'),
        jsonb_build_object('column', 'member_number', 'label', 'Member Number (for linking)', 'required', false, 'type', 'text'),
        jsonb_build_object('column', 'plan_code', 'label', 'Plan Code (for linking)', 'required', true, 'type', 'text'),
        jsonb_build_object('column', 'membership_number', 'label', 'Membership Number', 'required', false, 'type', 'text'),
        jsonb_build_object('column', 'status', 'label', 'Status', 'required', false, 'type', 'select'),
        jsonb_build_object('column', 'effective_date', 'label', 'Effective Date', 'required', true, 'type', 'date'),
        jsonb_build_object('column', 'end_date', 'label', 'End Date', 'required', false, 'type', 'date'),
        jsonb_build_object('column', 'billing_amount', 'label', 'Billing Amount', 'required', false, 'type', 'number'),
        jsonb_build_object('column', 'advisor_email', 'label', 'Advisor Email (for linking)', 'required', false, 'type', 'email')
      );
    ELSE
      RETURN '[]'::jsonb;
  END CASE;
END;
$$ LANGUAGE plpgsql STABLE;


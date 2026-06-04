-- ============================================================================
-- MODULE 6: Process Management — Pipeline System
-- Creates multi-pipeline support with stage permissions and required fields
-- Extends existing crm_deal_stages with pipeline scoping
-- Existing tables: crm_deal_stages, crm_deal_stage_history
-- ============================================================================

-- ============================================================================
-- 1. CRM PIPELINES — Multi-pipeline registry
-- Each pipeline belongs to an org and is associated with a module
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_pipelines (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id       uuid         REFERENCES crm_modules(id) ON DELETE SET NULL,
  name            text         NOT NULL,
  key             text         NOT NULL,
  description     text,
  pipeline_type   text         NOT NULL DEFAULT 'standard' CHECK (pipeline_type IN (
                    'standard', 'lead', 'enrollment', 'support', 'custom'
                  )),
  is_default      boolean      NOT NULL DEFAULT false,
  is_active       boolean      NOT NULL DEFAULT true,
  color           text         DEFAULT '#6366f1',
  icon            text         DEFAULT 'git-branch',
  display_order   int          NOT NULL DEFAULT 0,
  config          jsonb        NOT NULL DEFAULT '{}',  -- rotting_days, auto_close, etc.
  created_by      uuid         REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT uq_pipelines_org_key
    UNIQUE (organization_id, key)
);

CREATE INDEX IF NOT EXISTS idx_crm_pipelines_org
  ON crm_pipelines(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_pipelines_org_type
  ON crm_pipelines(organization_id, pipeline_type);
CREATE INDEX IF NOT EXISTS idx_crm_pipelines_org_active
  ON crm_pipelines(organization_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_crm_pipelines_org_default
  ON crm_pipelines(organization_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_crm_pipelines_module
  ON crm_pipelines(module_id) WHERE module_id IS NOT NULL;

COMMENT ON TABLE crm_pipelines IS 'Multi-pipeline registry — each pipeline has its own set of stages';
COMMENT ON COLUMN crm_pipelines.pipeline_type IS 'Pipeline category: standard, lead, enrollment, support, custom';
COMMENT ON COLUMN crm_pipelines.config IS 'Pipeline config: {rotting_days, auto_close_after_days, require_reason_on_lost}';

-- ============================================================================
-- 2. CRM PIPELINE STAGES — Stages within a pipeline
-- Extends the concept from crm_deal_stages with pipeline scoping,
-- required fields enforcement, and transition rules
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_pipeline_stages (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id     uuid         NOT NULL REFERENCES crm_pipelines(id) ON DELETE CASCADE,
  organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text         NOT NULL,
  key             text         NOT NULL,
  color           text         DEFAULT '#6366f1',
  probability     int          DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  is_won          boolean      NOT NULL DEFAULT false,
  is_lost         boolean      NOT NULL DEFAULT false,
  display_order   int          NOT NULL DEFAULT 0,
  is_active       boolean      NOT NULL DEFAULT true,
  -- Required fields enforcement
  required_fields text[]       DEFAULT '{}',  -- Field keys that must be filled to enter this stage
  -- Transition rules
  allowed_from    uuid[]       DEFAULT NULL,  -- Stage IDs that can transition to this stage (NULL = any)
  allowed_to      uuid[]       DEFAULT NULL,  -- Stage IDs this stage can transition to (NULL = any)
  -- Stage behavior
  auto_actions    jsonb        DEFAULT '[]',  -- Actions to execute on entry: [{type, config}]
  sla_hours       int,                        -- SLA response time for this stage
  rotting_days    int,                        -- Days before a record in this stage is "rotting"
  metadata        jsonb        DEFAULT '{}',
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT uq_pipeline_stage_key
    UNIQUE (pipeline_id, key),
  CONSTRAINT chk_stage_not_won_and_lost
    CHECK (NOT (is_won AND is_lost))
);

CREATE INDEX IF NOT EXISTS idx_crm_pipeline_stages_pipeline
  ON crm_pipeline_stages(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_crm_pipeline_stages_org
  ON crm_pipeline_stages(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_pipeline_stages_active
  ON crm_pipeline_stages(pipeline_id, is_active, display_order)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_crm_pipeline_stages_org_key
  ON crm_pipeline_stages(organization_id, key);

COMMENT ON TABLE crm_pipeline_stages IS 'Stages within a pipeline with required fields, transition rules, and SLA config';
COMMENT ON COLUMN crm_pipeline_stages.required_fields IS 'Field keys that must have values before a record can enter this stage';
COMMENT ON COLUMN crm_pipeline_stages.allowed_from IS 'Stage IDs allowed to transition INTO this stage (NULL = unrestricted)';
COMMENT ON COLUMN crm_pipeline_stages.allowed_to IS 'Stage IDs this stage can transition TO (NULL = unrestricted)';
COMMENT ON COLUMN crm_pipeline_stages.rotting_days IS 'Days before a record in this stage is flagged as rotting';

-- ============================================================================
-- 3. CRM STAGE PERMISSIONS — Role-based stage access control
-- Controls who can move records into or out of specific stages
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_stage_permissions (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id        uuid         NOT NULL REFERENCES crm_pipeline_stages(id) ON DELETE CASCADE,
  organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Permission target: role name or specific user
  role            text,        -- crm_admin, crm_manager, crm_agent, etc.
  user_id         uuid         REFERENCES profiles(id) ON DELETE CASCADE,
  -- Permission type
  can_enter       boolean      NOT NULL DEFAULT true,  -- Can move records INTO this stage
  can_exit        boolean      NOT NULL DEFAULT true,  -- Can move records OUT OF this stage
  can_edit        boolean      NOT NULL DEFAULT true,  -- Can edit records IN this stage
  can_delete      boolean      NOT NULL DEFAULT false, -- Can delete records IN this stage
  -- Metadata
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT chk_stage_perm_target
    CHECK (role IS NOT NULL OR user_id IS NOT NULL),
  CONSTRAINT uq_stage_perm_role
    UNIQUE (stage_id, role) DEFERRABLE,
  CONSTRAINT uq_stage_perm_user
    UNIQUE (stage_id, user_id) DEFERRABLE
);

CREATE INDEX IF NOT EXISTS idx_crm_stage_perms_stage
  ON crm_stage_permissions(stage_id);
CREATE INDEX IF NOT EXISTS idx_crm_stage_perms_org
  ON crm_stage_permissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_stage_perms_role
  ON crm_stage_permissions(role) WHERE role IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_stage_perms_user
  ON crm_stage_permissions(user_id) WHERE user_id IS NOT NULL;

COMMENT ON TABLE crm_stage_permissions IS 'Role or user-based permissions for pipeline stages — controls who can enter/exit/edit at each stage';

-- ============================================================================
-- 4. LINK EXISTING crm_deal_stages TO PIPELINES
-- Add pipeline_id column to crm_deal_stages for backward compatibility
-- ============================================================================
ALTER TABLE crm_deal_stages
  ADD COLUMN IF NOT EXISTS pipeline_id uuid REFERENCES crm_pipelines(id) ON DELETE SET NULL;

ALTER TABLE crm_deal_stages
  ADD COLUMN IF NOT EXISTS required_fields text[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_crm_deal_stages_pipeline
  ON crm_deal_stages(pipeline_id) WHERE pipeline_id IS NOT NULL;

COMMENT ON COLUMN crm_deal_stages.pipeline_id IS 'Optional link to crm_pipelines for multi-pipeline support';
COMMENT ON COLUMN crm_deal_stages.required_fields IS 'Field keys required before entering this stage';

-- ============================================================================
-- 5. VALIDATE REQUIRED FIELDS FUNCTION
-- Checks if a record has all required fields for a target stage
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_validate_stage_required_fields(
  p_record_id uuid,
  p_stage_id uuid,
  p_use_pipeline_stages boolean DEFAULT true
)
RETURNS TABLE(field_key text, is_missing boolean) AS $$
DECLARE
  v_required text[];
  v_record_data jsonb;
BEGIN
  -- Get required fields from appropriate stage table
  IF p_use_pipeline_stages THEN
    SELECT ps.required_fields INTO v_required
    FROM crm_pipeline_stages ps WHERE ps.id = p_stage_id;
  ELSE
    SELECT ds.required_fields INTO v_required
    FROM crm_deal_stages ds WHERE ds.id = p_stage_id;
  END IF;

  -- No required fields → return empty
  IF v_required IS NULL OR array_length(v_required, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Get record data
  SELECT r.data INTO v_record_data
  FROM crm_records r WHERE r.id = p_record_id;

  IF v_record_data IS NULL THEN
    v_record_data := '{}'::jsonb;
  END IF;

  -- Check each required field
  RETURN QUERY
  SELECT
    f.field_key,
    (v_record_data ->> f.field_key IS NULL OR trim(v_record_data ->> f.field_key) = '')
  FROM unnest(v_required) AS f(field_key);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION fn_validate_stage_required_fields IS
  'Validates that a record has all required fields for entering a pipeline stage';

-- ============================================================================
-- 6. CHECK STAGE TRANSITION PERMISSION
-- Validates if a user/role can transition to a target stage
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_check_stage_permission(
  p_user_id uuid,
  p_user_role text,
  p_stage_id uuid,
  p_permission_type text DEFAULT 'enter'  -- 'enter', 'exit', 'edit', 'delete'
)
RETURNS boolean AS $$
DECLARE
  v_has_permission boolean := false;
  v_perm_count int;
BEGIN
  -- Count total permissions for this stage
  SELECT count(*) INTO v_perm_count
  FROM crm_stage_permissions WHERE stage_id = p_stage_id;

  -- If no permissions are defined, stage is unrestricted
  IF v_perm_count = 0 THEN
    RETURN true;
  END IF;

  -- Check user-specific permission
  SELECT CASE p_permission_type
    WHEN 'enter' THEN can_enter
    WHEN 'exit' THEN can_exit
    WHEN 'edit' THEN can_edit
    WHEN 'delete' THEN can_delete
    ELSE false
  END INTO v_has_permission
  FROM crm_stage_permissions
  WHERE stage_id = p_stage_id AND user_id = p_user_id;

  IF v_has_permission IS NOT NULL THEN
    RETURN v_has_permission;
  END IF;

  -- Check role-based permission
  SELECT CASE p_permission_type
    WHEN 'enter' THEN can_enter
    WHEN 'exit' THEN can_exit
    WHEN 'edit' THEN can_edit
    WHEN 'delete' THEN can_delete
    ELSE false
  END INTO v_has_permission
  FROM crm_stage_permissions
  WHERE stage_id = p_stage_id AND role = p_user_role;

  RETURN COALESCE(v_has_permission, false);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION fn_check_stage_permission IS
  'Checks if a user/role has a specific permission for a pipeline stage';

-- ============================================================================
-- 7. GET PIPELINE WITH STAGES — convenience function
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_get_pipeline_stages(
  p_pipeline_id uuid
)
RETURNS TABLE(
  stage_id uuid,
  stage_name text,
  stage_key text,
  color text,
  probability int,
  is_won boolean,
  is_lost boolean,
  display_order int,
  required_fields text[],
  sla_hours int,
  rotting_days int
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.key,
    s.color,
    s.probability,
    s.is_won,
    s.is_lost,
    s.display_order,
    s.required_fields,
    s.sla_hours,
    s.rotting_days
  FROM crm_pipeline_stages s
  WHERE s.pipeline_id = p_pipeline_id
    AND s.is_active = true
  ORDER BY s.display_order ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION fn_get_pipeline_stages IS
  'Get active stages for a pipeline in display order';

-- ============================================================================
-- 8. SEED DEFAULT PIPELINES FUNCTION
-- Creates Lead, Enrollment, and Support Case pipelines with stages
-- ============================================================================
CREATE OR REPLACE FUNCTION seed_default_pipelines(p_org_id uuid)
RETURNS void AS $$
DECLARE
  v_lead_pipeline_id uuid;
  v_enrollment_pipeline_id uuid;
  v_support_pipeline_id uuid;
  v_caller_id uuid;
BEGIN
  -- Verify caller belongs to org
  SELECT id INTO v_caller_id
  FROM profiles WHERE user_id = auth.uid() AND organization_id = p_org_id;
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: caller does not belong to this organization';
  END IF;

  -- Only seed if no pipelines exist
  IF EXISTS (SELECT 1 FROM crm_pipelines WHERE organization_id = p_org_id) THEN
    RETURN;
  END IF;

  -- ── Lead Pipeline ────────────────────────────────────────────────────
  INSERT INTO crm_pipelines (organization_id, name, key, pipeline_type, is_default, color, icon, display_order, created_by)
  VALUES (p_org_id, 'Lead Pipeline', 'lead_pipeline', 'lead', true, '#8b5cf6', 'user-plus', 1, v_caller_id)
  RETURNING id INTO v_lead_pipeline_id;

  INSERT INTO crm_pipeline_stages (pipeline_id, organization_id, name, key, color, probability, display_order, required_fields) VALUES
    (v_lead_pipeline_id, p_org_id, 'New Lead',       'new_lead',       '#94a3b8', 5,  1, '{}'),
    (v_lead_pipeline_id, p_org_id, 'Contacted',      'contacted',      '#8b5cf6', 15, 2, ARRAY['phone','email']),
    (v_lead_pipeline_id, p_org_id, 'Qualified',      'qualified',      '#6366f1', 35, 3, ARRAY['phone','email','source']),
    (v_lead_pipeline_id, p_org_id, 'Proposal Sent',  'proposal_sent',  '#3b82f6', 60, 4, ARRAY['phone','email','source']),
    (v_lead_pipeline_id, p_org_id, 'Converted',      'converted',      '#22c55e', 100, 5, ARRAY['phone','email','source']),
    (v_lead_pipeline_id, p_org_id, 'Disqualified',   'disqualified',   '#ef4444', 0,  6, '{}');

  UPDATE crm_pipeline_stages SET is_won = true WHERE pipeline_id = v_lead_pipeline_id AND key = 'converted';
  UPDATE crm_pipeline_stages SET is_lost = true WHERE pipeline_id = v_lead_pipeline_id AND key = 'disqualified';

  -- ── Enrollment Pipeline ──────────────────────────────────────────────
  INSERT INTO crm_pipelines (organization_id, name, key, pipeline_type, color, icon, display_order, created_by)
  VALUES (p_org_id, 'Enrollment Pipeline', 'enrollment_pipeline', 'enrollment', '#0ea5e9', 'clipboard-check', 2, v_caller_id)
  RETURNING id INTO v_enrollment_pipeline_id;

  INSERT INTO crm_pipeline_stages (pipeline_id, organization_id, name, key, color, probability, display_order, required_fields) VALUES
    (v_enrollment_pipeline_id, p_org_id, 'Application Received', 'application_received', '#94a3b8', 10, 1, ARRAY['first_name','last_name','email']),
    (v_enrollment_pipeline_id, p_org_id, 'Documents Review',     'documents_review',     '#f59e0b', 25, 2, ARRAY['first_name','last_name','email','date_of_birth']),
    (v_enrollment_pipeline_id, p_org_id, 'Underwriting',         'underwriting',         '#8b5cf6', 50, 3, ARRAY['first_name','last_name','email','date_of_birth','ssn_last4']),
    (v_enrollment_pipeline_id, p_org_id, 'Approval Pending',     'approval_pending',     '#3b82f6', 75, 4, ARRAY['first_name','last_name','email','date_of_birth']),
    (v_enrollment_pipeline_id, p_org_id, 'Enrolled',             'enrolled',             '#22c55e', 100, 5, ARRAY['first_name','last_name','email','date_of_birth','plan_id']),
    (v_enrollment_pipeline_id, p_org_id, 'Declined',             'declined',             '#ef4444', 0,  6, '{}');

  UPDATE crm_pipeline_stages SET is_won = true WHERE pipeline_id = v_enrollment_pipeline_id AND key = 'enrolled';
  UPDATE crm_pipeline_stages SET is_lost = true WHERE pipeline_id = v_enrollment_pipeline_id AND key = 'declined';

  -- ── Support Case Pipeline ───────────────────────────────────────────
  INSERT INTO crm_pipelines (organization_id, name, key, pipeline_type, color, icon, display_order, created_by)
  VALUES (p_org_id, 'Support Case Pipeline', 'support_pipeline', 'support', '#f59e0b', 'life-buoy', 3, v_caller_id)
  RETURNING id INTO v_support_pipeline_id;

  INSERT INTO crm_pipeline_stages (pipeline_id, organization_id, name, key, color, probability, display_order, required_fields, sla_hours) VALUES
    (v_support_pipeline_id, p_org_id, 'Open',        'open',        '#ef4444', 0,  1, ARRAY['subject','description'], 4),
    (v_support_pipeline_id, p_org_id, 'In Progress',  'in_progress', '#f59e0b', 25, 2, ARRAY['subject','description','assigned_to'], 8),
    (v_support_pipeline_id, p_org_id, 'Waiting',      'waiting',     '#94a3b8', 50, 3, '{}', 24),
    (v_support_pipeline_id, p_org_id, 'Escalated',    'escalated',   '#dc2626', 50, 4, ARRAY['subject','description','assigned_to','escalation_reason'], 2),
    (v_support_pipeline_id, p_org_id, 'Resolved',     'resolved',    '#22c55e', 100, 5, ARRAY['subject','description','resolution'], NULL),
    (v_support_pipeline_id, p_org_id, 'Closed',       'closed',      '#64748b', 100, 6, '{}', NULL);

  UPDATE crm_pipeline_stages SET is_won = true WHERE pipeline_id = v_support_pipeline_id AND key IN ('resolved', 'closed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION seed_default_pipelines(uuid) TO authenticated;

COMMENT ON FUNCTION seed_default_pipelines IS
  'Seeds default Lead, Enrollment, and Support Case pipelines with stages for a new organization';

-- ============================================================================
-- 9. AUDIT TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_audit_pipeline_changes()
RETURNS trigger AS $$
BEGIN
  INSERT INTO unified_audit_logs (
    organization_id, app_source, actor_id,
    action, action_category, risk_level, details, changes
  ) VALUES (
    COALESCE(NEW.organization_id, OLD.organization_id),
    'crm',
    COALESCE(
      (SELECT id FROM profiles WHERE user_id = (SELECT auth.uid()) LIMIT 1),
      NULL
    ),
    TG_TABLE_NAME || '.' || lower(TG_OP),
    'process',
    CASE
      WHEN TG_TABLE_NAME = 'crm_stage_permissions' THEN 'high'
      WHEN TG_OP = 'DELETE' THEN 'high'
      ELSE 'medium'
    END,
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'entity_name', CASE
        WHEN TG_TABLE_NAME = 'crm_pipelines' THEN COALESCE(NEW.name, OLD.name)
        WHEN TG_TABLE_NAME = 'crm_pipeline_stages' THEN COALESCE(NEW.name, OLD.name)
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

CREATE TRIGGER trg_audit_crm_pipelines
  AFTER INSERT OR UPDATE OR DELETE ON crm_pipelines
  FOR EACH ROW EXECUTE FUNCTION fn_audit_pipeline_changes();

CREATE TRIGGER trg_audit_crm_pipeline_stages
  AFTER INSERT OR UPDATE OR DELETE ON crm_pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION fn_audit_pipeline_changes();

CREATE TRIGGER trg_audit_crm_stage_permissions
  AFTER INSERT OR UPDATE OR DELETE ON crm_stage_permissions
  FOR EACH ROW EXECUTE FUNCTION fn_audit_pipeline_changes();

-- ============================================================================
-- 10. UPDATED_AT TRIGGERS
-- ============================================================================
CREATE TRIGGER update_crm_pipelines_updated_at
  BEFORE UPDATE ON crm_pipelines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_pipeline_stages_updated_at
  BEFORE UPDATE ON crm_pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_stage_permissions_updated_at
  BEFORE UPDATE ON crm_stage_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 11. ROW LEVEL SECURITY
-- ============================================================================

-- ── crm_pipelines: org-scoped read, admin/manager write ──────────────
ALTER TABLE crm_pipelines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pipelines_select" ON crm_pipelines;
CREATE POLICY "pipelines_select" ON crm_pipelines
  FOR SELECT TO authenticated
  USING (is_crm_member(organization_id));

DROP POLICY IF EXISTS "pipelines_admin_insert" ON crm_pipelines;
CREATE POLICY "pipelines_admin_insert" ON crm_pipelines
  FOR INSERT TO authenticated
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "pipelines_admin_update" ON crm_pipelines;
CREATE POLICY "pipelines_admin_update" ON crm_pipelines
  FOR UPDATE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']))
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "pipelines_admin_delete" ON crm_pipelines;
CREATE POLICY "pipelines_admin_delete" ON crm_pipelines
  FOR DELETE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "pipelines_service" ON crm_pipelines;
CREATE POLICY "pipelines_service" ON crm_pipelines
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── crm_pipeline_stages: org-scoped read, admin/manager write ────────
ALTER TABLE crm_pipeline_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pipeline_stages_select" ON crm_pipeline_stages;
CREATE POLICY "pipeline_stages_select" ON crm_pipeline_stages
  FOR SELECT TO authenticated
  USING (is_crm_member(organization_id));

DROP POLICY IF EXISTS "pipeline_stages_admin_insert" ON crm_pipeline_stages;
CREATE POLICY "pipeline_stages_admin_insert" ON crm_pipeline_stages
  FOR INSERT TO authenticated
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "pipeline_stages_admin_update" ON crm_pipeline_stages;
CREATE POLICY "pipeline_stages_admin_update" ON crm_pipeline_stages
  FOR UPDATE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']))
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "pipeline_stages_admin_delete" ON crm_pipeline_stages;
CREATE POLICY "pipeline_stages_admin_delete" ON crm_pipeline_stages
  FOR DELETE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "pipeline_stages_service" ON crm_pipeline_stages;
CREATE POLICY "pipeline_stages_service" ON crm_pipeline_stages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── crm_stage_permissions: admin only ────────────────────────────────
ALTER TABLE crm_stage_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stage_perms_select" ON crm_stage_permissions;
CREATE POLICY "stage_perms_select" ON crm_stage_permissions
  FOR SELECT TO authenticated
  USING (is_crm_member(organization_id));

DROP POLICY IF EXISTS "stage_perms_admin_insert" ON crm_stage_permissions;
CREATE POLICY "stage_perms_admin_insert" ON crm_stage_permissions
  FOR INSERT TO authenticated
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "stage_perms_admin_update" ON crm_stage_permissions;
CREATE POLICY "stage_perms_admin_update" ON crm_stage_permissions
  FOR UPDATE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']))
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "stage_perms_admin_delete" ON crm_stage_permissions;
CREATE POLICY "stage_perms_admin_delete" ON crm_stage_permissions
  FOR DELETE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "stage_perms_service" ON crm_stage_permissions;
CREATE POLICY "stage_perms_service" ON crm_stage_permissions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Service role on crm_deal_stages (existing table) ─────────────────
DROP POLICY IF EXISTS "deal_stages_service" ON crm_deal_stages;
CREATE POLICY "deal_stages_service" ON crm_deal_stages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "deal_stage_history_service" ON crm_deal_stage_history;
CREATE POLICY "deal_stage_history_service" ON crm_deal_stage_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- END MODULE 6
-- ============================================================================

-- ============================================================================
-- MODULE 5: Workflow Automation Engine
-- Extends existing workflow infrastructure with:
--   - field_value_changed trigger type
--   - crm_workflow_triggers normalized trigger definitions
--   - Audit triggers on workflow configuration changes
--   - Service role bypass policies
-- Existing tables: crm_workflows, crm_workflow_steps, crm_workflow_run_logs,
--   crm_automation_runs, crm_macros, crm_scheduler_jobs, crm_macro_runs
-- ============================================================================

-- ============================================================================
-- 1. EXTEND TRIGGER TYPES — add field_value_changed
-- ============================================================================
ALTER TABLE crm_workflows
  DROP CONSTRAINT IF EXISTS crm_workflows_trigger_type_check;

ALTER TABLE crm_workflows
  ADD CONSTRAINT crm_workflows_trigger_type_check
  CHECK (trigger_type IN (
    'on_create', 'on_update', 'on_stage_change',
    'field_value_changed', 'scheduled', 'webform', 'inbound_webhook'
  ));

COMMENT ON COLUMN crm_workflows.trigger_type IS
  'Trigger types: on_create, on_update, on_stage_change, field_value_changed, scheduled, webform, inbound_webhook';

-- ============================================================================
-- 2. CRM WORKFLOW TRIGGERS — Normalized trigger definitions
-- Allows multiple triggers per workflow and reusable trigger templates
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_workflow_triggers (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id     uuid         NOT NULL REFERENCES crm_workflows(id) ON DELETE CASCADE,
  organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  trigger_type    text         NOT NULL CHECK (trigger_type IN (
                    'on_create', 'on_update', 'on_stage_change',
                    'field_value_changed', 'scheduled', 'webform', 'inbound_webhook'
                  )),
  name            text,        -- Optional label: "When email changes", "Daily at 9am"
  config          jsonb        NOT NULL DEFAULT '{}',
  -- field_value_changed specifics
  watch_fields    text[],      -- Fields to monitor for changes
  from_value      text,        -- Optional: only fire when old value matches
  to_value        text,        -- Optional: only fire when new value matches
  -- scheduling
  cron_expression text,        -- For scheduled triggers
  timezone        text         DEFAULT 'UTC',
  -- state
  is_enabled      boolean      NOT NULL DEFAULT true,
  last_fired_at   timestamptz,
  fire_count      bigint       NOT NULL DEFAULT 0,
  -- metadata
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_wf_triggers_workflow
  ON crm_workflow_triggers(workflow_id);
CREATE INDEX IF NOT EXISTS idx_crm_wf_triggers_org
  ON crm_workflow_triggers(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_wf_triggers_type
  ON crm_workflow_triggers(trigger_type) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_crm_wf_triggers_scheduled
  ON crm_workflow_triggers(cron_expression)
  WHERE trigger_type = 'scheduled' AND is_enabled = true AND cron_expression IS NOT NULL;

COMMENT ON TABLE crm_workflow_triggers IS
  'Normalized trigger definitions for workflows — supports multiple triggers per workflow';
COMMENT ON COLUMN crm_workflow_triggers.watch_fields IS
  'For field_value_changed: array of field keys to monitor for changes';
COMMENT ON COLUMN crm_workflow_triggers.cron_expression IS
  'For scheduled triggers: cron expression (e.g., 0 9 * * 1 = every Monday 9am)';

-- ============================================================================
-- 3. SEED TRIGGERS FROM EXISTING WORKFLOWS
-- Back-populate crm_workflow_triggers from inline trigger_config
-- ============================================================================
INSERT INTO crm_workflow_triggers (workflow_id, organization_id, trigger_type, config, is_enabled)
SELECT
  w.id,
  w.org_id,
  w.trigger_type,
  w.trigger_config,
  w.is_enabled
FROM crm_workflows w
WHERE NOT EXISTS (
  SELECT 1 FROM crm_workflow_triggers t WHERE t.workflow_id = w.id
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. AUDIT TRIGGERS — log workflow configuration changes
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_audit_workflow_changes()
RETURNS trigger AS $$
BEGIN
  INSERT INTO unified_audit_logs (
    organization_id, app_source, actor_id,
    action, action_category, risk_level, details, changes
  ) VALUES (
    COALESCE(
      CASE WHEN TG_TABLE_NAME IN ('crm_workflows', 'crm_macros', 'crm_assignment_rules', 'crm_scoring_rules', 'crm_cadences', 'crm_sla_policies')
        THEN COALESCE(NEW.org_id, OLD.org_id)
        ELSE NULL
      END,
      CASE WHEN TG_TABLE_NAME = 'crm_workflow_triggers'
        THEN COALESCE(NEW.organization_id, OLD.organization_id)
        ELSE NULL
      END,
      -- For crm_workflow_steps, look up the org from the parent workflow
      (SELECT w.org_id FROM crm_workflows w WHERE w.id = COALESCE(NEW.workflow_id, OLD.workflow_id) LIMIT 1)
    ),
    'crm',
    COALESCE(
      (SELECT id FROM profiles WHERE user_id = (SELECT auth.uid()) LIMIT 1),
      NULL
    ),
    TG_TABLE_NAME || '.' || lower(TG_OP),
    'automation',
    CASE
      WHEN TG_TABLE_NAME = 'crm_workflows' AND TG_OP = 'DELETE' THEN 'high'
      WHEN TG_TABLE_NAME = 'crm_workflows' THEN 'medium'
      ELSE 'low'
    END,
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'entity_name', CASE
        WHEN TG_TABLE_NAME = 'crm_workflows' THEN COALESCE(NEW.name, OLD.name)
        WHEN TG_TABLE_NAME = 'crm_macros' THEN COALESCE(NEW.name, OLD.name)
        WHEN TG_TABLE_NAME = 'crm_assignment_rules' THEN COALESCE(NEW.name, OLD.name)
        WHEN TG_TABLE_NAME = 'crm_scoring_rules' THEN COALESCE(NEW.name, OLD.name)
        WHEN TG_TABLE_NAME = 'crm_cadences' THEN COALESCE(NEW.name, OLD.name)
        WHEN TG_TABLE_NAME = 'crm_sla_policies' THEN COALESCE(NEW.name, OLD.name)
        WHEN TG_TABLE_NAME = 'crm_workflow_triggers' THEN COALESCE(NEW.name, OLD.name, 'trigger')
        WHEN TG_TABLE_NAME = 'crm_workflow_steps' THEN COALESCE(NEW.name, OLD.name, 'step')
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

COMMENT ON FUNCTION fn_audit_workflow_changes IS
  'Audit trigger for all workflow/automation configuration changes → unified_audit_logs';

-- Apply audit triggers to all automation tables
CREATE TRIGGER trg_audit_crm_workflows
  AFTER INSERT OR UPDATE OR DELETE ON crm_workflows
  FOR EACH ROW EXECUTE FUNCTION fn_audit_workflow_changes();

CREATE TRIGGER trg_audit_crm_workflow_steps
  AFTER INSERT OR UPDATE OR DELETE ON crm_workflow_steps
  FOR EACH ROW EXECUTE FUNCTION fn_audit_workflow_changes();

CREATE TRIGGER trg_audit_crm_workflow_triggers
  AFTER INSERT OR UPDATE OR DELETE ON crm_workflow_triggers
  FOR EACH ROW EXECUTE FUNCTION fn_audit_workflow_changes();

CREATE TRIGGER trg_audit_crm_macros
  AFTER INSERT OR UPDATE OR DELETE ON crm_macros
  FOR EACH ROW EXECUTE FUNCTION fn_audit_workflow_changes();

CREATE TRIGGER trg_audit_crm_assignment_rules
  AFTER INSERT OR UPDATE OR DELETE ON crm_assignment_rules
  FOR EACH ROW EXECUTE FUNCTION fn_audit_workflow_changes();

CREATE TRIGGER trg_audit_crm_scoring_rules
  AFTER INSERT OR UPDATE OR DELETE ON crm_scoring_rules
  FOR EACH ROW EXECUTE FUNCTION fn_audit_workflow_changes();

CREATE TRIGGER trg_audit_crm_cadences
  AFTER INSERT OR UPDATE OR DELETE ON crm_cadences
  FOR EACH ROW EXECUTE FUNCTION fn_audit_workflow_changes();

CREATE TRIGGER trg_audit_crm_sla_policies
  AFTER INSERT OR UPDATE OR DELETE ON crm_sla_policies
  FOR EACH ROW EXECUTE FUNCTION fn_audit_workflow_changes();

-- ============================================================================
-- 5. UPDATED_AT TRIGGER for workflow_triggers
-- ============================================================================
CREATE TRIGGER update_crm_workflow_triggers_updated_at
  BEFORE UPDATE ON crm_workflow_triggers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. INCREMENT FIRE COUNT — helper for trigger execution tracking
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_record_trigger_fired(p_trigger_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE crm_workflow_triggers
  SET fire_count = fire_count + 1,
      last_fired_at = now()
  WHERE id = p_trigger_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION fn_record_trigger_fired IS
  'Atomically increment fire count and update last_fired_at for a workflow trigger';

-- ============================================================================
-- 7. FIELD VALUE CHANGE DETECTION HELPER
-- Compares old and new record data JSONB to detect field changes
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_detect_field_changes(
  p_old_data jsonb,
  p_new_data jsonb,
  p_watch_fields text[]
)
RETURNS TABLE(field_key text, old_value text, new_value text) AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.field_key,
    (p_old_data ->> f.field_key)::text,
    (p_new_data ->> f.field_key)::text
  FROM unnest(p_watch_fields) AS f(field_key)
  WHERE (p_old_data ->> f.field_key) IS DISTINCT FROM (p_new_data ->> f.field_key);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION fn_detect_field_changes IS
  'Detects which watched fields changed between old and new record data JSONB';

-- ============================================================================
-- 8. GET MATCHING TRIGGERS — find workflow triggers that match a record event
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_get_matching_workflow_triggers(
  p_org_id uuid,
  p_module_id uuid,
  p_trigger_type text,
  p_watch_fields text[] DEFAULT NULL
)
RETURNS TABLE(
  trigger_id uuid,
  workflow_id uuid,
  trigger_type text,
  config jsonb,
  watch_fields text[],
  from_value text,
  to_value text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.workflow_id,
    t.trigger_type,
    t.config,
    t.watch_fields,
    t.from_value,
    t.to_value
  FROM crm_workflow_triggers t
  JOIN crm_workflows w ON w.id = t.workflow_id
  WHERE w.org_id = p_org_id
    AND w.module_id = p_module_id
    AND w.is_enabled = true
    AND t.is_enabled = true
    AND t.trigger_type = p_trigger_type
    AND (
      -- For field_value_changed, check if any watched fields overlap
      p_trigger_type != 'field_value_changed'
      OR p_watch_fields IS NULL
      OR t.watch_fields IS NULL
      OR t.watch_fields && p_watch_fields  -- array overlap operator
    )
  ORDER BY w.priority ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION fn_get_matching_workflow_triggers IS
  'Find enabled workflow triggers matching org, module, and trigger type';

-- ============================================================================
-- 9. ROW LEVEL SECURITY — crm_workflow_triggers
-- ============================================================================
ALTER TABLE crm_workflow_triggers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wf_triggers_select" ON crm_workflow_triggers;
CREATE POLICY "wf_triggers_select" ON crm_workflow_triggers
  FOR SELECT TO authenticated
  USING (is_crm_member(organization_id));

DROP POLICY IF EXISTS "wf_triggers_admin_insert" ON crm_workflow_triggers;
CREATE POLICY "wf_triggers_admin_insert" ON crm_workflow_triggers
  FOR INSERT TO authenticated
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "wf_triggers_admin_update" ON crm_workflow_triggers;
CREATE POLICY "wf_triggers_admin_update" ON crm_workflow_triggers
  FOR UPDATE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']))
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "wf_triggers_admin_delete" ON crm_workflow_triggers;
CREATE POLICY "wf_triggers_admin_delete" ON crm_workflow_triggers
  FOR DELETE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "wf_triggers_service" ON crm_workflow_triggers;
CREATE POLICY "wf_triggers_service" ON crm_workflow_triggers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 10. SERVICE ROLE BYPASS POLICIES — add to existing automation tables
-- These are additive; existing authenticated policies remain unchanged
-- ============================================================================

-- crm_workflows
DROP POLICY IF EXISTS "workflows_service" ON crm_workflows;
CREATE POLICY "workflows_service" ON crm_workflows
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- crm_workflow_steps
DROP POLICY IF EXISTS "workflow_steps_service" ON crm_workflow_steps;
CREATE POLICY "workflow_steps_service" ON crm_workflow_steps
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- crm_workflow_run_logs
DROP POLICY IF EXISTS "workflow_run_logs_service" ON crm_workflow_run_logs;
CREATE POLICY "workflow_run_logs_service" ON crm_workflow_run_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- crm_automation_runs
DROP POLICY IF EXISTS "automation_runs_service" ON crm_automation_runs;
CREATE POLICY "automation_runs_service" ON crm_automation_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- crm_macros
DROP POLICY IF EXISTS "macros_service" ON crm_macros;
CREATE POLICY "macros_service" ON crm_macros
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- crm_macro_runs
DROP POLICY IF EXISTS "macro_runs_service" ON crm_macro_runs;
CREATE POLICY "macro_runs_service" ON crm_macro_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- crm_scheduler_jobs
DROP POLICY IF EXISTS "scheduler_jobs_service" ON crm_scheduler_jobs;
CREATE POLICY "scheduler_jobs_service" ON crm_scheduler_jobs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- crm_assignment_rules
DROP POLICY IF EXISTS "assignment_rules_service" ON crm_assignment_rules;
CREATE POLICY "assignment_rules_service" ON crm_assignment_rules
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- crm_scoring_rules
DROP POLICY IF EXISTS "scoring_rules_service" ON crm_scoring_rules;
CREATE POLICY "scoring_rules_service" ON crm_scoring_rules
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- crm_cadences
DROP POLICY IF EXISTS "cadences_service" ON crm_cadences;
CREATE POLICY "cadences_service" ON crm_cadences
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- crm_cadence_enrollments
DROP POLICY IF EXISTS "cadence_enrollments_service" ON crm_cadence_enrollments;
CREATE POLICY "cadence_enrollments_service" ON crm_cadence_enrollments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- crm_sla_policies
DROP POLICY IF EXISTS "sla_policies_service" ON crm_sla_policies;
CREATE POLICY "sla_policies_service" ON crm_sla_policies
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- crm_webforms
DROP POLICY IF EXISTS "webforms_service" ON crm_webforms;
CREATE POLICY "webforms_service" ON crm_webforms
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- crm_notifications
DROP POLICY IF EXISTS "notifications_service" ON crm_notifications;
CREATE POLICY "notifications_service" ON crm_notifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- END MODULE 5
-- ============================================================================

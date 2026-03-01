-- =============================================================================
-- Create missing tables and RPC functions found during full audit:
-- 1. crm_user_preferences — per-user module view preferences
-- 2. crm_tags — organization-level tag definitions
-- 3. crm_record_tags — junction table linking tags to CRM records
-- 4. automation_rules — workflow automation rules engine
-- 5. shift_sequence_steps() — RPC to shift step order in email sequences
-- 6. increment_sequence_completed() — RPC to increment completed count
-- 7. increment_template_usage() — RPC to increment template usage count
-- =============================================================================

-- ===================== 1. crm_user_preferences ===============================

CREATE TABLE IF NOT EXISTS crm_user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, org_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_crm_user_prefs_user_org
  ON crm_user_preferences(user_id, org_id);

ALTER TABLE crm_user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON crm_user_preferences FOR SELECT
  USING (org_id = (SELECT get_user_organization_id()));

CREATE POLICY "Users can insert own preferences"
  ON crm_user_preferences FOR INSERT
  WITH CHECK (
    org_id = (SELECT get_user_organization_id())
    AND user_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Users can update own preferences"
  ON crm_user_preferences FOR UPDATE
  USING (
    org_id = (SELECT get_user_organization_id())
    AND user_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Users can delete own preferences"
  ON crm_user_preferences FOR DELETE
  USING (
    org_id = (SELECT get_user_organization_id())
    AND user_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE TRIGGER update_crm_user_preferences_updated_at
  BEFORE UPDATE ON crm_user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================== 2. crm_tags ===========================================

CREATE TABLE IF NOT EXISTS crm_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  module_key text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_tags_org ON crm_tags(org_id);
CREATE INDEX IF NOT EXISTS idx_crm_tags_org_module ON crm_tags(org_id, module_key);

ALTER TABLE crm_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tags in their org"
  ON crm_tags FOR SELECT
  USING (org_id = (SELECT get_user_organization_id()));

CREATE POLICY "Users can create tags in their org"
  ON crm_tags FOR INSERT
  WITH CHECK (org_id = (SELECT get_user_organization_id()));

CREATE POLICY "Users can update tags in their org"
  ON crm_tags FOR UPDATE
  USING (org_id = (SELECT get_user_organization_id()));

CREATE POLICY "Users can delete tags in their org"
  ON crm_tags FOR DELETE
  USING (org_id = (SELECT get_user_organization_id()));

-- ===================== 3. crm_record_tags ====================================

CREATE TABLE IF NOT EXISTS crm_record_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES crm_records(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES crm_tags(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(record_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_record_tags_record ON crm_record_tags(record_id);
CREATE INDEX IF NOT EXISTS idx_crm_record_tags_tag ON crm_record_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_crm_record_tags_org ON crm_record_tags(org_id);

ALTER TABLE crm_record_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view record tags in their org"
  ON crm_record_tags FOR SELECT
  USING (org_id = (SELECT get_user_organization_id()));

CREATE POLICY "Users can add record tags in their org"
  ON crm_record_tags FOR INSERT
  WITH CHECK (org_id = (SELECT get_user_organization_id()));

CREATE POLICY "Users can remove record tags in their org"
  ON crm_record_tags FOR DELETE
  USING (org_id = (SELECT get_user_organization_id()));

-- ===================== 4. automation_rules ===================================

CREATE TABLE IF NOT EXISTS automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL,
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  conditions jsonb DEFAULT '{"match": "all", "rules": []}'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  run_count int DEFAULT 0,
  last_run_at timestamptz,
  last_run_status text,
  error_count int DEFAULT 0,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_org ON automation_rules(org_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_active
  ON automation_rules(org_id, is_active) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger ON automation_rules(trigger_type);

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view automation rules in their org"
  ON automation_rules FOR SELECT
  USING (org_id = (SELECT get_user_organization_id()));

CREATE POLICY "Admins can create automation rules"
  ON automation_rules FOR INSERT
  WITH CHECK (
    org_id = (SELECT get_user_organization_id())
    AND (SELECT get_user_role()) IN ('owner', 'admin')
  );

CREATE POLICY "Admins can update automation rules"
  ON automation_rules FOR UPDATE
  USING (
    org_id = (SELECT get_user_organization_id())
    AND (SELECT get_user_role()) IN ('owner', 'admin')
  );

CREATE POLICY "Admins can delete automation rules"
  ON automation_rules FOR DELETE
  USING (
    org_id = (SELECT get_user_organization_id())
    AND (SELECT get_user_role()) IN ('owner', 'admin')
  );

CREATE TRIGGER update_automation_rules_updated_at
  BEFORE UPDATE ON automation_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================== 5. shift_sequence_steps RPC ===========================
-- Shifts step_order of all steps >= p_from_order up by 1 to make room for insertion

CREATE OR REPLACE FUNCTION public.shift_sequence_steps(
  p_sequence_id uuid,
  p_from_order int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE email_sequence_steps
  SET step_order = step_order + 1
  WHERE sequence_id = p_sequence_id
    AND step_order >= p_from_order;
END;
$$;

-- ===================== 6. increment_sequence_completed RPC ===================
-- Increments total_completed on an email sequence by 1

CREATE OR REPLACE FUNCTION public.increment_sequence_completed(
  sequence_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE email_sequences
  SET total_completed = COALESCE(total_completed, 0) + 1
  WHERE id = sequence_id;
END;
$$;

-- ===================== 7. increment_template_usage RPC =======================
-- Increments usage_count on a message template by 1

CREATE OR REPLACE FUNCTION public.increment_template_usage(
  template_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE crm_message_templates
  SET usage_count = COALESCE(usage_count, 0) + 1
  WHERE id = template_id;
END;
$$;

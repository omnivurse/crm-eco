-- ============================================================================
-- MODULE: Advisor Contact Hierarchy
-- Advisor-based client segmentation with reporting views
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Table — crm_advisors
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_advisors (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
  advisor_name     text         NOT NULL,
  agency_name      text,
  state            text,
  is_active        boolean      NOT NULL DEFAULT true,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  crm_advisors IS 'CRM advisors for client segmentation and reporting';
COMMENT ON COLUMN crm_advisors.user_id IS 'Optional link to auth user for portal access';
COMMENT ON COLUMN crm_advisors.advisor_name IS 'Display name of the advisor';
COMMENT ON COLUMN crm_advisors.agency_name IS 'Agency or brokerage the advisor belongs to';
COMMENT ON COLUMN crm_advisors.state IS 'Primary operating state';

-- ----------------------------------------------------------------------------
-- 2. Indexes — crm_advisors
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_crm_advisors_org
  ON crm_advisors (organization_id);

CREATE INDEX IF NOT EXISTS idx_crm_advisors_user
  ON crm_advisors (user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_advisors_state
  ON crm_advisors (organization_id, state) WHERE state IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. Auto-update trigger — crm_advisors
-- ----------------------------------------------------------------------------
CREATE TRIGGER update_crm_advisors_updated_at
  BEFORE UPDATE ON crm_advisors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 4. Audit trigger — crm_advisors
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_crm_advisors()
RETURNS trigger AS $$
BEGIN
  INSERT INTO unified_audit_logs (
    organization_id, app_source, actor_id,
    action, action_category, risk_level, details, changes
  ) VALUES (
    COALESCE(NEW.organization_id, OLD.organization_id),
    'crm',
    COALESCE(NEW.user_id, OLD.user_id),
    CASE TG_OP
      WHEN 'INSERT' THEN 'advisor_created'
      WHEN 'UPDATE' THEN 'advisor_updated'
      WHEN 'DELETE' THEN 'advisor_deleted'
    END,
    'advisor_management',
    'medium',
    jsonb_build_object(
      'advisor_name', COALESCE(NEW.advisor_name, OLD.advisor_name),
      'agency_name', COALESCE(NEW.agency_name, OLD.agency_name)
    ),
    CASE TG_OP
      WHEN 'INSERT' THEN jsonb_build_object('new', row_to_json(NEW))
      WHEN 'UPDATE' THEN jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW))
      WHEN 'DELETE' THEN jsonb_build_object('old', row_to_json(OLD))
    END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_audit_crm_advisors
  AFTER INSERT OR UPDATE OR DELETE ON crm_advisors
  FOR EACH ROW EXECUTE FUNCTION fn_audit_crm_advisors();

-- ----------------------------------------------------------------------------
-- 5. RLS — crm_advisors
-- ----------------------------------------------------------------------------
ALTER TABLE crm_advisors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_advisors_select_member" ON crm_advisors;
CREATE POLICY "crm_advisors_select_member" ON crm_advisors
  FOR SELECT TO authenticated
  USING (is_crm_member(organization_id));

DROP POLICY IF EXISTS "crm_advisors_insert_manager" ON crm_advisors;
CREATE POLICY "crm_advisors_insert_manager" ON crm_advisors
  FOR INSERT TO authenticated
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "crm_advisors_update_manager" ON crm_advisors;
CREATE POLICY "crm_advisors_update_manager" ON crm_advisors
  FOR UPDATE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']))
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

DROP POLICY IF EXISTS "crm_advisors_delete_admin" ON crm_advisors;
CREATE POLICY "crm_advisors_delete_admin" ON crm_advisors
  FOR DELETE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "crm_advisors_service" ON crm_advisors;
CREATE POLICY "crm_advisors_service" ON crm_advisors
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 6. Extend crm_records — advisor_id + contact_type
-- ============================================================================
ALTER TABLE crm_records
  ADD COLUMN IF NOT EXISTS advisor_id    uuid REFERENCES crm_advisors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contact_type  text;

COMMENT ON COLUMN crm_records.advisor_id IS 'Assigned CRM advisor for this contact record';
COMMENT ON COLUMN crm_records.contact_type IS 'Contact classification: lead, member, or former_member';

-- Constrain contact_type values
DO $$ BEGIN
  ALTER TABLE crm_records
    ADD CONSTRAINT chk_crm_records_contact_type
    CHECK (contact_type IS NULL OR contact_type IN ('lead', 'member', 'former_member'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 7. Indexes — contacts by advisor
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_contacts_advisor
  ON crm_records (org_id, advisor_id) WHERE advisor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_contact_type
  ON crm_records (org_id, contact_type) WHERE contact_type IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 8. Reporting view — advisor_contact_summary
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW advisor_contact_summary AS
SELECT
  a.id                                      AS advisor_id,
  a.organization_id,
  a.advisor_name,
  a.agency_name,
  a.state,
  a.is_active                               AS advisor_active,
  COUNT(r.id)                               AS total_contacts,
  COUNT(r.id) FILTER (WHERE r.contact_type = 'member')        AS active_members,
  COUNT(r.id) FILTER (WHERE r.contact_type = 'former_member') AS inactive_members,
  COUNT(r.id) FILTER (WHERE r.contact_type = 'lead')          AS leads,
  COUNT(r.id) FILTER (WHERE r.created_at >= date_trunc('month', now())) AS contacts_this_month
FROM crm_advisors a
LEFT JOIN crm_records r
  ON r.advisor_id = a.id
GROUP BY a.id, a.organization_id, a.advisor_name, a.agency_name, a.state, a.is_active;

COMMENT ON VIEW advisor_contact_summary IS 'Aggregated contact stats per advisor for dashboard widgets';

-- ============================================================================
-- END MODULE: Advisor Contact Hierarchy
-- ============================================================================

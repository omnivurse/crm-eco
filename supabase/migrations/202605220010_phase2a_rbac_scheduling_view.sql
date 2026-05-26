-- =========================================================================
-- Phase 2A — RBAC v2 + scheduling_bookings + advisor_contact_summary VIEW
--           + crm_import_jobs extensions
--
-- After Phase 3 (migration 009), 27 BLOCKER findings remained, all of them
-- "Missing tables" or "Missing RPCs". This migration ships the client's
-- final Phase 2A decisions:
--
--   • BUILD RBAC v2 (custom roles + SSO before enrollment season)
--   • BUILD scheduling_bookings (public /book/[slug] is otherwise broken)
--   • BUILD advisor_contact_summary as a VIEW (5-line cost)
--   • BUILD download tracking on crm_import_jobs (so exports/mass-ops
--     reuse the existing import-jobs infrastructure)
--
-- All operations are idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS /
-- CREATE OR REPLACE) so re-running is safe.
-- =========================================================================

BEGIN;

-- =========================================================================
-- SECTION 1 — RBAC v2: roles, permissions, SSO, trusted domains, login audit
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1.1 crm_roles — per-org and system roles
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_roles (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid         REFERENCES organizations(id) ON DELETE CASCADE,
  key             text         NOT NULL,
  name            text         NOT NULL,
  description     text,
  is_system       boolean      DEFAULT false,
  created_at      timestamptz  DEFAULT now(),
  updated_at      timestamptz  DEFAULT now()
);

-- Org-scoped unique constraint (null org_id means "system template")
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_crm_roles_org_key'
  ) THEN
    ALTER TABLE crm_roles ADD CONSTRAINT uq_crm_roles_org_key
      UNIQUE (organization_id, key);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_roles_org ON crm_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_roles_key ON crm_roles(key);

COMMENT ON TABLE crm_roles IS 'Per-org CRM role definitions (RBAC v2). NULL organization_id rows are system templates.';

-- -------------------------------------------------------------------------
-- 1.2 crm_user_roles — assignment of users to roles
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_user_roles (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id    uuid        NOT NULL REFERENCES crm_roles(id) ON DELETE CASCADE,
  granted_by uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_user_roles_user ON crm_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_user_roles_role ON crm_user_roles(role_id);

-- -------------------------------------------------------------------------
-- 1.3 crm_permissions — global catalog of granular permission keys
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_permissions (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text         NOT NULL UNIQUE,
  name        text         NOT NULL,
  description text,
  module      text,
  category    text         NOT NULL DEFAULT 'general'
                CHECK (category IN (
                  'general','records','modules','fields','reports',
                  'automation','admin','security','import_export','api'
                )),
  is_system   boolean      DEFAULT true,
  created_at  timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_permissions_module   ON crm_permissions(module);
CREATE INDEX IF NOT EXISTS idx_crm_permissions_category ON crm_permissions(category);

COMMENT ON TABLE crm_permissions IS 'Granular permission catalog for CRM RBAC v2 (org-agnostic).';

-- -------------------------------------------------------------------------
-- 1.4 crm_role_permissions — many-to-many mapping
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_role_permissions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id       uuid        NOT NULL REFERENCES crm_roles(id) ON DELETE CASCADE,
  permission_id uuid        NOT NULL REFERENCES crm_permissions(id) ON DELETE CASCADE,
  granted_at    timestamptz DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_role_perms_role ON crm_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_crm_role_perms_perm ON crm_role_permissions(permission_id);

-- -------------------------------------------------------------------------
-- 1.5 crm_login_history — per-org login/session audit trail
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_login_history (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id      uuid         REFERENCES profiles(id) ON DELETE SET NULL,
  event_type      text         NOT NULL CHECK (event_type IN (
                      'login_success','login_failed','logout',
                      'session_expired','password_changed',
                      'mfa_enrolled','mfa_verified','mfa_failed'
                    )),
  ip_address      inet,
  user_agent      text,
  location        jsonb,
  device_info     jsonb,
  risk_score      smallint     DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  metadata        jsonb        DEFAULT '{}'::jsonb,
  created_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_login_history_org_date
  ON crm_login_history(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_login_history_user_date
  ON crm_login_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_login_history_event
  ON crm_login_history(event_type, created_at DESC);

COMMENT ON TABLE crm_login_history IS 'CRM-specific login/session audit trail. Prune after 90 days via pg_cron.';

-- -------------------------------------------------------------------------
-- 1.6 crm_trusted_domains — email-domain allowlist per org
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_trusted_domains (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  domain          text         NOT NULL,
  is_verified     boolean      DEFAULT false,
  auto_approve    boolean      DEFAULT false,
  added_by        uuid         REFERENCES profiles(id) ON DELETE SET NULL,
  verified_at     timestamptz,
  created_at      timestamptz  DEFAULT now(),
  UNIQUE(organization_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_crm_trusted_domains_org
  ON crm_trusted_domains(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_trusted_domains_domain
  ON crm_trusted_domains(domain);

-- -------------------------------------------------------------------------
-- 1.7 crm_sso_config — SSO provider configuration per org
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_sso_config (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider        text         NOT NULL CHECK (provider IN (
                      'saml','oidc','google','microsoft','okta','auth0','custom'
                    )),
  display_name    text,
  is_enabled      boolean      DEFAULT false,
  config          jsonb        NOT NULL DEFAULT '{}'::jsonb,
  metadata_url    text,
  client_id       text,
  enforce_sso     boolean      DEFAULT false,
  allowed_domains text[]       DEFAULT '{}',
  created_by      uuid         REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz  DEFAULT now(),
  updated_at      timestamptz  DEFAULT now(),
  UNIQUE(organization_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_crm_sso_config_org
  ON crm_sso_config(organization_id);

-- -------------------------------------------------------------------------
-- 1.8 Seed system roles (NULL organization_id = template; orgs can copy)
-- -------------------------------------------------------------------------
INSERT INTO crm_roles (key, name, description, is_system, organization_id) VALUES
  ('ceo',     'CEO',     'Executive access — full visibility across all modules', true, NULL),
  ('admin',   'Admin',   'Full CRM administration including settings and user management', true, NULL),
  ('manager', 'Manager', 'Team management, records, and reporting access', true, NULL),
  ('advisor', 'Advisor', 'Standard record access for daily advisor operations', true, NULL),
  ('support', 'Support', 'Read-only access with limited write for support tickets', true, NULL)
ON CONFLICT (organization_id, key) DO NOTHING;

-- -------------------------------------------------------------------------
-- 1.9 Seed catalog of permissions
-- -------------------------------------------------------------------------
INSERT INTO crm_permissions (key, name, description, module, category) VALUES
  ('records.read',        'Read Records',         'View CRM records',                    NULL, 'records'),
  ('records.create',      'Create Records',       'Create new CRM records',              NULL, 'records'),
  ('records.update',      'Update Records',       'Edit existing CRM records',           NULL, 'records'),
  ('records.delete',      'Delete Records',       'Delete CRM records',                  NULL, 'records'),
  ('records.bulk_update', 'Bulk Update',          'Perform bulk operations on records',  NULL, 'records'),
  ('records.export',      'Export Records',       'Export CRM data',                     NULL, 'import_export'),
  ('records.import',      'Import Records',       'Import data into CRM',                NULL, 'import_export'),
  ('modules.manage',      'Manage Modules',       'Enable/disable/configure modules',    NULL, 'modules'),
  ('fields.manage',       'Manage Fields',        'Add/edit/remove custom fields',       NULL, 'fields'),
  ('reports.view',        'View Reports',         'Access CRM reports',                  NULL, 'reports'),
  ('reports.create',      'Create Reports',       'Build custom reports',                NULL, 'reports'),
  ('automation.manage',   'Manage Automation',    'Create/edit workflows and rules',     NULL, 'automation'),
  ('automation.execute',  'Execute Automation',   'Trigger manual workflow runs',        NULL, 'automation'),
  ('admin.settings',      'System Settings',      'Modify system configuration',         NULL, 'admin'),
  ('admin.users',         'User Management',      'Manage CRM users and roles',          NULL, 'admin'),
  ('admin.audit',         'View Audit Logs',      'Access audit trail',                  NULL, 'security'),
  ('admin.security',      'Security Settings',    'Manage security policies and SSO',    NULL, 'security'),
  ('api.manage',          'Manage API Keys',      'Create and revoke API keys',          NULL, 'api'),
  ('api.webhooks',        'Manage Webhooks',      'Configure webhook endpoints',         NULL, 'api')
ON CONFLICT (key) DO NOTHING;

-- -------------------------------------------------------------------------
-- 1.10 Seed role → permission mappings
-- -------------------------------------------------------------------------
-- Insert role-permission mappings via a single SQL statement so we don't
-- have to deal with cursors. Each mapping joins the seeded role (NULL org
-- = system template) to the matching permission by key.
WITH role_perm_pairs (role_key, perm_key) AS (
  VALUES
    -- CEO / Admin: all 19 permissions
    ('ceo',     'records.read'),        ('ceo',     'records.create'),
    ('ceo',     'records.update'),      ('ceo',     'records.delete'),
    ('ceo',     'records.bulk_update'), ('ceo',     'records.export'),
    ('ceo',     'records.import'),      ('ceo',     'modules.manage'),
    ('ceo',     'fields.manage'),       ('ceo',     'reports.view'),
    ('ceo',     'reports.create'),      ('ceo',     'automation.manage'),
    ('ceo',     'automation.execute'),  ('ceo',     'admin.settings'),
    ('ceo',     'admin.users'),         ('ceo',     'admin.audit'),
    ('ceo',     'admin.security'),      ('ceo',     'api.manage'),
    ('ceo',     'api.webhooks'),
    ('admin',   'records.read'),        ('admin',   'records.create'),
    ('admin',   'records.update'),      ('admin',   'records.delete'),
    ('admin',   'records.bulk_update'), ('admin',   'records.export'),
    ('admin',   'records.import'),      ('admin',   'modules.manage'),
    ('admin',   'fields.manage'),       ('admin',   'reports.view'),
    ('admin',   'reports.create'),      ('admin',   'automation.manage'),
    ('admin',   'automation.execute'),  ('admin',   'admin.settings'),
    ('admin',   'admin.users'),         ('admin',   'admin.audit'),
    ('admin',   'admin.security'),      ('admin',   'api.manage'),
    ('admin',   'api.webhooks'),
    -- Manager
    ('manager', 'records.read'),        ('manager', 'records.create'),
    ('manager', 'records.update'),      ('manager', 'records.delete'),
    ('manager', 'records.bulk_update'), ('manager', 'records.export'),
    ('manager', 'reports.view'),        ('manager', 'reports.create'),
    ('manager', 'automation.execute'),
    -- Advisor (default for most field users)
    ('advisor', 'records.read'),        ('advisor', 'records.create'),
    ('advisor', 'records.update'),      ('advisor', 'reports.view'),
    -- Support
    ('support', 'records.read'),        ('support', 'records.create'),
    ('support', 'records.update'),      ('support', 'reports.view')
)
INSERT INTO crm_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   role_perm_pairs rpp
JOIN   crm_roles       r ON r.key = rpp.role_key AND r.organization_id IS NULL
JOIN   crm_permissions p ON p.key = rpp.perm_key
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------------------------
-- 1.11 has_crm_permission(user_id, permission_key) helper
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION has_crm_permission(p_user_id uuid, p_permission_key text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM crm_user_roles ur
    JOIN crm_role_permissions rp ON rp.role_id = ur.role_id
    JOIN crm_permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = p_user_id
      AND p.key = p_permission_key
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

COMMENT ON FUNCTION has_crm_permission IS 'Check if a user has a specific granular permission via their assigned roles.';

-- -------------------------------------------------------------------------
-- 1.12 Audit trigger: log security-table changes to unified_audit_logs
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_security_changes()
RETURNS trigger AS $$
DECLARE
  v_org_id uuid;
  v_actor_id uuid;
BEGIN
  -- Resolve the organization for the log entry
  v_org_id := COALESCE(
    CASE WHEN TG_TABLE_NAME = 'crm_user_roles' THEN
      (SELECT organization_id FROM profiles
       WHERE user_id = COALESCE(NEW.user_id, OLD.user_id) LIMIT 1)
    ELSE COALESCE(NEW.organization_id, OLD.organization_id)
    END,
    '00000000-0000-0000-0000-000000000000'::uuid
  );

  SELECT id INTO v_actor_id FROM profiles
    WHERE user_id = (SELECT auth.uid()) LIMIT 1;

  INSERT INTO unified_audit_logs (
    organization_id, app_source, actor_id,
    action, action_category, risk_level, details, changes
  ) VALUES (
    v_org_id, 'crm', v_actor_id,
    TG_TABLE_NAME || '.' || lower(TG_OP),
    'authorization',
    'high',
    jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP),
    CASE TG_OP
      WHEN 'INSERT' THEN jsonb_build_object('new', row_to_json(NEW)::jsonb)
      WHEN 'UPDATE' THEN jsonb_build_object('old', row_to_json(OLD)::jsonb, 'new', row_to_json(NEW)::jsonb)
      WHEN 'DELETE' THEN jsonb_build_object('old', row_to_json(OLD)::jsonb)
    END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_audit_crm_roles ON crm_roles;
CREATE TRIGGER trg_audit_crm_roles
  AFTER INSERT OR UPDATE OR DELETE ON crm_roles
  FOR EACH ROW EXECUTE FUNCTION fn_audit_security_changes();

DROP TRIGGER IF EXISTS trg_audit_crm_user_roles ON crm_user_roles;
CREATE TRIGGER trg_audit_crm_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON crm_user_roles
  FOR EACH ROW EXECUTE FUNCTION fn_audit_security_changes();

DROP TRIGGER IF EXISTS trg_audit_crm_trusted_domains ON crm_trusted_domains;
CREATE TRIGGER trg_audit_crm_trusted_domains
  AFTER INSERT OR UPDATE OR DELETE ON crm_trusted_domains
  FOR EACH ROW EXECUTE FUNCTION fn_audit_security_changes();

DROP TRIGGER IF EXISTS trg_audit_crm_sso_config ON crm_sso_config;
CREATE TRIGGER trg_audit_crm_sso_config
  AFTER INSERT OR UPDATE OR DELETE ON crm_sso_config
  FOR EACH ROW EXECUTE FUNCTION fn_audit_security_changes();

-- -------------------------------------------------------------------------
-- 1.13 RLS policies
-- -------------------------------------------------------------------------
-- crm_roles
ALTER TABLE crm_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_roles_select" ON crm_roles;
CREATE POLICY "crm_roles_select" ON crm_roles
  FOR SELECT TO authenticated
  USING (organization_id IS NULL OR is_crm_member(organization_id));

DROP POLICY IF EXISTS "crm_roles_admin" ON crm_roles;
CREATE POLICY "crm_roles_admin" ON crm_roles
  FOR ALL TO authenticated
  USING (
    organization_id IS NOT NULL
    AND has_crm_role(organization_id, ARRAY['crm_admin'])
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND has_crm_role(organization_id, ARRAY['crm_admin'])
  );

DROP POLICY IF EXISTS "crm_roles_service" ON crm_roles;
CREATE POLICY "crm_roles_service" ON crm_roles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- crm_user_roles
ALTER TABLE crm_user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_user_roles_select" ON crm_user_roles;
CREATE POLICY "crm_user_roles_select" ON crm_user_roles
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "crm_user_roles_admin" ON crm_user_roles;
CREATE POLICY "crm_user_roles_admin" ON crm_user_roles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm_roles r
      WHERE r.id = role_id
        AND r.organization_id IS NOT NULL
        AND has_crm_role(r.organization_id, ARRAY['crm_admin'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM crm_roles r
      WHERE r.id = role_id
        AND r.organization_id IS NOT NULL
        AND has_crm_role(r.organization_id, ARRAY['crm_admin'])
    )
  );

DROP POLICY IF EXISTS "crm_user_roles_service" ON crm_user_roles;
CREATE POLICY "crm_user_roles_service" ON crm_user_roles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- crm_permissions (read-only catalog for authenticated)
ALTER TABLE crm_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perms_select_authenticated" ON crm_permissions;
CREATE POLICY "perms_select_authenticated" ON crm_permissions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "perms_admin_manage" ON crm_permissions;
CREATE POLICY "perms_admin_manage" ON crm_permissions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- crm_role_permissions
ALTER TABLE crm_role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_perms_select" ON crm_role_permissions;
CREATE POLICY "role_perms_select" ON crm_role_permissions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "role_perms_admin_write" ON crm_role_permissions;
CREATE POLICY "role_perms_admin_write" ON crm_role_permissions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm_roles r
      WHERE r.id = role_id
        AND r.organization_id IS NOT NULL
        AND has_crm_role(r.organization_id, ARRAY['crm_admin'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM crm_roles r
      WHERE r.id = role_id
        AND r.organization_id IS NOT NULL
        AND has_crm_role(r.organization_id, ARRAY['crm_admin'])
    )
  );

DROP POLICY IF EXISTS "role_perms_service" ON crm_role_permissions;
CREATE POLICY "role_perms_service" ON crm_role_permissions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- crm_login_history
ALTER TABLE crm_login_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "login_history_select" ON crm_login_history;
CREATE POLICY "login_history_select" ON crm_login_history
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR has_crm_role(organization_id, ARRAY['crm_admin'])
  );

DROP POLICY IF EXISTS "login_history_insert" ON crm_login_history;
CREATE POLICY "login_history_insert" ON crm_login_history
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "login_history_service" ON crm_login_history;
CREATE POLICY "login_history_service" ON crm_login_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- crm_trusted_domains
ALTER TABLE crm_trusted_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trusted_domains_select" ON crm_trusted_domains;
CREATE POLICY "trusted_domains_select" ON crm_trusted_domains
  FOR SELECT TO authenticated USING (is_crm_member(organization_id));

DROP POLICY IF EXISTS "trusted_domains_admin" ON crm_trusted_domains;
CREATE POLICY "trusted_domains_admin" ON crm_trusted_domains
  FOR ALL TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']))
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "trusted_domains_service" ON crm_trusted_domains;
CREATE POLICY "trusted_domains_service" ON crm_trusted_domains
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- crm_sso_config
ALTER TABLE crm_sso_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sso_config_select" ON crm_sso_config;
CREATE POLICY "sso_config_select" ON crm_sso_config
  FOR SELECT TO authenticated USING (is_crm_member(organization_id));

DROP POLICY IF EXISTS "sso_config_admin" ON crm_sso_config;
CREATE POLICY "sso_config_admin" ON crm_sso_config
  FOR ALL TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']))
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "sso_config_service" ON crm_sso_config;
CREATE POLICY "sso_config_service" ON crm_sso_config
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- -------------------------------------------------------------------------
-- 1.14 updated_at triggers
-- -------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_crm_roles_updated_at ON crm_roles;
CREATE TRIGGER update_crm_roles_updated_at
  BEFORE UPDATE ON crm_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_crm_sso_config_updated_at ON crm_sso_config;
CREATE TRIGGER update_crm_sso_config_updated_at
  BEFORE UPDATE ON crm_sso_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =========================================================================
-- SECTION 2 — scheduling_bookings (public /book/[slug] page)
-- =========================================================================
CREATE TABLE IF NOT EXISTS scheduling_bookings (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  link_id          uuid         NOT NULL REFERENCES scheduling_links(id) ON DELETE CASCADE,
  host_id          uuid         REFERENCES profiles(id) ON DELETE SET NULL,
  invitee_name     text         NOT NULL,
  invitee_email    text         NOT NULL,
  invitee_phone    text,
  invitee_timezone text,
  start_time       timestamptz  NOT NULL,
  end_time         timestamptz  NOT NULL,
  meeting_type     text,
  location         text,
  status           text         NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled','confirmed','cancelled','no_show','completed')),
  notes            text,
  custom_answers   jsonb        DEFAULT '{}'::jsonb,
  created_at       timestamptz  DEFAULT now(),
  updated_at       timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scheduling_bookings_link_time_idx
  ON scheduling_bookings(link_id, start_time);
CREATE INDEX IF NOT EXISTS scheduling_bookings_org_idx
  ON scheduling_bookings(org_id, start_time DESC);
CREATE INDEX IF NOT EXISTS scheduling_bookings_invitee_email_idx
  ON scheduling_bookings(lower(invitee_email));

ALTER TABLE scheduling_bookings ENABLE ROW LEVEL SECURITY;

-- Public anon INSERT — but only against active scheduling_links
DROP POLICY IF EXISTS "scheduling_bookings_public_insert" ON scheduling_bookings;
CREATE POLICY "scheduling_bookings_public_insert" ON scheduling_bookings
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM scheduling_links sl
      WHERE sl.id = scheduling_bookings.link_id
        AND sl.is_active = true
        AND sl.org_id   = scheduling_bookings.org_id
    )
  );

-- Authenticated INSERT also allowed (host re-creating a booking)
DROP POLICY IF EXISTS "scheduling_bookings_auth_insert" ON scheduling_bookings;
CREATE POLICY "scheduling_bookings_auth_insert" ON scheduling_bookings
  FOR INSERT TO authenticated
  WITH CHECK (is_crm_member(org_id));

-- Org members can read all bookings for their org
DROP POLICY IF EXISTS "scheduling_bookings_org_select" ON scheduling_bookings;
CREATE POLICY "scheduling_bookings_org_select" ON scheduling_bookings
  FOR SELECT TO authenticated
  USING (is_crm_member(org_id));

-- Org members can update bookings (e.g. mark cancelled/completed)
DROP POLICY IF EXISTS "scheduling_bookings_org_update" ON scheduling_bookings;
CREATE POLICY "scheduling_bookings_org_update" ON scheduling_bookings
  FOR UPDATE TO authenticated
  USING (is_crm_member(org_id))
  WITH CHECK (is_crm_member(org_id));

-- Org admins can delete
DROP POLICY IF EXISTS "scheduling_bookings_admin_delete" ON scheduling_bookings;
CREATE POLICY "scheduling_bookings_admin_delete" ON scheduling_bookings
  FOR DELETE TO authenticated
  USING (has_crm_role(org_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "scheduling_bookings_service" ON scheduling_bookings;
CREATE POLICY "scheduling_bookings_service" ON scheduling_bookings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS update_scheduling_bookings_updated_at ON scheduling_bookings;
CREATE TRIGGER update_scheduling_bookings_updated_at
  BEFORE UPDATE ON scheduling_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE scheduling_bookings IS
  'Bookings made via /book/[slug] public booking page. Joins to scheduling_links for host info.';


-- =========================================================================
-- SECTION 3 — advisor_contact_summary VIEW
-- =========================================================================
-- Aggregated per-advisor counts of leads/members for the advisor management
-- admin page. Implemented as a VIEW so it stays in sync automatically.
CREATE OR REPLACE VIEW advisor_contact_summary AS
SELECT
  a.organization_id,
  a.id           AS advisor_id,
  a.full_name,
  a.email,
  a.state,
  a.is_active    AS advisor_active,
  COUNT(DISTINCT l.id)                                  AS total_leads,
  COUNT(DISTINCT m.id)                                  AS total_members,
  COUNT(DISTINCT l.id) + COUNT(DISTINCT m.id)           AS total_contacts,
  MAX(GREATEST(
    COALESCE(l.created_at, '1900-01-01'::timestamptz),
    COALESCE(m.created_at, '1900-01-01'::timestamptz)
  ))                                                    AS last_contact_at
FROM advisors a
LEFT JOIN leads   l ON l.advisor_id   = a.id
LEFT JOIN members m ON m.advisor_id   = a.id
GROUP BY a.organization_id, a.id, a.full_name, a.email, a.state, a.is_active;

COMMENT ON VIEW advisor_contact_summary IS
  'Per-advisor aggregate of leads + members. Backs the advisor admin page and POST /api/crm/advisors/summary.';


-- =========================================================================
-- SECTION 4 — crm_import_jobs extensions (now also used for exports + mass-ops)
-- =========================================================================
-- Add download_url + expires_at so export jobs can publish a signed download
-- link, and so mass-operation jobs can publish a report file.
ALTER TABLE crm_import_jobs
  ADD COLUMN IF NOT EXISTS download_url text,
  ADD COLUMN IF NOT EXISTS expires_at   timestamptz;

-- Allow NULL module_id so the table can also track exports/mass-ops that
-- span multiple modules (or "all modules"). The original schema required
-- module_id only because it was originally CSV-import only.
ALTER TABLE crm_import_jobs ALTER COLUMN module_id DROP NOT NULL;

-- Note: crm_import_jobs.source_type is plain `text` (no CHECK constraint),
-- so the route layer can write 'csv_import', 'export_csv', 'export_xlsx',
-- 'export_json', 'mass_update', 'mass_delete' freely.

COMMENT ON COLUMN crm_import_jobs.download_url IS
  'Optional signed URL produced by export / mass-op jobs. Expires per expires_at.';

COMMIT;

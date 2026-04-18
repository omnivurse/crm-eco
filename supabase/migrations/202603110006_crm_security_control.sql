-- ============================================================================
-- MODULE 2: Security Control System
-- Role-based access, granular permissions, login tracking, trusted domains, SSO
-- ============================================================================

-- ============================================================================
-- 1. PROMOTE crm_roles WITH ORG-SCOPING
-- The migrations_temp version lacks organization_id. This migration creates
-- the table properly if it doesn't exist, or adds the column if it does.
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_roles (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid         REFERENCES organizations(id) ON DELETE CASCADE,
  key             text         NOT NULL,
  name            text         NOT NULL,
  description     text,
  permissions     jsonb        DEFAULT '[]'::jsonb,
  is_system       boolean      DEFAULT false,
  created_at      timestamptz  DEFAULT now(),
  updated_at      timestamptz  DEFAULT now()
);

-- Add org_id column if the table was created earlier without it
ALTER TABLE crm_roles ADD COLUMN IF NOT EXISTS organization_id uuid
  REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE crm_roles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Drop old unique constraint and add org-scoped one
ALTER TABLE crm_roles DROP CONSTRAINT IF EXISTS crm_roles_key_key;
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

-- ============================================================================
-- 2. PROMOTE crm_user_roles
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_user_roles (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id     uuid        NOT NULL REFERENCES crm_roles(id) ON DELETE CASCADE,
  granted_by  uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_user_roles_user ON crm_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_user_roles_role ON crm_user_roles(role_id);

-- ============================================================================
-- 3. CRM PERMISSIONS — Granular permission definitions
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_permissions (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text         NOT NULL UNIQUE,
  name        text         NOT NULL,
  description text,
  module      text,            -- which CRM module this applies to (null = global)
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

COMMENT ON TABLE crm_permissions IS 'Granular permission definitions for CRM RBAC';

-- ============================================================================
-- 4. CRM ROLE-PERMISSIONS — Junction table
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_role_permissions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id       uuid        NOT NULL REFERENCES crm_roles(id) ON DELETE CASCADE,
  permission_id uuid        NOT NULL REFERENCES crm_permissions(id) ON DELETE CASCADE,
  granted_at    timestamptz DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_role_perms_role ON crm_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_crm_role_perms_perm ON crm_role_permissions(permission_id);

COMMENT ON TABLE crm_role_permissions IS 'Maps permissions to roles (many-to-many)';

-- ============================================================================
-- 5. CRM LOGIN HISTORY — CRM-specific login/session tracking
-- ============================================================================
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
  location        jsonb,          -- {country, region, city}
  device_info     jsonb,          -- parsed UA: {browser, os, device}
  risk_score      smallint     DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  metadata        jsonb        DEFAULT '{}',
  created_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_login_history_org_date
  ON crm_login_history(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_login_history_user_date
  ON crm_login_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_login_history_event
  ON crm_login_history(event_type, created_at DESC);

-- Partition-friendly: auto-prune after 90 days via pg_cron or edge function
COMMENT ON TABLE crm_login_history IS 'CRM-specific login/session audit trail';

-- ============================================================================
-- 6. CRM TRUSTED DOMAINS — Email domain allowlisting
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_trusted_domains (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  domain          text         NOT NULL,
  is_verified     boolean      DEFAULT false,
  auto_approve    boolean      DEFAULT false,  -- auto-approve signups from domain
  added_by        uuid         REFERENCES profiles(id) ON DELETE SET NULL,
  verified_at     timestamptz,
  created_at      timestamptz  DEFAULT now(),
  UNIQUE(organization_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_crm_trusted_domains_org
  ON crm_trusted_domains(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_trusted_domains_domain
  ON crm_trusted_domains(domain);

COMMENT ON TABLE crm_trusted_domains IS 'Allowlisted email domains per org for signup/SSO';

-- ============================================================================
-- 7. CRM SSO CONFIG — SSO provider configuration
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_sso_config (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider        text         NOT NULL CHECK (provider IN (
                      'saml','oidc','google','microsoft','okta','auth0','custom'
                    )),
  display_name    text,
  is_enabled      boolean      DEFAULT false,
  config          jsonb        NOT NULL DEFAULT '{}',  -- provider-specific config
  metadata_url    text,                                 -- SAML metadata URL
  client_id       text,                                 -- OIDC client ID
  -- client_secret stored encrypted in config jsonb
  enforce_sso     boolean      DEFAULT false,           -- disable password login
  allowed_domains text[]       DEFAULT '{}',            -- restrict SSO to these domains
  created_by      uuid         REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz  DEFAULT now(),
  updated_at      timestamptz  DEFAULT now(),
  UNIQUE(organization_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_crm_sso_config_org
  ON crm_sso_config(organization_id);

COMMENT ON TABLE crm_sso_config IS 'SSO provider configuration per organization';

-- ============================================================================
-- 8. SEED DHH ROLES (global system roles, org_id NULL = template)
-- ============================================================================
INSERT INTO crm_roles (key, name, description, permissions, is_system, organization_id) VALUES
  ('ceo',     'CEO',       'Executive access — full visibility across all modules',
   '["read","write","delete","manage_users","manage_settings","view_audit","view_reports","manage_billing"]'::jsonb,
   true, NULL),
  ('admin',   'Admin',     'Full CRM administration including settings and user management',
   '["read","write","delete","manage_users","manage_settings","view_audit","view_reports"]'::jsonb,
   true, NULL),
  ('manager', 'Manager',   'Team management, records, and reporting access',
   '["read","write","delete","manage_team","view_reports"]'::jsonb,
   true, NULL),
  ('advisor', 'Advisor',   'Standard record access for daily advisor operations',
   '["read","write"]'::jsonb,
   true, NULL),
  ('support', 'Support',   'Read-only access with limited write for support tickets',
   '["read","write_support"]'::jsonb,
   true, NULL)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 9. SEED PERMISSIONS
-- ============================================================================
INSERT INTO crm_permissions (key, name, description, module, category) VALUES
  -- General
  ('records.read',        'Read Records',         'View CRM records',                    NULL,          'records'),
  ('records.create',      'Create Records',       'Create new CRM records',              NULL,          'records'),
  ('records.update',      'Update Records',       'Edit existing CRM records',           NULL,          'records'),
  ('records.delete',      'Delete Records',       'Delete CRM records',                  NULL,          'records'),
  ('records.bulk_update', 'Bulk Update',          'Perform bulk operations on records',  NULL,          'records'),
  ('records.export',      'Export Records',       'Export CRM data',                     NULL,          'import_export'),
  ('records.import',      'Import Records',       'Import data into CRM',               NULL,          'import_export'),
  -- Modules
  ('modules.manage',      'Manage Modules',       'Enable/disable/configure modules',   NULL,          'modules'),
  ('fields.manage',       'Manage Fields',        'Add/edit/remove custom fields',       NULL,          'fields'),
  -- Reports
  ('reports.view',        'View Reports',         'Access CRM reports',                  NULL,          'reports'),
  ('reports.create',      'Create Reports',       'Build custom reports',                NULL,          'reports'),
  -- Automation
  ('automation.manage',   'Manage Automation',    'Create/edit workflows and rules',     NULL,          'automation'),
  ('automation.execute',  'Execute Automation',   'Trigger manual workflow runs',        NULL,          'automation'),
  -- Admin
  ('admin.settings',      'System Settings',      'Modify system configuration',         NULL,          'admin'),
  ('admin.users',         'User Management',      'Manage CRM users and roles',          NULL,          'admin'),
  ('admin.audit',         'View Audit Logs',      'Access audit trail',                  NULL,          'security'),
  ('admin.security',      'Security Settings',    'Manage security policies and SSO',    NULL,          'security'),
  -- API
  ('api.manage',          'Manage API Keys',      'Create and revoke API keys',          NULL,          'api'),
  ('api.webhooks',        'Manage Webhooks',      'Configure webhook endpoints',         NULL,          'api')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 10. SEED ROLE ↔ PERMISSION MAPPINGS
-- ============================================================================
DO $$
DECLARE
  v_role_id uuid;
  v_perm_id uuid;
  v_ceo_perms text[] := ARRAY[
    'records.read','records.create','records.update','records.delete','records.bulk_update',
    'records.export','records.import','modules.manage','fields.manage',
    'reports.view','reports.create','automation.manage','automation.execute',
    'admin.settings','admin.users','admin.audit','admin.security','api.manage','api.webhooks'
  ];
  v_admin_perms text[] := ARRAY[
    'records.read','records.create','records.update','records.delete','records.bulk_update',
    'records.export','records.import','modules.manage','fields.manage',
    'reports.view','reports.create','automation.manage','automation.execute',
    'admin.settings','admin.users','admin.audit','admin.security','api.manage','api.webhooks'
  ];
  v_manager_perms text[] := ARRAY[
    'records.read','records.create','records.update','records.delete','records.bulk_update',
    'records.export','reports.view','reports.create','automation.execute'
  ];
  v_advisor_perms text[] := ARRAY[
    'records.read','records.create','records.update','reports.view'
  ];
  v_support_perms text[] := ARRAY[
    'records.read','records.create','records.update','reports.view'
  ];
  v_perm_key text;
BEGIN
  -- CEO
  SELECT id INTO v_role_id FROM crm_roles WHERE key = 'ceo' AND organization_id IS NULL LIMIT 1;
  IF v_role_id IS NOT NULL THEN
    FOREACH v_perm_key IN ARRAY v_ceo_perms LOOP
      SELECT id INTO v_perm_id FROM crm_permissions WHERE key = v_perm_key;
      IF v_perm_id IS NOT NULL THEN
        INSERT INTO crm_role_permissions (role_id, permission_id)
        VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- Admin
  SELECT id INTO v_role_id FROM crm_roles WHERE key = 'admin' AND organization_id IS NULL LIMIT 1;
  IF v_role_id IS NOT NULL THEN
    FOREACH v_perm_key IN ARRAY v_admin_perms LOOP
      SELECT id INTO v_perm_id FROM crm_permissions WHERE key = v_perm_key;
      IF v_perm_id IS NOT NULL THEN
        INSERT INTO crm_role_permissions (role_id, permission_id)
        VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- Manager
  SELECT id INTO v_role_id FROM crm_roles WHERE key = 'manager' AND organization_id IS NULL LIMIT 1;
  IF v_role_id IS NOT NULL THEN
    FOREACH v_perm_key IN ARRAY v_manager_perms LOOP
      SELECT id INTO v_perm_id FROM crm_permissions WHERE key = v_perm_key;
      IF v_perm_id IS NOT NULL THEN
        INSERT INTO crm_role_permissions (role_id, permission_id)
        VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- Advisor
  SELECT id INTO v_role_id FROM crm_roles WHERE key = 'advisor' AND organization_id IS NULL LIMIT 1;
  IF v_role_id IS NOT NULL THEN
    FOREACH v_perm_key IN ARRAY v_advisor_perms LOOP
      SELECT id INTO v_perm_id FROM crm_permissions WHERE key = v_perm_key;
      IF v_perm_id IS NOT NULL THEN
        INSERT INTO crm_role_permissions (role_id, permission_id)
        VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- Support
  SELECT id INTO v_role_id FROM crm_roles WHERE key = 'support' AND organization_id IS NULL LIMIT 1;
  IF v_role_id IS NOT NULL THEN
    FOREACH v_perm_key IN ARRAY v_support_perms LOOP
      SELECT id INTO v_perm_id FROM crm_permissions WHERE key = v_perm_key;
      IF v_perm_id IS NOT NULL THEN
        INSERT INTO crm_role_permissions (role_id, permission_id)
        VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;
END $$;

-- ============================================================================
-- 11. HELPER FUNCTION: Check granular permission
-- ============================================================================
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

COMMENT ON FUNCTION has_crm_permission IS 'Check if user has a specific granular permission via their roles';

-- ============================================================================
-- 12. AUDIT TRIGGER — log security table changes
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_audit_security_changes()
RETURNS trigger AS $$
BEGIN
  INSERT INTO unified_audit_logs (
    organization_id, app_source, actor_id,
    action, action_category, risk_level, details, changes
  ) VALUES (
    COALESCE(
      (CASE WHEN TG_TABLE_NAME = 'crm_user_roles' THEN
        (SELECT organization_id FROM profiles WHERE user_id = COALESCE(NEW.user_id, OLD.user_id) LIMIT 1)
       WHEN TG_TABLE_NAME IN ('crm_trusted_domains','crm_sso_config','crm_login_history') THEN
        COALESCE(NEW.organization_id, OLD.organization_id)
       WHEN TG_TABLE_NAME = 'crm_roles' THEN
        COALESCE(NEW.organization_id, OLD.organization_id)
       ELSE NULL
      END),
      '00000000-0000-0000-0000-000000000000'::uuid
    ),
    'crm',
    COALESCE(
      (SELECT id FROM profiles WHERE user_id = (SELECT auth.uid()) LIMIT 1),
      NULL
    ),
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

-- Attach to security tables
CREATE TRIGGER trg_audit_crm_roles
  AFTER INSERT OR UPDATE OR DELETE ON crm_roles
  FOR EACH ROW EXECUTE FUNCTION fn_audit_security_changes();

CREATE TRIGGER trg_audit_crm_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON crm_user_roles
  FOR EACH ROW EXECUTE FUNCTION fn_audit_security_changes();

CREATE TRIGGER trg_audit_crm_trusted_domains
  AFTER INSERT OR UPDATE OR DELETE ON crm_trusted_domains
  FOR EACH ROW EXECUTE FUNCTION fn_audit_security_changes();

CREATE TRIGGER trg_audit_crm_sso_config
  AFTER INSERT OR UPDATE OR DELETE ON crm_sso_config
  FOR EACH ROW EXECUTE FUNCTION fn_audit_security_changes();

-- ============================================================================
-- 13. ROW LEVEL SECURITY
-- ============================================================================

-- ── crm_permissions: readable by all, writable by admins ──────────────────
ALTER TABLE crm_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perms_select_authenticated" ON crm_permissions;
CREATE POLICY "perms_select_authenticated" ON crm_permissions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "perms_admin_manage" ON crm_permissions;
CREATE POLICY "perms_admin_manage" ON crm_permissions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── crm_role_permissions: readable by all, writable by admins ─────────────
ALTER TABLE crm_role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_perms_select" ON crm_role_permissions;
CREATE POLICY "role_perms_select" ON crm_role_permissions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "role_perms_admin_insert" ON crm_role_permissions;
CREATE POLICY "role_perms_admin_insert" ON crm_role_permissions
  FOR INSERT TO authenticated
  WITH CHECK (
    has_crm_governance_role(ARRAY['admin']) OR
    has_crm_role(get_user_organization_id(), ARRAY['crm_admin'])
  );

DROP POLICY IF EXISTS "role_perms_admin_delete" ON crm_role_permissions;
CREATE POLICY "role_perms_admin_delete" ON crm_role_permissions
  FOR DELETE TO authenticated
  USING (
    has_crm_governance_role(ARRAY['admin']) OR
    has_crm_role(get_user_organization_id(), ARRAY['crm_admin'])
  );

DROP POLICY IF EXISTS "role_perms_service" ON crm_role_permissions;
CREATE POLICY "role_perms_service" ON crm_role_permissions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── crm_login_history: org-scoped read, service write ─────────────────────
ALTER TABLE crm_login_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "login_history_select" ON crm_login_history;
CREATE POLICY "login_history_select" ON crm_login_history
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid()) OR
    has_crm_role(organization_id, ARRAY['crm_admin'])
  );

DROP POLICY IF EXISTS "login_history_insert" ON crm_login_history;
CREATE POLICY "login_history_insert" ON crm_login_history
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "login_history_service" ON crm_login_history;
CREATE POLICY "login_history_service" ON crm_login_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── crm_trusted_domains: org-scoped ──────────────────────────────────────
ALTER TABLE crm_trusted_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trusted_domains_select" ON crm_trusted_domains;
CREATE POLICY "trusted_domains_select" ON crm_trusted_domains
  FOR SELECT TO authenticated
  USING (is_crm_member(organization_id));

DROP POLICY IF EXISTS "trusted_domains_admin" ON crm_trusted_domains;
CREATE POLICY "trusted_domains_admin" ON crm_trusted_domains
  FOR ALL TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']))
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "trusted_domains_service" ON crm_trusted_domains;
CREATE POLICY "trusted_domains_service" ON crm_trusted_domains
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── crm_sso_config: org-scoped, admin only ───────────────────────────────
ALTER TABLE crm_sso_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sso_config_select" ON crm_sso_config;
CREATE POLICY "sso_config_select" ON crm_sso_config
  FOR SELECT TO authenticated
  USING (is_crm_member(organization_id));

DROP POLICY IF EXISTS "sso_config_admin" ON crm_sso_config;
CREATE POLICY "sso_config_admin" ON crm_sso_config
  FOR ALL TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']))
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin']));

DROP POLICY IF EXISTS "sso_config_service" ON crm_sso_config;
CREATE POLICY "sso_config_service" ON crm_sso_config
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 14. AUTO-UPDATE TRIGGERS
-- ============================================================================
CREATE TRIGGER update_crm_roles_updated_at
  BEFORE UPDATE ON crm_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_sso_config_updated_at
  BEFORE UPDATE ON crm_sso_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- END MODULE 2
-- ============================================================================

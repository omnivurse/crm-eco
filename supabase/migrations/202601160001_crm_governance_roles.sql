-- ============================================================================
-- W0: CRM Governance & Role Tables
-- Implements flexible role definitions and multi-role user assignments
-- ============================================================================

-- ============================================================================
-- CRM ROLES TABLE
-- Define CRM roles with permissions (admin, manager, rep, ops, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  permissions jsonb DEFAULT '[]'::jsonb,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_roles_key ON crm_roles(key);

-- ============================================================================
-- CRM USER ROLES TABLE
-- Multi-role assignment per user (supports users having multiple roles)
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES crm_roles(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role_id)
);

CREATE INDEX idx_crm_user_roles_user ON crm_user_roles(user_id);
CREATE INDEX idx_crm_user_roles_role ON crm_user_roles(role_id);

-- ============================================================================
-- SEED DEFAULT ROLES
-- ============================================================================
INSERT INTO crm_roles (key, name, description, permissions, is_system) VALUES
  ('admin', 'Administrator', 'Full CRM access including settings and user management', 
   '["read", "write", "delete", "manage_users", "manage_settings", "view_audit"]'::jsonb, true),
  ('manager', 'Manager', 'Team management, records, and reporting access', 
   '["read", "write", "delete", "manage_team", "view_reports"]'::jsonb, true),
  ('rep', 'Sales Rep', 'Standard record CRUD access for daily operations', 
   '["read", "write"]'::jsonb, true),
  ('ops', 'Operations', 'Audit logs, reporting, and read-only system access', 
   '["read", "view_audit", "view_reports"]'::jsonb, true)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- HELPER FUNCTION: Check if user has specific CRM governance role
-- ============================================================================
CREATE OR REPLACE FUNCTION has_crm_governance_role(p_role_keys text[])
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM crm_user_roles ur
    JOIN crm_roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() 
      AND r.key = ANY(p_role_keys)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on both tables
ALTER TABLE crm_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CRM ROLES POLICIES
-- Readable by all authenticated users; writable only by admins
-- ============================================================================

-- All authenticated users can view roles
CREATE POLICY "Authenticated users can view CRM roles"
  ON crm_roles FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert roles
CREATE POLICY "Admins can insert CRM roles"
  ON crm_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    has_crm_governance_role(ARRAY['admin']) OR
    has_crm_role(get_user_organization_id(), ARRAY['crm_admin'])
  );

-- Only admins can update roles
CREATE POLICY "Admins can update CRM roles"
  ON crm_roles FOR UPDATE
  TO authenticated
  USING (
    has_crm_governance_role(ARRAY['admin']) OR
    has_crm_role(get_user_organization_id(), ARRAY['crm_admin'])
  );

-- Only admins can delete non-system roles
CREATE POLICY "Admins can delete non-system CRM roles"
  ON crm_roles FOR DELETE
  TO authenticated
  USING (
    is_system = false AND (
      has_crm_governance_role(ARRAY['admin']) OR
      has_crm_role(get_user_organization_id(), ARRAY['crm_admin'])
    )
  );

-- ============================================================================
-- CRM USER ROLES POLICIES
-- Readable by admin + self; writable only by admins
-- ============================================================================

-- Admins can view all role assignments; users can view their own
CREATE POLICY "View CRM user roles"
  ON crm_user_roles FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    has_crm_governance_role(ARRAY['admin']) OR
    has_crm_role(get_user_organization_id(), ARRAY['crm_admin'])
  );

-- Only admins can assign roles
CREATE POLICY "Admins can assign CRM roles"
  ON crm_user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    has_crm_governance_role(ARRAY['admin']) OR
    has_crm_role(get_user_organization_id(), ARRAY['crm_admin'])
  );

-- Only admins can update role assignments
CREATE POLICY "Admins can update CRM role assignments"
  ON crm_user_roles FOR UPDATE
  TO authenticated
  USING (
    has_crm_governance_role(ARRAY['admin']) OR
    has_crm_role(get_user_organization_id(), ARRAY['crm_admin'])
  );

-- Only admins can remove role assignments
CREATE POLICY "Admins can remove CRM role assignments"
  ON crm_user_roles FOR DELETE
  TO authenticated
  USING (
    has_crm_governance_role(ARRAY['admin']) OR
    has_crm_role(get_user_organization_id(), ARRAY['crm_admin'])
  );

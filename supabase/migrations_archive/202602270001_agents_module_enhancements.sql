-- ============================================================================
-- AGENTS MODULE ENHANCEMENTS
-- Licenses, Appointments, Bill Groups, Permissions, and Audit Logging
-- ============================================================================

-- ============================================================================
-- AGENT LICENSES TABLE
-- Track individual license records per agent per state
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  advisor_id uuid NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,

  -- License details
  state_code text NOT NULL,
  license_number text NOT NULL,
  license_type text DEFAULT 'life_health' CHECK (license_type IN ('life_health', 'property_casualty', 'life_only', 'health_only', 'variable', 'other')),

  -- Dates
  issue_date date,
  expiration_date date,

  -- Status
  status text DEFAULT 'active' CHECK (status IN ('active', 'expired', 'pending', 'suspended', 'revoked')),

  -- Continuing education
  ce_hours_required int,
  ce_hours_completed int DEFAULT 0,
  ce_due_date date,

  -- Metadata
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(advisor_id, state_code, license_number)
);

CREATE INDEX idx_agent_licenses_org ON agent_licenses(organization_id);
CREATE INDEX idx_agent_licenses_advisor ON agent_licenses(advisor_id);
CREATE INDEX idx_agent_licenses_state ON agent_licenses(state_code);
CREATE INDEX idx_agent_licenses_expiration ON agent_licenses(expiration_date) WHERE status = 'active';
CREATE INDEX idx_agent_licenses_status ON agent_licenses(organization_id, status);

COMMENT ON TABLE agent_licenses IS 'Individual license records for agents by state';

-- ============================================================================
-- AGENT APPOINTMENTS TABLE
-- Track carrier appointments for agents
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  advisor_id uuid NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,

  -- Carrier details
  carrier_name text NOT NULL,
  carrier_code text,

  -- Appointment details
  appointment_number text,
  appointment_type text DEFAULT 'writing' CHECK (appointment_type IN ('writing', 'servicing', 'both')),

  -- States covered
  states text[] DEFAULT '{}',

  -- Products
  products text[] DEFAULT '{}',

  -- Dates
  effective_date date,
  termination_date date,

  -- Status
  status text DEFAULT 'active' CHECK (status IN ('active', 'pending', 'terminated', 'suspended')),

  -- Commission info
  commission_level text,
  hierarchy_code text,

  -- Metadata
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(advisor_id, carrier_code)
);

CREATE INDEX idx_agent_appointments_org ON agent_appointments(organization_id);
CREATE INDEX idx_agent_appointments_advisor ON agent_appointments(advisor_id);
CREATE INDEX idx_agent_appointments_carrier ON agent_appointments(carrier_code);
CREATE INDEX idx_agent_appointments_status ON agent_appointments(organization_id, status);

COMMENT ON TABLE agent_appointments IS 'Carrier appointment records for agents';

-- ============================================================================
-- AGENT BILL GROUPS TABLE
-- Groups of agents for commission/billing purposes
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_bill_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Group details
  name text NOT NULL,
  code text,
  description text,

  -- Group type
  group_type text DEFAULT 'commission' CHECK (group_type IN ('commission', 'billing', 'reporting', 'territory', 'team')),

  -- Configuration
  config jsonb DEFAULT '{}'::jsonb,

  -- Status
  is_active boolean DEFAULT true,

  -- Ownership
  manager_advisor_id uuid REFERENCES advisors(id) ON DELETE SET NULL,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(organization_id, code)
);

CREATE INDEX idx_agent_bill_groups_org ON agent_bill_groups(organization_id);
CREATE INDEX idx_agent_bill_groups_type ON agent_bill_groups(group_type);
CREATE INDEX idx_agent_bill_groups_manager ON agent_bill_groups(manager_advisor_id);

COMMENT ON TABLE agent_bill_groups IS 'Groups of agents for commission/billing/reporting purposes';

-- ============================================================================
-- AGENT BILL GROUP MEMBERS TABLE
-- Junction table for agent-to-group membership
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_bill_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bill_group_id uuid NOT NULL REFERENCES agent_bill_groups(id) ON DELETE CASCADE,
  advisor_id uuid NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,

  -- Role in group
  role text DEFAULT 'member' CHECK (role IN ('member', 'lead', 'manager')),

  -- Effective dates
  effective_date date DEFAULT CURRENT_DATE,
  end_date date,

  -- Timestamps
  created_at timestamptz DEFAULT now(),

  UNIQUE(bill_group_id, advisor_id)
);

CREATE INDEX idx_agent_bill_group_members_org ON agent_bill_group_members(organization_id);
CREATE INDEX idx_agent_bill_group_members_group ON agent_bill_group_members(bill_group_id);
CREATE INDEX idx_agent_bill_group_members_advisor ON agent_bill_group_members(advisor_id);

COMMENT ON TABLE agent_bill_group_members IS 'Agent membership in bill groups';

-- ============================================================================
-- PERMISSIONS TABLE
-- Granular permission definitions
-- ============================================================================
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  resource text NOT NULL,
  action text NOT NULL,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_permissions_resource ON permissions(resource);
CREATE INDEX idx_permissions_key ON permissions(key);

COMMENT ON TABLE permissions IS 'System permission definitions';

-- ============================================================================
-- ROLE PERMISSIONS TABLE
-- Assign permissions to roles
-- ============================================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role, permission_id)
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);

COMMENT ON TABLE role_permissions IS 'Role to permission assignments';

-- ============================================================================
-- INSERT DEFAULT AGENT PERMISSIONS
-- ============================================================================
INSERT INTO permissions (key, name, description, resource, action, is_system) VALUES
  ('agents.read', 'View Agents', 'View agent records and details', 'agents', 'read', true),
  ('agents.write', 'Manage Agents', 'Create and update agent records', 'agents', 'write', true),
  ('agents.delete', 'Delete Agents', 'Delete agent records', 'agents', 'delete', true),
  ('agents.licenses.read', 'View Licenses', 'View agent license information', 'agents.licenses', 'read', true),
  ('agents.licenses.write', 'Manage Licenses', 'Create and update license records', 'agents.licenses', 'write', true),
  ('agents.appointments.read', 'View Appointments', 'View carrier appointment information', 'agents.appointments', 'read', true),
  ('agents.appointments.write', 'Manage Appointments', 'Create and update appointment records', 'agents.appointments', 'write', true),
  ('agents.billgroups.read', 'View Bill Groups', 'View bill group information', 'agents.billgroups', 'read', true),
  ('agents.billgroups.write', 'Manage Bill Groups', 'Create and manage bill groups', 'agents.billgroups', 'write', true),
  ('agents.assignment.read', 'View Assignment Rules', 'View agent assignment rules', 'agents.assignment', 'read', true),
  ('agents.assignment.write', 'Manage Assignment Rules', 'Create and manage assignment rules', 'agents.assignment', 'write', true),
  ('agents.import', 'Import Agents', 'Bulk import agent data', 'agents', 'import', true)
ON CONFLICT (key) DO NOTHING;

-- Assign agent permissions to admin and manager roles
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions WHERE key LIKE 'agents.%'
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'crm_admin', id FROM permissions WHERE key LIKE 'agents.%'
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'crm_manager', id FROM permissions WHERE key IN ('agents.read', 'agents.write', 'agents.licenses.read', 'agents.licenses.write', 'agents.appointments.read', 'agents.appointments.write', 'agents.billgroups.read')
ON CONFLICT (role, permission_id) DO NOTHING;

-- ============================================================================
-- AGENT AUDIT LOG TABLE
-- Comprehensive audit logging for agent operations
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Actor
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  actor_email text,

  -- Action
  action text NOT NULL,
  -- Actions: create, update, delete, import, assignment_rule_create, assignment_rule_update, assignment_rule_delete,
  --          license_create, license_update, appointment_create, appointment_update, bill_group_create, bill_group_update

  -- Entity
  entity_type text NOT NULL,
  -- Types: advisor, license, appointment, bill_group, assignment_rule
  entity_id uuid,

  -- Changes
  old_data jsonb,
  new_data jsonb,
  changes jsonb,

  -- Context
  ip_address text,
  user_agent text,

  -- Timestamps
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_agent_audit_log_org ON agent_audit_log(organization_id);
CREATE INDEX idx_agent_audit_log_actor ON agent_audit_log(actor_id);
CREATE INDEX idx_agent_audit_log_entity ON agent_audit_log(entity_type, entity_id);
CREATE INDEX idx_agent_audit_log_action ON agent_audit_log(action);
CREATE INDEX idx_agent_audit_log_created ON agent_audit_log(created_at DESC);

COMMENT ON TABLE agent_audit_log IS 'Audit log for agent-related operations';

-- ============================================================================
-- AUDIT TRIGGER FUNCTIONS
-- ============================================================================

-- Function to log advisor changes
CREATE OR REPLACE FUNCTION log_advisor_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_id uuid;
  v_action text;
  v_old_data jsonb;
  v_new_data jsonb;
  v_changes jsonb;
BEGIN
  -- Get actor from session
  v_actor_id := current_profile_id();

  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_new_data := row_to_json(NEW)::jsonb;

    INSERT INTO agent_audit_log (organization_id, actor_id, action, entity_type, entity_id, new_data)
    VALUES (NEW.organization_id, v_actor_id, v_action, 'advisor', NEW.id, v_new_data);

  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_old_data := row_to_json(OLD)::jsonb;
    v_new_data := row_to_json(NEW)::jsonb;

    -- Calculate changes
    SELECT jsonb_object_agg(key, jsonb_build_object('old', v_old_data->key, 'new', v_new_data->key))
    INTO v_changes
    FROM jsonb_object_keys(v_new_data) AS key
    WHERE v_old_data->key IS DISTINCT FROM v_new_data->key
      AND key NOT IN ('updated_at');

    IF v_changes IS NOT NULL AND v_changes != '{}'::jsonb THEN
      INSERT INTO agent_audit_log (organization_id, actor_id, action, entity_type, entity_id, old_data, new_data, changes)
      VALUES (NEW.organization_id, v_actor_id, v_action, 'advisor', NEW.id, v_old_data, v_new_data, v_changes);
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_old_data := row_to_json(OLD)::jsonb;

    INSERT INTO agent_audit_log (organization_id, actor_id, action, entity_type, entity_id, old_data)
    VALUES (OLD.organization_id, v_actor_id, v_action, 'advisor', OLD.id, v_old_data);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log license changes
CREATE OR REPLACE FUNCTION log_license_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_id uuid;
  v_action text;
BEGIN
  v_actor_id := current_profile_id();

  IF TG_OP = 'INSERT' THEN
    v_action := 'license_create';
    INSERT INTO agent_audit_log (organization_id, actor_id, action, entity_type, entity_id, new_data)
    VALUES (NEW.organization_id, v_actor_id, v_action, 'license', NEW.id, row_to_json(NEW)::jsonb);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'license_update';
    INSERT INTO agent_audit_log (organization_id, actor_id, action, entity_type, entity_id, old_data, new_data)
    VALUES (NEW.organization_id, v_actor_id, v_action, 'license', NEW.id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'license_delete';
    INSERT INTO agent_audit_log (organization_id, actor_id, action, entity_type, entity_id, old_data)
    VALUES (OLD.organization_id, v_actor_id, v_action, 'license', OLD.id, row_to_json(OLD)::jsonb);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log appointment changes
CREATE OR REPLACE FUNCTION log_appointment_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_id uuid;
  v_action text;
BEGIN
  v_actor_id := current_profile_id();

  IF TG_OP = 'INSERT' THEN
    v_action := 'appointment_create';
    INSERT INTO agent_audit_log (organization_id, actor_id, action, entity_type, entity_id, new_data)
    VALUES (NEW.organization_id, v_actor_id, v_action, 'appointment', NEW.id, row_to_json(NEW)::jsonb);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'appointment_update';
    INSERT INTO agent_audit_log (organization_id, actor_id, action, entity_type, entity_id, old_data, new_data)
    VALUES (NEW.organization_id, v_actor_id, v_action, 'appointment', NEW.id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'appointment_delete';
    INSERT INTO agent_audit_log (organization_id, actor_id, action, entity_type, entity_id, old_data)
    VALUES (OLD.organization_id, v_actor_id, v_action, 'appointment', OLD.id, row_to_json(OLD)::jsonb);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log bill group changes
CREATE OR REPLACE FUNCTION log_bill_group_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_id uuid;
  v_action text;
BEGIN
  v_actor_id := current_profile_id();

  IF TG_OP = 'INSERT' THEN
    v_action := 'bill_group_create';
    INSERT INTO agent_audit_log (organization_id, actor_id, action, entity_type, entity_id, new_data)
    VALUES (NEW.organization_id, v_actor_id, v_action, 'bill_group', NEW.id, row_to_json(NEW)::jsonb);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'bill_group_update';
    INSERT INTO agent_audit_log (organization_id, actor_id, action, entity_type, entity_id, old_data, new_data)
    VALUES (NEW.organization_id, v_actor_id, v_action, 'bill_group', NEW.id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'bill_group_delete';
    INSERT INTO agent_audit_log (organization_id, actor_id, action, entity_type, entity_id, old_data)
    VALUES (OLD.organization_id, v_actor_id, v_action, 'bill_group', OLD.id, row_to_json(OLD)::jsonb);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CREATE AUDIT TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_log_advisor_changes ON advisors;
CREATE TRIGGER trigger_log_advisor_changes
  AFTER INSERT OR UPDATE OR DELETE ON advisors
  FOR EACH ROW EXECUTE FUNCTION log_advisor_changes();

DROP TRIGGER IF EXISTS trigger_log_license_changes ON agent_licenses;
CREATE TRIGGER trigger_log_license_changes
  AFTER INSERT OR UPDATE OR DELETE ON agent_licenses
  FOR EACH ROW EXECUTE FUNCTION log_license_changes();

DROP TRIGGER IF EXISTS trigger_log_appointment_changes ON agent_appointments;
CREATE TRIGGER trigger_log_appointment_changes
  AFTER INSERT OR UPDATE OR DELETE ON agent_appointments
  FOR EACH ROW EXECUTE FUNCTION log_appointment_changes();

DROP TRIGGER IF EXISTS trigger_log_bill_group_changes ON agent_bill_groups;
CREATE TRIGGER trigger_log_bill_group_changes
  AFTER INSERT OR UPDATE OR DELETE ON agent_bill_groups
  FOR EACH ROW EXECUTE FUNCTION log_bill_group_changes();

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================
CREATE TRIGGER update_agent_licenses_updated_at
  BEFORE UPDATE ON agent_licenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_appointments_updated_at
  BEFORE UPDATE ON agent_appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_bill_groups_updated_at
  BEFORE UPDATE ON agent_bill_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE agent_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_bill_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_bill_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Agent Licenses Policies
CREATE POLICY "Users can view licenses in their org"
  ON agent_licenses FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage licenses"
  ON agent_licenses FOR ALL
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('admin', 'super_admin'));

-- Agent Appointments Policies
CREATE POLICY "Users can view appointments in their org"
  ON agent_appointments FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage appointments"
  ON agent_appointments FOR ALL
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('admin', 'super_admin'));

-- Agent Bill Groups Policies
CREATE POLICY "Users can view bill groups in their org"
  ON agent_bill_groups FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage bill groups"
  ON agent_bill_groups FOR ALL
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('admin', 'super_admin'));

-- Bill Group Members Policies
CREATE POLICY "Users can view bill group members in their org"
  ON agent_bill_group_members FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage bill group members"
  ON agent_bill_group_members FOR ALL
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('admin', 'super_admin'));

-- Audit Log Policies
CREATE POLICY "Users can view audit logs in their org"
  ON agent_audit_log FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Permissions Policies (viewable by all authenticated users)
CREATE POLICY "Authenticated users can view permissions"
  ON permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view role permissions"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if user has a specific permission
CREATE OR REPLACE FUNCTION has_permission(p_permission_key text)
RETURNS boolean AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE user_id = auth.uid() LIMIT 1;

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  -- Super admin has all permissions
  IF v_role = 'super_admin' THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    WHERE rp.role = v_role
      AND p.key = p_permission_key
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION has_permission(text) TO authenticated;

-- Get next agent in round-robin rotation
CREATE OR REPLACE FUNCTION get_next_round_robin_agent(
  p_rule_id uuid
) RETURNS uuid AS $$
DECLARE
  v_config jsonb;
  v_users uuid[];
  v_cursor int;
  v_next_agent uuid;
BEGIN
  -- Get rule config
  SELECT config INTO v_config
  FROM crm_assignment_rules
  WHERE id = p_rule_id AND is_enabled = true;

  IF v_config IS NULL THEN
    RETURN NULL;
  END IF;

  -- Extract users and cursor
  v_users := ARRAY(SELECT jsonb_array_elements_text(v_config->'users')::uuid);
  v_cursor := COALESCE((v_config->>'cursor')::int, 0);

  IF array_length(v_users, 1) IS NULL OR array_length(v_users, 1) = 0 THEN
    RETURN NULL;
  END IF;

  -- Get next agent
  v_next_agent := v_users[(v_cursor % array_length(v_users, 1)) + 1];

  -- Update cursor
  UPDATE crm_assignment_rules
  SET config = config || jsonb_build_object('cursor', (v_cursor + 1) % array_length(v_users, 1))
  WHERE id = p_rule_id;

  RETURN v_next_agent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Preview round-robin assignment without advancing cursor
CREATE OR REPLACE FUNCTION preview_round_robin_assignments(
  p_rule_id uuid,
  p_count int DEFAULT 5
) RETURNS TABLE(assignment_position int, advisor_id uuid) AS $$
DECLARE
  v_config jsonb;
  v_users uuid[];
  v_cursor int;
  v_len int;
BEGIN
  -- Get rule config
  SELECT config INTO v_config
  FROM crm_assignment_rules
  WHERE id = p_rule_id;

  IF v_config IS NULL THEN
    RETURN;
  END IF;

  -- Extract users and cursor
  v_users := ARRAY(SELECT jsonb_array_elements_text(v_config->'users')::uuid);
  v_cursor := COALESCE((v_config->>'cursor')::int, 0);
  v_len := array_length(v_users, 1);

  IF v_len IS NULL OR v_len = 0 THEN
    RETURN;
  END IF;

  -- Generate preview
  FOR i IN 0..(p_count - 1) LOOP
    assignment_position := i + 1;
    advisor_id := v_users[((v_cursor + i) % v_len) + 1];
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION preview_round_robin_assignments(uuid, int) TO authenticated;

-- ============================================================================
-- COMPLETE
-- ============================================================================
SELECT 'Agents Module Enhancements migration complete!' as status;

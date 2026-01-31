-- CRM-ECO Initial Schema Migration
-- Creates all core tables for the healthshare/insurance CRM platform

-- ============================================================================
-- ORGANIZATIONS
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
-- PROFILES (linked to auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  avatar_url text,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'admin', 'advisor', 'staff')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- Create indexes only if the columns exist (handles Portal vs CRM schema differences)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'organization_id') THEN
    CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email') THEN
    CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
  END IF;
END $$;

-- ============================================================================
-- ADVISORS
-- ============================================================================
CREATE TABLE IF NOT EXISTS advisors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  parent_advisor_id uuid REFERENCES advisors(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  license_number text,
  license_states text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive', 'terminated')),
  commission_tier text,
  custom_fields jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advisors_organization_id ON advisors(organization_id);
CREATE INDEX IF NOT EXISTS idx_advisors_profile_id ON advisors(profile_id);
CREATE INDEX IF NOT EXISTS idx_advisors_parent_advisor_id ON advisors(parent_advisor_id);
CREATE INDEX IF NOT EXISTS idx_advisors_status ON advisors(status);
CREATE INDEX IF NOT EXISTS idx_advisors_email ON advisors(email);

-- ============================================================================
-- MEMBERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  advisor_id uuid REFERENCES advisors(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  date_of_birth date,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip_code text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive', 'terminated')),
  plan_name text,
  plan_type text,
  effective_date date,
  termination_date date,
  monthly_share numeric(10,2),
  custom_fields jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_members_organization_id ON members(organization_id);
CREATE INDEX IF NOT EXISTS idx_members_advisor_id ON members(advisor_id);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_state ON members(state);

-- ============================================================================
-- LEADS
-- ============================================================================
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  advisor_id uuid REFERENCES advisors(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  source text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  notes text,
  custom_fields jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_organization_id ON leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_leads_advisor_id ON leads(advisor_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);

-- ============================================================================
-- ACTIVITIES (audit log)
-- ============================================================================
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activities_organization_id ON activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_activities_profile_id ON activities(profile_id);
CREATE INDEX IF NOT EXISTS idx_activities_entity_type_id ON activities(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);

-- ============================================================================
-- TICKETS
-- ============================================================================
CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  assigned_to_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  advisor_id uuid REFERENCES advisors(id) ON DELETE SET NULL,
  agency_name text,
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('need', 'enrollment', 'billing', 'service', 'other')),
  subject text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  sla_target_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create ticket indexes only if columns exist (handles Portal vs CRM schema differences)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'organization_id') THEN
    CREATE INDEX IF NOT EXISTS idx_tickets_organization_id ON tickets(organization_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'created_by_profile_id') THEN
    CREATE INDEX IF NOT EXISTS idx_tickets_created_by_profile_id ON tickets(created_by_profile_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'assigned_to_profile_id') THEN
    CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to_profile_id ON tickets(assigned_to_profile_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'member_id') THEN
    CREATE INDEX IF NOT EXISTS idx_tickets_member_id ON tickets(member_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'advisor_id') THEN
    CREATE INDEX IF NOT EXISTS idx_tickets_advisor_id ON tickets(advisor_id);
  END IF;
  CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
  CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'category') THEN
    CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);
  END IF;
  CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
END $$;

-- ============================================================================
-- TICKET COMMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  created_by_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  is_internal boolean DEFAULT false,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ticket_comments' AND column_name = 'created_by_profile_id') THEN
    CREATE INDEX IF NOT EXISTS idx_ticket_comments_created_by_profile_id ON ticket_comments(created_by_profile_id);
  END IF;
END $$;

-- ============================================================================
-- NEEDS (healthshare reimbursement requests)
-- ============================================================================
CREATE TABLE IF NOT EXISTS needs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  advisor_id uuid REFERENCES advisors(id) ON DELETE SET NULL,
  need_type text NOT NULL,
  description text NOT NULL,
  total_amount numeric(12,2) DEFAULT 0,
  iua_amount numeric(12,2) DEFAULT 0,
  eligible_amount numeric(12,2) DEFAULT 0,
  reimbursed_amount numeric(12,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'paid', 'closed')),
  urgency_light text NOT NULL DEFAULT 'green' CHECK (urgency_light IN ('green', 'orange', 'red')),
  sla_target_date date,
  custom_fields jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_needs_organization_id ON needs(organization_id);
CREATE INDEX IF NOT EXISTS idx_needs_member_id ON needs(member_id);
CREATE INDEX IF NOT EXISTS idx_needs_advisor_id ON needs(advisor_id);
CREATE INDEX IF NOT EXISTS idx_needs_status ON needs(status);
CREATE INDEX IF NOT EXISTS idx_needs_urgency_light ON needs(urgency_light);
CREATE INDEX IF NOT EXISTS idx_needs_created_at ON needs(created_at DESC);

-- ============================================================================
-- NEED EVENTS (timeline/history for needs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS need_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  need_id uuid NOT NULL REFERENCES needs(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_need_events_need_id ON need_events(need_id);
CREATE INDEX IF NOT EXISTS idx_need_events_created_at ON need_events(created_at DESC);

-- ============================================================================
-- CUSTOM FIELD DEFINITIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('advisor', 'member', 'lead', 'need', 'ticket')),
  field_name text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'boolean', 'select', 'multiselect')),
  field_label text NOT NULL,
  options jsonb DEFAULT '[]'::jsonb,
  is_required boolean DEFAULT false,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, entity_type, field_name)
);

CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_organization_id ON custom_field_definitions(organization_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_entity_type ON custom_field_definitions(entity_type);

-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers (drop first to avoid conflicts)
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_advisors_updated_at ON advisors;
DROP TRIGGER IF EXISTS update_members_updated_at ON members;
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
DROP TRIGGER IF EXISTS update_needs_updated_at ON needs;
DROP TRIGGER IF EXISTS update_custom_field_definitions_updated_at ON custom_field_definitions;

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_advisors_updated_at BEFORE UPDATE ON advisors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_needs_updated_at BEFORE UPDATE ON needs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_custom_field_definitions_updated_at BEFORE UPDATE ON custom_field_definitions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE advisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE needs ENABLE ROW LEVEL SECURITY;
ALTER TABLE need_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's organization_id
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS uuid AS $$
  SELECT organization_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text AS $$
  SELECT role FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to check if user is advisor
CREATE OR REPLACE FUNCTION get_user_advisor_id()
RETURNS uuid AS $$
  SELECT a.id FROM advisors a
  JOIN profiles p ON p.id = a.profile_id
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- DROP EXISTING POLICIES (to make migration idempotent)
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their organization" ON organizations;
DROP POLICY IF EXISTS "Owners can update their organization" ON organizations;
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view advisors in their organization" ON advisors;
DROP POLICY IF EXISTS "Admins can manage advisors" ON advisors;
DROP POLICY IF EXISTS "Advisors can update their own record" ON advisors;
DROP POLICY IF EXISTS "Admins can view all members in organization" ON members;
DROP POLICY IF EXISTS "Advisors can view their assigned members" ON members;
DROP POLICY IF EXISTS "Admins can manage members" ON members;
DROP POLICY IF EXISTS "Advisors can update their assigned members" ON members;
DROP POLICY IF EXISTS "Admins can view all leads" ON leads;
DROP POLICY IF EXISTS "Advisors can view their assigned leads" ON leads;
DROP POLICY IF EXISTS "Admins can manage leads" ON leads;
DROP POLICY IF EXISTS "Users can view activities in their organization" ON activities;
DROP POLICY IF EXISTS "Users can create activities" ON activities;
DROP POLICY IF EXISTS "Users can view tickets in their organization" ON tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON tickets;
DROP POLICY IF EXISTS "Admins can manage tickets" ON tickets;
DROP POLICY IF EXISTS "Users can update their created tickets" ON tickets;
DROP POLICY IF EXISTS "Users can view ticket comments" ON ticket_comments;
DROP POLICY IF EXISTS "Users can create ticket comments" ON ticket_comments;
DROP POLICY IF EXISTS "Admins can view all needs" ON needs;
DROP POLICY IF EXISTS "Advisors can view their members' needs" ON needs;
DROP POLICY IF EXISTS "Admins can manage needs" ON needs;
DROP POLICY IF EXISTS "Users can view need events" ON need_events;
DROP POLICY IF EXISTS "Users can create need events" ON need_events;
DROP POLICY IF EXISTS "Users can view custom field definitions" ON custom_field_definitions;
DROP POLICY IF EXISTS "Admins can manage custom field definitions" ON custom_field_definitions;

-- ============================================================================
-- ORGANIZATIONS POLICIES
-- ============================================================================
CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT
  USING (id = get_user_organization_id());

CREATE POLICY "Owners can update their organization"
  ON organizations FOR UPDATE
  USING (id = get_user_organization_id() AND get_user_role() = 'owner');

-- ============================================================================
-- PROFILES POLICIES
-- ============================================================================
CREATE POLICY "Users can view profiles in their organization"
  ON profiles FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id() 
    AND get_user_role() IN ('owner', 'admin')
  );

-- ============================================================================
-- ADVISORS POLICIES
-- ============================================================================
CREATE POLICY "Users can view advisors in their organization"
  ON advisors FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage advisors"
  ON advisors FOR ALL
  USING (
    organization_id = get_user_organization_id() 
    AND get_user_role() IN ('owner', 'admin')
  );

CREATE POLICY "Advisors can update their own record"
  ON advisors FOR UPDATE
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- ============================================================================
-- MEMBERS POLICIES
-- ============================================================================
CREATE POLICY "Admins can view all members in organization"
  ON members FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

CREATE POLICY "Advisors can view their assigned members"
  ON members FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() = 'advisor'
    AND advisor_id = get_user_advisor_id()
  );

CREATE POLICY "Admins can manage members"
  ON members FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

CREATE POLICY "Advisors can update their assigned members"
  ON members FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() = 'advisor'
    AND advisor_id = get_user_advisor_id()
  );

-- ============================================================================
-- LEADS POLICIES
-- ============================================================================
CREATE POLICY "Admins can view all leads"
  ON leads FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

CREATE POLICY "Advisors can view their assigned leads"
  ON leads FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() = 'advisor'
    AND advisor_id = get_user_advisor_id()
  );

CREATE POLICY "Admins can manage leads"
  ON leads FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

-- ============================================================================
-- ACTIVITIES POLICIES
-- ============================================================================
CREATE POLICY "Users can view activities in their organization"
  ON activities FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create activities"
  ON activities FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

-- ============================================================================
-- TICKETS POLICIES
-- ============================================================================
CREATE POLICY "Users can view tickets in their organization"
  ON tickets FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create tickets"
  ON tickets FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage tickets"
  ON tickets FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

CREATE POLICY "Users can update their created tickets"
  ON tickets FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND created_by_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- ============================================================================
-- TICKET COMMENTS POLICIES
-- ============================================================================
CREATE POLICY "Users can view ticket comments"
  ON ticket_comments FOR SELECT
  USING (
    ticket_id IN (SELECT id FROM tickets WHERE organization_id = get_user_organization_id())
  );

CREATE POLICY "Users can create ticket comments"
  ON ticket_comments FOR INSERT
  WITH CHECK (
    ticket_id IN (SELECT id FROM tickets WHERE organization_id = get_user_organization_id())
  );

-- ============================================================================
-- NEEDS POLICIES
-- ============================================================================
CREATE POLICY "Admins can view all needs"
  ON needs FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

CREATE POLICY "Advisors can view their members' needs"
  ON needs FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() = 'advisor'
    AND member_id IN (SELECT id FROM members WHERE advisor_id = get_user_advisor_id())
  );

CREATE POLICY "Admins can manage needs"
  ON needs FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

-- ============================================================================
-- NEED EVENTS POLICIES
-- ============================================================================
CREATE POLICY "Users can view need events"
  ON need_events FOR SELECT
  USING (
    need_id IN (SELECT id FROM needs WHERE organization_id = get_user_organization_id())
  );

CREATE POLICY "Users can create need events"
  ON need_events FOR INSERT
  WITH CHECK (
    need_id IN (SELECT id FROM needs WHERE organization_id = get_user_organization_id())
  );

-- ============================================================================
-- CUSTOM FIELD DEFINITIONS POLICIES
-- ============================================================================
CREATE POLICY "Users can view custom field definitions"
  ON custom_field_definitions FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage custom field definitions"
  ON custom_field_definitions FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );


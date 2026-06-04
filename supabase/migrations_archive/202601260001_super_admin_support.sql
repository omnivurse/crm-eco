-- Super Admin Support Migration
-- Adds is_super_admin flag to profiles and updates helper functions
-- Super admins can access ALL organizations in the ecosystem

-- ============================================================================
-- ADD SUPER ADMIN COLUMN TO PROFILES
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_super_admin boolean DEFAULT false;

-- Index for super admin lookups
CREATE INDEX IF NOT EXISTS idx_profiles_super_admin ON public.profiles(is_super_admin) 
  WHERE is_super_admin = true;

COMMENT ON COLUMN public.profiles.is_super_admin IS 'True if user is a super admin with access to ALL organizations';

-- ============================================================================
-- CREATE SUPER ADMIN CHECK FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM public.profiles WHERE user_id = auth.uid() LIMIT 1),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;

-- ============================================================================
-- UPDATE get_user_organization_id TO SUPPORT SUPER ADMINS
-- For super admins querying without context, returns NULL (they can see all)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS uuid AS $$
DECLARE
  v_is_super boolean;
  v_org_id uuid;
BEGIN
  SELECT is_super_admin, organization_id 
  INTO v_is_super, v_org_id
  FROM public.profiles 
  WHERE user_id = auth.uid() 
  LIMIT 1;
  
  -- Super admins return their default org (they still need one for creating records)
  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION get_user_organization_id() TO authenticated;

-- ============================================================================
-- CREATE FUNCTION TO CHECK IF USER CAN ACCESS AN ORGANIZATION
-- Super admins can access any org, regular users only their own
-- ============================================================================

CREATE OR REPLACE FUNCTION can_access_organization(p_org_id uuid)
RETURNS boolean AS $$
DECLARE
  v_is_super boolean;
  v_user_org_id uuid;
BEGIN
  SELECT is_super_admin, organization_id 
  INTO v_is_super, v_user_org_id
  FROM public.profiles 
  WHERE user_id = auth.uid() 
  LIMIT 1;
  
  -- Super admins can access any organization
  IF v_is_super = true THEN
    RETURN true;
  END IF;
  
  -- Regular users can only access their own organization
  RETURN v_user_org_id = p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION can_access_organization(uuid) TO authenticated;

-- ============================================================================
-- CREATE SUPER ADMIN ORGANIZATION SWITCH FUNCTION
-- Allows super admins to temporarily switch their active organization context
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.super_admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  active_organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(profile_id)
);

CREATE INDEX IF NOT EXISTS idx_super_admin_sessions_profile ON public.super_admin_sessions(profile_id);

-- Function to set active organization for super admin
CREATE OR REPLACE FUNCTION set_super_admin_active_org(p_org_id uuid)
RETURNS boolean AS $$
DECLARE
  v_profile_id uuid;
  v_is_super boolean;
BEGIN
  SELECT id, is_super_admin 
  INTO v_profile_id, v_is_super
  FROM public.profiles 
  WHERE user_id = auth.uid() 
  LIMIT 1;
  
  IF v_is_super IS NOT TRUE THEN
    RAISE EXCEPTION 'Only super admins can switch organizations';
  END IF;
  
  INSERT INTO public.super_admin_sessions (profile_id, active_organization_id)
  VALUES (v_profile_id, p_org_id)
  ON CONFLICT (profile_id) 
  DO UPDATE SET active_organization_id = p_org_id, updated_at = now();
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION set_super_admin_active_org(uuid) TO authenticated;

-- Function to get super admin's current active organization
CREATE OR REPLACE FUNCTION get_super_admin_active_org()
RETURNS uuid AS $$
DECLARE
  v_profile_id uuid;
  v_is_super boolean;
  v_active_org uuid;
BEGIN
  SELECT id, is_super_admin 
  INTO v_profile_id, v_is_super
  FROM public.profiles 
  WHERE user_id = auth.uid() 
  LIMIT 1;
  
  IF v_is_super IS NOT TRUE THEN
    RETURN NULL;
  END IF;
  
  SELECT active_organization_id INTO v_active_org
  FROM public.super_admin_sessions
  WHERE profile_id = v_profile_id;
  
  RETURN v_active_org;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION get_super_admin_active_org() TO authenticated;

-- ============================================================================
-- UPDATE KEY RLS POLICIES TO SUPPORT SUPER ADMINS
-- ============================================================================

-- Organizations: Super admins can see all organizations
DROP POLICY IF EXISTS "Super admins can view all organizations" ON public.organizations;
CREATE POLICY "Super admins can view all organizations"
  ON public.organizations FOR SELECT
  USING (is_super_admin() = true);

-- Profiles: Super admins can view all profiles
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
CREATE POLICY "Super admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all profiles" ON public.profiles;
CREATE POLICY "Super admins can manage all profiles"
  ON public.profiles FOR ALL
  USING (is_super_admin() = true);

-- Members: Super admins can view all members
DROP POLICY IF EXISTS "Super admins can view all members" ON public.members;
CREATE POLICY "Super admins can view all members"
  ON public.members FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all members" ON public.members;
CREATE POLICY "Super admins can manage all members"
  ON public.members FOR ALL
  USING (is_super_admin() = true);

-- Advisors: Super admins can view all advisors
DROP POLICY IF EXISTS "Super admins can view all advisors" ON public.advisors;
CREATE POLICY "Super admins can view all advisors"
  ON public.advisors FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all advisors" ON public.advisors;
CREATE POLICY "Super admins can manage all advisors"
  ON public.advisors FOR ALL
  USING (is_super_admin() = true);

-- Enrollments: Super admins can view all enrollments
DROP POLICY IF EXISTS "Super admins can view all enrollments" ON public.enrollments;
CREATE POLICY "Super admins can view all enrollments"
  ON public.enrollments FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all enrollments" ON public.enrollments;
CREATE POLICY "Super admins can manage all enrollments"
  ON public.enrollments FOR ALL
  USING (is_super_admin() = true);

-- Plans: Super admins can view all plans
DROP POLICY IF EXISTS "Super admins can view all plans" ON public.plans;
CREATE POLICY "Super admins can view all plans"
  ON public.plans FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all plans" ON public.plans;
CREATE POLICY "Super admins can manage all plans"
  ON public.plans FOR ALL
  USING (is_super_admin() = true);

-- Leads: Super admins can view all leads
DROP POLICY IF EXISTS "Super admins can view all leads" ON public.leads;
CREATE POLICY "Super admins can view all leads"
  ON public.leads FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all leads" ON public.leads;
CREATE POLICY "Super admins can manage all leads"
  ON public.leads FOR ALL
  USING (is_super_admin() = true);

-- Needs: Super admins can view all needs
DROP POLICY IF EXISTS "Super admins can view all needs" ON public.needs;
CREATE POLICY "Super admins can view all needs"
  ON public.needs FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all needs" ON public.needs;
CREATE POLICY "Super admins can manage all needs"
  ON public.needs FOR ALL
  USING (is_super_admin() = true);

-- Tickets: Super admins can view all tickets
DROP POLICY IF EXISTS "Super admins can view all tickets" ON public.tickets;
CREATE POLICY "Super admins can view all tickets"
  ON public.tickets FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all tickets" ON public.tickets;
CREATE POLICY "Super admins can manage all tickets"
  ON public.tickets FOR ALL
  USING (is_super_admin() = true);

-- Activities: Super admins can view all activities
DROP POLICY IF EXISTS "Super admins can view all activities" ON public.activities;
CREATE POLICY "Super admins can view all activities"
  ON public.activities FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all activities" ON public.activities;
CREATE POLICY "Super admins can manage all activities"
  ON public.activities FOR ALL
  USING (is_super_admin() = true);

-- Admin settings: Super admins can view all settings
DROP POLICY IF EXISTS "Super admins can view all admin settings" ON public.admin_settings;
CREATE POLICY "Super admins can view all admin settings"
  ON public.admin_settings FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all admin settings" ON public.admin_settings;
CREATE POLICY "Super admins can manage all admin settings"
  ON public.admin_settings FOR ALL
  USING (is_super_admin() = true);

-- Admin activity log: Super admins can view all logs
DROP POLICY IF EXISTS "Super admins can view all activity logs" ON public.admin_activity_log;
CREATE POLICY "Super admins can view all activity logs"
  ON public.admin_activity_log FOR SELECT
  USING (is_super_admin() = true);

-- Dependents: Super admins can view all dependents
DROP POLICY IF EXISTS "Super admins can view all dependents" ON public.dependents;
CREATE POLICY "Super admins can view all dependents"
  ON public.dependents FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all dependents" ON public.dependents;
CREATE POLICY "Super admins can manage all dependents"
  ON public.dependents FOR ALL
  USING (is_super_admin() = true);

-- ============================================================================
-- RLS FOR SUPER ADMIN SESSIONS TABLE
-- ============================================================================

ALTER TABLE public.super_admin_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can manage their sessions" ON public.super_admin_sessions;
CREATE POLICY "Super admins can manage their sessions"
  ON public.super_admin_sessions FOR ALL
  USING (
    profile_id IN (
      SELECT id FROM public.profiles 
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );

-- ============================================================================
-- CRM TABLE POLICIES FOR SUPER ADMINS
-- ============================================================================

-- CRM Modules
DROP POLICY IF EXISTS "Super admins can view all CRM modules" ON public.crm_modules;
CREATE POLICY "Super admins can view all CRM modules"
  ON public.crm_modules FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all CRM modules" ON public.crm_modules;
CREATE POLICY "Super admins can manage all CRM modules"
  ON public.crm_modules FOR ALL
  USING (is_super_admin() = true);

-- CRM Fields
DROP POLICY IF EXISTS "Super admins can view all CRM fields" ON public.crm_fields;
CREATE POLICY "Super admins can view all CRM fields"
  ON public.crm_fields FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all CRM fields" ON public.crm_fields;
CREATE POLICY "Super admins can manage all CRM fields"
  ON public.crm_fields FOR ALL
  USING (is_super_admin() = true);

-- CRM Records
DROP POLICY IF EXISTS "Super admins can view all CRM records" ON public.crm_records;
CREATE POLICY "Super admins can view all CRM records"
  ON public.crm_records FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all CRM records" ON public.crm_records;
CREATE POLICY "Super admins can manage all CRM records"
  ON public.crm_records FOR ALL
  USING (is_super_admin() = true);

-- CRM Views
DROP POLICY IF EXISTS "Super admins can view all CRM views" ON public.crm_views;
CREATE POLICY "Super admins can view all CRM views"
  ON public.crm_views FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all CRM views" ON public.crm_views;
CREATE POLICY "Super admins can manage all CRM views"
  ON public.crm_views FOR ALL
  USING (is_super_admin() = true);

-- CRM Notes
DROP POLICY IF EXISTS "Super admins can view all CRM notes" ON public.crm_notes;
CREATE POLICY "Super admins can view all CRM notes"
  ON public.crm_notes FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all CRM notes" ON public.crm_notes;
CREATE POLICY "Super admins can manage all CRM notes"
  ON public.crm_notes FOR ALL
  USING (is_super_admin() = true);

-- CRM Tasks
DROP POLICY IF EXISTS "Super admins can view all CRM tasks" ON public.crm_tasks;
CREATE POLICY "Super admins can view all CRM tasks"
  ON public.crm_tasks FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all CRM tasks" ON public.crm_tasks;
CREATE POLICY "Super admins can manage all CRM tasks"
  ON public.crm_tasks FOR ALL
  USING (is_super_admin() = true);

-- CRM Layouts
DROP POLICY IF EXISTS "Super admins can view all CRM layouts" ON public.crm_layouts;
CREATE POLICY "Super admins can view all CRM layouts"
  ON public.crm_layouts FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all CRM layouts" ON public.crm_layouts;
CREATE POLICY "Super admins can manage all CRM layouts"
  ON public.crm_layouts FOR ALL
  USING (is_super_admin() = true);

-- CRM Import Jobs
DROP POLICY IF EXISTS "Super admins can view all CRM import jobs" ON public.crm_import_jobs;
CREATE POLICY "Super admins can view all CRM import jobs"
  ON public.crm_import_jobs FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all CRM import jobs" ON public.crm_import_jobs;
CREATE POLICY "Super admins can manage all CRM import jobs"
  ON public.crm_import_jobs FOR ALL
  USING (is_super_admin() = true);

-- CRM Blueprints
DROP POLICY IF EXISTS "Super admins can view all CRM blueprints" ON public.crm_blueprints;
CREATE POLICY "Super admins can view all CRM blueprints"
  ON public.crm_blueprints FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all CRM blueprints" ON public.crm_blueprints;
CREATE POLICY "Super admins can manage all CRM blueprints"
  ON public.crm_blueprints FOR ALL
  USING (is_super_admin() = true);

-- CRM Approvals
DROP POLICY IF EXISTS "Super admins can view all CRM approvals" ON public.crm_approvals;
CREATE POLICY "Super admins can view all CRM approvals"
  ON public.crm_approvals FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all CRM approvals" ON public.crm_approvals;
CREATE POLICY "Super admins can manage all CRM approvals"
  ON public.crm_approvals FOR ALL
  USING (is_super_admin() = true);

-- CRM Workflows
DROP POLICY IF EXISTS "Super admins can view all CRM workflows" ON public.crm_workflows;
CREATE POLICY "Super admins can view all CRM workflows"
  ON public.crm_workflows FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all CRM workflows" ON public.crm_workflows;
CREATE POLICY "Super admins can manage all CRM workflows"
  ON public.crm_workflows FOR ALL
  USING (is_super_admin() = true);

-- CRM Message Templates
DROP POLICY IF EXISTS "Super admins can view all CRM templates" ON public.crm_message_templates;
CREATE POLICY "Super admins can view all CRM templates"
  ON public.crm_message_templates FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all CRM templates" ON public.crm_message_templates;
CREATE POLICY "Super admins can manage all CRM templates"
  ON public.crm_message_templates FOR ALL
  USING (is_super_admin() = true);

-- ============================================================================
-- UPDATE has_crm_role TO SUPPORT SUPER ADMINS
-- ============================================================================

CREATE OR REPLACE FUNCTION has_crm_role(p_org_id uuid, p_roles text[])
RETURNS boolean AS $$
DECLARE
  v_is_super boolean;
BEGIN
  -- Check if user is super admin first
  SELECT is_super_admin INTO v_is_super
  FROM public.profiles 
  WHERE user_id = auth.uid() 
  LIMIT 1;
  
  IF v_is_super = true THEN
    RETURN true;
  END IF;
  
  -- Check regular CRM role
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
      AND organization_id = p_org_id
      AND crm_role = ANY(p_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION has_crm_role(uuid, text[]) TO authenticated;

-- Update is_crm_member to support super admins
CREATE OR REPLACE FUNCTION is_crm_member(p_org_id uuid)
RETURNS boolean AS $$
DECLARE
  v_is_super boolean;
BEGIN
  -- Check if user is super admin first
  SELECT is_super_admin INTO v_is_super
  FROM public.profiles 
  WHERE user_id = auth.uid() 
  LIMIT 1;
  
  IF v_is_super = true THEN
    RETURN true;
  END IF;
  
  -- Check regular CRM membership
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
      AND organization_id = p_org_id
      AND crm_role IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION is_crm_member(uuid) TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.super_admin_sessions IS 'Tracks active organization context for super admin users';
COMMENT ON FUNCTION is_super_admin() IS 'Returns true if current user is a super admin';
COMMENT ON FUNCTION can_access_organization(uuid) IS 'Returns true if user can access the specified organization';
COMMENT ON FUNCTION set_super_admin_active_org(uuid) IS 'Sets the active organization for a super admin session';
COMMENT ON FUNCTION get_super_admin_active_org() IS 'Gets the active organization for the current super admin session';

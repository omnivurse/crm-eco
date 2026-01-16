-- CRM-ECO: Security Hardening Migration
-- Applies security best practices to helper functions and views

-- ============================================================================
-- PHASE 1: SECURE HELPER FUNCTIONS
-- All SECURITY DEFINER functions must have SET search_path = public
-- ============================================================================

-- Recreate has_crm_role with secure search_path
CREATE OR REPLACE FUNCTION has_crm_role(p_org_id uuid, p_roles text[])
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
      AND organization_id = p_org_id
      AND crm_role = ANY(p_roles)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION has_crm_role(uuid, text[]) TO authenticated;

-- Recreate is_crm_member with secure search_path
CREATE OR REPLACE FUNCTION is_crm_member(p_org_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
      AND organization_id = p_org_id
      AND crm_role IS NOT NULL
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION is_crm_member(uuid) TO authenticated;

-- Recreate get_user_crm_role with secure search_path
CREATE OR REPLACE FUNCTION get_user_crm_role(p_org_id uuid)
RETURNS text AS $$
  SELECT crm_role FROM public.profiles 
  WHERE user_id = auth.uid() 
    AND organization_id = p_org_id
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION get_user_crm_role(uuid) TO authenticated;

-- Recreate get_user_organization_id with secure search_path
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS uuid AS $$
  SELECT organization_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION get_user_organization_id() TO authenticated;

-- Recreate get_user_role with secure search_path
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated;

-- Recreate get_user_advisor_id with secure search_path
CREATE OR REPLACE FUNCTION get_user_advisor_id()
RETURNS uuid AS $$
  SELECT a.id FROM public.advisors a
  JOIN public.profiles p ON p.id = a.profile_id
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION get_user_advisor_id() TO authenticated;

-- ============================================================================
-- PHASE 2: ADD current_profile_id() HELPER
-- Maps auth.uid() to profiles.id for consistent ownership references
-- ============================================================================

CREATE OR REPLACE FUNCTION current_profile_id()
RETURNS uuid AS $$
  SELECT id FROM public.profiles 
  WHERE user_id = auth.uid() 
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION current_profile_id() TO authenticated;

-- ============================================================================
-- PHASE 3: SECURE crm_ext VIEWS WITH security_invoker (Postgres 15+)
-- Ensures views respect RLS of the calling user, not the view definer
-- ============================================================================

-- Drop and recreate members view with security_invoker
DROP VIEW IF EXISTS crm_ext.members;
CREATE VIEW crm_ext.members 
WITH (security_invoker = true) AS
  SELECT 
    id,
    organization_id,
    first_name,
    last_name,
    email,
    phone,
    date_of_birth,
    address_line1,
    city,
    state,
    status,
    plan_name,
    plan_type,
    effective_date,
    termination_date,
    monthly_share,
    created_at,
    updated_at
  FROM public.members;

-- Drop and recreate enrollments view with security_invoker
DROP VIEW IF EXISTS crm_ext.enrollments;
CREATE VIEW crm_ext.enrollments 
WITH (security_invoker = true) AS
  SELECT 
    id,
    organization_id,
    enrollment_number,
    primary_member_id,
    advisor_id,
    status,
    selected_plan_id,
    effective_date,
    household_size,
    created_at,
    updated_at
  FROM public.enrollments;

-- Drop and recreate advisors view with security_invoker
DROP VIEW IF EXISTS crm_ext.advisors;
CREATE VIEW crm_ext.advisors 
WITH (security_invoker = true) AS
  SELECT 
    id,
    organization_id,
    first_name,
    last_name,
    email,
    phone,
    status,
    license_number,
    license_states,
    commission_tier,
    created_at
  FROM public.advisors;

-- Re-grant select permissions on views
GRANT SELECT ON crm_ext.members TO authenticated;
GRANT SELECT ON crm_ext.enrollments TO authenticated;
GRANT SELECT ON crm_ext.advisors TO authenticated;

-- ============================================================================
-- PHASE 4: SECURE AUDIT LOGGING FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION log_crm_record_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_id uuid;
  v_action text;
  v_diff jsonb;
BEGIN
  -- Get actor ID using the new helper
  v_actor_id := current_profile_id();
  
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_diff := jsonb_build_object('new', row_to_json(NEW)::jsonb);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_diff := jsonb_build_object(
      'old', row_to_json(OLD)::jsonb,
      'new', row_to_json(NEW)::jsonb
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_diff := jsonb_build_object('old', row_to_json(OLD)::jsonb);
  END IF;
  
  INSERT INTO public.crm_audit_log (org_id, actor_id, action, entity, entity_id, diff)
  VALUES (
    COALESCE(NEW.org_id, OLD.org_id),
    v_actor_id,
    v_action,
    'crm_records',
    COALESCE(NEW.id, OLD.id),
    v_diff
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

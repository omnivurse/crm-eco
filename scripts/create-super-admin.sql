-- ============================================================================
-- CREATE SUPER ADMIN USERS
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard
-- ============================================================================
-- 
-- This script is SELF-CONTAINED - it creates the necessary schema changes
-- and then creates the super admin users.
--
-- Super Admin Users:
--   1. omnivurse@gmail.com / OMNIvurse!@19
--   2. 27@oiagent.cloud / PAYITforward!@19
--
-- ============================================================================

-- ============================================================================
-- STEP 1: ADD SUPER ADMIN COLUMN IF NOT EXISTS
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_super_admin boolean DEFAULT false;

-- Ensure display_name column exists (required by trigger)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text;

-- Index for super admin lookups
CREATE INDEX IF NOT EXISTS idx_profiles_super_admin ON public.profiles(is_super_admin) 
  WHERE is_super_admin = true;

-- ============================================================================
-- STEP 2: FIX THE HANDLE_NEW_USER TRIGGER (make it robust)
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_org_id uuid;
  profile_exists boolean;
BEGIN
  -- Check if profile already exists for this user
  SELECT EXISTS(SELECT 1 FROM profiles WHERE user_id = NEW.id) INTO profile_exists;
  
  IF profile_exists THEN
    -- Profile already exists, skip creation
    RETURN NEW;
  END IF;

  -- Get the default organization (first one created, or system-admin)
  SELECT id INTO default_org_id FROM organizations 
  WHERE id = '00000000-0000-0000-0000-000000000001'
  LIMIT 1;
  
  -- If system org doesn't exist, get first org
  IF default_org_id IS NULL THEN
    SELECT id INTO default_org_id FROM organizations ORDER BY created_at LIMIT 1;
  END IF;

  -- If no organization exists, create a default one
  IF default_org_id IS NULL THEN
    INSERT INTO organizations (name, slug)
    VALUES ('Default Organization', 'default')
    RETURNING id INTO default_org_id;
  END IF;

  -- Create profile for new user
  BEGIN
    INSERT INTO profiles (user_id, organization_id, email, full_name, display_name, role)
    VALUES (
      NEW.id,
      default_org_id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      'staff'
    );
  EXCEPTION WHEN unique_violation THEN
    -- Profile already exists (race condition), ignore
    NULL;
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 3: CREATE SUPER ADMIN CHECK FUNCTION
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
-- STEP 4: CREATE SUPER ADMIN RLS POLICIES
-- ============================================================================

-- Organizations: Super admins can see all organizations
DROP POLICY IF EXISTS "Super admins can view all organizations" ON public.organizations;
CREATE POLICY "Super admins can view all organizations"
  ON public.organizations FOR SELECT
  USING (is_super_admin() = true);

-- Profiles: Super admins can view/manage all profiles
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
CREATE POLICY "Super admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all profiles" ON public.profiles;
CREATE POLICY "Super admins can manage all profiles"
  ON public.profiles FOR ALL
  USING (is_super_admin() = true);

-- Members: Super admins can view/manage all members
DROP POLICY IF EXISTS "Super admins can view all members" ON public.members;
CREATE POLICY "Super admins can view all members"
  ON public.members FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all members" ON public.members;
CREATE POLICY "Super admins can manage all members"
  ON public.members FOR ALL
  USING (is_super_admin() = true);

-- Advisors: Super admins can view/manage all advisors
DROP POLICY IF EXISTS "Super admins can view all advisors" ON public.advisors;
CREATE POLICY "Super admins can view all advisors"
  ON public.advisors FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all advisors" ON public.advisors;
CREATE POLICY "Super admins can manage all advisors"
  ON public.advisors FOR ALL
  USING (is_super_admin() = true);

-- Enrollments: Super admins can view/manage all enrollments
DROP POLICY IF EXISTS "Super admins can view all enrollments" ON public.enrollments;
CREATE POLICY "Super admins can view all enrollments"
  ON public.enrollments FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all enrollments" ON public.enrollments;
CREATE POLICY "Super admins can manage all enrollments"
  ON public.enrollments FOR ALL
  USING (is_super_admin() = true);

-- Plans: Super admins can view/manage all plans
DROP POLICY IF EXISTS "Super admins can view all plans" ON public.plans;
CREATE POLICY "Super admins can view all plans"
  ON public.plans FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all plans" ON public.plans;
CREATE POLICY "Super admins can manage all plans"
  ON public.plans FOR ALL
  USING (is_super_admin() = true);

-- Leads: Super admins can view/manage all leads  
DROP POLICY IF EXISTS "Super admins can view all leads" ON public.leads;
CREATE POLICY "Super admins can view all leads"
  ON public.leads FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all leads" ON public.leads;
CREATE POLICY "Super admins can manage all leads"
  ON public.leads FOR ALL
  USING (is_super_admin() = true);

-- Needs: Super admins can view/manage all needs
DROP POLICY IF EXISTS "Super admins can view all needs" ON public.needs;
CREATE POLICY "Super admins can view all needs"
  ON public.needs FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all needs" ON public.needs;
CREATE POLICY "Super admins can manage all needs"
  ON public.needs FOR ALL
  USING (is_super_admin() = true);

-- Tickets: Super admins can view/manage all tickets
DROP POLICY IF EXISTS "Super admins can view all tickets" ON public.tickets;
CREATE POLICY "Super admins can view all tickets"
  ON public.tickets FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all tickets" ON public.tickets;
CREATE POLICY "Super admins can manage all tickets"
  ON public.tickets FOR ALL
  USING (is_super_admin() = true);

-- Activities: Super admins can view/manage all activities
DROP POLICY IF EXISTS "Super admins can view all activities" ON public.activities;
CREATE POLICY "Super admins can view all activities"
  ON public.activities FOR SELECT
  USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all activities" ON public.activities;
CREATE POLICY "Super admins can manage all activities"
  ON public.activities FOR ALL
  USING (is_super_admin() = true);

-- ============================================================================
-- STEP 5: ENSURE SYSTEM ORGANIZATION EXISTS
-- ============================================================================

INSERT INTO organizations (id, name, slug, settings)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'System Administration',
  'system-admin',
  '{"is_system": true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  settings = organizations.settings || '{"is_system": true}'::jsonb;

-- ============================================================================
-- STEP 6: NOW CREATE AUTH USERS IN SUPABASE DASHBOARD
-- ============================================================================
-- 
-- The trigger is now fixed! Go to:
-- https://supabase.com/dashboard → Your Project → Authentication → Users → Add User
--
-- User 1:
--   Email: omnivurse@gmail.com
--   Password: OMNIvurse!@19
--   ✓ Check "Auto Confirm User"
--
-- User 2:
--   Email: 27@oiagent.cloud
--   Password: PAYITforward!@19
--   ✓ Check "Auto Confirm User"
--
-- AFTER CREATING THE USERS, RUN STEP 7 BELOW
-- ============================================================================

-- ============================================================================
-- STEP 7: UPDATE PROFILES TO SUPER ADMIN (run after creating auth users)
-- ============================================================================

-- Super Admin 1: omnivurse@gmail.com
UPDATE profiles 
SET 
  is_super_admin = true,
  crm_role = 'crm_admin',
  role = 'owner',
  is_active = true,
  full_name = 'Omnivurse Super Admin',
  organization_id = '00000000-0000-0000-0000-000000000001'
WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'omnivurse@gmail.com');

-- If profile doesn't exist yet, create it
INSERT INTO profiles (
  user_id,
  organization_id,
  email,
  full_name,
  display_name,
  role,
  crm_role,
  is_active,
  is_super_admin
)
SELECT 
  au.id,
  '00000000-0000-0000-0000-000000000001',
  'omnivurse@gmail.com',
  'Omnivurse Super Admin',
  'Omnivurse Super Admin',
  'owner',
  'crm_admin',
  true,
  true
FROM auth.users au
WHERE au.email = 'omnivurse@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = au.id);

-- Super Admin 2: 27@oiagent.cloud
UPDATE profiles 
SET 
  is_super_admin = true,
  crm_role = 'crm_admin',
  role = 'owner',
  is_active = true,
  full_name = 'OI Agent Super Admin',
  organization_id = '00000000-0000-0000-0000-000000000001'
WHERE user_id IN (SELECT id FROM auth.users WHERE email = '27@oiagent.cloud');

-- If profile doesn't exist yet, create it
INSERT INTO profiles (
  user_id,
  organization_id,
  email,
  full_name,
  display_name,
  role,
  crm_role,
  is_active,
  is_super_admin
)
SELECT 
  au.id,
  '00000000-0000-0000-0000-000000000001',
  '27@oiagent.cloud',
  'OI Agent Super Admin',
  'OI Agent Super Admin',
  'owner',
  'crm_admin',
  true,
  true
FROM auth.users au
WHERE au.email = '27@oiagent.cloud'
  AND NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = au.id);

-- ============================================================================
-- STEP 8: VERIFY SUPER ADMINS WERE CREATED
-- ============================================================================

SELECT 
  p.id,
  p.user_id,
  p.email,
  p.full_name,
  p.role,
  p.crm_role,
  p.is_super_admin,
  p.is_active,
  o.name as organization_name
FROM profiles p
JOIN organizations o ON o.id = p.organization_id
WHERE p.is_super_admin = true
ORDER BY p.email;

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================

-- Check if auth users exist:
-- SELECT id, email, created_at FROM auth.users WHERE email IN ('omnivurse@gmail.com', '27@oiagent.cloud');

-- Check all profiles:
-- SELECT id, user_id, email, full_name, role, crm_role, is_super_admin FROM profiles ORDER BY created_at DESC LIMIT 20;

-- Grant super admin to existing user by email:
-- UPDATE profiles SET is_super_admin = true, role = 'owner', crm_role = 'crm_admin' WHERE email = 'your-email@example.com';

-- Revoke super admin access:
-- UPDATE profiles SET is_super_admin = false WHERE email = 'email-to-revoke@example.com';

-- Delete a user completely and try again:
-- DELETE FROM auth.users WHERE email = 'email-to-delete@example.com';

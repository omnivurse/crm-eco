-- ============================================================================
-- CREATE SUPER ADMIN USERS - COMPLETE SCRIPT
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: SCHEMA SETUP
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_super_admin boolean DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text;

CREATE INDEX IF NOT EXISTS idx_profiles_super_admin ON public.profiles(is_super_admin) 
  WHERE is_super_admin = true;

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
-- PART 2: FIX THE USER CREATION TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_org_id uuid;
  profile_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM profiles WHERE user_id = NEW.id) INTO profile_exists;
  IF profile_exists THEN
    RETURN NEW;
  END IF;

  SELECT id INTO default_org_id FROM organizations 
  WHERE id = '00000000-0000-0000-0000-000000000001' LIMIT 1;
  
  IF default_org_id IS NULL THEN
    SELECT id INTO default_org_id FROM organizations ORDER BY created_at LIMIT 1;
  END IF;

  IF default_org_id IS NULL THEN
    INSERT INTO organizations (name, slug) VALUES ('Default Organization', 'default')
    RETURNING id INTO default_org_id;
  END IF;

  BEGIN
    INSERT INTO profiles (user_id, organization_id, email, full_name, display_name, role)
    VALUES (
      NEW.id, default_org_id, NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      'staff'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 3: SUPER ADMIN FUNCTION AND POLICIES
-- ============================================================================

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM public.profiles WHERE user_id = auth.uid() LIMIT 1),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;

DROP POLICY IF EXISTS "Super admins can view all organizations" ON public.organizations;
CREATE POLICY "Super admins can view all organizations" ON public.organizations FOR SELECT USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
CREATE POLICY "Super admins can view all profiles" ON public.profiles FOR SELECT USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all profiles" ON public.profiles;
CREATE POLICY "Super admins can manage all profiles" ON public.profiles FOR ALL USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can view all members" ON public.members;
CREATE POLICY "Super admins can view all members" ON public.members FOR SELECT USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all members" ON public.members;
CREATE POLICY "Super admins can manage all members" ON public.members FOR ALL USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can view all advisors" ON public.advisors;
CREATE POLICY "Super admins can view all advisors" ON public.advisors FOR SELECT USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all advisors" ON public.advisors;
CREATE POLICY "Super admins can manage all advisors" ON public.advisors FOR ALL USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can view all enrollments" ON public.enrollments;
CREATE POLICY "Super admins can view all enrollments" ON public.enrollments FOR SELECT USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all enrollments" ON public.enrollments;
CREATE POLICY "Super admins can manage all enrollments" ON public.enrollments FOR ALL USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can view all plans" ON public.plans;
CREATE POLICY "Super admins can view all plans" ON public.plans FOR SELECT USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all plans" ON public.plans;
CREATE POLICY "Super admins can manage all plans" ON public.plans FOR ALL USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can view all leads" ON public.leads;
CREATE POLICY "Super admins can view all leads" ON public.leads FOR SELECT USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all leads" ON public.leads;
CREATE POLICY "Super admins can manage all leads" ON public.leads FOR ALL USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can view all needs" ON public.needs;
CREATE POLICY "Super admins can view all needs" ON public.needs FOR SELECT USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all needs" ON public.needs;
CREATE POLICY "Super admins can manage all needs" ON public.needs FOR ALL USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can view all tickets" ON public.tickets;
CREATE POLICY "Super admins can view all tickets" ON public.tickets FOR SELECT USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all tickets" ON public.tickets;
CREATE POLICY "Super admins can manage all tickets" ON public.tickets FOR ALL USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can view all activities" ON public.activities;
CREATE POLICY "Super admins can view all activities" ON public.activities FOR SELECT USING (is_super_admin() = true);

DROP POLICY IF EXISTS "Super admins can manage all activities" ON public.activities;
CREATE POLICY "Super admins can manage all activities" ON public.activities FOR ALL USING (is_super_admin() = true);

-- ============================================================================
-- PART 4: DELETE EXISTING USERS (clean slate)
-- ============================================================================

DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email IN ('omnivurse@gmail.com', '27@oiagent.cloud'));
DELETE FROM auth.users WHERE email IN ('omnivurse@gmail.com', '27@oiagent.cloud');

-- ============================================================================
-- PART 5: CREATE SUPER ADMIN 1 - omnivurse@gmail.com / OMNIvurse!@19
-- ============================================================================

DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
BEGIN
  -- Create auth user
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    'omnivurse@gmail.com',
    crypt('OMNIvurse!@19', gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"full_name": "Omnivurse Super Admin"}'::jsonb,
    'authenticated',
    'authenticated',
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  -- Create identity for email login
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', 'omnivurse@gmail.com', 'email_verified', true),
    'email',
    new_user_id::text,
    now(),
    now(),
    now()
  );

  -- Create profile
  INSERT INTO profiles (user_id, organization_id, email, full_name, display_name, role, crm_role, is_active, is_super_admin)
  VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000001',
    'omnivurse@gmail.com',
    'Omnivurse Super Admin',
    'Omnivurse Super Admin',
    'owner',
    'crm_admin',
    true,
    true
  )
  ON CONFLICT (user_id, organization_id) DO UPDATE SET
    is_super_admin = true, crm_role = 'crm_admin', role = 'owner', is_active = true;
END $$;

-- ============================================================================
-- PART 6: CREATE SUPER ADMIN 2 - 27@oiagent.cloud / PAYITforward!@19
-- ============================================================================

DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
BEGIN
  -- Create auth user
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    '27@oiagent.cloud',
    crypt('PAYITforward!@19', gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"full_name": "OI Agent Super Admin"}'::jsonb,
    'authenticated',
    'authenticated',
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  -- Create identity for email login
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', '27@oiagent.cloud', 'email_verified', true),
    'email',
    new_user_id::text,
    now(),
    now(),
    now()
  );

  -- Create profile
  INSERT INTO profiles (user_id, organization_id, email, full_name, display_name, role, crm_role, is_active, is_super_admin)
  VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000001',
    '27@oiagent.cloud',
    'OI Agent Super Admin',
    'OI Agent Super Admin',
    'owner',
    'crm_admin',
    true,
    true
  )
  ON CONFLICT (user_id, organization_id) DO UPDATE SET
    is_super_admin = true, crm_role = 'crm_admin', role = 'owner', is_active = true;
END $$;

-- ============================================================================
-- PART 7: VERIFY EVERYTHING
-- ============================================================================

SELECT 
  au.id as user_id,
  au.email,
  au.email_confirmed_at,
  p.full_name,
  p.role,
  p.crm_role,
  p.is_super_admin,
  p.is_active,
  (SELECT COUNT(*) FROM auth.identities WHERE user_id = au.id) as identity_count
FROM auth.users au
LEFT JOIN profiles p ON p.user_id = au.id
WHERE au.email IN ('omnivurse@gmail.com', '27@oiagent.cloud')
ORDER BY au.email;

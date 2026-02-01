/*
  # Create Super Admin Users - Drop and Recreate Triggers

  Strategy:
  1. Fix sync_email_from_auth to preserve provided email
  2. Drop and recreate handle_new_user to ensure new code
  3. Create auth users and profiles manually
  4. Update profiles to super_admin
*/

SET search_path TO extensions, public;

-- ============================================================================
-- STEP 1: FIX SYNC EMAIL TRIGGER TO NOT OVERWRITE PROVIDED EMAIL
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_email_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If email is explicitly provided in the INSERT, keep it
  IF NEW.email IS NOT NULL THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- Otherwise try to get email from auth.users
  IF NEW.id IS NOT NULL THEN
    NEW.email := (SELECT email FROM auth.users WHERE id = NEW.id);
  END IF;

  -- Fallback to user_id
  IF NEW.email IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.email := (SELECT email FROM auth.users WHERE id = NEW.user_id);
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- STEP 2: DROP OLD HANDLE_NEW_USER FUNCTION AND TRIGGER, RECREATE FRESH
-- ============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  default_org_id uuid;
BEGIN
  -- Skip if profile already exists for this user
  IF EXISTS(SELECT 1 FROM profiles WHERE id = NEW.id OR user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Get the default organization
  SELECT id INTO default_org_id FROM organizations ORDER BY created_at LIMIT 1;
  IF default_org_id IS NULL THEN
    default_org_id := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  -- Create profile for new user
  -- profile.id MUST equal NEW.id (auth.users.id) due to FK constraint
  INSERT INTO profiles (
    id,
    user_id,
    organization_id,
    email,
    full_name,
    display_name,
    role,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.id,
    default_org_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'staff',
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user error for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- STEP 3: ENSURE DEFAULT ORGANIZATION EXISTS
-- ============================================================================
INSERT INTO organizations (id, name, slug, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Default Organization',
  'default',
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 4: CREATE SUPER ADMIN USERS
-- ============================================================================
DO $$
DECLARE
  v_vinnie_user_id uuid := 'a1111111-1111-1111-1111-111111111111'::uuid;
  v_agent27_user_id uuid := 'a2222222-2222-2222-2222-222222222222'::uuid;
  v_instance_id uuid;
BEGIN
  -- Get instance_id if any users exist
  SELECT instance_id INTO v_instance_id FROM auth.users LIMIT 1;
  IF v_instance_id IS NULL THEN
    v_instance_id := '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;

  -- ========================================
  -- VINNIE (omnivurse@gmail.com)
  -- ========================================

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'omnivurse@gmail.com') THEN
    -- Create auth user (our new trigger will create profile correctly)
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
      recovery_token
    ) VALUES (
      v_vinnie_user_id,
      v_instance_id,
      'omnivurse@gmail.com',
      crypt('OMNIvurse!@19', gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"full_name": "Vinnie", "display_name": "Vinnie"}'::jsonb,
      'authenticated',
      'authenticated',
      now(),
      now(),
      '',
      ''
    );

    -- Create identity
    INSERT INTO auth.identities (
      id,
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      v_vinnie_user_id,
      'omnivurse@gmail.com',
      v_vinnie_user_id,
      jsonb_build_object('sub', v_vinnie_user_id::text, 'email', 'omnivurse@gmail.com', 'email_verified', true),
      'email',
      now(),
      now(),
      now()
    );

    RAISE NOTICE 'Created auth user for Vinnie';
  ELSE
    SELECT id INTO v_vinnie_user_id FROM auth.users WHERE email = 'omnivurse@gmail.com';
    RAISE NOTICE 'Vinnie already exists with ID: %', v_vinnie_user_id;
  END IF;

  -- Update profile to super_admin
  UPDATE profiles
  SET
    role = 'super_admin',
    is_super_admin = true,
    is_active = true,
    full_name = 'Vinnie',
    display_name = 'Vinnie',
    updated_at = now()
  WHERE id = v_vinnie_user_id OR email = 'omnivurse@gmail.com';

  RAISE NOTICE 'Set Vinnie as super_admin';

  -- ========================================
  -- AGENT27 (27@oiagent.cloud)
  -- ========================================

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = '27@oiagent.cloud') THEN
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
      recovery_token
    ) VALUES (
      v_agent27_user_id,
      v_instance_id,
      '27@oiagent.cloud',
      crypt('PAYitFORWARD!@19', gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"full_name": "Agent27", "display_name": "Agent27"}'::jsonb,
      'authenticated',
      'authenticated',
      now(),
      now(),
      '',
      ''
    );

    -- Create identity
    INSERT INTO auth.identities (
      id,
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      v_agent27_user_id,
      '27@oiagent.cloud',
      v_agent27_user_id,
      jsonb_build_object('sub', v_agent27_user_id::text, 'email', '27@oiagent.cloud', 'email_verified', true),
      'email',
      now(),
      now(),
      now()
    );

    RAISE NOTICE 'Created auth user for Agent27';
  ELSE
    SELECT id INTO v_agent27_user_id FROM auth.users WHERE email = '27@oiagent.cloud';
    RAISE NOTICE 'Agent27 already exists with ID: %', v_agent27_user_id;
  END IF;

  -- Update profile to super_admin
  UPDATE profiles
  SET
    role = 'super_admin',
    is_super_admin = true,
    is_active = true,
    full_name = 'Agent27',
    display_name = 'Agent27',
    updated_at = now()
  WHERE id = v_agent27_user_id OR email = '27@oiagent.cloud';

  RAISE NOTICE 'Set Agent27 as super_admin';
END $$;

-- ============================================================================
-- STEP 5: VERIFICATION
-- ============================================================================
DO $$
DECLARE
  v_count integer;
  v_row record;
BEGIN
  SELECT COUNT(*) INTO v_count FROM auth.users WHERE email IN ('omnivurse@gmail.com', '27@oiagent.cloud');
  RAISE NOTICE 'Auth users: %', v_count;

  SELECT COUNT(*) INTO v_count FROM profiles WHERE is_super_admin = true;
  RAISE NOTICE 'Super admin profiles: %', v_count;

  FOR v_row IN SELECT id, email, role, is_super_admin FROM profiles WHERE email IN ('omnivurse@gmail.com', '27@oiagent.cloud') LOOP
    RAISE NOTICE 'Profile: % | % | role=% | super=%', v_row.id, v_row.email, v_row.role, v_row.is_super_admin;
  END LOOP;
END $$;

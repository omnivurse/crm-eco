/*
  # Create Super Admin User - daniel@mympb.com

  1. User Creation
    - Creates a new user in auth.users with email daniel@mympb.com
    - Sets password to fjh#@!125#59 (hashed via crypt extension)
    - Confirms email automatically for immediate access
    - Generates UUID for user ID
    
  2. Profile Setup
    - Creates corresponding profile with super_admin role
    - Sets full_name to 'Daniel Champion'
    - Syncs email between auth.users and profiles
    
  3. Security
    - Uses pgcrypto extension for secure password hashing
    - Email is pre-confirmed (email_confirmed_at set to now())
    - User can login immediately with provided credentials
    
  4. Notes
    - This migration is idempotent - checks if user exists first
    - Only creates user if daniel@mympb.com doesn't already exist
    - Audit log entry is created for tracking
*/

-- Ensure pgcrypto extension is enabled for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create the super admin user
DO $$
DECLARE
  v_user_id uuid;
  v_encrypted_password text;
BEGIN
  -- Check if user already exists
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'daniel@mympb.com';
  
  -- Only create if user doesn't exist
  IF v_user_id IS NULL THEN
    -- Generate a new UUID for the user
    v_user_id := gen_random_uuid();
    
    -- Hash the password using crypt
    v_encrypted_password := crypt('fjh#@!125#59', gen_salt('bf'));
    
    -- Insert into auth.users
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud,
      confirmation_token,
      recovery_token
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'daniel@mympb.com',
      v_encrypted_password,
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Daniel Champion"}',
      now(),
      now(),
      'authenticated',
      'authenticated',
      '',
      ''
    );
    
    -- Insert into auth.identities with provider_id
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
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', 'daniel@mympb.com'),
      'email',
      v_user_id::text,
      now(),
      now(),
      now()
    );
    
    -- Create or update profile with super_admin role (as text, not enum)
    INSERT INTO public.profiles (id, email, full_name, role, created_at)
    VALUES (
      v_user_id,
      'daniel@mympb.com',
      'Daniel Champion',
      'super_admin',
      now()
    )
    ON CONFLICT (id) DO UPDATE
    SET 
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role = 'super_admin';
    
    -- Create audit log entry if audit_logs table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs' AND table_schema = 'public') THEN
      INSERT INTO public.audit_logs (actor_id, target_user_id, action, details)
      VALUES (
        NULL,
        v_user_id,
        'create_super_admin',
        jsonb_build_object(
          'email', 'daniel@mympb.com',
          'role', 'super_admin',
          'full_name', 'Daniel Champion',
          'source', 'migration',
          'created_at', now()
        )
      );
    END IF;
    
    RAISE NOTICE 'Super admin user created successfully: daniel@mympb.com (ID: %)', v_user_id;
  ELSE
    -- User exists, update to super_admin if needed
    UPDATE public.profiles
    SET 
      role = 'super_admin',
      full_name = 'Daniel Champion'
    WHERE id = v_user_id;
    
    RAISE NOTICE 'User daniel@mympb.com already exists (ID: %). Updated role to super_admin.', v_user_id;
  END IF;
END $$;

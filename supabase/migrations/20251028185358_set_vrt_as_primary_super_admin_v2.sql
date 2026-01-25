/*
  # Set vrt@mympb.com as Primary Super Admin

  1. Purpose
    - Confirms vrt@mympb.com (Vinnie Champion) as the primary super admin
    - Updates user metadata to ensure full_name is properly set
    - Documents vrt@mympb.com as the main super user account
    
  2. Changes
    - Updates auth.users metadata for vrt@mympb.com
    - Ensures profile has super_admin role (already set)
    - Adds audit log entry documenting primary super admin
    
  3. Security
    - Maintains existing super_admin privileges
    - Does not affect other admin accounts
    - Preserves audit trail
*/

-- Ensure vrt@mympb.com has proper metadata in auth.users
UPDATE auth.users
SET 
  raw_user_meta_data = jsonb_build_object('full_name', 'Vinnie Champion'),
  updated_at = now()
WHERE email = 'vrt@mympb.com';

-- Ensure profile is set to super_admin (should already be set)
UPDATE public.profiles
SET 
  role = 'super_admin',
  full_name = 'Vinnie Champion'
WHERE email = 'vrt@mympb.com';

-- Add audit log entry
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get the user ID
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'vrt@mympb.com';
  
  -- Log the confirmation
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs' AND table_schema = 'public') THEN
    INSERT INTO public.audit_logs (actor_id, target_user_id, action, details)
    VALUES (
      NULL,
      v_user_id,
      'confirm_primary_super_admin',
      jsonb_build_object(
        'email', 'vrt@mympb.com',
        'full_name', 'Vinnie Champion',
        'role', 'super_admin',
        'description', 'Confirmed vrt@mympb.com as primary super admin with unrestricted access',
        'timestamp', now()
      )
    );
  END IF;
  
  RAISE NOTICE 'Primary super admin confirmed: vrt@mympb.com (Vinnie Champion)';
END $$;

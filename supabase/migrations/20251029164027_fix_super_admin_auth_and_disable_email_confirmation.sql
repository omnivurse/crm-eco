/*
  # Fix Super Admin Authentication and Disable Email Confirmation
  
  1. Updates
    - Reset super admin password to ensure proper bcrypt hashing
    - Confirm email_confirmed_at is set to now()
    - Update encrypted_password with proper bcrypt hash
    - Ensure confirmation_token is empty
    
  2. Configuration
    - This migration ensures the super admin can login immediately
    - Email: daniel@mympb.com
    - Password: fjh#@!125#59
    
  3. Security
    - Uses pgcrypto extension for proper bcrypt password hashing
    - Email confirmation is set to allow immediate login
    - All auth fields properly configured
*/

-- Ensure pgcrypto extension is enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Update the super admin user with proper password hash and email confirmation
DO $$
DECLARE
  v_user_id uuid;
  v_encrypted_password text;
BEGIN
  -- Get the user ID
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'daniel@mympb.com';
  
  IF v_user_id IS NOT NULL THEN
    -- Generate properly hashed password
    v_encrypted_password := crypt('fjh#@!125#59', gen_salt('bf'));
    
    -- Update the user with new password and confirm email
    UPDATE auth.users
    SET 
      encrypted_password = v_encrypted_password,
      email_confirmed_at = now(),
      confirmation_token = '',
      recovery_token = '',
      email_change_token_new = '',
      email_change = '',
      updated_at = now()
    WHERE id = v_user_id;
    
    RAISE NOTICE 'Super admin password reset and email confirmed for: daniel@mympb.com';
  ELSE
    RAISE NOTICE 'Super admin user not found: daniel@mympb.com';
  END IF;
END $$;

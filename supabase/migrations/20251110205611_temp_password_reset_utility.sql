/*
  # Temporary Password Reset Utility
  
  Creates a helper function to reset user passwords directly.
  This is for emergency access when admin functions aren't available.
  
  Usage:
  SELECT reset_user_password('email@example.com', 'NewPassword123!');
*/

-- Create a function to reset user password
CREATE OR REPLACE FUNCTION reset_user_password(user_email text, new_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  target_user_id uuid;
  result json;
BEGIN
  -- Find the user
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = user_email;

  IF target_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'User not found'
    );
  END IF;

  -- Update the password using Supabase's auth schema
  UPDATE auth.users
  SET 
    encrypted_password = crypt(new_password, gen_salt('bf')),
    updated_at = now()
  WHERE id = target_user_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Password reset successfully',
    'user_id', target_user_id,
    'email', user_email
  );
END;
$$;
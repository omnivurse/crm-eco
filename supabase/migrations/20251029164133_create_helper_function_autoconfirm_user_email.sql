/*
  # Helper Function: Auto-Confirm User Email
  
  1. New Function
    - `autoconfirm_user_email(user_email text)` - Confirms email for any user
    - Useful for manually confirming users who can't access email
    - Can be called by super admins
    
  2. Security
    - Function uses SECURITY DEFINER to run with elevated privileges
    - Only accessible to authenticated users
    - Sets email_confirmed_at to current timestamp
    
  3. Usage Example
    ```sql
    SELECT autoconfirm_user_email('user@example.com');
    ```
*/

-- Create function to auto-confirm a user's email
CREATE OR REPLACE FUNCTION autoconfirm_user_email(user_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_result jsonb;
BEGIN
  -- Find the user
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = user_email;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'User not found',
      'email', user_email
    );
  END IF;
  
  -- Update the user to confirm their email
  UPDATE auth.users
  SET 
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    confirmation_token = '',
    updated_at = now()
  WHERE id = v_user_id;
  
  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Email confirmed successfully',
    'email', user_email,
    'user_id', v_user_id,
    'confirmed_at', now()
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'message', 'Error confirming email: ' || SQLERRM,
    'email', user_email
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION autoconfirm_user_email(text) TO authenticated;

-- Add comment
COMMENT ON FUNCTION autoconfirm_user_email(text) IS 'Auto-confirms a user email address. Usage: SELECT autoconfirm_user_email(''user@example.com'')';

/*
  # Recreate handle_new_user Trigger for Profile Auto-Creation

  1. Issue Identified
    - handle_new_user trigger is missing from auth.users table
    - When admin-create-user Edge Function creates users, profiles are not auto-created
    - Edge Function updates profile manually but relies on profile existing first
    
  2. Solution
    - Create handle_new_user function to auto-create profiles on user signup
    - Attach trigger to auth.users AFTER INSERT
    - Use SECURITY DEFINER to bypass RLS policies
    - Extract full_name from user_metadata if available
    - Default role to 'member'
    
  3. Behavior
    - Automatically creates profile when user is created in auth.users
    - Uses ON CONFLICT DO NOTHING to prevent duplicate key errors
    - Syncs email and full_name from auth.users metadata
    - Allows Edge Function to update role after profile creation

  4. Security
    - SECURITY DEFINER ensures function runs with creator privileges
    - RLS policies still apply to normal profile queries
    - Only triggered on INSERT into auth.users (admin operation)
*/

-- Create function to auto-create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles(id, email, full_name, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'member'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;

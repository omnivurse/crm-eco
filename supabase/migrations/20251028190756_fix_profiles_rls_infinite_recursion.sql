/*
  # Fix Profiles RLS Infinite Recursion

  1. Issue Identified
    - Multiple overlapping SELECT policies on profiles table
    - Policies contain subqueries that query profiles table (infinite recursion)
    - "profiles_self_read" and "profiles_public_read_for_tickets" both check profiles.role
    - This creates circular dependency when trying to read profiles
    
  2. Critical Errors
    - "infinite recursion detected in policy for relation 'profiles'"
    - Users cannot log in because profile fetch fails
    - Dashboard queries fail cascading from profile fetch failure
    
  3. Solution
    - Drop all existing SELECT policies
    - Create single, simple SELECT policy without subqueries
    - Use simple conditions that don't query profiles table within policy
    - Allow authenticated users to read all profiles (needed for ticket assignments, etc.)
    - Maintain security through application-level checks
    
  4. Security Notes
    - Authenticated users need to see other profiles for ticket/collaboration features
    - Role-based access control handled in application layer
    - RLS prevents unauthenticated access to profiles
*/

-- Drop all existing SELECT policies that cause recursion
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON profiles;
DROP POLICY IF EXISTS "profiles_self_read" ON profiles;
DROP POLICY IF EXISTS "profiles_public_read_for_tickets" ON profiles;

-- Create single, simple SELECT policy without recursion
CREATE POLICY "authenticated_users_read_profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Keep UPDATE policies but simplify to avoid recursion
DROP POLICY IF EXISTS "profiles_admin_update" ON profiles;

CREATE POLICY "users_update_own_profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Add INSERT policy for new user registration
DROP POLICY IF EXISTS "users_insert_own_profile" ON profiles;
CREATE POLICY "users_insert_own_profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Log the fix
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs' AND table_schema = 'public') THEN
    INSERT INTO public.audit_logs (actor_id, action, details)
    VALUES (
      NULL,
      'fix_profiles_rls_infinite_recursion',
      jsonb_build_object(
        'timestamp', now(),
        'issue', 'Infinite recursion in profiles RLS policies preventing login',
        'solution', 'Simplified SELECT policies to remove circular dependencies',
        'policies_removed', jsonb_build_array(
          'Users can read own profile',
          'Authenticated users can read all profiles',
          'profiles_self_read',
          'profiles_public_read_for_tickets',
          'profiles_admin_update'
        ),
        'policies_created', jsonb_build_array(
          'authenticated_users_read_profiles',
          'users_update_own_profile',
          'users_insert_own_profile'
        )
      )
    );
  END IF;
END $$;

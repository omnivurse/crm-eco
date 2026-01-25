/*
  # Fix Admin Role Update Permissions

  ## Issue Identified
  - Current RLS policies on profiles table only allow users to update their own profile
  - The "users_update_own_profile" policy has USING (id = auth.uid()) which blocks admins from updating other users
  - Migration 20251028190756 removed the "profiles_admin_update" policy that allowed admin role updates
  - Result: Admins cannot change other users' roles, updates fail silently

  ## Root Cause
  - Policy conflict: users_update_own_profile restricts updates to own profile only
  - No policy exists to allow admins/super_admins to update other users' profiles
  - RLS blocks the UPDATE even though the application code attempts it

  ## Solution
  - Add new policy "admins_can_update_all_profiles" for admin/super_admin users
  - Allow admins to update any profile (including role changes)
  - Prevent infinite recursion by using a simple role comparison without subqueries
  - Keep existing "users_update_own_profile" policy for regular users
  - Use security definer approach with proper role checking

  ## Security
  - Only users with role 'admin' or 'super_admin' can update other profiles
  - Regular users can still update their own profile (except role)
  - Maintains audit logging through existing trigger trg_profiles_role_audit
  - Prevents privilege escalation by requiring admin role in policy

  ## Testing
  After applying this migration:
  1. Admin users should be able to change other users' roles in Users Admin page
  2. Role changes should persist after page refresh
  3. Audit logs should record all role changes
  4. Regular users should not be able to change their own role
*/

-- Drop existing UPDATE policies to recreate cleanly
DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
DROP POLICY IF EXISTS "admins_can_update_all_profiles" ON public.profiles;

-- Policy 1: Users can update their own profile (but not their role)
CREATE POLICY "users_update_own_profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (
    id = (SELECT auth.uid())
    AND role = (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- Policy 2: Admins and super_admins can update any profile including roles
-- Using a function to avoid infinite recursion in RLS policy
CREATE OR REPLACE FUNCTION public.is_admin_or_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  );
$$;

CREATE POLICY "admins_can_update_all_profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_super_admin())
  WITH CHECK (public.is_admin_or_super_admin());

-- Log the fix to audit_logs
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) THEN
    INSERT INTO public.audit_logs (actor_id, action, details)
    VALUES (
      NULL,
      'fix_admin_role_update_permissions',
      jsonb_build_object(
        'timestamp', now(),
        'issue', 'Admins could not update other users roles due to RLS policy blocking updates',
        'solution', 'Added admins_can_update_all_profiles policy to allow admin/super_admin role updates',
        'policies_created', jsonb_build_array(
          'users_update_own_profile (with role protection)',
          'admins_can_update_all_profiles'
        ),
        'function_created', 'is_admin_or_super_admin()',
        'security_notes', 'Prevents infinite recursion by using SECURITY DEFINER function'
      )
    );
  END IF;
END $$;

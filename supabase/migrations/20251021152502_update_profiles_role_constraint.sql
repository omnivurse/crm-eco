/*
  # Update Profiles Role Constraint

  1. Constraint Update
    - Drops old check constraint that only allowed requester, agent, admin
    - Creates new check constraint allowing all 6 roles: super_admin, admin, it, staff, advisor, member
    
  2. Notes
    - This allows the profiles table to use the full role hierarchy
    - Existing data is not affected
    - Idempotent - checks if constraint exists before dropping
*/

-- Drop old constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_role_check' 
    AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
    RAISE NOTICE 'Dropped old profiles_role_check constraint';
  END IF;
END $$;

-- Add new constraint with all 6 roles
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('super_admin', 'admin', 'it', 'staff', 'advisor', 'member'));

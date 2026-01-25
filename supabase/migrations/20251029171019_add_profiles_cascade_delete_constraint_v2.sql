/*
  # Add CASCADE DELETE constraint to profiles table

  1. Issue
    - The profiles table was created without a foreign key constraint to auth.users
    - When users are deleted from auth.users, their profiles remain in the database
    - This causes deleted users to reappear in the user management interface

  2. Changes
    - Add foreign key constraint on profiles.id referencing auth.users(id)
    - Set ON DELETE CASCADE to automatically delete profiles when auth users are deleted
    - This ensures complete user deletion across both auth and public schemas

  3. Impact
    - Fixes the bug where deleted users remain visible in the admin panel
    - Ensures data consistency between auth.users and public.profiles
    - Maintains referential integrity
*/

-- Check if the constraint already exists before adding
DO $$
BEGIN
  -- First, check if constraint exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_id_fkey' 
      AND table_name = 'profiles'
  ) THEN
    -- Add foreign key constraint with CASCADE delete
    ALTER TABLE public.profiles 
      ADD CONSTRAINT profiles_id_fkey 
      FOREIGN KEY (id) 
      REFERENCES auth.users(id) 
      ON DELETE CASCADE;
  END IF;
END $$;

/*
  # Add super_admin to user_role enum

  1. Enum Update
    - Adds 'super_admin' value to existing user_role enum
    - Checks if value already exists before adding
    
  2. Notes
    - Idempotent migration - safe to run multiple times
    - Does not affect existing data
*/

-- Add super_admin to user_role enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'super_admin' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE user_role ADD VALUE 'super_admin';
    RAISE NOTICE 'Added super_admin to user_role enum';
  ELSE
    RAISE NOTICE 'super_admin already exists in user_role enum';
  END IF;
END $$;

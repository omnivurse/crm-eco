/*
  # Fix Profiles Role Constraint - Add Concierge Role

  1. Issue Identified
    - profiles.role column is TEXT type with default 'requester'
    - user_role ENUM exists with: member, advisor, staff, agent, admin, super_admin, concierge
    - CHECK constraint profiles_role_check only allows: super_admin, admin, it, staff, advisor, member
    - Missing: 'concierge' and 'agent' in CHECK constraint
    - Has: 'it' which is not used
    - Has: default 'requester' which is not in CHECK constraint

  2. Fixes Applied
    - Drop existing profiles_role_check constraint
    - Add new CHECK constraint with all valid roles including concierge and agent
    - Remove unused 'it' role
    - Update default from 'requester' to 'member'
    
  3. Valid Roles After Fix
    - super_admin (highest privilege)
    - admin
    - agent
    - staff
    - concierge
    - advisor
    - member (default)

  4. Security
    - Maintains RLS policies
    - Does not affect existing user data
    - Allows all roles used by the application
*/

-- Drop the existing constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add new constraint with all valid roles including concierge and agent
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('super_admin', 'admin', 'agent', 'staff', 'concierge', 'advisor', 'member'));

-- Update the default value from 'requester' to 'member'
ALTER TABLE public.profiles 
ALTER COLUMN role SET DEFAULT 'member';

-- Update any existing 'requester' or 'it' roles to 'member'
UPDATE public.profiles 
SET role = 'member' 
WHERE role NOT IN ('super_admin', 'admin', 'agent', 'staff', 'concierge', 'advisor', 'member');

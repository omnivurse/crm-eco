-- ============================================================================
-- CREATE SUPER ADMIN USER
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard
-- ============================================================================

-- STEP 1: First, create an organization if one doesn't exist
INSERT INTO organizations (id, name, slug, settings)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Pay It Forward HealthShare',
  'pifhs',
  '{}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- STEP 2: Create the auth user via Supabase Dashboard
-- Go to: Authentication > Users > Add User
-- Email: admin@payitforwardhealthshare.com
-- Password: (your secure password)
-- Check "Auto Confirm User"

-- STEP 3: After creating the auth user, get the user ID from the dashboard
-- Then run this to create the profile (replace YOUR_AUTH_USER_ID with actual ID):

/*
-- UNCOMMENT AND RUN AFTER CREATING AUTH USER:

INSERT INTO profiles (
  user_id,
  organization_id,
  email,
  full_name,
  role,
  crm_role,
  is_active
)
VALUES (
  'YOUR_AUTH_USER_ID',  -- Replace with actual auth.users.id from dashboard
  '00000000-0000-0000-0000-000000000001',
  'admin@payitforwardhealthshare.com',
  'Super Admin',
  'owner',           -- Gives access to regular dashboard
  'crm_admin',       -- Gives access to CRM
  true
)
ON CONFLICT (user_id) DO UPDATE SET
  crm_role = 'crm_admin',
  role = 'owner',
  is_active = true;

*/

-- ============================================================================
-- ALTERNATIVE: Update an existing user to have CRM access
-- ============================================================================
-- If you already have a user but they can't access the CRM, run this:

/*
-- Find your user first:
SELECT id, user_id, email, full_name, role, crm_role 
FROM profiles 
ORDER BY created_at DESC 
LIMIT 10;

-- Then update them to have CRM admin access:
UPDATE profiles 
SET crm_role = 'crm_admin', role = 'owner'
WHERE email = 'your-email@example.com';
*/

-- ============================================================================
-- QUICK FIX: Grant CRM access to ALL existing users (use with caution!)
-- ============================================================================
/*
UPDATE profiles 
SET crm_role = 'crm_admin'
WHERE crm_role IS NULL;
*/

-- ============================================================================
-- TEST DATA SETUP SCRIPT
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================================

-- 1. Create demo organization (if not exists)
INSERT INTO organizations (id, name, slug, settings)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Demo Healthshare',
  'demo-healthshare',
  '{"timezone": "America/New_York", "currency": "USD"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- 2. Create custom field definitions
INSERT INTO custom_field_definitions (organization_id, entity_type, field_name, field_type, field_label, options, display_order)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'member', 'referral_source', 'select', 'Referral Source', '["Web", "Friend", "Advisor", "Social Media", "Other"]'::jsonb, 1),
  ('00000000-0000-0000-0000-000000000001', 'member', 'preferred_contact', 'select', 'Preferred Contact Method', '["Email", "Phone", "Text"]'::jsonb, 2),
  ('00000000-0000-0000-0000-000000000001', 'advisor', 'years_experience', 'number', 'Years of Experience', '[]'::jsonb, 1),
  ('00000000-0000-0000-0000-000000000001', 'need', 'service_type', 'select', 'Service Type', '["Hospital", "Physician", "Lab", "Imaging", "Pharmacy", "Other"]'::jsonb, 1)
ON CONFLICT DO NOTHING;

-- 3. Create test user (you need to create this in Auth > Users first!)
-- After creating user in Auth, get the user ID and run:
-- UPDATE: Replace USER_UUID_HERE with the actual auth user ID
/*
INSERT INTO profiles (user_id, organization_id, email, display_name, role)
VALUES (
  'USER_UUID_HERE', -- Get this from Auth > Users after creating user
  '00000000-0000-0000-0000-000000000001',
  'admin@demo.com',
  'Admin User',
  'owner'
);
*/

-- 4. Create a test advisor
INSERT INTO advisors (id, organization_id, first_name, last_name, email, phone, agency_name, license_number, npn, status)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'John',
  'Broker',
  'john.broker@example.com',
  '555-123-4567',
  'Premier Insurance Agency',
  'LIC-123456',
  '1234567890',
  'active'
) ON CONFLICT (id) DO NOTHING;

-- 5. Create a test plan
INSERT INTO plans (id, organization_id, name, code, description, monthly_share, enrollment_fee, iua_amount, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'Basic Health Share',
  'BHS-001',
  'Standard healthshare plan with comprehensive coverage',
  299.00,
  125.00,
  1000.00,
  true
) ON CONFLICT (id) DO NOTHING;

-- 6. Create some test members (including one in mandate state with 65+ age)
INSERT INTO members (id, organization_id, first_name, last_name, email, phone, state, date_of_birth, status, advisor_id)
VALUES 
  (
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'Jane',
    'Smith',
    'jane.smith@example.com',
    '555-987-6543',
    'MA', -- Mandate state
    '1958-03-15', -- 66+ years old
    'active',
    '00000000-0000-0000-0000-000000000002'
  ),
  (
    '00000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    'Bob',
    'Johnson',
    'bob.johnson@example.com',
    '555-456-7890',
    'FL',
    '1985-07-22',
    'active',
    '00000000-0000-0000-0000-000000000002'
  )
ON CONFLICT (id) DO NOTHING;

-- Done! Now go to Auth > Users and create admin@demo.com with password123
-- Then copy the user ID and run the profile insert above


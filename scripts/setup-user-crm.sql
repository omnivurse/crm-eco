-- ============================================================================
-- CRM-ECO: User & Organization Setup
-- Run this AFTER run-all-migrations.sql
-- ============================================================================

-- Your user ID from earlier
DO $$
DECLARE
  v_user_id uuid := '0bafef11-5e2b-4752-a6d8-9c1fbb48895e';
  v_org_id uuid;
  v_profile_id uuid;
BEGIN
  -- ============================================================================
  -- 1. CREATE ORGANIZATION (if not exists)
  -- ============================================================================
  INSERT INTO organizations (id, name, slug, settings)
  VALUES (
    gen_random_uuid(),
    'Pay It Forward',
    'pay-it-forward',
    '{"theme": "modern", "features": ["crm", "enrollment", "needs"]}'::jsonb
  )
  ON CONFLICT (slug) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_org_id;
  
  -- If org already existed, get its ID
  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id FROM organizations WHERE slug = 'pay-it-forward';
  END IF;
  
  RAISE NOTICE 'Organization ID: %', v_org_id;

  -- ============================================================================
  -- 2. CREATE/UPDATE PROFILE
  -- ============================================================================
  
  -- Check if profile exists
  SELECT id INTO v_profile_id FROM profiles WHERE user_id = v_user_id LIMIT 1;
  
  IF v_profile_id IS NULL THEN
    -- Create new profile
    INSERT INTO profiles (user_id, organization_id, email, full_name, display_name, role, crm_role)
    VALUES (
      v_user_id,
      v_org_id,
      'admin@payitforward.com',
      'CRM Admin',
      'CRM Admin',
      'owner',
      'crm_admin'
    )
    RETURNING id INTO v_profile_id;
    RAISE NOTICE 'Created profile: %', v_profile_id;
  ELSE
    -- Update existing profile with CRM role
    UPDATE profiles 
    SET 
      organization_id = v_org_id,
      role = 'owner',
      crm_role = 'crm_admin'
    WHERE id = v_profile_id;
    RAISE NOTICE 'Updated profile: %', v_profile_id;
  END IF;

END $$;

-- ============================================================================
-- 3. VERIFY SETUP
-- ============================================================================
SELECT 
  o.name as organization_name,
  p.full_name as profile_name,
  p.email,
  p.role,
  p.crm_role
FROM profiles p
JOIN organizations o ON o.id = p.organization_id
WHERE p.user_id = '0bafef11-5e2b-4752-a6d8-9c1fbb48895e';

-- Show CRM modules
SELECT key, name, description FROM crm_modules ORDER BY display_order;

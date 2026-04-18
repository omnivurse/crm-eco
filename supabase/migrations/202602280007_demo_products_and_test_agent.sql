-- ============================================================================
-- Fix: Patch sync_advisor_to_crm_records trigger to use organization_id
-- (advisors table does not have an org_id column)
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_advisor_to_crm_records()
RETURNS TRIGGER AS $$
DECLARE
  v_module_id uuid;
  v_owner_id uuid;
  v_org_id uuid;
  v_data jsonb;
BEGIN
  -- Determine the org_id (advisors table uses organization_id)
  IF TG_OP = 'DELETE' THEN
    v_org_id := OLD.organization_id;
  ELSE
    v_org_id := NEW.organization_id;
  END IF;

  -- Find the "advisors" CRM module for this org
  SELECT id INTO v_module_id
    FROM crm_modules
    WHERE org_id = v_org_id AND key = 'advisors';

  IF v_module_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  -- Get owner (profile_id of the advisor)
  IF TG_OP != 'DELETE' THEN
    v_owner_id := NEW.profile_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_data := jsonb_build_object(
      'advisor_code', NEW.advisor_code,
      'first_name', NEW.first_name,
      'last_name', NEW.last_name,
      'agency_name', NEW.agency_name,
      'license_number', NEW.license_number,
      'npn', NEW.npn,
      'commission_tier', NEW.commission_tier,
      'enrollment_code', NEW.enrollment_code,
      'contract_date', NEW.contract_date,
      'primary_channel', NEW.primary_channel,
      'agent_role', NEW.agent_role
    );

    INSERT INTO crm_records (
      org_id, module_id, owner_id,
      title, status, email, phone,
      data, system,
      created_at, updated_at
    ) VALUES (
      v_org_id,
      v_module_id,
      v_owner_id,
      NEW.first_name || ' ' || NEW.last_name,
      NEW.status,
      NEW.email,
      NEW.phone,
      v_data,
      jsonb_build_object(
        'source_table', 'advisors',
        'source_id', NEW.id::text,
        'advisor_code', NEW.advisor_code,
        'synced', true
      ),
      NEW.created_at,
      now()
    );

  ELSIF TG_OP = 'UPDATE' THEN
    v_data := jsonb_build_object(
      'advisor_code', NEW.advisor_code,
      'first_name', NEW.first_name,
      'last_name', NEW.last_name,
      'agency_name', NEW.agency_name,
      'license_number', NEW.license_number,
      'npn', NEW.npn,
      'commission_tier', NEW.commission_tier,
      'enrollment_code', NEW.enrollment_code,
      'contract_date', NEW.contract_date,
      'primary_channel', NEW.primary_channel,
      'agent_role', NEW.agent_role
    );

    UPDATE crm_records SET
      title = NEW.first_name || ' ' || NEW.last_name,
      status = NEW.status,
      email = NEW.email,
      phone = NEW.phone,
      data = v_data,
      owner_id = v_owner_id,
      updated_at = now()
    WHERE module_id = v_module_id
      AND system->>'source_table' = 'advisors'
      AND system->>'source_id' = NEW.id::text;

  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM crm_records
    WHERE module_id = v_module_id
      AND system->>'source_table' = 'advisors'
      AND system->>'source_id' = OLD.id::text;

    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Demo Products, Test Advisor, and Landing Pages
-- Seeds the system with 3 health-share plans, a test advisor, a company
-- landing page, and a test-advisor landing page so the full enrollment
-- pipeline can be verified end-to-end.
-- ============================================================================

DO $$
DECLARE
  v_org_id uuid;
  v_plan_essential_id uuid;
  v_plan_premium_id uuid;
  v_plan_complete_id uuid;
  v_test_advisor_id uuid;
BEGIN
  -- Get the first (primary) organization
  SELECT id INTO v_org_id FROM organizations LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found -- skipping demo seed.';
    RETURN;
  END IF;

  -- ==========================================================================
  -- 1. INSERT 3 DEMO PLANS (idempotent via ON CONFLICT on org + code)
  -- ==========================================================================

  -- Essential Health
  INSERT INTO plans (
    organization_id, name, code, label, description,
    product_line, coverage_category, tier, provider,
    monthly_share, enrollment_fee, iua_amount, default_iua, max_annual_share,
    is_active, hide_from_public
  ) VALUES (
    v_org_id,
    'Essential Health',
    'HLTH-ESS',
    'Essential',
    'Core health sharing for individuals. Covers primary care, emergency room visits, hospitalization, and preventive care benefits.',
    'Health Share',
    'Primary Health',
    'Bronze',
    'Pay It Forward Health',
    149.00, 125.00, 2500.00, 2500.00, 100000.00,
    true, false
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_plan_essential_id;

  -- If we didn't insert (already exists), look it up
  IF v_plan_essential_id IS NULL THEN
    SELECT id INTO v_plan_essential_id
    FROM plans WHERE organization_id = v_org_id AND code = 'HLTH-ESS';
  END IF;

  -- Premium Health
  INSERT INTO plans (
    organization_id, name, code, label, description,
    product_line, coverage_category, tier, provider,
    monthly_share, enrollment_fee, iua_amount, default_iua, max_annual_share,
    is_active, hide_from_public
  ) VALUES (
    v_org_id,
    'Premium Health',
    'HLTH-PRM',
    'Premium',
    'Comprehensive family coverage. Everything in Essential plus specialist visits, mental health support, prescription assistance, and lower per-incident sharing.',
    'Health Share',
    'Primary Health',
    'Silver',
    'Pay It Forward Health',
    249.00, 125.00, 1500.00, 1500.00, 250000.00,
    true, false
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_plan_premium_id;

  IF v_plan_premium_id IS NULL THEN
    SELECT id INTO v_plan_premium_id
    FROM plans WHERE organization_id = v_org_id AND code = 'HLTH-PRM';
  END IF;

  -- Complete Health
  INSERT INTO plans (
    organization_id, name, code, label, description,
    product_line, coverage_category, tier, provider,
    monthly_share, enrollment_fee, iua_amount, default_iua, max_annual_share,
    is_active, hide_from_public
  ) VALUES (
    v_org_id,
    'Complete Health',
    'HLTH-CMP',
    'Complete',
    'Maximum coverage and benefits. Everything in Premium plus dental and vision sharing, maternity benefits, lowest per-incident share, and wellness incentives.',
    'Health Share',
    'Primary Health',
    'Gold',
    'Pay It Forward Health',
    349.00, 125.00, 500.00, 500.00, 500000.00,
    true, false
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_plan_complete_id;

  IF v_plan_complete_id IS NULL THEN
    SELECT id INTO v_plan_complete_id
    FROM plans WHERE organization_id = v_org_id AND code = 'HLTH-CMP';
  END IF;

  -- ==========================================================================
  -- 2. INSERT PRODUCT BENEFITS for each plan
  -- ==========================================================================

  -- Essential benefits
  INSERT INTO product_benefits (organization_id, plan_id, benefit_name, description, sort_order)
  VALUES
    (v_org_id, v_plan_essential_id, 'Primary care sharing', 'Visits to your primary care doctor are eligible for sharing', 1),
    (v_org_id, v_plan_essential_id, 'Emergency room visits', 'Emergency room visits are shared after the IUA is met', 2),
    (v_org_id, v_plan_essential_id, 'Hospitalization coverage', 'Inpatient hospital stays are eligible for sharing', 3),
    (v_org_id, v_plan_essential_id, 'Preventive care benefits', 'Annual wellness visits and preventive screenings', 4)
  ON CONFLICT DO NOTHING;

  -- Premium benefits
  INSERT INTO product_benefits (organization_id, plan_id, benefit_name, description, sort_order)
  VALUES
    (v_org_id, v_plan_premium_id, 'Primary care sharing', 'Visits to your primary care doctor are eligible for sharing', 1),
    (v_org_id, v_plan_premium_id, 'Emergency room visits', 'Emergency room visits are shared after the IUA is met', 2),
    (v_org_id, v_plan_premium_id, 'Hospitalization coverage', 'Inpatient hospital stays are eligible for sharing', 3),
    (v_org_id, v_plan_premium_id, 'Preventive care benefits', 'Annual wellness visits and preventive screenings', 4),
    (v_org_id, v_plan_premium_id, 'Specialist visits', 'Visits to specialists are eligible for sharing', 5),
    (v_org_id, v_plan_premium_id, 'Mental health support', 'Counseling and mental health services', 6),
    (v_org_id, v_plan_premium_id, 'Prescription assistance', 'Rx discount program and sharing for eligible prescriptions', 7),
    (v_org_id, v_plan_premium_id, 'Lower per-incident share', 'Reduced IUA compared to Essential plan', 8)
  ON CONFLICT DO NOTHING;

  -- Complete benefits
  INSERT INTO product_benefits (organization_id, plan_id, benefit_name, description, sort_order)
  VALUES
    (v_org_id, v_plan_complete_id, 'Primary care sharing', 'Visits to your primary care doctor are eligible for sharing', 1),
    (v_org_id, v_plan_complete_id, 'Emergency room visits', 'Emergency room visits are shared after the IUA is met', 2),
    (v_org_id, v_plan_complete_id, 'Hospitalization coverage', 'Inpatient hospital stays are eligible for sharing', 3),
    (v_org_id, v_plan_complete_id, 'Preventive care benefits', 'Annual wellness visits and preventive screenings', 4),
    (v_org_id, v_plan_complete_id, 'Specialist visits', 'Visits to specialists are eligible for sharing', 5),
    (v_org_id, v_plan_complete_id, 'Mental health support', 'Counseling and mental health services', 6),
    (v_org_id, v_plan_complete_id, 'Prescription assistance', 'Rx discount program and sharing for eligible prescriptions', 7),
    (v_org_id, v_plan_complete_id, 'Dental & vision sharing', 'Dental and vision care eligible for sharing', 8),
    (v_org_id, v_plan_complete_id, 'Maternity benefits', 'Pregnancy and maternity care sharing', 9),
    (v_org_id, v_plan_complete_id, 'Lowest per-incident share', 'Lowest IUA of all plans at $500', 10),
    (v_org_id, v_plan_complete_id, 'Wellness incentives', 'Rewards for healthy lifestyle choices', 11)
  ON CONFLICT DO NOTHING;

  -- ==========================================================================
  -- 3. INSERT TEST ADVISOR
  -- ==========================================================================

  INSERT INTO advisors (
    organization_id, first_name, last_name, email, phone,
    status, commission_tier, agency_name, agent_role
  ) VALUES (
    v_org_id,
    'Test', 'Advisor',
    'test-advisor@doublehelixhub.com',
    '555-000-0001',
    'active',
    'standard',
    'PIFH Test Agency',
    'Agent'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_test_advisor_id;

  IF v_test_advisor_id IS NULL THEN
    SELECT id INTO v_test_advisor_id
    FROM advisors WHERE organization_id = v_org_id AND email = 'test-advisor@doublehelixhub.com';
  END IF;

  -- ==========================================================================
  -- 4. INSERT LANDING PAGES
  -- ==========================================================================

  -- Company-level landing page (no specific advisor)
  INSERT INTO landing_pages (
    organization_id, name, slug, page_type,
    headline, subheadline,
    primary_color, secondary_color, background_style,
    plan_ids, default_advisor_id,
    is_published, published_at
  ) VALUES (
    v_org_id,
    'Pay It Forward Health - Main',
    'pifh-health',
    'enrollment',
    'Join Pay It Forward Health',
    'Affordable, community-powered health sharing for individuals and families.',
    '#0d9488', '#1e3a5f', 'gradient',
    ARRAY[v_plan_essential_id, v_plan_premium_id, v_plan_complete_id],
    NULL,
    true, now()
  )
  ON CONFLICT (organization_id, slug) DO UPDATE
  SET
    plan_ids = ARRAY[v_plan_essential_id, v_plan_premium_id, v_plan_complete_id],
    is_published = true,
    updated_at = now();

  -- Test advisor landing page
  INSERT INTO landing_pages (
    organization_id, name, slug, page_type,
    headline, subheadline,
    primary_color, secondary_color, background_style,
    plan_ids, default_advisor_id,
    is_published, published_at
  ) VALUES (
    v_org_id,
    'Test Advisor Enrollment',
    'test-advisor',
    'enrollment',
    'Your Health Sharing Partner',
    'I''m here to help you find the perfect health sharing plan for your family.',
    '#0d9488', '#047474', 'gradient',
    ARRAY[v_plan_essential_id, v_plan_premium_id, v_plan_complete_id],
    v_test_advisor_id,
    true, now()
  )
  ON CONFLICT (organization_id, slug) DO UPDATE
  SET
    plan_ids = ARRAY[v_plan_essential_id, v_plan_premium_id, v_plan_complete_id],
    default_advisor_id = v_test_advisor_id,
    is_published = true,
    updated_at = now();

  RAISE NOTICE 'Demo seed complete: 3 plans (% / % / %), test advisor %, and 2 landing pages created.',
    v_plan_essential_id, v_plan_premium_id, v_plan_complete_id, v_test_advisor_id;
END $$;

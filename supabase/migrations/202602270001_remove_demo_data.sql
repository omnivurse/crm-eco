-- ============================================================================
-- Remove demo data that was incorrectly inserted via migration
-- 202602280007_demo_products_and_test_agent.sql
--
-- The trigger function fix (sync_advisor_to_crm_records) from that migration
-- is legitimate and stays. Only the demo seed data is removed here.
-- Demo data has been moved to supabase/seed/demo_products.sql for local dev.
-- ============================================================================

DO $$
DECLARE
  v_org_id uuid;
  v_plan_ids uuid[];
  v_advisor_id uuid;
BEGIN
  -- Find the org that received demo data
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  -- Collect demo plan IDs
  SELECT array_agg(id) INTO v_plan_ids
  FROM plans
  WHERE organization_id = v_org_id
    AND code IN ('HLTH-ESS', 'HLTH-PRM', 'HLTH-CMP');

  -- Remove demo landing pages (by slug)
  DELETE FROM landing_pages
  WHERE organization_id = v_org_id
    AND slug IN ('pif-health', 'test-advisor');

  -- Remove demo product benefits
  IF v_plan_ids IS NOT NULL THEN
    DELETE FROM product_benefits
    WHERE organization_id = v_org_id
      AND plan_id = ANY(v_plan_ids);
  END IF;

  -- Remove test advisor
  SELECT id INTO v_advisor_id
  FROM advisors
  WHERE organization_id = v_org_id
    AND email = 'test-advisor@pifhealth.com';

  IF v_advisor_id IS NOT NULL THEN
    -- Clean up any CRM records synced from this advisor
    DELETE FROM crm_records
    WHERE org_id = v_org_id
      AND system->>'source_table' = 'advisors'
      AND system->>'source_id' = v_advisor_id::text;

    DELETE FROM advisors WHERE id = v_advisor_id;
  END IF;

  -- Remove demo plans
  IF v_plan_ids IS NOT NULL THEN
    DELETE FROM plans
    WHERE id = ANY(v_plan_ids);
  END IF;

  RAISE NOTICE 'Demo data cleanup complete for org %', v_org_id;
END $$;

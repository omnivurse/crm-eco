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

  -- Nullify default_plan_id on landing pages referencing demo plans
  IF v_plan_ids IS NOT NULL THEN
    UPDATE landing_pages SET default_plan_id = NULL
    WHERE default_plan_id = ANY(v_plan_ids);
  END IF;

  -- Remove demo landing pages (by slug)
  DELETE FROM landing_pages
  WHERE organization_id = v_org_id
    AND slug IN ('dhh-health', 'test-advisor');

  -- Remove all FK-dependent rows for demo plans
  IF v_plan_ids IS NOT NULL THEN
    DELETE FROM product_audit_log WHERE plan_id = ANY(v_plan_ids);
    DELETE FROM product_feature_mappings WHERE plan_id = ANY(v_plan_ids);
    DELETE FROM product_eligibility_rules WHERE plan_id = ANY(v_plan_ids);
    DELETE FROM product_iua WHERE plan_id = ANY(v_plan_ids);
    DELETE FROM product_age_brackets WHERE plan_id = ANY(v_plan_ids);
    DELETE FROM product_pricing_matrix WHERE plan_id = ANY(v_plan_ids);
    DELETE FROM product_extra_costs WHERE plan_id = ANY(v_plan_ids);
    DELETE FROM plan_rate_sets WHERE plan_id = ANY(v_plan_ids);
    DELETE FROM product_benefits
    WHERE organization_id = v_org_id
      AND plan_id = ANY(v_plan_ids);
    DELETE FROM enrollments WHERE selected_plan_id = ANY(v_plan_ids);
    DELETE FROM memberships WHERE plan_id = ANY(v_plan_ids);
  END IF;

  -- Remove test advisor
  SELECT id INTO v_advisor_id
  FROM advisors
  WHERE organization_id = v_org_id
    AND email = 'test-advisor@doublehelixhub.com';

  IF v_advisor_id IS NOT NULL THEN
    -- Clean up any CRM records synced from this advisor
    DELETE FROM crm_records
    WHERE org_id = v_org_id
      AND system->>'source_table' = 'advisors'
      AND system->>'source_id' = v_advisor_id::text;

    DELETE FROM advisors WHERE id = v_advisor_id;
  END IF;

  -- Remove demo plans (disable audit trigger to avoid FK violation)
  IF v_plan_ids IS NOT NULL THEN
    ALTER TABLE plans DISABLE TRIGGER plans_audit_trigger;
    DELETE FROM plans
    WHERE id = ANY(v_plan_ids);
    ALTER TABLE plans ENABLE TRIGGER plans_audit_trigger;
  END IF;

  RAISE NOTICE 'Demo data cleanup complete for org %', v_org_id;
END $$;

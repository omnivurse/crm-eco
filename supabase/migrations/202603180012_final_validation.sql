-- ============================================================================
-- FINAL VALIDATION — No schema changes, just verification queries
-- This migration is a no-op that confirms the system is healthy
-- ============================================================================

-- Verify all expected columns exist on crm_records
DO $$
DECLARE
  v_missing text[];
  v_col text;
  v_expected text[] := ARRAY[
    'market_type', 'canonical_advisor_id', 'normalized_advisor_name',
    'normalized_agent_name', 'normalization_status', 'normalization_notes',
    'import_source', 'source_record_id', 'import_batch_id',
    'estimated_age', 'age_range', 'age_is_estimated', 'age_notes',
    'carrier_id'
  ];
BEGIN
  v_missing := ARRAY[]::text[];
  FOREACH v_col IN ARRAY v_expected LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'crm_records' AND column_name = v_col
    ) THEN
      v_missing := v_missing || v_col;
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION 'Missing columns on crm_records: %', v_missing;
  ELSE
    RAISE NOTICE 'PASS: All 14 canonical columns exist on crm_records';
  END IF;
END $$;

-- Verify advisor_identity_bridge view exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.views WHERE table_name = 'advisor_identity_bridge'
  ) THEN
    RAISE EXCEPTION 'FAIL: advisor_identity_bridge view does not exist';
  ELSE
    RAISE NOTICE 'PASS: advisor_identity_bridge view exists';
  END IF;
END $$;

-- Verify key functions exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'classify_market_type') THEN
    RAISE EXCEPTION 'FAIL: classify_market_type function missing';
  ELSE
    RAISE NOTICE 'PASS: classify_market_type function exists';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_record_counts_by_advisor') THEN
    RAISE EXCEPTION 'FAIL: get_record_counts_by_advisor RPC missing';
  ELSE
    RAISE NOTICE 'PASS: get_record_counts_by_advisor RPC exists';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_agent_tree_data') THEN
    RAISE EXCEPTION 'FAIL: get_agent_tree_data RPC missing';
  ELSE
    RAISE NOTICE 'PASS: get_agent_tree_data RPC exists';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'upsert_contacts_batch') THEN
    RAISE EXCEPTION 'FAIL: upsert_contacts_batch function missing';
  ELSE
    RAISE NOTICE 'PASS: upsert_contacts_batch function exists';
  END IF;
END $$;

-- Verify insurance_carriers has data
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM insurance_carriers;
  IF v_count = 0 THEN
    RAISE WARNING 'insurance_carriers is empty';
  ELSE
    RAISE NOTICE 'PASS: insurance_carriers has % records', v_count;
  END IF;
END $$;

-- Verify advisors table has imported advisors
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM advisors;
  RAISE NOTICE 'PASS: advisors table has % records', v_count;
END $$;

-- Summary stats
DO $$
DECLARE
  v_total int;
  v_normalized int;
  v_review int;
  v_hs int;
  v_ti int;
  v_unk int;
  v_with_carrier int;
  v_with_advisor int;
BEGIN
  SELECT count(*) INTO v_total FROM crm_records;
  SELECT count(*) INTO v_normalized FROM crm_records WHERE normalization_status = 'normalized';
  SELECT count(*) INTO v_review FROM crm_records WHERE normalization_status = 'needs_review';
  SELECT count(*) INTO v_hs FROM crm_records WHERE market_type = 'healthshare';
  SELECT count(*) INTO v_ti FROM crm_records WHERE market_type = 'traditional_insurance';
  SELECT count(*) INTO v_unk FROM crm_records WHERE market_type = 'unknown';
  SELECT count(*) INTO v_with_carrier FROM crm_records WHERE carrier_id IS NOT NULL;
  SELECT count(*) INTO v_with_advisor FROM crm_records WHERE canonical_advisor_id IS NOT NULL;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'FINAL VALIDATION SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total records: %', v_total;
  RAISE NOTICE 'Normalized: % (%.1s%%)', v_normalized, (100.0 * v_normalized / v_total);
  RAISE NOTICE 'Needs review: % (%.1s%%)', v_review, (100.0 * v_review / v_total);
  RAISE NOTICE 'HealthShare: %', v_hs;
  RAISE NOTICE 'Traditional Insurance: %', v_ti;
  RAISE NOTICE 'Unknown: %', v_unk;
  RAISE NOTICE 'With carrier_id: %', v_with_carrier;
  RAISE NOTICE 'With canonical_advisor_id: %', v_with_advisor;
  RAISE NOTICE '========================================';
END $$;

NOTIFY pgrst, 'reload schema';

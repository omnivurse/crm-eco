-- ============================================================================
-- LAUNCH COMPLETION — CARRIER INVENTORY, POPULATION, AND BACKFILL
--
-- This migration:
-- 1. Extracts distinct raw carrier/product values from imported CRM data
-- 2. Classifies them as healthshare/insurance/short_term
-- 3. Inserts them into insurance_carriers (idempotent, ON CONFLICT DO NOTHING)
-- 4. Re-runs 3-pass carrier backfill to link crm_records to carrier_id
-- ============================================================================

-- ============================================================================
-- STEP 1: AUTO-POPULATE INSURANCE_CARRIERS FROM RAW IMPORTED DATA
-- ============================================================================

DO $$
DECLARE
  v_org_id uuid;
  v_raw text;
  v_type text;
  v_inserted int := 0;
  v_skipped int := 0;
BEGIN
  -- Get the organization ID
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE WARNING 'No organization found — skipping carrier population';
    RETURN;
  END IF;

  -- -------------------------------------------------------
  -- Pass A: Extract from data->>'carrier' (direct carrier names)
  -- -------------------------------------------------------
  FOR v_raw IN
    SELECT DISTINCT TRIM(data->>'carrier') AS val
    FROM crm_records
    WHERE data->>'carrier' IS NOT NULL
      AND TRIM(data->>'carrier') != ''
    ORDER BY val
  LOOP
    -- Classify carrier type
    IF v_raw ~* '(health\s*share|sharing|ministry|impact|knew\s*health|oneshare|sedera|liberty|zion|aliera|medishare|samaritan|mpowering|mpb|mpower|jericho|unite|chr\b)' THEN
      v_type := 'healthshare';
    ELSIF v_raw ~* '(medicaid|chip|children.s\s*health)' THEN
      v_type := 'medicaid';
    ELSIF v_raw ~* '(short.term|gap|temporary|bridge|interim)' THEN
      v_type := 'short_term';
    ELSE
      v_type := 'insurance';
    END IF;

    BEGIN
      INSERT INTO insurance_carriers (organization_id, carrier_name, carrier_type, is_active)
      VALUES (v_org_id, v_raw, v_type, true);
      v_inserted := v_inserted + 1;
    EXCEPTION WHEN unique_violation THEN
      v_skipped := v_skipped + 1;
    END;
  END LOOP;

  RAISE NOTICE 'Pass A (carrier field): inserted=%, skipped (already exist)=%', v_inserted, v_skipped;

  -- -------------------------------------------------------
  -- Pass B: Extract from data->>'product' where it looks
  --         like a program/carrier name (HealthShare programs)
  -- -------------------------------------------------------
  v_inserted := 0;
  v_skipped := 0;

  FOR v_raw IN
    SELECT DISTINCT TRIM(data->>'product') AS val
    FROM crm_records
    WHERE data->>'product' IS NOT NULL
      AND TRIM(data->>'product') != ''
      -- Only include values that look like HealthShare program names
      -- (not generic plan descriptors like "Family", "Individual", etc.)
      AND TRIM(data->>'product') ~* '(health\s*share|sharing|ministry|impact|knew\s*health|oneshare|sedera|liberty|zion|aliera|medishare|samaritan|mpowering|mpb|mpower|jericho|unite|chr\b)'
    ORDER BY val
  LOOP
    BEGIN
      INSERT INTO insurance_carriers (organization_id, carrier_name, carrier_type, is_active)
      VALUES (v_org_id, v_raw, 'healthshare', true);
      v_inserted := v_inserted + 1;
    EXCEPTION WHEN unique_violation THEN
      v_skipped := v_skipped + 1;
    END;
  END LOOP;

  RAISE NOTICE 'Pass B (HealthShare products): inserted=%, skipped=%', v_inserted, v_skipped;
END $$;


-- ============================================================================
-- STEP 2: RE-RUN 3-PASS CARRIER BACKFILL
-- (Same logic as Phase 5 migration but runs after population)
-- ============================================================================

-- Pass 1: Exact case-insensitive carrier_name match
UPDATE crm_records r
SET carrier_id = ic.id
FROM insurance_carriers ic
WHERE r.carrier_id IS NULL
  AND r.data->>'carrier' IS NOT NULL
  AND NULLIF(TRIM(r.data->>'carrier'), '') IS NOT NULL
  AND ic.organization_id = r.org_id
  AND LOWER(TRIM(r.data->>'carrier')) = LOWER(TRIM(ic.carrier_name));

-- Pass 2: Partial match — carrier_name contained in raw text
UPDATE crm_records r
SET carrier_id = ic.id
FROM insurance_carriers ic
WHERE r.carrier_id IS NULL
  AND r.data->>'carrier' IS NOT NULL
  AND NULLIF(TRIM(r.data->>'carrier'), '') IS NOT NULL
  AND ic.organization_id = r.org_id
  AND LOWER(TRIM(r.data->>'carrier')) LIKE '%' || LOWER(TRIM(ic.carrier_name)) || '%'
  -- Avoid matching on very short carrier names that could cause false positives
  AND LENGTH(TRIM(ic.carrier_name)) >= 4;

-- Pass 3: Product-name match for HealthShare programs
UPDATE crm_records r
SET carrier_id = ic.id
FROM insurance_carriers ic
WHERE r.carrier_id IS NULL
  AND r.data->>'product' IS NOT NULL
  AND ic.organization_id = r.org_id
  AND ic.carrier_type = 'healthshare'
  AND LOWER(TRIM(r.data->>'product')) LIKE '%' || LOWER(TRIM(ic.carrier_name)) || '%'
  AND LENGTH(TRIM(ic.carrier_name)) >= 4;


NOTIFY pgrst, 'reload schema';

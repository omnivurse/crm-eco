-- ============================================================================
-- DATA QUALITY CLEANUP
-- 1. Merge duplicate carriers
-- 2. Fix misclassified carriers
-- 3. Deactivate junk carriers
-- 4. Reclassify unknown market_type records
-- ============================================================================

-- ============================================================================
-- SECTION 1: CARRIER DEDUPLICATION
-- Strategy: pick the canonical name, update all linked records, delete dupes
-- ============================================================================

-- Helper: merge carrier B into carrier A (repoint records, delete B)
CREATE OR REPLACE FUNCTION _merge_carrier(p_keep_id uuid, p_remove_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE crm_records SET carrier_id = p_keep_id WHERE carrier_id = p_remove_id;
  DELETE FROM insurance_carriers WHERE id = p_remove_id;
END;
$$;

-- Liberty HealthShare variants → keep "Liberty HealthShare"
DO $$
DECLARE
  v_keep_id uuid;
  v_dup_id uuid;
BEGIN
  SELECT id INTO v_keep_id FROM insurance_carriers WHERE carrier_name = 'Liberty HealthShare' LIMIT 1;
  IF v_keep_id IS NOT NULL THEN
    FOR v_dup_id IN SELECT id FROM insurance_carriers WHERE carrier_name IN ('Liberty Health Share', 'LibertyHealthShare') AND id != v_keep_id LOOP
      PERFORM _merge_carrier(v_keep_id, v_dup_id);
    END LOOP;
  END IF;
END $$;

-- MPB Direct variants → keep "MPB Direct (27200)"
DO $$
DECLARE v_keep_id uuid; v_dup_id uuid;
BEGIN
  SELECT id INTO v_keep_id FROM insurance_carriers WHERE TRIM(carrier_name) = 'MPB Direct (27200)' LIMIT 1;
  IF v_keep_id IS NOT NULL THEN
    FOR v_dup_id IN SELECT id FROM insurance_carriers WHERE TRIM(carrier_name) = 'MPB Direct (27200)' AND id != v_keep_id LOOP
      PERFORM _merge_carrier(v_keep_id, v_dup_id);
    END LOOP;
    -- Also fix the name if it had extra spaces
    UPDATE insurance_carriers SET carrier_name = 'MPB Direct (27200)' WHERE id = v_keep_id;
  END IF;
END $$;

-- MPowering Secure Care variants → keep "MPowering Secure Care (35768)"
DO $$
DECLARE v_keep_id uuid; v_dup_id uuid;
BEGIN
  SELECT id INTO v_keep_id FROM insurance_carriers WHERE carrier_name = 'MPowering Secure Care - 35768' LIMIT 1;
  IF v_keep_id IS NULL THEN
    SELECT id INTO v_keep_id FROM insurance_carriers WHERE TRIM(carrier_name) LIKE 'MPowering Secure Care%35768%' LIMIT 1;
  END IF;
  IF v_keep_id IS NOT NULL THEN
    FOR v_dup_id IN SELECT id FROM insurance_carriers WHERE TRIM(carrier_name) LIKE 'MPowering Secure Care%35768%' AND id != v_keep_id LOOP
      PERFORM _merge_carrier(v_keep_id, v_dup_id);
    END LOOP;
    UPDATE insurance_carriers SET carrier_name = 'MPowering Secure Care (35768)' WHERE id = v_keep_id;
  END IF;
END $$;

-- MPowering Care Plus variants → keep "MPowering Care Plus (35693)"
DO $$
DECLARE v_keep_id uuid; v_dup_id uuid;
BEGIN
  SELECT id INTO v_keep_id FROM insurance_carriers WHERE carrier_name = 'MPowering Care Plus - 35693' LIMIT 1;
  IF v_keep_id IS NULL THEN
    SELECT id INTO v_keep_id FROM insurance_carriers WHERE carrier_name = 'MPowering Care Plus (35693)' LIMIT 1;
  END IF;
  IF v_keep_id IS NOT NULL THEN
    FOR v_dup_id IN SELECT id FROM insurance_carriers WHERE (carrier_name = 'MPowering Care Plus - 35693' OR carrier_name = 'MPowering Care Plus (35693)') AND id != v_keep_id LOOP
      PERFORM _merge_carrier(v_keep_id, v_dup_id);
    END LOOP;
    UPDATE insurance_carriers SET carrier_name = 'MPowering Care Plus (35693)' WHERE id = v_keep_id;
  END IF;
END $$;

-- MPowering Direct Care variants → keep "MPowering Direct Care (35770)"
DO $$
DECLARE v_keep_id uuid; v_dup_id uuid;
BEGIN
  SELECT id INTO v_keep_id FROM insurance_carriers WHERE carrier_name = 'MPowering Direct Care - 35770' LIMIT 1;
  IF v_keep_id IS NULL THEN
    SELECT id INTO v_keep_id FROM insurance_carriers WHERE carrier_name = 'MPowering Direct Care (35770)' LIMIT 1;
  END IF;
  IF v_keep_id IS NOT NULL THEN
    FOR v_dup_id IN SELECT id FROM insurance_carriers WHERE (carrier_name = 'MPowering Direct Care - 35770' OR carrier_name = 'MPowering Direct Care (35770)') AND id != v_keep_id LOOP
      PERFORM _merge_carrier(v_keep_id, v_dup_id);
    END LOOP;
    UPDATE insurance_carriers SET carrier_name = 'MPowering Direct Care (35770)' WHERE id = v_keep_id;
  END IF;
END $$;

-- MPowering Care / MPB Care (28009) → keep "MPB Care (28009)"
DO $$
DECLARE v_keep_id uuid; v_dup_id uuid;
BEGIN
  SELECT id INTO v_keep_id FROM insurance_carriers WHERE carrier_name = 'MPB Care (28009)' LIMIT 1;
  IF v_keep_id IS NOT NULL THEN
    FOR v_dup_id IN SELECT id FROM insurance_carriers WHERE carrier_name = 'MPowering Care - 28009' AND id != v_keep_id LOOP
      PERFORM _merge_carrier(v_keep_id, v_dup_id);
    END LOOP;
  END IF;
END $$;

-- MPB CareZ Connected Worksite (30658) dupes
DO $$
DECLARE v_keep_id uuid; v_dup_id uuid;
BEGIN
  SELECT id INTO v_keep_id FROM insurance_carriers WHERE carrier_name LIKE 'MPB CareZ%Connected Worksite%30658%' LIMIT 1;
  IF v_keep_id IS NOT NULL THEN
    FOR v_dup_id IN SELECT id FROM insurance_carriers WHERE carrier_name LIKE 'MPB CareZ%Connected Worksite%30658%' AND id != v_keep_id LOOP
      PERFORM _merge_carrier(v_keep_id, v_dup_id);
    END LOOP;
    UPDATE insurance_carriers SET carrier_name = 'MPB CareZ Connected Worksite (30658)' WHERE id = v_keep_id;
  END IF;
END $$;

-- BC/BS + BCBS → merge into "BCBS"
DO $$
DECLARE v_keep_id uuid; v_dup_id uuid;
BEGIN
  SELECT id INTO v_keep_id FROM insurance_carriers WHERE carrier_name = 'BCBS' LIMIT 1;
  IF v_keep_id IS NOT NULL THEN
    FOR v_dup_id IN SELECT id FROM insurance_carriers WHERE carrier_name = 'BC/BS' AND id != v_keep_id LOOP
      PERFORM _merge_carrier(v_keep_id, v_dup_id);
    END LOOP;
  END IF;
END $$;

-- Fix typo: "Anthem BCBS - Virgina" → "Anthem BCBS - Virginia"
DO $$
DECLARE v_keep_id uuid; v_dup_id uuid;
BEGIN
  SELECT id INTO v_keep_id FROM insurance_carriers WHERE carrier_name = 'Anthem BCBS - Virginia' LIMIT 1;
  IF v_keep_id IS NOT NULL THEN
    FOR v_dup_id IN SELECT id FROM insurance_carriers WHERE carrier_name = 'Anthem BCBS - Virgina' AND id != v_keep_id LOOP
      PERFORM _merge_carrier(v_keep_id, v_dup_id);
    END LOOP;
  ELSE
    UPDATE insurance_carriers SET carrier_name = 'Anthem BCBS - Virginia' WHERE carrier_name = 'Anthem BCBS - Virgina';
  END IF;
END $$;

-- Drop the helper function
DROP FUNCTION IF EXISTS _merge_carrier(uuid, uuid);

-- ============================================================================
-- SECTION 2: FIX MISCLASSIFIED CARRIERS
-- ============================================================================

-- United Healthcare is insurance, not healthshare
UPDATE insurance_carriers
SET carrier_type = 'insurance'
WHERE carrier_name = 'United Healthcare' AND carrier_type = 'healthshare';

-- ============================================================================
-- SECTION 3: DEACTIVATE JUNK CARRIERS
-- ============================================================================

UPDATE insurance_carriers
SET is_active = false
WHERE carrier_name IN ('No', 'Other', 'To Be Determined');

-- ============================================================================
-- SECTION 4: RECLASSIFY UNKNOWN MARKET_TYPE RECORDS
-- Much broader pattern matching than the original classify_market_type
-- ============================================================================

-- "Health Sharing" product → healthshare
UPDATE crm_records
SET market_type = 'healthshare',
    normalization_notes = COALESCE(normalization_notes, '') || ' | Reclassified: product=Health Sharing'
WHERE market_type = 'unknown'
  AND LOWER(TRIM(data->>'product')) = 'health sharing';

-- MPB/MPowering products → healthshare
UPDATE crm_records
SET market_type = 'healthshare',
    normalization_notes = COALESCE(normalization_notes, '') || ' | Reclassified: MPB/MPowering product'
WHERE market_type = 'unknown'
  AND (
    data->>'product' ILIKE 'MPB%'
    OR data->>'product' ILIKE 'MPowering%'
    OR data->>'product' ILIKE '%Essentials%'
    OR data->>'product' ILIKE '%MEC%'
    OR data->>'product' ILIKE '%Redirect%'
    OR data->>'product' ILIKE '%Self Directed%'
    OR data->>'product' ILIKE '%Co-Pay%'
    OR data->>'product' ILIKE '%Secure%'
    OR data->>'product' ILIKE '%Care Plus%'
    OR data->>'product' ILIKE '%Healthcare Essentials%'
    OR data->>'product' ILIKE '%Partially Self%'
    OR data->>'product' ILIKE '%Provider Directed%'
  );

-- "Health Insurance" product → traditional_insurance
UPDATE crm_records
SET market_type = 'traditional_insurance',
    normalization_notes = COALESCE(normalization_notes, '') || ' | Reclassified: product=Health Insurance'
WHERE market_type = 'unknown'
  AND LOWER(TRIM(data->>'product')) = 'health insurance';

-- "Insurance" product → traditional_insurance
UPDATE crm_records
SET market_type = 'traditional_insurance',
    normalization_notes = COALESCE(normalization_notes, '') || ' | Reclassified: product=Insurance'
WHERE market_type = 'unknown'
  AND LOWER(TRIM(data->>'product')) = 'insurance';

-- "Group Health Insurance" → traditional_insurance
UPDATE crm_records
SET market_type = 'traditional_insurance',
    normalization_notes = COALESCE(normalization_notes, '') || ' | Reclassified: product=Group Health Insurance'
WHERE market_type = 'unknown'
  AND LOWER(TRIM(data->>'product')) = 'group health insurance';

-- Records with known insurance carriers but unknown market type
UPDATE crm_records r
SET market_type = 'traditional_insurance',
    normalization_notes = COALESCE(r.normalization_notes, '') || ' | Reclassified: carrier is insurance type'
FROM insurance_carriers ic
WHERE r.market_type = 'unknown'
  AND r.carrier_id = ic.id
  AND ic.carrier_type = 'insurance';

-- Records with known healthshare carriers but unknown market type
UPDATE crm_records r
SET market_type = 'healthshare',
    normalization_notes = COALESCE(r.normalization_notes, '') || ' | Reclassified: carrier is healthshare type'
FROM insurance_carriers ic
WHERE r.market_type = 'unknown'
  AND r.carrier_id = ic.id
  AND ic.carrier_type = 'healthshare';

-- Records with "To Be Determined" as both product and carrier — remain unknown
-- but mark normalization_status as needs_review
UPDATE crm_records
SET normalization_status = 'needs_review',
    normalization_notes = COALESCE(normalization_notes, '') || ' | No classifiable product or carrier data'
WHERE market_type = 'unknown'
  AND normalization_status != 'needs_review';

-- ============================================================================
-- SECTION 5: UPDATE NORMALIZATION STATUS FOR RECLASSIFIED RECORDS
-- ============================================================================

UPDATE crm_records
SET normalization_status = 'normalized'
WHERE market_type IN ('healthshare', 'traditional_insurance')
  AND normalization_status != 'normalized'
  AND (canonical_advisor_id IS NOT NULL OR normalized_advisor_name IS NOT NULL OR normalized_agent_name IS NOT NULL);

-- ============================================================================
-- SECTION 6: TRIM WHITESPACE FROM ALL CARRIER NAMES
-- ============================================================================

UPDATE insurance_carriers
SET carrier_name = TRIM(carrier_name)
WHERE carrier_name != TRIM(carrier_name);

NOTIFY pgrst, 'reload schema';

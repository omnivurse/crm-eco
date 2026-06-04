-- ============================================================================
-- FINAL CARRIER DEDUP — catch internal whitespace duplicates
-- ============================================================================

-- MPB Direct with extra internal spaces
DO $$
DECLARE v_keep_id uuid; v_dup_id uuid;
BEGIN
  SELECT id INTO v_keep_id FROM insurance_carriers WHERE carrier_name = 'MPB Direct (27200)' LIMIT 1;
  IF v_keep_id IS NOT NULL THEN
    FOR v_dup_id IN
      SELECT id FROM insurance_carriers
      WHERE id != v_keep_id AND REGEXP_REPLACE(carrier_name, '\s+', ' ', 'g') = 'MPB Direct (27200)'
    LOOP
      UPDATE crm_records SET carrier_id = v_keep_id WHERE carrier_id = v_dup_id;
      DELETE FROM insurance_carriers WHERE id = v_dup_id;
    END LOOP;
  END IF;
END $$;

-- Normalize ALL carrier names: collapse multiple spaces into single space
UPDATE insurance_carriers
SET carrier_name = REGEXP_REPLACE(TRIM(carrier_name), '\s+', ' ', 'g')
WHERE carrier_name ~ '\s{2,}' OR carrier_name != TRIM(carrier_name);

NOTIFY pgrst, 'reload schema';

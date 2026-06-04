-- ============================================================================
-- Create advisor records from imported names and link crm_records
-- Disables sync trigger to avoid duplicate CRM record creation
-- ============================================================================

-- Disable all triggers on advisors during bulk insert
ALTER TABLE advisors DISABLE TRIGGER USER;

DO $$
DECLARE
  v_org_id uuid;
  v_name text;
  v_first text;
  v_last text;
  v_advisor_id uuid;
  v_inserted int := 0;
  v_counter int := 0;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;

  FOR v_name IN
    SELECT DISTINCT normalized_advisor_name
    FROM crm_records
    WHERE normalized_advisor_name IS NOT NULL
      AND TRIM(normalized_advisor_name) != ''
      AND canonical_advisor_id IS NULL
    ORDER BY normalized_advisor_name
  LOOP
    v_first := SPLIT_PART(TRIM(v_name), ' ', 1);
    v_last := CASE
      WHEN POSITION(' ' IN TRIM(v_name)) > 0
      THEN SUBSTRING(TRIM(v_name) FROM POSITION(' ' IN TRIM(v_name)) + 1)
      ELSE ''
    END;

    SELECT id INTO v_advisor_id FROM advisors
    WHERE organization_id = v_org_id
      AND LOWER(TRIM(first_name || ' ' || last_name)) = LOWER(TRIM(v_name))
    LIMIT 1;

    IF v_advisor_id IS NULL THEN
      v_counter := v_counter + 1;
      INSERT INTO advisors (organization_id, first_name, last_name, email, status, advisor_code)
      VALUES (v_org_id, v_first, v_last,
        LOWER(REPLACE(REPLACE(v_first, ' ', ''), ',', '') || '.' || REPLACE(REPLACE(v_last, ' ', ''), ',', '') || '+' || v_counter || '@placeholder.local'),
        'active',
        'IMP-' || LPAD(v_counter::text, 4, '0'))
      RETURNING id INTO v_advisor_id;
      v_inserted := v_inserted + 1;
    END IF;

    UPDATE crm_records
    SET canonical_advisor_id = v_advisor_id
    WHERE normalized_advisor_name IS NOT NULL
      AND LOWER(TRIM(normalized_advisor_name)) = LOWER(TRIM(v_name))
      AND canonical_advisor_id IS NULL;

  END LOOP;

  RAISE NOTICE 'Created % new advisor records', v_inserted;
END $$;

-- Re-enable all triggers
ALTER TABLE advisors ENABLE TRIGGER USER;

-- Update normalization status for newly linked records
UPDATE crm_records
SET normalization_status = 'normalized',
    normalization_notes = 'Auto-classified as ' || market_type || '; advisor matched to ' || normalized_advisor_name
WHERE canonical_advisor_id IS NOT NULL
  AND normalization_status = 'needs_review';

NOTIFY pgrst, 'reload schema';

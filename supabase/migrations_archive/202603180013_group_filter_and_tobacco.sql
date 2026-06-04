-- ============================================================================
-- GROUP FILTERING + TOBACCO USER TRACKING
-- ============================================================================

-- ============================================================================
-- SECTION 1: RECORD TYPE — individual vs group classification
-- ============================================================================

ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS record_type text;

DO $$ BEGIN
  ALTER TABLE crm_records
    ADD CONSTRAINT chk_crm_records_record_type
    CHECK (record_type IS NULL OR record_type IN ('individual', 'group', 'unknown'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_records_record_type
  ON crm_records (org_id, record_type) WHERE record_type IS NOT NULL;

COMMENT ON COLUMN crm_records.record_type IS
  'Record classification: individual member or group/employer record';

-- ============================================================================
-- SECTION 2: TOBACCO USER FIELD
-- ============================================================================

ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS tobacco_user boolean;

CREATE INDEX IF NOT EXISTS idx_crm_records_tobacco_user
  ON crm_records (org_id, tobacco_user) WHERE tobacco_user IS NOT NULL;

COMMENT ON COLUMN crm_records.tobacco_user IS
  'Whether this member is a tobacco user. NULL = unknown/not recorded.';

-- ============================================================================
-- SECTION 3: BACKFILL record_type FROM PRODUCT NAMES
-- ============================================================================

-- Group records: products containing "group" or "(GROUP)" patterns
UPDATE crm_records
SET record_type = 'group'
WHERE record_type IS NULL
  AND (
    data->>'product' ILIKE '%group%'
    OR data->>'product' ILIKE '%(GROUP)%'
    OR data->>'product' ILIKE '%group plan%'
    OR data->>'product' ILIKE '%group health%'
  );

-- Everything else is individual
UPDATE crm_records
SET record_type = 'individual'
WHERE record_type IS NULL;

-- ============================================================================
-- SECTION 4: REGISTER FIELDS IN crm_fields FOR UI VISIBILITY
-- ============================================================================

DO $$
DECLARE
  v_mod record;
BEGIN
  FOR v_mod IN
    SELECT id, org_id FROM crm_modules
    WHERE key IN ('contacts', 'leads')
  LOOP
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, is_pinned, display_order, section, tooltip, options)
    VALUES
      (v_mod.org_id, v_mod.id, 'record_type', 'Record Type', 'select', false, true, false, 108,
       'management', 'Individual member or group/employer record',
       '["individual","group","unknown"]'::jsonb),
      (v_mod.org_id, v_mod.id, 'tobacco_user', 'Tobacco User', 'boolean', false, true, false, 109,
       'management', 'Whether this member uses tobacco products', NULL)
    ON CONFLICT (module_id, key) DO NOTHING;
  END LOOP;
END $$;

-- ============================================================================
-- SECTION 5: TOBACCO COUNT RPC
-- Returns tobacco user counts for a given module, with optional filters
-- ============================================================================

CREATE OR REPLACE FUNCTION get_tobacco_counts(
  p_module_id uuid,
  p_record_type text DEFAULT NULL
)
RETURNS TABLE(
  total_records bigint,
  tobacco_users bigint,
  non_tobacco bigint,
  unknown_tobacco bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    count(*)                                          AS total_records,
    count(*) FILTER (WHERE tobacco_user = true)       AS tobacco_users,
    count(*) FILTER (WHERE tobacco_user = false)      AS non_tobacco,
    count(*) FILTER (WHERE tobacco_user IS NULL)      AS unknown_tobacco
  FROM crm_records
  WHERE module_id = p_module_id
    AND (p_record_type IS NULL OR record_type = p_record_type);
$$;

GRANT EXECUTE ON FUNCTION get_tobacco_counts(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

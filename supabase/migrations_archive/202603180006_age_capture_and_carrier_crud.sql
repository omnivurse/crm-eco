-- ============================================================================
-- PHASE 4 — FLEXIBLE AGE CAPTURE + CARRIER CRUD SUPPORT
-- ============================================================================

-- ============================================================================
-- SECTION 1: Flexible Age Capture Fields on crm_records
-- ============================================================================

ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS estimated_age integer;
ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS age_range text;
ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS age_is_estimated boolean DEFAULT false;
ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS age_notes text;

DO $$ BEGIN
  ALTER TABLE crm_records
    ADD CONSTRAINT chk_crm_records_age_range
    CHECK (age_range IS NULL OR age_range IN (
      '0-17', '18-25', '26-34', '35-44', '45-54', '55-64', '65+'
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE crm_records
    ADD CONSTRAINT chk_crm_records_estimated_age
    CHECK (estimated_age IS NULL OR (estimated_age >= 0 AND estimated_age <= 150));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_records_age_range
  ON crm_records (org_id, age_range) WHERE age_range IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_records_estimated_age
  ON crm_records (org_id, estimated_age) WHERE estimated_age IS NOT NULL;

-- Register age fields in crm_fields for UI visibility
DO $$
DECLARE
  v_org record;
  v_mod record;
BEGIN
  FOR v_org IN SELECT DISTINCT org_id FROM crm_modules LOOP
    FOR v_mod IN
      SELECT id, org_id, key FROM crm_modules
      WHERE org_id = v_org.org_id AND key IN ('contacts', 'leads')
    LOOP
      INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, is_pinned, display_order, section, tooltip, options)
      VALUES
        (v_mod.org_id, v_mod.id, 'estimated_age', 'Estimated Age', 'number', false, true, false, 125,
         'personal', 'Age estimate when exact DOB is not known', NULL),
        (v_mod.org_id, v_mod.id, 'age_range', 'Age Range', 'select', false, true, false, 126,
         'personal', 'Age bracket when exact DOB is not known',
         '["0-17","18-25","26-34","35-44","45-54","55-64","65+"]'::jsonb),
        (v_mod.org_id, v_mod.id, 'age_is_estimated', 'Age Is Estimated', 'boolean', false, true, false, 127,
         'personal', 'Whether the age value is an estimate rather than calculated from DOB', NULL),
        (v_mod.org_id, v_mod.id, 'age_notes', 'Age Notes', 'text', false, true, false, 128,
         'personal', 'Additional context about age information', NULL)
      ON CONFLICT (module_id, key) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

COMMENT ON COLUMN crm_records.estimated_age IS 'Estimated age when exact DOB is not available';
COMMENT ON COLUMN crm_records.age_range IS 'Age bracket: 0-17, 18-25, 26-34, 35-44, 45-54, 55-64, 65+';
COMMENT ON COLUMN crm_records.age_is_estimated IS 'True when age is estimated rather than calculated from DOB';
COMMENT ON COLUMN crm_records.age_notes IS 'Contextual notes about age information';

-- ============================================================================
-- SECTION 2: Add carrier_id FK to crm_records
-- Links records to the existing insurance_carriers table for normalized lookup
-- ============================================================================

ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS carrier_id uuid
  REFERENCES insurance_carriers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_records_carrier
  ON crm_records (org_id, carrier_id) WHERE carrier_id IS NOT NULL;

COMMENT ON COLUMN crm_records.carrier_id IS 'Referenced insurance carrier for this record';

-- Register carrier_id in crm_fields
DO $$
DECLARE
  v_org record;
  v_mod record;
BEGIN
  FOR v_org IN SELECT DISTINCT org_id FROM crm_modules LOOP
    FOR v_mod IN
      SELECT id, org_id, key FROM crm_modules
      WHERE org_id = v_org.org_id AND key IN ('contacts', 'leads')
    LOOP
      INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, is_pinned, display_order, section, tooltip)
      VALUES
        (v_mod.org_id, v_mod.id, 'carrier_id', 'Carrier', 'lookup', false, true, false, 120,
         'management', 'The insurance carrier or HealthShare program for this record')
      ON CONFLICT (module_id, key) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Add age fields to isSystemField list recognition
-- (This is handled in the TypeScript code edit)

NOTIFY pgrst, 'reload schema';

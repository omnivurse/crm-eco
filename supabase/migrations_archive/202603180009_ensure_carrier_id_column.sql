-- ============================================================================
-- ENSURE carrier_id column exists on crm_records
-- This is a safety net — the column was defined in 202603180006 but may
-- not have been applied if that migration partially failed.
-- ============================================================================

ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS carrier_id uuid
  REFERENCES insurance_carriers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_records_carrier
  ON crm_records (org_id, carrier_id) WHERE carrier_id IS NOT NULL;

COMMENT ON COLUMN crm_records.carrier_id IS 'Referenced insurance carrier for this record';

NOTIFY pgrst, 'reload schema';

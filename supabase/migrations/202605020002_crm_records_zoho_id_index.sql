-- =============================================================================
-- Index on `crm_records.data->>'zoho_id'` for fast CSV-update lookups.
--
-- The /crm/imports/update flow matches each row of an uploaded Zoho CSV to
-- an existing CRM record, preferring an exact `zoho_id` match before falling
-- back to email or phone. Without an index, that match is a sequential scan
-- across `crm_records` (16k+ rows already and growing). A btree on the
-- expression is the smallest, most direct fix.
--
-- Partial-by-org isn't useful (multi-tenant won't have org-spanning hits)
-- but partial-by-NOT-NULL drops ~all rows that never had a Zoho ID, which
-- keeps the index small. CONCURRENTLY would be ideal in production but
-- migrations run inside a transaction, so we use a plain CREATE INDEX —
-- table is small enough that the lock window is negligible.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_crm_records_zoho_id
  ON public.crm_records ((data->>'zoho_id'))
  WHERE data ? 'zoho_id';

COMMENT ON INDEX public.idx_crm_records_zoho_id IS
  'Speeds up CSV-update flow that matches Zoho exports by zoho_id stored in data JSONB.';

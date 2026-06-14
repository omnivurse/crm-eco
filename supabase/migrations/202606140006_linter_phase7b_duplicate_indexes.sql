-- Phase 7b: Supabase linter — duplicate_index
-- Drop redundant indexes that duplicate an existing index on the same columns.
-- Rollback: recreate dropped indexes from pg_indexes snapshot before apply.

BEGIN;

SET lock_timeout = '5s';

-- crm_records: (org_id, market_type) partial index — keep idx_* naming convention
DROP INDEX IF EXISTS public.crm_records_market_type_idx;

-- crm_records: (org_id, module_id) — keep older canonical name
DROP INDEX IF EXISTS public.crm_records_module_idx;

-- crm_reports: org_id — keep idx_crm_reports_org (matches prior db_health migration)
DROP INDEX IF EXISTS public.idx_crm_reports_organization_id;

COMMIT;

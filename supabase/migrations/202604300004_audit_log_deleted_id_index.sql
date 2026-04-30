-- Migration 202604300004 (was colliding duplicate of 202604300003; remote 003 is crm_smart_search v4.)
-- Adds an index to crm_audit_log for diff->>'deleted_id' to prevent full table scans
-- during merge resolution. The /resolve API route times out (503) without this index
-- when attempting to resolve records merged by bulk migrations that only logged the keeper.

CREATE INDEX IF NOT EXISTS idx_crm_audit_log_deleted_id 
ON public.crm_audit_log ((diff->>'deleted_id')) 
WHERE entity = 'record' AND action = 'merge';

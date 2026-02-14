-- Set longer statement timeout for import functions (10 minutes)
-- These functions process thousands of rows and need more time

ALTER FUNCTION upsert_contacts_from_staging() SET statement_timeout = '600s';
ALTER FUNCTION deduplicate_contacts() SET statement_timeout = '600s';
ALTER FUNCTION import_notes_from_staging() SET statement_timeout = '600s';

NOTIFY pgrst, 'reload schema';

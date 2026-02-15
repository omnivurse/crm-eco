-- Migration: Remove phantom 'record_id' field from Contacts and Leads modules
-- The import stores Zoho record IDs as 'zoho_record_id' in the JSONB data,
-- but the field definition used key 'record_id' which never matches any data.
-- A proper 'zoho_record_id' field already exists in the system section.

DELETE FROM crm_fields
WHERE key = 'record_id'
  AND module_id IN (
    SELECT id FROM crm_modules WHERE key IN ('contacts', 'leads')
  );

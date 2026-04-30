-- Read-only: rows where the record is in one org but its module belongs to another.
-- Symptom: list/search may show the record (title on crm_records) but /crm/r/:id/edit shows
--          "Record not found" or the new "Cannot load this record's module" because the
--          embedded crm_modules row is hidden by is_crm_member(module.org_id).
--
-- Run against your DB (e.g. psql). Scope to a tenant if needed: AND r.org_id = '...'::uuid

SELECT
  r.id AS record_id,
  r.org_id AS record_org_id,
  r.module_id,
  m.org_id AS module_org_id,
  m.key AS module_key,
  r.title
FROM public.crm_records r
JOIN public.crm_modules m ON m.id = r.module_id
WHERE r.org_id IS DISTINCT FROM m.org_id
ORDER BY r.updated_at DESC NULLS LAST
LIMIT 500;

-- READ-ONLY pre-flight discovery for the B1/B2 family-email fix (migration 202605300016).
-- Run against PROD. Wrapped in a READ ONLY transaction — it cannot write anything.
-- Purpose: gather the rehearsal numbers the migration header asks for BEFORE promoting it.
--
-- Run:  psql "<prod-conn>" -f supabase/drafts/202605300016_rehearsal_discovery.READONLY.sql

BEGIN;
SET TRANSACTION READ ONLY;

\echo '== #1 members already LOST to B1 (active member, members module exists, but NO members-module crm_record) =='
SELECT count(*) AS lost_members
FROM public.members m
WHERE m.merged_into_id IS NULL
  AND EXISTS (SELECT 1 FROM crm_modules cm
               WHERE cm.organization_id = m.organization_id AND cm.key = 'members')
  AND NOT EXISTS (
    SELECT 1 FROM crm_records r
      JOIN crm_modules cm ON cm.id = r.module_id
     WHERE cm.key = 'members'
       AND cm.organization_id = m.organization_id
       AND r.system->>'source_table' = 'members'
       AND r.system->>'source_id'    = m.id::text);

\echo '== #1b same, broken out per organization =='
SELECT m.organization_id, count(*) AS lost_members
FROM public.members m
WHERE m.merged_into_id IS NULL
  AND EXISTS (SELECT 1 FROM crm_modules cm
               WHERE cm.organization_id = m.organization_id AND cm.key = 'members')
  AND NOT EXISTS (
    SELECT 1 FROM crm_records r
      JOIN crm_modules cm ON cm.id = r.module_id
     WHERE cm.key = 'members'
       AND cm.organization_id = m.organization_id
       AND r.system->>'source_table' = 'members'
       AND r.system->>'source_id'    = m.id::text)
GROUP BY 1 ORDER BY 2 DESC;

\echo '== #2 would crm_records_members_source_uniq BUILD? (rows here = pre-existing dup source_ids that must be cleaned first; 0 = safe) =='
SELECT org_id, module_id, system->>'source_id' AS source_id, count(*) AS n
FROM crm_records
WHERE system->>'source_table' = 'members' AND system->>'source_id' IS NOT NULL
GROUP BY 1,2,3 HAVING count(*) > 1
ORDER BY n DESC LIMIT 50;

\echo '== #3 B1/B2 blast radius: active members sharing an email with a DIFFERENT-named active member (the family-shared-email population) =='
SELECT count(*) AS members_on_shared_family_emails
FROM public.members m
WHERE m.merged_into_id IS NULL AND m.email IS NOT NULL AND btrim(m.email) <> ''
  AND EXISTS (
    SELECT 1 FROM public.members m2
     WHERE m2.organization_id = m.organization_id
       AND m2.merged_into_id IS NULL
       AND lower(m2.email) = lower(m.email)
       AND (lower(btrim(m2.first_name)), lower(btrim(m2.last_name)))
        <> (lower(btrim(m.first_name)),  lower(btrim(m.last_name))));

\echo '== #3b number of distinct (org,email) family groups affected =='
SELECT count(*) AS shared_email_family_groups FROM (
  SELECT organization_id, lower(email) AS le
  FROM public.members
  WHERE merged_into_id IS NULL AND email IS NOT NULL AND btrim(email) <> ''
  GROUP BY 1,2
  HAVING count(DISTINCT lower(btrim(first_name)) || '|' || lower(btrim(last_name))) > 1
) g;

\echo '== #4 confirm idx_crm_records_unique_email still matches the ON CONFLICT target (definition snapshot) =='
SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_crm_records_unique_email';

ROLLBACK;

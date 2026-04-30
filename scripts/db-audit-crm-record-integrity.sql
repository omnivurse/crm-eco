-- CRM record integrity & visibility audit (read-only).
-- Run: npm run db:audit:records
-- Local: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD in .env
-- CI:    PIFH_SUPABASE_DB_URL (same secret as pifh-deploy-gate)
--
-- Interpreting results:
-- * orphan_module: invalid module_id FK (UI cannot load module metadata).
-- * rv_missing_record: recently_viewed pointing at deleted ids (dead rail links).
-- * merge_missing_*: merge audit rows missing kept_id/deleted_id (stale URL redirect breaks).
-- * tasks_null_record_count: OPTIONAL per schema — tasks may be "standalone" (record_id NULL).
-- * tasks_orphan_fk_count: BUG — record_id set but crm_records row missing (should be 0; fails --strict).

SELECT '== 1) crm_records row count & org distribution (top 15) ==' AS section;
SELECT org_id::text, COUNT(*) AS records
FROM public.crm_records
GROUP BY org_id
ORDER BY COUNT(*) DESC
LIMIT 15;

SELECT '== 2) Records with invalid module_id (orphan_module) ==' AS section;
SELECT COUNT(*) AS orphan_module_count
FROM public.crm_records r
LEFT JOIN public.crm_modules m ON m.id = r.module_id
WHERE m.id IS NULL;

SELECT '== 3) recently_viewed rows whose record no longer exists ==' AS section;
SELECT COUNT(*) AS rv_missing_record_count
FROM public.crm_recently_viewed v
LEFT JOIN public.crm_records r ON r.id = v.record_id
WHERE r.id IS NULL;

SELECT '== 4) Sample of stale recently_viewed (max 20) ==' AS section;
SELECT v.record_id::text, v.user_id::text, v.last_viewed_at
FROM public.crm_recently_viewed v
LEFT JOIN public.crm_records r ON r.id = v.record_id
WHERE r.id IS NULL
ORDER BY v.last_viewed_at DESC
LIMIT 20;

SELECT '== 5) merge audit rows missing kept_id in diff ==' AS section;
SELECT COUNT(*) AS merge_missing_kept_count
FROM public.crm_audit_log a
WHERE a.entity IN ('record', 'crm_records')
  AND a.action = 'merge'
  AND (
    a.diff->>'kept_id' IS NULL
    OR a.diff->>'kept_id' = ''
  );

SELECT '== 6) merge audit rows missing deleted_id in diff ==' AS section;
SELECT COUNT(*) AS merge_missing_deleted_count
FROM public.crm_audit_log a
WHERE a.entity IN ('record', 'crm_records')
  AND a.action = 'merge'
  AND (
    a.diff->>'deleted_id' IS NULL
    OR a.diff->>'deleted_id' = ''
  );

SELECT '== 7) Duplicate migration-style version strings in local history (DB) ==' AS section;
SELECT version::text, COUNT(*) AS n
FROM supabase_migrations.schema_migrations
GROUP BY version
HAVING COUNT(*) > 1;

SELECT '== 8) Notes referencing missing crm_records (sample count) ==' AS section;
SELECT COUNT(*) AS notes_orphan_record_count
FROM public.crm_notes n
LEFT JOIN public.crm_records r ON r.id = n.record_id
WHERE r.id IS NULL;

SELECT '== 9) Tasks: record_id is NULL (unassigned to a record; count) ==' AS section;
SELECT COUNT(*) AS tasks_null_record_count
FROM public.crm_tasks t
WHERE t.record_id IS NULL;

SELECT '== 9a) Tasks: record_id set but row missing from crm_records (broken FK trail) ==' AS section;
SELECT COUNT(*) AS tasks_orphan_fk_count
FROM public.crm_tasks t
LEFT JOIN public.crm_records r ON r.id = t.record_id
WHERE t.record_id IS NOT NULL AND r.id IS NULL;

SELECT '== 9b) Sample tasks with stale record_id UUID (broken FK trail, max 15) ==' AS section;
SELECT t.id::text AS task_id, t.record_id::text AS stale_record_id, t.title, t.created_at
FROM public.crm_tasks t
LEFT JOIN public.crm_records r ON r.id = t.record_id
WHERE t.record_id IS NOT NULL AND r.id IS NULL
ORDER BY t.created_at DESC
LIMIT 15;

SELECT '== 9c) Sample tasks with record_id IS NULL (max 15) ==' AS section;
SELECT t.id::text AS task_id, t.title, t.created_at
FROM public.crm_tasks t
WHERE t.record_id IS NULL
ORDER BY t.created_at DESC
LIMIT 15;

SELECT '== Done. Review *_count rows. Standalone tasks (record_id NULL) are valid by schema — only 9a/9b FK gaps need action. ==' AS section;

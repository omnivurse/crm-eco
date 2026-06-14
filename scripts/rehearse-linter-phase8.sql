-- REHEARSAL ONLY — run against staging (cammurefjywnzxnmuyfv) before production
-- Expected: 199 index creates + up to 6 PK adds; zero persistent changes after ROLLBACK

BEGIN;

\echo '=== Phase 8a rehearsal: FK covering indexes ==='
\ir ../supabase/migrations/202606150001_linter_phase8a_fk_covering_indexes.sql

-- Count remaining unindexed FKs (splinter-equivalent check)
SELECT count(*) AS remaining_unindexed_fks
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE c.contype = 'f'
  AND n.nspname = 'public'
  AND NOT EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = c.conrelid
      AND (i.indkey::smallint[])[0:array_length(c.conkey, 1) - 1] = c.conkey
  );

ROLLBACK;

BEGIN;

\echo '=== Phase 8b rehearsal: staging primary keys ==='
\ir ../supabase/migrations/202606150002_linter_phase8b_staging_primary_keys.sql

SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    '_import_contacts_staging',
    '_import_leads_staging',
    '_import_notes_staging',
    'import_contacts_staging',
    'import_leads_staging',
    'import_notes_staging'
  )
  AND indexname LIKE '%pkey';

ROLLBACK;

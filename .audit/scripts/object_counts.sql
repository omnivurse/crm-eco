-- Public-schema object counts. Used by docs/MIGRATION_CONSOLIDATION_RUNBOOK.md to prove
-- a replayed baseline matches production bit-for-bit. Run against two DBs and diff the output.
SELECT 'tables'   AS object, count(*) AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p')
UNION ALL SELECT 'views',     count(*) FROM pg_views    WHERE schemaname='public'
UNION ALL SELECT 'matviews',  count(*) FROM pg_matviews WHERE schemaname='public'
UNION ALL SELECT 'functions', count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
UNION ALL SELECT 'policies',  count(*) FROM pg_policies WHERE schemaname='public'
UNION ALL SELECT 'triggers',  count(*) FROM information_schema.triggers WHERE trigger_schema='public'
UNION ALL SELECT 'indexes',   count(*) FROM pg_indexes  WHERE schemaname='public'
UNION ALL SELECT 'enums',     count(DISTINCT t.typname) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype='e'
ORDER BY 1;

-- =============================================================================
-- db-audit-tenant-key-drift.sql  (READ-ONLY DIAGNOSTIC -- runs no DDL/DML)
--
-- Standing probe for the org_id / organization_id tenant-key invariant installed
-- by migrations 202607300005 (functions + NOT VALID CHECK) and 202607300006
-- (VALIDATE). Run against any environment; every statement is a SELECT.
--
-- A clean system returns ZERO rows from Q1-Q4. Any row is a regression:
--   Q1  a dual-column table with no fill/sync BEFORE trigger
--   Q2  a dual-column table with no tenant-key CHECK, or one still NOT VALID
--   Q3  a sync function missing the fail-closed ("tenant key conflict") branch
--   Q4  actual rows where org_id and organization_id disagree (the real leak)
--   Q5  summary counts (informational)
-- =============================================================================

-- Q1. Dual-column tables missing a BEFORE INSERT/UPDATE sync trigger. --------
WITH dual AS (
  SELECT c.oid, c.relname
  FROM   pg_class c
  JOIN   pg_namespace n ON n.oid = c.relnamespace
  WHERE  n.nspname = 'public' AND c.relkind = 'r'
    AND  EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='org_id'          AND NOT a.attisdropped)
    AND  EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='organization_id' AND NOT a.attisdropped)
)
SELECT d.relname AS table_missing_sync_trigger
FROM   dual d
WHERE  NOT EXISTS (
         SELECT 1
         FROM   pg_trigger t
         JOIN   pg_proc    p ON p.oid = t.tgfoid
         WHERE  t.tgrelid = d.oid
           AND  NOT t.tgisinternal
           AND  p.proname IN ('sync_org_tenant_key', 'sync_integration_conn_org_id')
       )
ORDER BY d.relname;

-- Q2. Dual-column tables missing the CHECK, or with it still NOT VALID. -------
WITH dual AS (
  SELECT c.oid, c.relname
  FROM   pg_class c
  JOIN   pg_namespace n ON n.oid = c.relnamespace
  WHERE  n.nspname = 'public' AND c.relkind = 'r'
    AND  EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='org_id'          AND NOT a.attisdropped)
    AND  EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='organization_id' AND NOT a.attisdropped)
)
SELECT d.relname AS table_name,
       CASE WHEN con.conname IS NULL THEN 'MISSING CHECK'
            WHEN NOT con.convalidated THEN 'CHECK NOT VALID'
       END AS issue
FROM   dual d
LEFT   JOIN pg_constraint con
       ON con.conrelid = d.oid
      AND con.contype  = 'c'
      AND con.conname LIKE '%\_org\_tenant\_key\_match' ESCAPE '\'
WHERE  con.conname IS NULL OR NOT con.convalidated
ORDER BY d.relname;

-- Q3. Sync functions missing the fail-closed guard (fill-missing only). -------
SELECT p.proname AS function_without_failclosed_guard
FROM   pg_proc p
JOIN   pg_namespace n ON n.oid = p.pronamespace
WHERE  n.nspname = 'public'
  AND  p.proname IN ('sync_org_tenant_key', 'sync_integration_conn_org_id')
  AND  pg_get_functiondef(p.oid) NOT ILIKE '%tenant key conflict%'
ORDER BY p.proname;

-- Q4. Rows that actually disagree (the real cross-tenant hazard). -------------
-- Dynamic per-table count via query_to_xml; returns only tables with > 0.
WITH dual AS (
  SELECT c.relname
  FROM   pg_class c
  JOIN   pg_namespace n ON n.oid = c.relnamespace
  WHERE  n.nspname = 'public' AND c.relkind = 'r'
    AND  EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='org_id'          AND NOT a.attisdropped)
    AND  EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='organization_id' AND NOT a.attisdropped)
)
SELECT relname AS table_name, divergent_rows
FROM (
  SELECT relname,
         (xpath('/row/c/text()',
                query_to_xml(format(
                  'SELECT count(*) c FROM public.%I WHERE org_id IS NOT NULL AND organization_id IS NOT NULL AND org_id <> organization_id',
                  relname), false, true, ''))
         )[1]::text::bigint AS divergent_rows
  FROM dual
) s
WHERE divergent_rows > 0
ORDER BY divergent_rows DESC, table_name;

-- Q5. Summary counts (informational). ----------------------------------------
WITH dual AS (
  SELECT c.oid, c.relname
  FROM   pg_class c
  JOIN   pg_namespace n ON n.oid = c.relnamespace
  WHERE  n.nspname = 'public' AND c.relkind = 'r'
    AND  EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='org_id'          AND NOT a.attisdropped)
    AND  EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='organization_id' AND NOT a.attisdropped)
)
SELECT
  (SELECT count(*) FROM dual) AS dual_column_tables,
  (SELECT count(*) FROM pg_constraint
     WHERE contype='c' AND conname LIKE '%\_org\_tenant\_key\_match' ESCAPE '\' AND convalidated)     AS validated_checks,
  (SELECT count(*) FROM pg_constraint
     WHERE contype='c' AND conname LIKE '%\_org\_tenant\_key\_match' ESCAPE '\' AND NOT convalidated) AS not_valid_checks;

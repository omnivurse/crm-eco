-- Phase 0 / Tenancy: DUAL-ORG-COLUMN AUDIT (READ-ONLY DIAGNOSTIC — runs no DDL/DML).
-- Project: sffisarikcreyyjzdjvb
-- Purpose: surface tables that carry BOTH org_id and organization_id, show which column is
--          actually populated, and reveal which org column each RLS policy keys off — so we can
--          catch any policy that filters on the NULL/wrong column and thus SILENTLY bypasses
--          tenant isolation.
-- Usage:   run each query against STAGING (or a read-replica). Nothing here mutates state.
-- Refs:    sync_org_tenant_key body baseline L20809; documents (healthy) policies L78744-78772;
--          payment_transactions (healthy) L75745; files (LEAK) policy L74852.

-- Q1. Tables in public that have BOTH org columns (the dual-column population candidates).
SELECT c1.table_name
FROM   information_schema.columns c1
JOIN   information_schema.columns c2
       ON c2.table_schema = c1.table_schema AND c2.table_name = c1.table_name
WHERE  c1.table_schema = 'public'
  AND  c1.column_name  = 'org_id'
  AND  c2.column_name  = 'organization_id'
ORDER  BY c1.table_name;

-- Q2. Every RLS policy in public, with the org column its qual/with_check text references.
--     'organization_id'        = canonical/healthy.
--     'org_id only'            = INVESTIGATE (may key off the denormalized/possibly-NULL column).
--     'no org predicate'       = POSSIBLE LEAK (this is how files' visibility='org' policy reads).
--     Rows are ordered worst-first.
SELECT
  pol.schemaname,
  pol.tablename,
  pol.policyname,
  pol.cmd,
  CASE
    WHEN coalesce(pol.qual,'') || coalesce(pol.with_check,'') ILIKE '%organization_id%' THEN 'organization_id'
    WHEN coalesce(pol.qual,'') || coalesce(pol.with_check,'') ILIKE '%org_id%'          THEN 'org_id only -- INVESTIGATE'
    ELSE 'no org predicate -- POSSIBLE LEAK'
  END AS org_key_used,
  pol.qual       AS using_expr,
  pol.with_check AS with_check_expr
FROM   pg_policies pol
WHERE  pol.schemaname = 'public'
ORDER  BY
  (CASE
     WHEN coalesce(pol.qual,'') || coalesce(pol.with_check,'') ILIKE '%organization_id%' THEN 2
     WHEN coalesce(pol.qual,'') || coalesce(pol.with_check,'') ILIKE '%org_id%'          THEN 1
     ELSE 0
   END),
  pol.tablename, pol.policyname;

-- Q3. Population check for dual-column tables: how many rows have each column NULL.
--     A column that is mostly/all NULL but is the one an RLS policy filters on = silent bypass.
--     TEMPLATE — extend with the table list Q1 returns. Known dual-column tables shown:
-- SELECT 'crm_records'     AS tbl, count(*) FILTER (WHERE org_id IS NULL)          AS org_id_null,
--                                  count(*) FILTER (WHERE organization_id IS NULL) AS organization_id_null,
--                                  count(*) AS total FROM public.crm_records
-- UNION ALL
-- SELECT 'crm_messages',   count(*) FILTER (WHERE org_id IS NULL), count(*) FILTER (WHERE organization_id IS NULL), count(*) FROM public.crm_messages
-- UNION ALL
-- SELECT 'sent_emails_log',count(*) FILTER (WHERE org_id IS NULL), count(*) FILTER (WHERE organization_id IS NULL), count(*) FROM public.sent_emails_log;

-- Q4. files V1 — how many rows would remain UNRESOLVED after A2's lineage + single-membership
--     fallback. A3 (NOT NULL/FK) must NOT run until this returns 0.
--     >> Run this ONLY after A1 (202606230001) has added files.organization_id on the target DB. <<
SELECT count(*) AS files_unresolved_after_backfill
FROM   public.files f
WHERE  f.organization_id IS NULL
  AND  NOT EXISTS (
         SELECT 1 FROM public.profiles p
         WHERE  p.user_id = f.owner_id AND p.organization_id IS NOT NULL
       )
  AND  NOT EXISTS (
         SELECT 1
         FROM   public.organization_members om
         WHERE  om.user_id = f.owner_id AND om.is_active = true
         GROUP  BY om.user_id
         HAVING count(*) = 1
       );

-- READ-ONLY: every statement above is a SELECT. No table is modified.

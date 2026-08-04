-- =============================================================================
-- Tenant-key invariant: make org_id / organization_id drift IMPOSSIBLE.
--
-- Context (verified live on sffisarikcreyyjzdjvb, 2026-07-30):
--   The strangler rename org_id -> organization_id is ~90% done. Every table
--   that carries BOTH columns (126 of them) already has the BEFORE INSERT/UPDATE
--   trigger trg_sync_org_tenant_key -> public.sync_org_tenant_key()
--   (integration_connections uses public.sync_integration_conn_org_id()).
--   RLS policies and FKs already key on organization_id; application code still
--   writes org_id; the trigger mirrors one column onto the other. A full audit of
--   750k+ rows found ZERO divergent rows and ZERO rows needing backfill.
--
--   The one remaining hole: both sync functions only FILL a NULL column from its
--   twin. If a writer sets BOTH columns to DIFFERENT non-null values, neither
--   branch fires and the row is persisted divergent -- reads (organization_id)
--   and writes (org_id) would then resolve to different tenants. This is the
--   drift we are eliminating for good.
--
-- What this migration does (two independent guarantees, defense in depth):
--   1. Upgrade both sync functions to RAISE (fail closed) when both columns are
--      set and disagree. The fill-missing behavior is preserved byte-for-byte.
--   2. Add CHECK (org_id IS NOT DISTINCT FROM organization_id) NOT VALID on every
--      dual-column table, so the invariant holds even if a trigger is ever
--      disabled or dropped. VALIDATE runs in the follow-up 202607300006.
--
-- Additive + reversible + idempotent. Touches NO existing row data.
-- Compatible with the eventual org_id drop: when org_id goes, drop the CHECK and
-- the trigger in the same migration.
-- PROD WRITE RISK: YES (function bodies + new constraints; no data mutated).
-- =============================================================================

-- Never block live traffic: if a table cannot be locked quickly, fail fast and
-- roll the whole migration back (nothing applied) -- just retry.
SET lock_timeout = '8s';

-- -- 1. Upgrade the shared sync function: fill-missing, else fail-closed --------
CREATE OR REPLACE FUNCTION public.sync_org_tenant_key()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $function$
BEGIN
  IF new.organization_id IS NULL THEN
    new.organization_id := new.org_id;        -- backfill the canonical column
  ELSIF new.org_id IS NULL THEN
    new.org_id := new.organization_id;        -- backfill the legacy column
  ELSIF new.org_id <> new.organization_id THEN
    -- Both set and disagree: the exact drift we must never persist. Fail closed.
    RAISE EXCEPTION USING
      errcode = 'check_violation',
      message = format('tenant key conflict on %s.%s: org_id=%s organization_id=%s',
                       tg_table_schema, tg_table_name, new.org_id, new.organization_id),
      hint    = 'org_id and organization_id must match; set only one, or set both to the same value.';
  END IF;
  RETURN new;
END;
$function$;

-- -- 1b. Same upgrade for integration_connections' dedicated sync function -----
CREATE OR REPLACE FUNCTION public.sync_integration_conn_org_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $function$
BEGIN
  IF new.org_id IS NOT NULL AND new.organization_id IS NULL THEN
    new.organization_id := new.org_id;
  ELSIF new.organization_id IS NOT NULL AND new.org_id IS NULL THEN
    new.org_id := new.organization_id;
  ELSIF new.org_id IS NOT NULL AND new.organization_id IS NOT NULL
        AND new.org_id <> new.organization_id THEN
    RAISE EXCEPTION USING
      errcode = 'check_violation',
      message = format('tenant key conflict on %s.%s: org_id=%s organization_id=%s',
                       tg_table_schema, tg_table_name, new.org_id, new.organization_id),
      hint    = 'org_id and organization_id must match; set only one, or set both to the same value.';
  END IF;
  RETURN new;
END;
$function$;

-- -- 2. Trigger-independent backstop: CHECK on every dual-column table ----------
-- NOT VALID => metadata-only, no table scan, governs all new writes immediately.
-- Existing rows are already all-equal (verified), so 202607300006 VALIDATEs clean.
-- Table set is discovered live from the catalog, so this covers any table the
-- migration files do not show (the live schema has drifted before).
--
-- RESILIENT + RE-RUNNABLE: adding a CHECK needs a brief ACCESS EXCLUSIVE lock. On
-- a hot table (crm_records, crm_audit_log, crm_notes) that lock can't always be
-- grabbed quickly; rather than let one busy table roll back all 126, each table
-- gets a short lock_timeout in its own subtransaction and is SKIPPED (not failed)
-- on contention. Re-run this migration's block to mop up any skipped tables; the
-- standing audit (scripts/db-audit-tenant-key-drift.sql) reports what's missing.
DO $$
DECLARE
  r        record;
  cname    text;
  n_add    int  := 0;
  n_have   int  := 0;
  n_skip   int  := 0;
  skipped  text[] := '{}';
BEGIN
  -- Fail fast on a busy table so we can skip it instead of blocking live traffic.
  PERFORM set_config('lock_timeout', '3s', false);

  FOR r IN
    SELECT c.oid, c.relname
    FROM   pg_class c
    JOIN   pg_namespace nsp ON nsp.oid = c.relnamespace
    WHERE  nsp.nspname = 'public'
      AND  c.relkind = 'r'   -- ordinary tables only (skip views + partitioned parents)
      AND  EXISTS (SELECT 1 FROM pg_attribute a
                   WHERE a.attrelid = c.oid AND a.attname = 'org_id'          AND NOT a.attisdropped)
      AND  EXISTS (SELECT 1 FROM pg_attribute a
                   WHERE a.attrelid = c.oid AND a.attname = 'organization_id' AND NOT a.attisdropped)
    ORDER BY c.relname
  LOOP
    -- Deterministic, collision-free name (longest dual table is 30 chars, so no
    -- truncation occurs; the left(...,41) guard keeps us within the 63-byte limit).
    cname := left(r.relname, 41) || '_org_tenant_key_match';

    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = r.oid AND conname = cname) THEN
      n_have := n_have + 1;
      CONTINUE;
    END IF;

    BEGIN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (org_id IS NOT DISTINCT FROM organization_id) NOT VALID',
        r.relname, cname);
      n_add := n_add + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Most likely lock_not_available (55P03) on a hot table. Skip + record; a
      -- re-run will pick it up. The BEFORE trigger already enforces the invariant
      -- meanwhile, so skipping the backstop briefly is safe.
      n_skip := n_skip + 1;
      skipped := array_append(skipped, r.relname || ' (' || SQLSTATE || ')');
    END;
  END LOOP;

  RAISE NOTICE 'tenant-key CHECK: % added, % already present, % skipped %',
    n_add, n_have, n_skip, skipped;
END $$;

-- -- 3. Self-verify the function upgrade actually took --------------------------
DO $$
BEGIN
  ASSERT (SELECT bool_or(pg_get_functiondef(oid) ILIKE '%tenant key conflict%')
          FROM pg_proc WHERE proname = 'sync_org_tenant_key'),
    'sync_org_tenant_key was not upgraded with the fail-closed branch';
  ASSERT (SELECT bool_or(pg_get_functiondef(oid) ILIKE '%tenant key conflict%')
          FROM pg_proc WHERE proname = 'sync_integration_conn_org_id'),
    'sync_integration_conn_org_id was not upgraded with the fail-closed branch';
END $$;

-- Rollback notes (no data is changed by this migration, so rollback is clean):
--   1. Restore the fill-missing-only bodies by removing the "ELSIF ... RAISE"
--      branch from both functions via CREATE OR REPLACE (see this file's git history).
--   2. Drop the backstop constraints:
--        DO $$
--        DECLARE r record;
--        BEGIN
--          FOR r IN
--            SELECT conrelid::regclass::text AS t, conname
--            FROM pg_constraint
--            WHERE contype = 'c'
--              AND conname LIKE '%\_org\_tenant\_key\_match' ESCAPE '\'
--          LOOP
--            EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.t, r.conname);
--          END LOOP;
--        END $$;

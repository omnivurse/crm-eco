-- REHEARSAL ONLY — Phases 7a/7b/7c linter remediation
-- Usage: psql "$SUPABASE_DB_URL" -f scripts/rehearse-linter-phase7.sql
-- Expected: NOTICE counts; ROLLBACK leaves DB unchanged

\set ON_ERROR_STOP on

BEGIN;

SET lock_timeout = '5s';

-- ── Phase 7a: auth_rls_initplan ─────────────────────────────────────────────

DO $fix_rls$
DECLARE
  pol RECORD;
  new_qual TEXT;
  new_with_check TEXT;
  needs_fix BOOLEAN;
  create_sql TEXT;
  role_list TEXT;
  fixed_count INT := 0;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    new_qual := pol.qual;
    new_with_check := pol.with_check;
    needs_fix := FALSE;

    IF new_qual IS NOT NULL THEN
      new_qual := replace(new_qual, '( SELECT auth.uid())',  '##SEL_AUTH_UID##');
      new_qual := replace(new_qual, '(SELECT auth.uid())',   '##SEL_AUTH_UID##');
      new_qual := replace(new_qual, '( SELECT auth.jwt())',  '##SEL_AUTH_JWT##');
      new_qual := replace(new_qual, '(SELECT auth.jwt())',   '##SEL_AUTH_JWT##');
      new_qual := replace(new_qual, '( SELECT auth.role())', '##SEL_AUTH_ROLE##');
      new_qual := replace(new_qual, '(SELECT auth.role())',  '##SEL_AUTH_ROLE##');
      new_qual := replace(new_qual, '( SELECT current_setting(', '##SEL_CURRENT_SETTING##');
      new_qual := replace(new_qual, '(SELECT current_setting(',  '##SEL_CURRENT_SETTING##');

      IF position('auth.uid()' in new_qual) > 0 THEN
        new_qual := replace(new_qual, 'auth.uid()', '(SELECT auth.uid())');
        needs_fix := TRUE;
      END IF;
      IF position('auth.jwt()' in new_qual) > 0 THEN
        new_qual := replace(new_qual, 'auth.jwt()', '(SELECT auth.jwt())');
        needs_fix := TRUE;
      END IF;
      IF position('auth.role()' in new_qual) > 0 THEN
        new_qual := replace(new_qual, 'auth.role()', '(SELECT auth.role())');
        needs_fix := TRUE;
      END IF;
      IF position('current_setting(' in new_qual) > 0 THEN
        new_qual := replace(new_qual, 'current_setting(', '(SELECT current_setting(');
        needs_fix := TRUE;
      END IF;

      new_qual := replace(new_qual, '##SEL_AUTH_UID##',  '(SELECT auth.uid())');
      new_qual := replace(new_qual, '##SEL_AUTH_JWT##',  '(SELECT auth.jwt())');
      new_qual := replace(new_qual, '##SEL_AUTH_ROLE##', '(SELECT auth.role())');
      new_qual := replace(new_qual, '##SEL_CURRENT_SETTING##', '(SELECT current_setting(');
    END IF;

    IF new_with_check IS NOT NULL THEN
      new_with_check := replace(new_with_check, '( SELECT auth.uid())',  '##SEL_AUTH_UID##');
      new_with_check := replace(new_with_check, '(SELECT auth.uid())',   '##SEL_AUTH_UID##');
      new_with_check := replace(new_with_check, '( SELECT auth.jwt())',  '##SEL_AUTH_JWT##');
      new_with_check := replace(new_with_check, '(SELECT auth.jwt())',   '##SEL_AUTH_JWT##');
      new_with_check := replace(new_with_check, '( SELECT auth.role())', '##SEL_AUTH_ROLE##');
      new_with_check := replace(new_with_check, '(SELECT auth.role())',  '##SEL_AUTH_ROLE##');
      new_with_check := replace(new_with_check, '( SELECT current_setting(', '##SEL_CURRENT_SETTING##');
      new_with_check := replace(new_with_check, '(SELECT current_setting(',  '##SEL_CURRENT_SETTING##');

      IF position('auth.uid()' in new_with_check) > 0 THEN
        new_with_check := replace(new_with_check, 'auth.uid()', '(SELECT auth.uid())');
        needs_fix := TRUE;
      END IF;
      IF position('auth.jwt()' in new_with_check) > 0 THEN
        new_with_check := replace(new_with_check, 'auth.jwt()', '(SELECT auth.jwt())');
        needs_fix := TRUE;
      END IF;
      IF position('auth.role()' in new_with_check) > 0 THEN
        new_with_check := replace(new_with_check, 'auth.role()', '(SELECT auth.role())');
        needs_fix := TRUE;
      END IF;
      IF position('current_setting(' in new_with_check) > 0 THEN
        new_with_check := replace(new_with_check, 'current_setting(', '(SELECT current_setting(');
        needs_fix := TRUE;
      END IF;

      new_with_check := replace(new_with_check, '##SEL_AUTH_UID##',  '(SELECT auth.uid())');
      new_with_check := replace(new_with_check, '##SEL_AUTH_JWT##',  '(SELECT auth.jwt())');
      new_with_check := replace(new_with_check, '##SEL_AUTH_ROLE##', '(SELECT auth.role())');
      new_with_check := replace(new_with_check, '##SEL_CURRENT_SETTING##', '(SELECT current_setting(');
    END IF;

    IF (new_qual IS DISTINCT FROM pol.qual)
       OR (new_with_check IS DISTINCT FROM pol.with_check) THEN
      needs_fix := TRUE;
    END IF;

    IF NOT needs_fix THEN
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);

    SELECT string_agg(quote_ident(r::text), ', ') INTO role_list FROM unnest(pol.roles) AS r;

    create_sql := format('CREATE POLICY %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    IF pol.permissive = 'RESTRICTIVE' THEN
      create_sql := create_sql || ' AS RESTRICTIVE';
    END IF;
    create_sql := create_sql || format(' FOR %s', pol.cmd);
    IF role_list IS NOT NULL THEN
      create_sql := create_sql || format(' TO %s', role_list);
    END IF;
    IF new_qual IS NOT NULL THEN
      create_sql := create_sql || format(' USING (%s)', new_qual);
    END IF;
    IF new_with_check IS NOT NULL THEN
      create_sql := create_sql || format(' WITH CHECK (%s)', new_with_check);
    END IF;

    EXECUTE create_sql;
    fixed_count := fixed_count + 1;
    RAISE NOTICE 'Fixed auth_rls_initplan: %.% — %', pol.schemaname, pol.tablename, pol.policyname;
  END LOOP;

  RAISE NOTICE 'Phase 7a rehearsal: policies fixed: %', fixed_count;
END;
$fix_rls$;

-- ── Phase 7b: duplicate indexes ───────────────────────────────────────────

DROP INDEX IF EXISTS public.crm_records_market_type_idx;
DROP INDEX IF EXISTS public.crm_records_module_idx;
DROP INDEX IF EXISTS public.idx_crm_reports_organization_id;

-- ── Phase 7c: split overlapping FOR ALL policies ──────────────────────────

DO $split_all$
DECLARE
  pol RECORD;
  other RECORD;
  covered_cmds text[];
  remaining_cmds text[];
  all_cmds text[] := ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
  cmd text;
  role_list text;
  create_sql text;
  check_expr text;
  split_count int := 0;
  dropped_count int := 0;
  roles_overlap boolean;
BEGIN
  FOR pol IN
    SELECT * FROM pg_policies
    WHERE schemaname = 'public' AND permissive = 'PERMISSIVE' AND cmd = 'ALL'
    ORDER BY tablename, policyname
  LOOP
    covered_cmds := ARRAY[]::text[];

    FOR other IN
      SELECT p.* FROM pg_policies p
      WHERE p.schemaname = pol.schemaname
        AND p.tablename = pol.tablename
        AND p.policyname <> pol.policyname
        AND p.permissive = 'PERMISSIVE'
    LOOP
      SELECT EXISTS (
        SELECT 1 FROM unnest(pol.roles) r1 JOIN unnest(other.roles) r2 ON r1 = r2
      ) INTO roles_overlap;

      IF NOT roles_overlap OR other.cmd = 'ALL' THEN
        CONTINUE;
      END IF;

      covered_cmds := array_append(covered_cmds, other.cmd);
    END LOOP;

    SELECT array_agg(DISTINCT c) INTO covered_cmds FROM unnest(covered_cmds) AS c;

    SELECT array_agg(c ORDER BY c) INTO remaining_cmds
    FROM unnest(all_cmds) AS c
    WHERE NOT (c = ANY (COALESCE(covered_cmds, ARRAY[]::text[])));

    IF remaining_cmds IS NULL OR array_length(remaining_cmds, 1) IS NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
      dropped_count := dropped_count + 1;
      RAISE NOTICE 'Dropped subsumed ALL policy: %.% — %', pol.schemaname, pol.tablename, pol.policyname;
      CONTINUE;
    END IF;

    IF array_length(remaining_cmds, 1) = array_length(all_cmds, 1) THEN
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);

    SELECT string_agg(quote_ident(r::text), ', ') INTO role_list FROM unnest(pol.roles) AS r;
    check_expr := COALESCE(pol.with_check, pol.qual);

    FOREACH cmd IN ARRAY remaining_cmds LOOP
      create_sql := format(
        'CREATE POLICY %I ON %I.%I',
        pol.policyname || '__' || lower(cmd), pol.schemaname, pol.tablename
      );
      create_sql := create_sql || format(' FOR %s', cmd);
      IF role_list IS NOT NULL THEN
        create_sql := create_sql || format(' TO %s', role_list);
      END IF;
      IF cmd IN ('SELECT', 'UPDATE', 'DELETE') AND pol.qual IS NOT NULL THEN
        create_sql := create_sql || format(' USING (%s)', pol.qual);
      END IF;
      IF cmd = 'INSERT' AND check_expr IS NOT NULL THEN
        create_sql := create_sql || format(' WITH CHECK (%s)', check_expr);
      ELSIF cmd = 'UPDATE' AND check_expr IS NOT NULL THEN
        create_sql := create_sql || format(' WITH CHECK (%s)', check_expr);
      END IF;
      EXECUTE create_sql;
      split_count := split_count + 1;
    END LOOP;

    RAISE NOTICE 'Split ALL policy: %.% — % → [%]',
      pol.schemaname, pol.tablename, pol.policyname, array_to_string(remaining_cmds, ', ');
  END LOOP;

  RAISE NOTICE 'Phase 7c rehearsal: split=% dropped=%', split_count, dropped_count;
END;
$split_all$;

ROLLBACK;

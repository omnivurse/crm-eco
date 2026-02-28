-- Migration: Fix RLS policy performance (auth_rls_initplan) — Round 2
--
-- Migrations added after 202602150003 re-introduced bare auth.uid() / auth.jwt()
-- / auth.role() calls in RLS policies. This migration re-applies the same
-- dynamic fix: wrap every bare call in (SELECT ...) so Postgres evaluates it
-- once per statement instead of once per row.
--
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

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
    SELECT
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual,
      with_check
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    new_qual := pol.qual;
    new_with_check := pol.with_check;
    needs_fix := FALSE;

    -- ---- Fix qual (USING clause) ----
    IF new_qual IS NOT NULL THEN
      -- Protect already-wrapped instances with placeholders
      new_qual := replace(new_qual, '( SELECT auth.uid())',  '##SEL_AUTH_UID##');
      new_qual := replace(new_qual, '(SELECT auth.uid())',   '##SEL_AUTH_UID##');
      new_qual := replace(new_qual, '( SELECT auth.jwt())',  '##SEL_AUTH_JWT##');
      new_qual := replace(new_qual, '(SELECT auth.jwt())',   '##SEL_AUTH_JWT##');
      new_qual := replace(new_qual, '( SELECT auth.role())', '##SEL_AUTH_ROLE##');
      new_qual := replace(new_qual, '(SELECT auth.role())',  '##SEL_AUTH_ROLE##');

      -- Wrap bare auth function calls
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

      -- Restore placeholders
      new_qual := replace(new_qual, '##SEL_AUTH_UID##',  '(SELECT auth.uid())');
      new_qual := replace(new_qual, '##SEL_AUTH_JWT##',  '(SELECT auth.jwt())');
      new_qual := replace(new_qual, '##SEL_AUTH_ROLE##', '(SELECT auth.role())');
    END IF;

    -- ---- Fix with_check (WITH CHECK clause) ----
    IF new_with_check IS NOT NULL THEN
      new_with_check := replace(new_with_check, '( SELECT auth.uid())',  '##SEL_AUTH_UID##');
      new_with_check := replace(new_with_check, '(SELECT auth.uid())',   '##SEL_AUTH_UID##');
      new_with_check := replace(new_with_check, '( SELECT auth.jwt())',  '##SEL_AUTH_JWT##');
      new_with_check := replace(new_with_check, '(SELECT auth.jwt())',   '##SEL_AUTH_JWT##');
      new_with_check := replace(new_with_check, '( SELECT auth.role())', '##SEL_AUTH_ROLE##');
      new_with_check := replace(new_with_check, '(SELECT auth.role())',  '##SEL_AUTH_ROLE##');

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

      new_with_check := replace(new_with_check, '##SEL_AUTH_UID##',  '(SELECT auth.uid())');
      new_with_check := replace(new_with_check, '##SEL_AUTH_JWT##',  '(SELECT auth.jwt())');
      new_with_check := replace(new_with_check, '##SEL_AUTH_ROLE##', '(SELECT auth.role())');
    END IF;

    -- ---- Rebuild the policy if changes were needed ----
    IF needs_fix THEN
      -- Drop the existing policy
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
        pol.policyname, pol.schemaname, pol.tablename);

      -- Build role list from the roles array
      SELECT string_agg(r::text, ', ')
        INTO role_list
        FROM unnest(pol.roles) AS r;

      -- Build CREATE POLICY statement
      create_sql := format('CREATE POLICY %I ON %I.%I',
        pol.policyname, pol.schemaname, pol.tablename);

      -- AS PERMISSIVE/RESTRICTIVE
      IF pol.permissive = 'RESTRICTIVE' THEN
        create_sql := create_sql || ' AS RESTRICTIVE';
      END IF;

      -- FOR command
      create_sql := create_sql || format(' FOR %s', pol.cmd);

      -- TO roles
      create_sql := create_sql || format(' TO %s', role_list);

      -- USING clause
      IF new_qual IS NOT NULL THEN
        create_sql := create_sql || format(' USING (%s)', new_qual);
      END IF;

      -- WITH CHECK clause
      IF new_with_check IS NOT NULL THEN
        create_sql := create_sql || format(' WITH CHECK (%s)', new_with_check);
      END IF;

      EXECUTE create_sql;
      fixed_count := fixed_count + 1;

      RAISE NOTICE 'Fixed RLS policy: %.% — %',
        pol.schemaname, pol.tablename, pol.policyname;
    END IF;
  END LOOP;

  RAISE NOTICE 'RLS initplan fix complete. Total policies fixed: %', fixed_count;
END;
$fix_rls$;

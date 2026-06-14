-- Phase 7a: Supabase linter — auth_rls_initplan
-- Wrap bare auth.*() and current_setting() calls in (SELECT ...) so Postgres
-- evaluates them once per statement, not once per row.
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- Rollback: re-run prior policy definitions from pg_policies backup or migration history.

BEGIN;

SET lock_timeout = '5s';

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

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policyname, pol.schemaname, pol.tablename
    );

    SELECT string_agg(quote_ident(r::text), ', ')
      INTO role_list
      FROM unnest(pol.roles) AS r;

    create_sql := format(
      'CREATE POLICY %I ON %I.%I',
      pol.policyname, pol.schemaname, pol.tablename
    );

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

    RAISE NOTICE 'Fixed auth_rls_initplan: %.% — %',
      pol.schemaname, pol.tablename, pol.policyname;
  END LOOP;

  RAISE NOTICE 'Phase 7a complete. Policies fixed: %', fixed_count;
END;
$fix_rls$;

COMMIT;

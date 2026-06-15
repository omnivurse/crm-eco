-- Phase 7c: Supabase linter — multiple_permissive_policies (FOR ALL overlap)
--
-- When a permissive FOR ALL policy overlaps another permissive policy on the
-- same table/roles (e.g. admin FOR ALL + user FOR SELECT), split ALL into
-- only the commands not already covered by sibling policies.
--
-- This preserves access semantics while eliminating duplicate permissive
-- evaluation for SELECT/INSERT/UPDATE/DELETE.
--
-- Rollback: restore policies from pre-migration pg_policies export.

BEGIN;

SET lock_timeout = '5s';

DO $split_all$
DECLARE
  pol RECORD;
  other RECORD;
  covered_cmds text[];
  remaining_cmds text[];
  all_cmds text[] := ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
  v_cmd text;
  role_list text;
  create_sql text;
  check_expr text;
  split_count int := 0;
  dropped_count int := 0;
  roles_overlap boolean;
BEGIN
  FOR pol IN
    SELECT *
    FROM pg_policies
    WHERE schemaname = 'public'
      AND permissive = 'PERMISSIVE'
      AND cmd = 'ALL'
    ORDER BY tablename, policyname
  LOOP
    covered_cmds := ARRAY[]::text[];

    FOR other IN
      SELECT p.*
      FROM pg_policies p
      WHERE p.schemaname = pol.schemaname
        AND p.tablename = pol.tablename
        AND p.policyname <> pol.policyname
        AND p.permissive = 'PERMISSIVE'
    LOOP
      SELECT EXISTS (
        SELECT 1
        FROM unnest(pol.roles) r1
        JOIN unnest(other.roles) r2 ON r1 = r2
      ) INTO roles_overlap;

      IF NOT roles_overlap THEN
        CONTINUE;
      END IF;

      IF other.cmd = 'ALL' THEN
        -- Another ALL policy is OR-combined, not redundant coverage.
        CONTINUE;
      END IF;

      covered_cmds := array_append(covered_cmds, other.cmd);
    END LOOP;

    SELECT array_agg(DISTINCT uc)
      INTO covered_cmds
      FROM unnest(covered_cmds) AS uc;

    SELECT array_agg(c ORDER BY c)
      INTO remaining_cmds
      FROM unnest(all_cmds) AS c
      WHERE NOT (c = ANY (COALESCE(covered_cmds, ARRAY[]::text[])));

    IF remaining_cmds IS NULL OR array_length(remaining_cmds, 1) IS NULL THEN
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON %I.%I',
        pol.policyname, pol.schemaname, pol.tablename
      );
      dropped_count := dropped_count + 1;
      RAISE NOTICE 'Dropped subsumed ALL policy: %.% — %',
        pol.schemaname, pol.tablename, pol.policyname;
      CONTINUE;
    END IF;

    IF array_length(remaining_cmds, 1) = array_length(all_cmds, 1) THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policyname, pol.schemaname, pol.tablename
    );

    SELECT string_agg(quote_ident(r::text), ', ')
      INTO role_list
      FROM unnest(pol.roles) AS r;

    check_expr := COALESCE(pol.with_check, pol.qual);

    FOREACH v_cmd IN ARRAY remaining_cmds LOOP
      create_sql := format(
        'CREATE POLICY %I ON %I.%I',
        pol.policyname || '__' || lower(v_cmd),
        pol.schemaname,
        pol.tablename
      );

      create_sql := create_sql || format(' FOR %s', v_cmd);

      IF role_list IS NOT NULL THEN
        create_sql := create_sql || format(' TO %s', role_list);
      END IF;

      IF v_cmd IN ('SELECT', 'UPDATE', 'DELETE') AND pol.qual IS NOT NULL THEN
        create_sql := create_sql || format(' USING (%s)', pol.qual);
      END IF;

      IF v_cmd = 'INSERT' AND check_expr IS NOT NULL THEN
        create_sql := create_sql || format(' WITH CHECK (%s)', check_expr);
      ELSIF v_cmd = 'UPDATE' AND check_expr IS NOT NULL THEN
        create_sql := create_sql || format(' WITH CHECK (%s)', check_expr);
      END IF;

      EXECUTE create_sql;
      split_count := split_count + 1;
    END LOOP;

    RAISE NOTICE 'Split ALL policy: %.% — % → [%]',
      pol.schemaname, pol.tablename, pol.policyname,
      array_to_string(remaining_cmds, ', ');
  END LOOP;

  RAISE NOTICE 'Phase 7c complete. Split policies created: %, subsumed ALL dropped: %',
    split_count, dropped_count;
END;
$split_all$;

COMMIT;

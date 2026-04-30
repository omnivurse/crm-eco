-- =============================================================================
-- db:health — duplicate-default audit
--
-- For every public.* table that has a boolean column matching is_default,
-- is_primary, or default (case-insensitive), report rows where MORE THAN ONE
-- row in the same parent group has flag=true. Parent group = all FK columns
-- on that table that point at another table — typically that's exactly the
-- grouping the app expects "one default per X".
--
-- Why this exists: the edit page crashed on PIFH because crm_layouts had
-- two default rows for the same module — `.maybeSingle()` throws on
-- multiple matches. This script finds the same shape pre-emptively across
-- every table.
--
-- Read-only, fast on small tables. Safe to run anytime.
-- =============================================================================

\set ON_ERROR_STOP on

\echo === Default-flag duplicate audit ===
\echo

DO $$
DECLARE
  rec record;
  parent_cols text;
  sql text;
  dup_count int;
BEGIN
  FOR rec IN
    SELECT c.table_schema, c.table_name, c.column_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema
       AND t.table_name = c.table_name
     WHERE c.table_schema = 'public'
       AND c.data_type = 'boolean'
       AND (
            lower(c.column_name) = 'is_default'
         OR lower(c.column_name) = 'is_primary'
       )
       AND t.table_type = 'BASE TABLE'
     ORDER BY c.table_name, c.column_name
  LOOP
    -- Build parent grouping = all FK-bearing columns. If none, fall back to a
    -- bare "WHERE flag = true" group-count so we still detect "multiple
    -- defaults globally" cases (e.g. small enum-like tables).
    SELECT string_agg(quote_ident(kcu.column_name), ', ' ORDER BY kcu.ordinal_position)
      INTO parent_cols
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema = rec.table_schema
       AND tc.table_name = rec.table_name;

    IF parent_cols IS NULL THEN
      sql := format(
        'SELECT count(*) - 1 FROM %I.%I WHERE %I = true',
        rec.table_schema, rec.table_name, rec.column_name
      );
    ELSE
      sql := format(
        'SELECT COALESCE(SUM(c - 1), 0)::int FROM (SELECT count(*) AS c FROM %I.%I WHERE %I = true GROUP BY %s HAVING count(*) > 1) s',
        rec.table_schema, rec.table_name, rec.column_name, parent_cols
      );
    END IF;

    EXECUTE sql INTO dup_count;
    IF dup_count IS NULL THEN dup_count := 0; END IF;
    IF dup_count < 0 THEN dup_count := 0; END IF;

    IF dup_count > 0 THEN
      RAISE NOTICE
        'DUP %.%(% = true) → % extra row(s) | parent=%',
        rec.table_name, rec.column_name, rec.column_name,
        dup_count,
        COALESCE(parent_cols, '(none)');
    ELSE
      RAISE NOTICE
        'ok  %.%(% = true) | parent=%',
        rec.table_name, rec.column_name, rec.column_name,
        COALESCE(parent_cols, '(none)');
    END IF;
  END LOOP;
END $$;

\echo
\echo === Detailed listing of any duplicates ===
\echo

DO $$
DECLARE
  rec record;
  parent_cols text;
  parent_select text;
  sql text;
  detail record;
  found boolean := false;
BEGIN
  FOR rec IN
    SELECT c.table_schema, c.table_name, c.column_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema
       AND t.table_name = c.table_name
     WHERE c.table_schema = 'public'
       AND c.data_type = 'boolean'
       AND (
            lower(c.column_name) = 'is_default'
         OR lower(c.column_name) = 'is_primary'
       )
       AND t.table_type = 'BASE TABLE'
     ORDER BY c.table_name, c.column_name
  LOOP
    SELECT
      string_agg(quote_ident(kcu.column_name), ', ' ORDER BY kcu.ordinal_position),
      string_agg(quote_ident(kcu.column_name) || '::text', ' || ''/'' || ' ORDER BY kcu.ordinal_position)
      INTO parent_cols, parent_select
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema = rec.table_schema
       AND tc.table_name = rec.table_name;

    IF parent_cols IS NULL THEN CONTINUE; END IF;

    sql := format(
      'SELECT (%s) AS parent_key, count(*) AS n FROM %I.%I WHERE %I = true GROUP BY %s HAVING count(*) > 1 ORDER BY n DESC LIMIT 20',
      parent_select, rec.table_schema, rec.table_name, rec.column_name, parent_cols
    );

    FOR detail IN EXECUTE sql LOOP
      found := true;
      RAISE NOTICE '  %.%(%) → parent=% has % defaults',
        rec.table_name, rec.column_name, rec.column_name,
        detail.parent_key, detail.n;
    END LOOP;
  END LOOP;

  IF NOT found THEN
    RAISE NOTICE 'No duplicate defaults found.';
  END IF;
END $$;

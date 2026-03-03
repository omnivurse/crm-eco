-- ============================================================================
-- Reporting Engine: Capacity-Aware Aggregation + Downline Support
-- Enhances the existing crm_reports system for dual-capacity role model.
-- ADDITIVE ONLY — does not alter existing columns or break existing queries.
-- ============================================================================

-- 1. Add capacity/scope columns to crm_reports
ALTER TABLE public.crm_reports
  ADD COLUMN IF NOT EXISTS product_type_filter text,
  ADD COLUMN IF NOT EXISTS scope text DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS advisor_id uuid,
  ADD COLUMN IF NOT EXISTS include_downline boolean DEFAULT false;

COMMENT ON COLUMN public.crm_reports.product_type_filter IS
  'Filter report by product type: health_insurance, health_share, or NULL for all';
COMMENT ON COLUMN public.crm_reports.scope IS
  'Report scope: all, mine, downline, capacity';
COMMENT ON COLUMN public.crm_reports.advisor_id IS
  'Filter by specific advisor (optional)';
COMMENT ON COLUMN public.crm_reports.include_downline IS
  'Include downline records (recursive hierarchy)';


-- 2. Server-side aggregation RPC
-- Performs GROUP BY with aggregations entirely on the database for performance.
CREATE OR REPLACE FUNCTION public.execute_report_aggregation(
  p_org_id uuid,
  p_table text,
  p_org_column text DEFAULT 'org_id',
  p_module_id uuid DEFAULT NULL,
  p_filters jsonb DEFAULT '[]'::jsonb,
  p_filter_logic text DEFAULT 'and',
  p_grouping jsonb DEFAULT '[]'::jsonb,
  p_aggregations jsonb DEFAULT '[]'::jsonb,
  p_sorting jsonb DEFAULT '[]'::jsonb,
  p_limit int DEFAULT 1000,
  p_offset int DEFAULT 0,
  p_product_type text DEFAULT NULL,
  p_advisor_id uuid DEFAULT NULL,
  p_include_downline boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sql text;
  v_select text;
  v_where text;
  v_group_by text := '';
  v_order_by text := '';
  v_having text := '';
  v_result jsonb;
  v_count_result bigint;
  v_agg record;
  v_grp record;
  v_flt record;
  v_srt record;
  v_i int := 0;
  v_col_name text;
  v_allowed_tables text[] := ARRAY[
    'crm_records', 'crm_tasks', 'members', 'advisors',
    'enrollments', 'commissions', 'commission_rates', 'products'
  ];
  v_col_re text := '^[a-zA-Z_][a-zA-Z0-9_]*$';
BEGIN
  -- Validate table name (whitelist)
  IF p_table IS NULL OR NOT (p_table = ANY(v_allowed_tables)) THEN
    RAISE EXCEPTION 'Invalid table: %', p_table;
  END IF;

  -- Validate org column
  IF p_org_column NOT IN ('org_id', 'organization_id') THEN
    RAISE EXCEPTION 'Invalid org column: %', p_org_column;
  END IF;

  -- Build SELECT: group fields + aggregations
  v_select := '';

  -- Add grouping columns to SELECT
  FOR v_grp IN SELECT * FROM jsonb_array_elements(p_grouping)
  LOOP
    v_col_name := v_grp.value->>'field';
    IF v_col_name IS NULL OR v_col_name !~ v_col_re THEN
      CONTINUE;
    END IF;
    IF v_select != '' THEN v_select := v_select || ', '; END IF;
    v_select := v_select || format('%I', v_col_name);
    IF v_group_by != '' THEN v_group_by := v_group_by || ', '; END IF;
    v_group_by := v_group_by || format('%I', v_col_name);
  END LOOP;

  -- Add aggregation columns to SELECT
  FOR v_agg IN SELECT * FROM jsonb_array_elements(p_aggregations)
  LOOP
    v_col_name := v_agg.value->>'field';
    IF v_col_name IS NULL OR v_col_name !~ v_col_re THEN
      CONTINUE;
    END IF;

    IF v_select != '' THEN v_select := v_select || ', '; END IF;

    CASE (v_agg.value->>'function')
      WHEN 'count' THEN
        v_select := v_select || format('COUNT(%I) AS %I', v_col_name, 'count_' || v_col_name);
      WHEN 'sum' THEN
        v_select := v_select || format('SUM((%I)::numeric) AS %I', v_col_name, 'sum_' || v_col_name);
      WHEN 'avg' THEN
        v_select := v_select || format('ROUND(AVG((%I)::numeric), 2) AS %I', v_col_name, 'avg_' || v_col_name);
      WHEN 'min' THEN
        v_select := v_select || format('MIN(%I) AS %I', v_col_name, 'min_' || v_col_name);
      WHEN 'max' THEN
        v_select := v_select || format('MAX(%I) AS %I', v_col_name, 'max_' || v_col_name);
      ELSE
        CONTINUE;
    END CASE;
  END LOOP;

  -- Fallback: if no aggregations and no grouping, just count
  IF v_select = '' THEN
    v_select := 'COUNT(*) AS total_count';
  END IF;

  -- Build WHERE clause
  v_where := format('%I = %L', p_org_column, p_org_id);

  -- Module filter
  IF p_module_id IS NOT NULL THEN
    v_where := v_where || format(' AND module_id = %L', p_module_id);
  END IF;

  -- Product type filter
  IF p_product_type IS NOT NULL AND p_product_type != '' THEN
    v_where := v_where || format(' AND product_type = %L', p_product_type);
  END IF;

  -- Advisor filter (with optional downline via recursive CTE)
  IF p_advisor_id IS NOT NULL THEN
    IF p_include_downline THEN
      v_where := v_where || format(
        ' AND advisor_id IN (
          SELECT %L::uuid
          UNION ALL
          SELECT id FROM get_advisor_downline_ids(%L)
        )',
        p_advisor_id, p_advisor_id
      );
    ELSE
      v_where := v_where || format(' AND advisor_id = %L', p_advisor_id);
    END IF;
  END IF;

  -- Apply user-defined filters
  FOR v_flt IN SELECT * FROM jsonb_array_elements(p_filters)
  LOOP
    v_col_name := v_flt.value->>'field';
    IF v_col_name IS NULL OR v_col_name !~ v_col_re THEN
      CONTINUE;
    END IF;

    DECLARE
      v_op text := COALESCE(v_flt.value->>'operator', 'equals');
      v_val text := v_flt.value->>'value';
      v_val2 text := v_flt.value->>'value2';
      v_connector text := CASE WHEN p_filter_logic = 'or' THEN ' OR ' ELSE ' AND ' END;
    BEGIN
      CASE v_op
        WHEN 'equals', 'eq' THEN
          v_where := v_where || v_connector || format('%I = %L', v_col_name, v_val);
        WHEN 'not_equals', 'neq' THEN
          v_where := v_where || v_connector || format('%I != %L', v_col_name, v_val);
        WHEN 'contains', 'ilike' THEN
          v_where := v_where || v_connector || format('%I ILIKE %L', v_col_name, '%' || v_val || '%');
        WHEN 'not_contains' THEN
          v_where := v_where || v_connector || format('%I NOT ILIKE %L', v_col_name, '%' || v_val || '%');
        WHEN 'starts_with' THEN
          v_where := v_where || v_connector || format('%I ILIKE %L', v_col_name, v_val || '%');
        WHEN 'gt' THEN
          v_where := v_where || v_connector || format('%I > %L', v_col_name, v_val);
        WHEN 'gte' THEN
          v_where := v_where || v_connector || format('%I >= %L', v_col_name, v_val);
        WHEN 'lt' THEN
          v_where := v_where || v_connector || format('%I < %L', v_col_name, v_val);
        WHEN 'lte' THEN
          v_where := v_where || v_connector || format('%I <= %L', v_col_name, v_val);
        WHEN 'between' THEN
          v_where := v_where || v_connector || format('%I BETWEEN %L AND %L', v_col_name, v_val, v_val2);
        WHEN 'in', 'is_any_of' THEN
          -- Value is comma-separated
          v_where := v_where || v_connector || format('%I = ANY(string_to_array(%L, %L))', v_col_name, v_val, ',');
        WHEN 'is_empty', 'is_null' THEN
          v_where := v_where || v_connector || format('%I IS NULL', v_col_name);
        WHEN 'is_not_empty', 'is_not_null' THEN
          v_where := v_where || v_connector || format('%I IS NOT NULL', v_col_name);
        ELSE
          NULL; -- skip unknown operators
      END CASE;
    END;
  END LOOP;

  -- Build ORDER BY
  IF p_sorting IS NOT NULL AND jsonb_array_length(p_sorting) > 0 THEN
    FOR v_srt IN SELECT * FROM jsonb_array_elements(p_sorting)
    LOOP
      v_col_name := v_srt.value->>'column';
      IF v_col_name IS NULL OR v_col_name !~ v_col_re THEN
        CONTINUE;
      END IF;
      IF v_order_by != '' THEN v_order_by := v_order_by || ', '; END IF;
      v_order_by := v_order_by || format('%I %s', v_col_name,
        CASE WHEN (v_srt.value->>'direction') = 'desc' THEN 'DESC' ELSE 'ASC' END
      );
    END LOOP;
  END IF;

  -- Assemble query
  v_sql := 'SELECT ' || v_select || format(' FROM %I WHERE ', p_table) || v_where;

  IF v_group_by != '' THEN
    v_sql := v_sql || ' GROUP BY ' || v_group_by;
  END IF;

  IF v_order_by != '' THEN
    v_sql := v_sql || ' ORDER BY ' || v_order_by;
  ELSIF v_group_by != '' THEN
    v_sql := v_sql || ' ORDER BY ' || v_group_by;
  END IF;

  v_sql := v_sql || format(' LIMIT %s OFFSET %s', p_limit, p_offset);

  -- Execute and return as JSONB
  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (%s) t',
    v_sql
  ) INTO v_result;

  -- Get total count for pagination
  IF v_group_by != '' THEN
    EXECUTE format(
      'SELECT COUNT(*) FROM (SELECT 1 FROM %I WHERE %s GROUP BY %s) sub',
      p_table, v_where, v_group_by
    ) INTO v_count_result;
  ELSE
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE %s', p_table, v_where)
      INTO v_count_result;
  END IF;

  RETURN jsonb_build_object(
    'rows', v_result,
    'total', v_count_result
  );
END;
$$;

COMMENT ON FUNCTION public.execute_report_aggregation IS
  'Server-side report execution with GROUP BY, aggregations, capacity filtering, and downline support';


-- 3. (get_advisor_downline_ids already created in 202603020001 — reusing existing function)

-- 4. Index for report queries
CREATE INDEX IF NOT EXISTS idx_crm_reports_org_scope
  ON public.crm_reports (org_id, scope)
  WHERE scope IS NOT NULL;


-- ============================================================================
-- Done. All changes are additive and backward-compatible.
-- ============================================================================

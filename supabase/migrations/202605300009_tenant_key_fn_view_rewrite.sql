-- Phase 1 (tenant-key standardization): make the remaining org_id-dependent
-- functions/views read organization_id, drop-safe. org_id == organization_id today
-- (sync-locked), so all changes are behavior-preserving. CREATE OR REPLACE only —
-- atomic, reversible, no data change.
--
-- Scope:
--   * execute_report_aggregation: default org column 'org_id' -> 'organization_id'
--     and normalize the (validated) p_org_column to organization_id at runtime so
--     legacy callers passing 'org_id' keep working and survive the column drop.
--   * 6 views recomputed off organization_id while PRESERVING their output column
--     names/types/order (so dependents + app readers are unaffected).
-- NOT here (still org_id, separate follow-ups before the column drop):
--   * crm_duplicate_audit_summary: reads crm_duplicate_audit's org_id OUTPUT column
--     (a view column, not a base column) -> already drop-safe, unchanged.
--   * get_executive_kpis + executive_kpi_mv + executive_top_advisor_mv: a matview
--     recreation sub-project (DROP/CREATE/reindex/REFRESH).
--   * 4 fns with a param literally named org_id (generate_invoice_number,
--     generate_quote_number, get_least_busy_agent, user_role_in): verified drop-safe
--     as-is (their tables have only organization_id; org_id is purely the param name).
--   * app-code org_id references (~243 files) incl. reports/execute route config.

-- ===== execute_report_aggregation =====
CREATE OR REPLACE FUNCTION public.execute_report_aggregation(p_org_id uuid, p_table text, p_org_column text DEFAULT 'organization_id'::text, p_module_id uuid DEFAULT NULL::uuid, p_filters jsonb DEFAULT '[]'::jsonb, p_filter_logic text DEFAULT 'and'::text, p_grouping jsonb DEFAULT '[]'::jsonb, p_aggregations jsonb DEFAULT '[]'::jsonb, p_sorting jsonb DEFAULT '[]'::jsonb, p_limit integer DEFAULT 1000, p_offset integer DEFAULT 0, p_product_type text DEFAULT NULL::text, p_advisor_id uuid DEFAULT NULL::uuid, p_include_downline boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Tenant-key cutover: org_id == organization_id (sync-locked). Normalize the
  -- legacy column name to the canonical one so this RPC stays correct after the
  -- org_id column is dropped. Behavior-preserving today (values identical).
  p_org_column := 'organization_id';

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
$function$;

-- ===== views (output columns preserved) =====
CREATE OR REPLACE VIEW public.change_feed_view AS
 SELECT ce.id,
    ce.organization_id AS org_id,
    ce.source_type,
    ce.source_name,
    ce.source_id,
    ce.change_type,
    ce.entity_type,
    ce.entity_id,
    ce.entity_title,
    ce.severity,
    ce.requires_review,
    ce.title,
    ce.description,
    ce.diff,
    ce.payload,
    ce.actor_id,
    ce.actor_name,
    ce.actor_type,
    ce.reconciliation_status,
    ce.reviewed_by,
    ce.reviewed_at,
    ce.review_notes,
    ce.content_hash,
    ce.previous_hash,
    ce.sync_status,
    ce.synced_at,
    ce.detected_at,
    ce.created_at,
    p.full_name AS actor_full_name,
    NULL::text AS actor_avatar_url,
    rp.full_name AS reviewer_full_name
   FROM change_events ce
     LEFT JOIN profiles p ON ce.actor_id = p.id
     LEFT JOIN profiles rp ON ce.reviewed_by = rp.id;;

CREATE OR REPLACE VIEW public.crm_duplicate_audit AS
 WITH email_clusters AS (
         SELECT r.organization_id AS org_id,
            'email'::text AS rule,
            lower(btrim(r.email)) AS match_key,
            array_agg(r.id ORDER BY r.created_at, r.id) AS ids,
            array_agg(r.title ORDER BY r.created_at, r.id) AS titles,
            array_agg(r.module_id ORDER BY r.created_at, r.id) AS module_ids,
            count(*)::integer AS member_count,
            NULL::numeric AS min_name_similarity
           FROM crm_records r
          WHERE r.email IS NOT NULL AND btrim(r.email) <> ''::text
          GROUP BY r.organization_id, (lower(btrim(r.email)))
         HAVING count(*) > 1
        ), phone_clusters_raw AS (
         SELECT r.organization_id AS org_id,
            regexp_replace(COALESCE(r.phone, ''::text), '\D'::text, ''::text, 'g'::text) AS digits,
            array_agg(r.id ORDER BY r.created_at, r.id) AS ids,
            array_agg(r.title ORDER BY r.created_at, r.id) AS titles,
            array_agg(r.module_id ORDER BY r.created_at, r.id) AS module_ids,
            count(*)::integer AS member_count
           FROM crm_records r
          WHERE length(regexp_replace(COALESCE(r.phone, ''::text), '\D'::text, ''::text, 'g'::text)) >= 10
          GROUP BY r.organization_id, (regexp_replace(COALESCE(r.phone, ''::text), '\D'::text, ''::text, 'g'::text))
         HAVING count(*) > 1
        ), phone_clusters AS (
         SELECT pc.org_id,
            'phone+name'::text AS rule,
            pc.digits AS match_key,
            pc.ids,
            pc.titles,
            pc.module_ids,
            pc.member_count,
            ( SELECT min(similarity(COALESCE(t1.t, ''::text), COALESCE(t2.t, ''::text))) AS min
                   FROM unnest(pc.titles) WITH ORDINALITY t1(t, i),
                    unnest(pc.titles) WITH ORDINALITY t2(t, i)
                  WHERE t1.i < t2.i) AS min_name_similarity
           FROM phone_clusters_raw pc
          WHERE NOT (EXISTS ( SELECT 1
                   FROM email_clusters ec
                  WHERE ec.org_id = pc.org_id AND ec.ids @> pc.ids))
        )
 SELECT c.org_id,
    o.name AS org_name,
    c.rule,
    c.match_key,
    c.ids[1] AS keeper_id_oldest,
    c.ids[2:] AS duplicate_ids,
    c.titles,
    c.module_ids,
    c.member_count,
    c.min_name_similarity
   FROM ( SELECT email_clusters.org_id,
            email_clusters.rule,
            email_clusters.match_key,
            email_clusters.ids,
            email_clusters.titles,
            email_clusters.module_ids,
            email_clusters.member_count,
            email_clusters.min_name_similarity
           FROM email_clusters
        UNION ALL
         SELECT phone_clusters.org_id,
            phone_clusters.rule,
            phone_clusters.match_key,
            phone_clusters.ids,
            phone_clusters.titles,
            phone_clusters.module_ids,
            phone_clusters.member_count,
            phone_clusters.min_name_similarity
           FROM phone_clusters) c
     LEFT JOIN organizations o ON o.id = c.org_id
  ORDER BY c.member_count DESC, c.org_id, c.rule, c.match_key;;

CREATE OR REPLACE VIEW public.crm_probable_duplicates_all AS
 WITH candidates AS (
         SELECT r.id,
            r.organization_id AS org_id,
            r.module_id,
            r.title,
            r.email,
            r.phone,
            r.status,
            r.updated_at,
            lower(COALESCE(r.data ->> 'first_name'::text, ''::text)) AS first_name_lc,
            lower(COALESCE(r.data ->> 'last_name'::text, ''::text)) AS last_name_lc,
            NULLIF(r.data ->> 'date_of_birth'::text, ''::text) AS dob,
            ( SELECT count(*) AS count
                   FROM crm_notes n
                  WHERE n.record_id = r.id) AS note_count,
            ( SELECT count(*) AS count
                   FROM crm_tasks t
                  WHERE t.record_id = r.id) AS task_count,
            ( SELECT count(*) AS count
                   FROM crm_attachments a
                  WHERE a.record_id = r.id) AS attachment_count
           FROM crm_records r
          WHERE COALESCE(r.data ->> 'first_name'::text, ''::text) <> ''::text AND COALESCE(r.data ->> 'last_name'::text, ''::text) <> ''::text
        ), pairs AS (
         SELECT a.id AS left_id,
            b.id AS right_id,
            a.org_id,
            a.module_id,
            a.title AS left_title,
            b.title AS right_title,
            a.email AS left_email,
            b.email AS right_email,
            a.phone AS left_phone,
            b.phone AS right_phone,
            a.status AS left_status,
            b.status AS right_status,
            a.note_count AS left_notes,
            b.note_count AS right_notes,
            a.task_count AS left_tasks,
            b.task_count AS right_tasks,
            a.attachment_count AS left_attachments,
            b.attachment_count AS right_attachments,
            a.updated_at AS left_updated_at,
            b.updated_at AS right_updated_at,
            array_remove(ARRAY[
                CASE
                    WHEN a.email IS NOT NULL AND b.email IS NOT NULL AND lower(a.email) = lower(b.email) THEN 'email'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN a.phone IS NOT NULL AND b.phone IS NOT NULL AND a.phone = b.phone THEN 'phone'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN a.dob IS NOT NULL AND b.dob IS NOT NULL AND a.dob = b.dob THEN 'dob'::text
                    ELSE NULL::text
                END], NULL::text) AS match_signals
           FROM candidates a
             JOIN candidates b ON a.org_id = b.org_id AND a.module_id = b.module_id AND a.id < b.id AND a.first_name_lc = b.first_name_lc AND a.last_name_lc = b.last_name_lc
          WHERE a.email IS NOT NULL AND b.email IS NOT NULL AND lower(a.email) = lower(b.email) OR a.phone IS NOT NULL AND b.phone IS NOT NULL AND a.phone = b.phone OR a.dob IS NOT NULL AND b.dob IS NOT NULL AND a.dob = b.dob
        )
 SELECT left_id,
    right_id,
    org_id,
    module_id,
    left_title,
    right_title,
    left_email,
    right_email,
    left_phone,
    right_phone,
    left_status,
    right_status,
    left_notes,
    right_notes,
    left_tasks,
    right_tasks,
    left_attachments,
    right_attachments,
    left_updated_at,
    right_updated_at,
    match_signals,
        CASE
            WHEN ('email'::text = ANY (match_signals)) AND ('dob'::text = ANY (match_signals)) THEN 'high'::text
            WHEN ('email'::text = ANY (match_signals)) AND ('phone'::text = ANY (match_signals)) THEN 'high'::text
            WHEN 'email'::text = ANY (match_signals) THEN 'medium'::text
            WHEN ('phone'::text = ANY (match_signals)) AND ('dob'::text = ANY (match_signals)) THEN 'medium'::text
            ELSE 'low'::text
        END AS confidence
   FROM pairs p;;

CREATE OR REPLACE VIEW public.crm_probable_duplicates AS
 SELECT left_id,
    right_id,
    org_id,
    module_id,
    left_title,
    right_title,
    left_email,
    right_email,
    left_phone,
    right_phone,
    left_status,
    right_status,
    left_notes,
    right_notes,
    left_tasks,
    right_tasks,
    left_attachments,
    right_attachments,
    left_updated_at,
    right_updated_at,
    match_signals,
    confidence
   FROM crm_probable_duplicates_all p
  WHERE NOT (EXISTS ( SELECT 1
           FROM crm_duplicate_dismissals d
          WHERE d.organization_id = p.org_id AND d.left_record_id = p.left_id AND d.right_record_id = p.right_id));;

CREATE OR REPLACE VIEW public.medicaid_dashboard_stats AS
 SELECT organization_id,
    count(id) FILTER (WHERE is_medicaid = true) AS total_medicaid_members,
    count(id) FILTER (WHERE is_medicaid = true AND medicaid_end_date IS NULL) AS active_medicaid,
    count(id) FILTER (WHERE is_medicaid = true AND medicaid_end_date IS NOT NULL) AS former_medicaid,
    count(id) FILTER (WHERE is_medicaid = true AND medicaid_end_date IS NOT NULL AND medicaid_end_date >= (now() - '90 days'::interval)) AS transitioning_from_medicaid,
    count(id) FILTER (WHERE is_medicaid = true AND medicaid_start_date >= date_trunc('month'::text, now())) AS new_medicaid_this_month
   FROM crm_records r
  GROUP BY organization_id;;

CREATE OR REPLACE VIEW public.medicaid_state_breakdown AS
 SELECT organization_id,
    medicaid_state AS state,
    count(id) AS total,
    count(id) FILTER (WHERE medicaid_end_date IS NULL) AS active,
    count(id) FILTER (WHERE medicaid_end_date IS NOT NULL AND medicaid_end_date >= (now() - '90 days'::interval)) AS transitioning
   FROM crm_records r
  WHERE is_medicaid = true AND medicaid_state IS NOT NULL
  GROUP BY organization_id, medicaid_state;;

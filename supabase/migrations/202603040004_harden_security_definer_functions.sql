-- Migration: Harden SECURITY DEFINER functions with org membership validation
--
-- Fixes: Multiple SECURITY DEFINER RPC functions accept org_id / record_id
-- parameters but never verify the calling user belongs to that org.
-- An authenticated user in Org A could call these functions with Org B's ID
-- and read/write data across tenant boundaries.
--
-- Strategy:
--   * For functions that accept p_org_id: validate auth.uid() has a matching
--     profile row with that organization_id before proceeding.
--   * For functions that accept only a record_id: join through the record's
--     org_id to validate caller membership.
--   * For functions that accept p_user_id: validate it matches auth.uid()'s
--     profile row.
--   * Silent "return empty" for read-only helpers (to avoid leaking existence).
--   * RAISE EXCEPTION for write helpers (to surface misconfiguration).

-- ============================================================================
-- 1. get_deal_stages(p_org_id) — returns empty if caller not in org
-- ============================================================================
CREATE OR REPLACE FUNCTION get_deal_stages(p_org_id uuid)
RETURNS SETOF crm_deal_stages
LANGUAGE plpgsql
SECURITY DEFINER STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND organization_id = p_org_id
  ) THEN
    RETURN; -- empty set, no information leakage
  END IF;

  RETURN QUERY
    SELECT * FROM crm_deal_stages
    WHERE org_id = p_org_id AND is_active = true
    ORDER BY display_order;
END;
$$;

-- ============================================================================
-- 2. get_record_stage_history(p_record_id) — validate caller owns the record's org
-- ============================================================================
DROP FUNCTION IF EXISTS get_record_stage_history(uuid);
CREATE OR REPLACE FUNCTION get_record_stage_history(p_record_id uuid)
RETURNS TABLE (
  id uuid,
  from_stage text,
  to_stage text,
  duration_seconds integer,
  changed_by uuid,
  changed_by_name text,
  reason text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM crm_records r
    JOIN profiles p ON p.organization_id = r.org_id
    WHERE r.id = p_record_id AND p.user_id = auth.uid()
  ) THEN
    RETURN; -- empty set
  END IF;

  RETURN QUERY
    SELECT
      h.id,
      h.from_stage,
      h.to_stage,
      h.duration_seconds,
      h.changed_by,
      p.full_name AS changed_by_name,
      h.reason,
      h.created_at
    FROM crm_deal_stage_history h
    LEFT JOIN profiles p ON h.changed_by = p.id
    WHERE h.record_id = p_record_id
    ORDER BY h.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION get_record_stage_history(uuid) TO authenticated;

-- ============================================================================
-- 3. get_linked_records(p_record_id) — validate caller owns the record's org
-- ============================================================================
DROP FUNCTION IF EXISTS get_linked_records(uuid);
CREATE OR REPLACE FUNCTION get_linked_records(p_record_id uuid)
RETURNS TABLE (
  link_id uuid,
  link_type text,
  is_primary boolean,
  direction text,
  record_id uuid,
  record_title text,
  record_module_key text,
  record_module_name text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM crm_records r
    JOIN profiles p ON p.organization_id = r.org_id
    WHERE r.id = p_record_id AND p.user_id = auth.uid()
  ) THEN
    RETURN; -- empty set
  END IF;

  RETURN QUERY
    SELECT
      l.id AS link_id,
      l.link_type,
      l.is_primary,
      'outbound'::text AS direction,
      r2.id AS record_id,
      r2.title AS record_title,
      m.key AS record_module_key,
      m.name AS record_module_name,
      l.created_at
    FROM crm_record_links l
    JOIN crm_records r2 ON l.target_record_id = r2.id
    JOIN crm_modules m ON r2.module_id = m.id
    WHERE l.source_record_id = p_record_id

    UNION ALL

    SELECT
      l.id AS link_id,
      l.link_type,
      l.is_primary,
      'inbound'::text AS direction,
      r2.id AS record_id,
      r2.title AS record_title,
      m.key AS record_module_key,
      m.name AS record_module_name,
      l.created_at
    FROM crm_record_links l
    JOIN crm_records r2 ON l.source_record_id = r2.id
    JOIN crm_modules m ON r2.module_id = m.id
    WHERE l.target_record_id = p_record_id

    ORDER BY created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION get_linked_records(uuid) TO authenticated;

-- ============================================================================
-- 4. seed_default_deal_stages(p_org_id) — WRITE: raise exception if unauthorized
-- ============================================================================
CREATE OR REPLACE FUNCTION seed_default_deal_stages(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND organization_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: caller does not belong to this organization';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM crm_deal_stages WHERE org_id = p_org_id) THEN
    INSERT INTO crm_deal_stages (org_id, key, name, color, probability, is_won, is_lost, display_order)
    VALUES
      (p_org_id, 'qualification', 'Qualification', '#8b5cf6', 10, false, false, 1),
      (p_org_id, 'needs_analysis', 'Needs Analysis', '#6366f1', 25, false, false, 2),
      (p_org_id, 'proposal', 'Proposal', '#3b82f6', 50, false, false, 3),
      (p_org_id, 'negotiation', 'Negotiation', '#0ea5e9', 75, false, false, 4),
      (p_org_id, 'closed_won', 'Closed Won', '#22c55e', 100, true, false, 5),
      (p_org_id, 'closed_lost', 'Closed Lost', '#ef4444', 0, false, true, 6);
  END IF;
END;
$$;

-- ============================================================================
-- 5. get_org_by_slug(p_slug) — CRITICAL: revoke anon access, require auth + membership
-- ============================================================================
CREATE OR REPLACE FUNCTION get_org_by_slug(p_slug text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT o.id FROM organizations o
  JOIN profiles p ON p.organization_id = o.id
  WHERE o.slug = p_slug AND p.user_id = auth.uid()
  LIMIT 1;
$$;

-- Revoke anonymous access — only authenticated users who belong to the org
REVOKE EXECUTE ON FUNCTION get_org_by_slug(text) FROM anon;
GRANT EXECUTE ON FUNCTION get_org_by_slug(text) TO authenticated;

-- ============================================================================
-- 6. increment_report_run_count(p_report_id) — validate caller owns the report's org
-- ============================================================================
CREATE OR REPLACE FUNCTION public.increment_report_run_count(p_report_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM crm_reports rpt
    JOIN profiles p ON p.organization_id = rpt.org_id
    WHERE rpt.id = p_report_id AND p.user_id = auth.uid()
  ) THEN
    RETURN; -- silently skip
  END IF;

  UPDATE public.crm_reports
  SET
    run_count = COALESCE(run_count, 0) + 1,
    last_run_at = now()
  WHERE id = p_report_id;
END;
$$;

-- ============================================================================
-- 7. log_report_run — validate caller matches p_user_id and belongs to p_org_id
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_report_run(
  p_report_id uuid,
  p_org_id uuid,
  p_user_id uuid,
  p_duration_ms integer,
  p_row_count integer,
  p_status text DEFAULT 'completed',
  p_error_message text DEFAULT NULL,
  p_filters_used jsonb DEFAULT '[]'::jsonb,
  p_export_format text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_history_id uuid;
BEGIN
  -- Validate caller belongs to org and matches user_id
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
      AND organization_id = p_org_id
      AND id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: caller does not match p_user_id or does not belong to org';
  END IF;

  INSERT INTO public.report_run_history (
    report_id, organization_id, executed_by, duration_ms, row_count,
    status, error_message, filters_used, export_format
  ) VALUES (
    p_report_id, p_org_id, p_user_id, p_duration_ms, p_row_count,
    p_status, p_error_message, p_filters_used, p_export_format
  )
  RETURNING id INTO v_history_id;

  IF p_status = 'completed' THEN
    PERFORM public.increment_report_run_count(p_report_id);
  END IF;

  RETURN v_history_id;
END;
$$;

-- ============================================================================
-- 8. get_agent_workload(p_agent_id) — validate caller is in same org as agent
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_agent_workload(p_agent_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_org uuid;
  v_agent_org uuid;
BEGIN
  SELECT organization_id INTO v_caller_org FROM profiles WHERE user_id = auth.uid() LIMIT 1;
  SELECT organization_id INTO v_agent_org FROM profiles WHERE id = p_agent_id LIMIT 1;

  IF v_caller_org IS NULL OR v_agent_org IS NULL OR v_caller_org != v_agent_org THEN
    RETURN 0;
  END IF;

  RETURN (
    SELECT COUNT(*)::int
    FROM tickets t
    WHERE t.assignee_id = p_agent_id
      AND t.status NOT IN ('closed', 'resolved')
  );
END;
$$;

-- ============================================================================
-- 9. get_least_busy_agent(org_id) — fix to actually filter by org_id + validate caller
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_least_busy_agent(uuid);
CREATE OR REPLACE FUNCTION public.get_least_busy_agent(org_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id uuid;
  v_effective_org uuid;
BEGIN
  -- Determine org: use param or fall back to caller's org
  v_effective_org := COALESCE(org_id, (SELECT organization_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

  IF v_effective_org IS NULL THEN
    RETURN NULL;
  END IF;

  -- Validate caller belongs to the org
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND organization_id = v_effective_org
  ) THEN
    RETURN NULL;
  END IF;

  -- Find least busy agent WITHIN the org
  SELECT p.id INTO v_agent_id
  FROM profiles p
  WHERE p.organization_id = v_effective_org
    AND p.role IN ('agent', 'it', 'staff', 'admin')
  ORDER BY (
    SELECT COUNT(*)
    FROM tickets t
    WHERE t.assignee_id = p.id
      AND t.status NOT IN ('closed', 'resolved')
  ) ASC
  LIMIT 1;

  RETURN v_agent_id;
EXCEPTION WHEN undefined_column THEN
  RETURN NULL;
END;
$$;

-- ============================================================================
-- 10. get_module_stats(p_org_id) — validate caller belongs to org
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_module_stats(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_one_week_ago timestamptz := now() - interval '7 days';
BEGIN
  -- Validate caller belongs to org
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND organization_id = p_org_id
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH module_counts AS (
    SELECT
      m.key AS module_key,
      COALESCE(m.name_plural, m.name || 's') AS module_name,
      COUNT(r.id) AS total_records,
      COUNT(r.id) FILTER (WHERE r.created_at >= v_one_week_ago) AS created_this_week
    FROM crm_modules m
    LEFT JOIN crm_records r ON r.module_id = m.id
    WHERE m.org_id = p_org_id AND m.is_enabled = true
    GROUP BY m.key, m.name, m.name_plural
  ),
  legacy_leads AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE created_at >= v_one_week_ago) AS this_week
    FROM leads
    WHERE organization_id = p_org_id
  ),
  legacy_members AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE created_at >= v_one_week_ago) AS this_week
    FROM members
    WHERE organization_id = p_org_id
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'moduleKey', mc.module_key,
      'moduleName', mc.module_name,
      'totalRecords', mc.total_records +
        CASE mc.module_key
          WHEN 'leads' THEN COALESCE((SELECT total FROM legacy_leads), 0)
          WHEN 'contacts' THEN COALESCE((SELECT total FROM legacy_members), 0)
          ELSE 0
        END,
      'createdThisWeek', mc.created_this_week +
        CASE mc.module_key
          WHEN 'leads' THEN COALESCE((SELECT this_week FROM legacy_leads), 0)
          WHEN 'contacts' THEN COALESCE((SELECT this_week FROM legacy_members), 0)
          ELSE 0
        END
    )
  ) INTO v_result
  FROM module_counts mc;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ============================================================================
-- 11. get_dashboard_hero_stats(p_org_id, p_user_id) — validate both params
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_hero_stats(
  p_org_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_start timestamptz := date_trunc('day', now());
  v_today_end   timestamptz := v_today_start + interval '1 day';
  v_seven_days  timestamptz := now() - interval '7 days';
  v_todays_task_count int;
  v_overdue_count int;
  v_at_risk_count int;
  v_new_this_week bigint;
BEGIN
  -- Validate caller belongs to org AND matches p_user_id
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
      AND organization_id = p_org_id
      AND id = p_user_id
  ) THEN
    RETURN jsonb_build_object(
      'todaysTaskCount', 0, 'overdueCount', 0,
      'atRiskCount', 0, 'newThisWeek', 0
    );
  END IF;

  SELECT COUNT(*) INTO v_todays_task_count
  FROM crm_tasks
  WHERE assigned_to = p_user_id
    AND status != 'completed'
    AND due_at >= v_today_start
    AND due_at < v_today_end;

  SELECT COUNT(*) INTO v_overdue_count
  FROM crm_tasks
  WHERE assigned_to = p_user_id
    AND status != 'completed'
    AND due_at < now();

  SELECT COUNT(*) INTO v_at_risk_count
  FROM crm_records r
  JOIN crm_modules m ON m.id = r.module_id
  WHERE m.org_id = p_org_id
    AND m.key = 'deals'
    AND r.updated_at < v_seven_days
    AND r.data->>'stage' NOT IN ('Closed Won', 'Closed Lost', 'closed_won', 'closed_lost');

  SELECT COUNT(*) INTO v_new_this_week
  FROM crm_records r
  JOIN crm_modules m ON m.id = r.module_id
  WHERE m.org_id = p_org_id
    AND m.is_enabled = true
    AND r.created_at >= v_seven_days;

  RETURN jsonb_build_object(
    'todaysTaskCount', v_todays_task_count,
    'overdueCount', v_overdue_count,
    'atRiskCount', v_at_risk_count,
    'newThisWeek', v_new_this_week
  );
END;
$$;

-- ============================================================================
-- 12. get_approval_rules_for_module(p_module_id) — validate caller owns the module's org
-- ============================================================================
CREATE OR REPLACE FUNCTION get_approval_rules_for_module(
  p_module_id uuid,
  p_trigger_type text DEFAULT NULL
)
RETURNS SETOF crm_approval_rules
LANGUAGE plpgsql
SECURITY DEFINER STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM crm_modules m
    JOIN profiles p ON p.organization_id = m.org_id
    WHERE m.id = p_module_id AND p.user_id = auth.uid()
  ) THEN
    RETURN; -- empty set
  END IF;

  RETURN QUERY
    SELECT * FROM crm_approval_rules
    WHERE module_id = p_module_id
      AND is_enabled = true
      AND (p_trigger_type IS NULL OR trigger_type = p_trigger_type)
    ORDER BY priority ASC, created_at ASC;
END;
$$;

-- ============================================================================
-- 13. check_approval_required(p_org_id, ...) — validate caller belongs to org
-- ============================================================================
CREATE OR REPLACE FUNCTION check_approval_required(
  p_org_id uuid,
  p_module_id uuid,
  p_trigger_type text,
  p_record_data jsonb,
  p_trigger_context jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  rule_id uuid,
  process_id uuid,
  rule_name text
)
LANGUAGE plpgsql
SECURITY DEFINER STABLE
SET search_path = public
AS $$
DECLARE
  v_rule RECORD;
  v_conditions jsonb;
  v_condition RECORD;
  v_logic text;
  v_matches boolean;
  v_field_value jsonb;
BEGIN
  -- Validate caller belongs to org
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND organization_id = p_org_id
  ) THEN
    RETURN; -- empty set
  END IF;

  FOR v_rule IN
    SELECT * FROM crm_approval_rules
    WHERE org_id = p_org_id
      AND module_id = p_module_id
      AND trigger_type = p_trigger_type
      AND is_enabled = true
    ORDER BY priority ASC
  LOOP
    v_conditions := COALESCE(v_rule.conditions, '[]'::jsonb);
    v_logic := COALESCE(v_rule.condition_logic, 'all');

    -- If no conditions, rule always matches
    IF jsonb_array_length(v_conditions) = 0 THEN
      rule_id := v_rule.id;
      process_id := v_rule.approval_process_id;
      rule_name := v_rule.name;
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Evaluate conditions
    v_matches := CASE WHEN v_logic = 'all' THEN true ELSE false END;

    FOR v_condition IN
      SELECT * FROM jsonb_to_recordset(v_conditions)
      AS x(field text, operator text, value jsonb)
    LOOP
      v_field_value := p_record_data->v_condition.field;

      DECLARE
        v_cond_met boolean := false;
      BEGIN
        CASE v_condition.operator
          WHEN 'equals' THEN
            v_cond_met := v_field_value = v_condition.value;
          WHEN 'not_equals' THEN
            v_cond_met := v_field_value != v_condition.value;
          WHEN 'greater_than' THEN
            v_cond_met := (v_field_value::text)::numeric > (v_condition.value::text)::numeric;
          WHEN 'less_than' THEN
            v_cond_met := (v_field_value::text)::numeric < (v_condition.value::text)::numeric;
          WHEN 'contains' THEN
            v_cond_met := v_field_value::text ILIKE '%' || (v_condition.value#>>'{}') || '%';
          WHEN 'in' THEN
            v_cond_met := v_field_value <@ v_condition.value;
          WHEN 'changed' THEN
            v_cond_met := p_trigger_context ? v_condition.field;
          ELSE
            v_cond_met := false;
        END CASE;

        IF v_logic = 'all' AND NOT v_cond_met THEN
          v_matches := false;
          EXIT;
        ELSIF v_logic = 'any' AND v_cond_met THEN
          v_matches := true;
          EXIT;
        END IF;
      END;
    END LOOP;

    IF v_matches THEN
      rule_id := v_rule.id;
      process_id := v_rule.approval_process_id;
      rule_name := v_rule.name;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================================
-- 14. get_approval_inbox(p_org_id, p_profile_id, ...) — validate caller
-- ============================================================================
CREATE OR REPLACE FUNCTION get_approval_inbox(
  p_org_id uuid,
  p_profile_id uuid,
  p_user_role text,
  p_status text DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_assigned_to_me boolean DEFAULT false,
  p_requested_by_me boolean DEFAULT false,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  process_id uuid,
  process_name text,
  record_id uuid,
  record_title text,
  module_key text,
  module_name text,
  status text,
  current_step int,
  total_steps int,
  context jsonb,
  requested_by uuid,
  requested_by_name text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER STABLE
SET search_path = public
AS $$
BEGIN
  -- Validate caller belongs to org AND matches p_profile_id
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
      AND organization_id = p_org_id
      AND id = p_profile_id
  ) THEN
    RETURN; -- empty set
  END IF;

  RETURN QUERY
    SELECT
      a.id,
      a.process_id,
      p.name AS process_name,
      a.record_id,
      r.title AS record_title,
      m.key AS module_key,
      m.name AS module_name,
      a.status,
      a.current_step,
      jsonb_array_length(p.steps)::int AS total_steps,
      a.context,
      a.requested_by,
      pr.full_name AS requested_by_name,
      a.created_at,
      a.updated_at
    FROM crm_approvals a
    JOIN crm_approval_processes p ON a.process_id = p.id
    JOIN crm_records r ON a.record_id = r.id
    JOIN crm_modules m ON r.module_id = m.id
    LEFT JOIN profiles pr ON a.requested_by = pr.id
    WHERE a.org_id = p_org_id
      AND (p_status IS NULL OR a.status = p_status)
      AND (p_entity_type IS NULL OR m.key = p_entity_type)
      AND (
        NOT p_assigned_to_me
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(p.steps) WITH ORDINALITY AS s(step, idx)
          WHERE (s.idx - 1) = a.current_step
            AND (
              s.step->>'approver_profile_id' = p_profile_id::text
              OR (s.step->>'approver_role' IS NOT NULL AND s.step->>'approver_role' = p_user_role)
            )
        )
      )
      AND (NOT p_requested_by_me OR a.requested_by = p_profile_id)
    ORDER BY a.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- ============================================================================
-- 15. get_approval_detail(p_approval_id) — validate caller belongs to approval's org
-- ============================================================================
CREATE OR REPLACE FUNCTION get_approval_detail(p_approval_id uuid)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  process_id uuid,
  process_name text,
  process_description text,
  process_steps jsonb,
  record_id uuid,
  record_title text,
  record_data jsonb,
  module_id uuid,
  module_key text,
  module_name text,
  status text,
  current_step int,
  context jsonb,
  action_payload jsonb,
  entity_snapshot jsonb,
  requested_by uuid,
  requested_by_name text,
  resolved_by uuid,
  resolved_by_name text,
  resolved_at timestamptz,
  applied_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER STABLE
SET search_path = public
AS $$
BEGIN
  -- Validate caller belongs to the approval's org
  IF NOT EXISTS (
    SELECT 1 FROM crm_approvals ca
    JOIN profiles p ON p.organization_id = ca.org_id
    WHERE ca.id = p_approval_id AND p.user_id = auth.uid()
  ) THEN
    RETURN; -- empty set
  END IF;

  RETURN QUERY
    SELECT
      a.id,
      a.org_id,
      a.process_id,
      p.name AS process_name,
      p.description AS process_description,
      p.steps AS process_steps,
      a.record_id,
      r.title AS record_title,
      r.data AS record_data,
      m.id AS module_id,
      m.key AS module_key,
      m.name AS module_name,
      a.status,
      a.current_step,
      a.context,
      a.action_payload,
      a.entity_snapshot,
      a.requested_by,
      pr.full_name AS requested_by_name,
      a.resolved_by,
      pres.full_name AS resolved_by_name,
      a.resolved_at,
      a.applied_at,
      a.expires_at,
      a.created_at,
      a.updated_at
    FROM crm_approvals a
    JOIN crm_approval_processes p ON a.process_id = p.id
    JOIN crm_records r ON a.record_id = r.id
    JOIN crm_modules m ON r.module_id = m.id
    LEFT JOIN profiles pr ON a.requested_by = pr.id
    LEFT JOIN profiles pres ON a.resolved_by = pres.id
    WHERE a.id = p_approval_id;
END;
$$;

-- ============================================================================
-- 16. is_staff_or_admin / is_admin — add org-scoped overloads
--     Keep parameterless versions for backward compat but fix auth.uid() usage
--     (currently checks profiles.id = auth.uid() which is WRONG — should be user_id)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
    AND role IN ('staff', 'agent', 'admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

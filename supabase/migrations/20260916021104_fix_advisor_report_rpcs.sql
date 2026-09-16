-- Phase 0: advisor report RPCs match live schema + enrollment status vocab.
-- Additive: CREATE OR REPLACE only. 0 business-row writes.
-- Rollback: restore prior function bodies from archive 202603120001.

BEGIN;

SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.rpc_advisor_enrollment_report(
  p_org_id uuid,
  p_advisor_ids uuid[] DEFAULT NULL,
  p_include_downline boolean DEFAULT false,
  p_date_start date DEFAULT NULL,
  p_date_end date DEFAULT NULL,
  p_states text[] DEFAULT NULL,
  p_plan_names text[] DEFAULT NULL,
  p_statuses text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_advisor_ids uuid[];
  v_result jsonb;
BEGIN
  IF p_advisor_ids IS NOT NULL AND p_include_downline THEN
    SELECT array_agg(DISTINCT aid) INTO v_advisor_ids
    FROM (
      SELECT unnest(p_advisor_ids) AS aid
      UNION
      SELECT dl FROM unnest(p_advisor_ids) AS root_id,
        LATERAL get_advisor_downline_ids(root_id) AS dl
    ) expanded;
  ELSE
    v_advisor_ids := p_advisor_ids;
  END IF;

  SELECT jsonb_build_object(
    'rows', COALESCE(jsonb_agg(row_data ORDER BY total_enrollments DESC), '[]'::jsonb),
    'total', COUNT(*)
  ) INTO v_result
  FROM (
    SELECT
      a.id AS advisor_id,
      COUNT(e.id) AS total_enrollments,
      jsonb_build_object(
        'advisor_id', a.id,
        'advisor_name', a.first_name || ' ' || a.last_name,
        'advisor_email', a.email,
        'agency_name', a.agency_name,
        'commission_tier', a.commission_tier,
        'total_enrollments', COUNT(e.id),
        'approved_or_active_count', COUNT(e.id) FILTER (WHERE e.status IN ('approved', 'active')),
        'pending_review_count', COUNT(e.id) FILTER (WHERE e.status IN ('submitted', 'pending_review', 'more_info')),
        'cancelled_count', COUNT(e.id) FILTER (WHERE e.status = 'cancelled'),
        'rejected_count', COUNT(e.id) FILTER (WHERE e.status = 'rejected'),
        'terminated_count', COUNT(e.id) FILTER (WHERE e.status = 'cancelled'),
        'inactive_count', COUNT(e.id) FILTER (WHERE e.status IN ('inactive', 'on_hold')),
        'active_count', COUNT(e.id) FILTER (WHERE e.status IN ('approved', 'active')),
        'pending_count', COUNT(e.id) FILTER (WHERE e.status IN ('submitted', 'pending_review', 'more_info')),
        'active', COUNT(e.id) FILTER (WHERE e.status IN ('approved', 'active')),
        'pending', COUNT(e.id) FILTER (WHERE e.status IN ('submitted', 'pending_review', 'more_info')),
        'cancelled', COUNT(e.id) FILTER (WHERE e.status = 'cancelled'),
        'terminated', COUNT(e.id) FILTER (WHERE e.status = 'cancelled'),
        'rejected', COUNT(e.id) FILTER (WHERE e.status = 'rejected')
      ) AS row_data
    FROM advisors a
    LEFT JOIN enrollments e ON e.advisor_id = a.id
      AND (p_date_start IS NULL OR e.enrollment_date >= p_date_start)
      AND (p_date_end IS NULL OR e.enrollment_date <= p_date_end)
      AND (p_statuses IS NULL OR e.status = ANY(p_statuses))
    LEFT JOIN members m ON e.primary_member_id = m.id
    LEFT JOIN plans p ON p.id = e.selected_plan_id
    WHERE a.organization_id = p_org_id
      AND (v_advisor_ids IS NULL OR a.id = ANY(v_advisor_ids))
      AND (p_states IS NULL OR m.state = ANY(p_states))
      AND (
        p_plan_names IS NULL
        OR COALESCE(m.plan_name, p.name, e.metadata->>'plan_name') = ANY(p_plan_names)
      )
    GROUP BY a.id, a.first_name, a.last_name, a.email, a.agency_name, a.commission_tier
  ) sub;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_advisor_active_members_report(
  p_org_id uuid,
  p_advisor_ids uuid[] DEFAULT NULL,
  p_include_downline boolean DEFAULT false,
  p_states text[] DEFAULT NULL,
  p_plan_names text[] DEFAULT NULL,
  p_plan_types text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_advisor_ids uuid[];
  v_result jsonb;
BEGIN
  IF p_advisor_ids IS NOT NULL AND p_include_downline THEN
    SELECT array_agg(DISTINCT aid) INTO v_advisor_ids
    FROM (
      SELECT unnest(p_advisor_ids) AS aid
      UNION
      SELECT dl FROM unnest(p_advisor_ids) AS root_id,
        LATERAL get_advisor_downline_ids(root_id) AS dl
    ) expanded;
  ELSE
    v_advisor_ids := p_advisor_ids;
  END IF;

  SELECT jsonb_build_object(
    'rows', COALESCE(jsonb_agg(row_data ORDER BY active_members DESC), '[]'::jsonb),
    'total', COUNT(*)
  ) INTO v_result
  FROM (
    SELECT
      a.id AS advisor_id,
      COUNT(m.id) AS active_members,
      jsonb_build_object(
        'advisor_id', a.id,
        'advisor_name', a.first_name || ' ' || a.last_name,
        'advisor_email', a.email,
        'agency_name', a.agency_name,
        'commission_tier', a.commission_tier,
        'active_members', COUNT(m.id),
        'states', jsonb_agg(DISTINCT m.state) FILTER (WHERE m.state IS NOT NULL),
        'plan_breakdown', COALESCE(
          (
            SELECT jsonb_object_agg(plan_label, cnt)
            FROM (
              SELECT COALESCE(mm.plan_name, 'Unknown') AS plan_label, COUNT(*) AS cnt
              FROM members mm
              WHERE mm.advisor_id = a.id
                AND mm.status = 'active'
                AND (p_states IS NULL OR mm.state = ANY(p_states))
                AND (p_plan_names IS NULL OR mm.plan_name = ANY(p_plan_names))
                AND (p_plan_types IS NULL OR mm.plan_type = ANY(p_plan_types))
              GROUP BY 1
            ) pb
          ),
          '{}'::jsonb
        )
      ) AS row_data
    FROM advisors a
    LEFT JOIN members m ON m.advisor_id = a.id
      AND m.status = 'active'
      AND (p_states IS NULL OR m.state = ANY(p_states))
      AND (p_plan_names IS NULL OR m.plan_name = ANY(p_plan_names))
      AND (p_plan_types IS NULL OR m.plan_type = ANY(p_plan_types))
    WHERE a.organization_id = p_org_id
      AND (v_advisor_ids IS NULL OR a.id = ANY(v_advisor_ids))
    GROUP BY a.id, a.first_name, a.last_name, a.email, a.agency_name, a.commission_tier
  ) sub;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_advisor_cancellations_report(
  p_org_id uuid,
  p_advisor_ids uuid[] DEFAULT NULL,
  p_include_downline boolean DEFAULT false,
  p_date_start date DEFAULT NULL,
  p_date_end date DEFAULT NULL,
  p_states text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_advisor_ids uuid[];
  v_result jsonb;
BEGIN
  IF p_advisor_ids IS NOT NULL AND p_include_downline THEN
    SELECT array_agg(DISTINCT aid) INTO v_advisor_ids
    FROM (
      SELECT unnest(p_advisor_ids) AS aid
      UNION
      SELECT dl FROM unnest(p_advisor_ids) AS root_id,
        LATERAL get_advisor_downline_ids(root_id) AS dl
    ) expanded;
  ELSE
    v_advisor_ids := p_advisor_ids;
  END IF;

  SELECT jsonb_build_object(
    'rows', COALESCE(jsonb_agg(row_data ORDER BY cancellation_rate DESC), '[]'::jsonb),
    'total', COUNT(*)
  ) INTO v_result
  FROM (
    SELECT
      a.id AS advisor_id,
      CASE WHEN total_count > 0
        THEN ROUND((cancelled_count::numeric / total_count) * 100, 2)
        ELSE 0
      END AS cancellation_rate,
      jsonb_build_object(
        'advisor_id', a.id,
        'advisor_name', a.first_name || ' ' || a.last_name,
        'advisor_email', a.email,
        'agency_name', a.agency_name,
        'total_members', total_count,
        'active_members', active_count,
        'cancelled_count', cancelled_count,
        'terminated_count', terminated_count,
        'cancellation_rate', CASE WHEN total_count > 0
          THEN ROUND((cancelled_count::numeric / total_count) * 100, 2)
          ELSE 0 END
      ) AS row_data
    FROM advisors a
    LEFT JOIN LATERAL (
      SELECT
        COUNT(m.id) AS total_count,
        COUNT(m.id) FILTER (WHERE m.status = 'active') AS active_count,
        COUNT(m.id) FILTER (WHERE m.status IN ('cancelled', 'inactive')) AS cancelled_count,
        COUNT(m.id) FILTER (WHERE m.status = 'terminated') AS terminated_count
      FROM members m
      WHERE m.advisor_id = a.id
        AND (p_states IS NULL OR m.state = ANY(p_states))
        AND (p_date_start IS NULL OR m.termination_date >= p_date_start OR m.status = 'active')
        AND (p_date_end IS NULL OR m.termination_date <= p_date_end OR m.status = 'active')
    ) counts ON true
    WHERE a.organization_id = p_org_id
      AND (v_advisor_ids IS NULL OR a.id = ANY(v_advisor_ids))
  ) sub;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_advisor_enrollment_report(uuid, uuid[], boolean, date, date, text[], text[], text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_advisor_active_members_report(uuid, uuid[], boolean, text[], text[], text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_advisor_cancellations_report(uuid, uuid[], boolean, date, date, text[]) TO authenticated;

COMMIT;

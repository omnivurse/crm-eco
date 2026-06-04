-- =============================================================================
-- Command Console RPC Function
-- Single round-trip function returning all data needed by the enterprise
-- command console dashboard: enrollment stats, billing stats, pipeline counts,
-- operations stats, and a prioritized work queue.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_command_console_stats(
  p_org_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_today_start   timestamptz := date_trunc('day', now());
  v_today_end     timestamptz := v_today_start + interval '1 day';
  v_48h_ago       timestamptz := now() - interval '48 hours';
  v_seven_days    timestamptz := now() - interval '7 days';

  -- Enrollment stats
  v_started_today       int := 0;
  v_submitted_today     int := 0;
  v_activated_today     int := 0;
  v_pending_underwriting int := 0;
  v_docs_required       int := 0;
  v_activation_delayed  int := 0;
  v_rejected_count      int := 0;
  v_expiring_soon       int := 0;
  v_total_draft         int := 0;

  -- Billing stats
  v_collected_today     numeric(12,2) := 0;
  v_mrr                 numeric(12,2) := 0;
  v_failed_today        int := 0;
  v_pending_ach         int := 0;
  v_last_payment_at     timestamptz;

  -- Pipeline counts
  v_pipeline_leads      bigint := 0;
  v_pipeline_draft      int := 0;
  v_pipeline_in_progress int := 0;
  v_pipeline_submitted  int := 0;
  v_pipeline_approved   int := 0;
  v_pipeline_rejected   int := 0;
  v_pipeline_cancelled  int := 0;

  -- Operations stats
  v_overdue_tasks       int := 0;
  v_at_risk_deals       int := 0;

  -- Work queue
  v_work_queue          jsonb := '[]'::jsonb;
BEGIN
  -- =========================================================================
  -- ENROLLMENT STATS
  -- =========================================================================

  -- Applications started today
  SELECT COUNT(*) INTO v_started_today
  FROM enrollments
  WHERE organization_id = p_org_id
    AND created_at >= v_today_start
    AND created_at < v_today_end;

  -- Submitted today
  SELECT COUNT(*) INTO v_submitted_today
  FROM enrollments
  WHERE organization_id = p_org_id
    AND status = 'submitted'
    AND updated_at >= v_today_start
    AND updated_at < v_today_end;

  -- Activated (approved) today
  SELECT COUNT(*) INTO v_activated_today
  FROM enrollments
  WHERE organization_id = p_org_id
    AND status = 'approved'
    AND updated_at >= v_today_start
    AND updated_at < v_today_end;

  -- Pending underwriting (submitted, awaiting review)
  SELECT COUNT(*) INTO v_pending_underwriting
  FROM enrollments
  WHERE organization_id = p_org_id
    AND status = 'submitted';

  -- Docs required: enrollments with incomplete steps
  SELECT COUNT(DISTINCT es.enrollment_id) INTO v_docs_required
  FROM enrollment_steps es
  JOIN enrollments e ON e.id = es.enrollment_id
  WHERE es.organization_id = p_org_id
    AND es.is_completed = false
    AND e.status NOT IN ('approved', 'rejected', 'cancelled');

  -- Activation delayed: approved but no effective_date
  SELECT COUNT(*) INTO v_activation_delayed
  FROM enrollments
  WHERE organization_id = p_org_id
    AND status = 'approved'
    AND effective_date IS NULL;

  -- Rejected enrollments
  SELECT COUNT(*) INTO v_rejected_count
  FROM enrollments
  WHERE organization_id = p_org_id
    AND status = 'rejected';

  -- Expiring soon: draft/in_progress older than 48h
  SELECT COUNT(*) INTO v_expiring_soon
  FROM enrollments
  WHERE organization_id = p_org_id
    AND status IN ('draft', 'in_progress')
    AND created_at < v_48h_ago;

  -- Total draft
  SELECT COUNT(*) INTO v_total_draft
  FROM enrollments
  WHERE organization_id = p_org_id
    AND status = 'draft';

  -- =========================================================================
  -- BILLING STATS
  -- =========================================================================

  -- Collected today: successful transactions
  SELECT COALESCE(SUM(amount), 0) INTO v_collected_today
  FROM billing_transactions
  WHERE organization_id = p_org_id
    AND status = 'success'
    AND processed_at >= v_today_start
    AND processed_at < v_today_end
    AND transaction_type = 'charge';

  -- Monthly recurring revenue: sum of active billing schedules
  SELECT COALESCE(SUM(amount), 0) INTO v_mrr
  FROM billing_schedules
  WHERE organization_id = p_org_id
    AND status = 'active';

  -- Failed payments today (unresolved)
  SELECT COUNT(*) INTO v_failed_today
  FROM billing_failures
  WHERE organization_id = p_org_id
    AND created_at >= v_today_start
    AND created_at < v_today_end
    AND resolved = false;

  -- Pending ACH transactions
  SELECT COUNT(*) INTO v_pending_ach
  FROM billing_transactions
  WHERE organization_id = p_org_id
    AND status = 'pending';

  -- Last successful payment timestamp
  SELECT MAX(processed_at) INTO v_last_payment_at
  FROM billing_transactions
  WHERE organization_id = p_org_id
    AND status = 'success';

  -- =========================================================================
  -- PIPELINE COUNTS
  -- =========================================================================

  -- Leads count from legacy leads table
  SELECT COUNT(*) INTO v_pipeline_leads
  FROM leads
  WHERE organization_id = p_org_id;

  -- Enrollment status breakdown
  SELECT
    COUNT(*) FILTER (WHERE status = 'draft') ,
    COUNT(*) FILTER (WHERE status = 'in_progress'),
    COUNT(*) FILTER (WHERE status = 'submitted'),
    COUNT(*) FILTER (WHERE status = 'approved'),
    COUNT(*) FILTER (WHERE status = 'rejected'),
    COUNT(*) FILTER (WHERE status = 'cancelled')
  INTO
    v_pipeline_draft,
    v_pipeline_in_progress,
    v_pipeline_submitted,
    v_pipeline_approved,
    v_pipeline_rejected,
    v_pipeline_cancelled
  FROM enrollments
  WHERE organization_id = p_org_id;

  -- =========================================================================
  -- OPERATIONS STATS
  -- =========================================================================

  -- Overdue tasks for this user
  SELECT COUNT(*) INTO v_overdue_tasks
  FROM crm_tasks
  WHERE assigned_to = p_user_id
    AND status != 'completed'
    AND due_at < now();

  -- At-risk deals (not updated in 7+ days, not closed)
  SELECT COUNT(*) INTO v_at_risk_deals
  FROM crm_records r
  JOIN crm_modules m ON m.id = r.module_id
  WHERE m.org_id = p_org_id
    AND m.key = 'deals'
    AND r.updated_at < v_seven_days
    AND r.data->>'stage' NOT IN ('Closed Won', 'Closed Lost', 'closed_won', 'closed_lost');

  -- =========================================================================
  -- WORK QUEUE (prioritized action items, max 8)
  -- Priority: 1=critical, 2=high, 3=medium, 4=normal
  -- =========================================================================

  WITH queue_items AS (
    -- Priority 1: Unresolved billing failures
    (
      SELECT
        bf.id::text AS id,
        'billing_failure' AS type,
        'Payment Failed — ' || COALESCE(m.first_name || ' ' || m.last_name, 'Unknown') AS title,
        'ACH rejected · $' || bf.amount::text AS subtitle,
        1 AS priority,
        bf.created_at
      FROM billing_failures bf
      LEFT JOIN members m ON m.id = bf.member_id
      WHERE bf.organization_id = p_org_id
        AND bf.resolved = false
      ORDER BY bf.created_at DESC
      LIMIT 3
    )

    UNION ALL

    -- Priority 2: Enrollments pending review
    (
      SELECT
        e.id::text AS id,
        'enrollment_review' AS type,
        'Review Application — ' || COALESCE(m.first_name || ' ' || m.last_name, 'Unknown') AS title,
        'Submitted ' || to_char(e.updated_at, 'Mon DD') AS subtitle,
        2 AS priority,
        e.updated_at AS created_at
      FROM enrollments e
      LEFT JOIN members m ON m.id = e.primary_member_id
      WHERE e.organization_id = p_org_id
        AND e.status = 'submitted'
      ORDER BY e.updated_at ASC
      LIMIT 3
    )

    UNION ALL

    -- Priority 3: Enrollments missing documents
    (
      SELECT
        e.id::text AS id,
        'docs_pending' AS type,
        'Missing Docs — ' || COALESCE(m.first_name || ' ' || m.last_name, 'Unknown') AS title,
        es.step_key || ' incomplete' AS subtitle,
        3 AS priority,
        es.created_at
      FROM enrollment_steps es
      JOIN enrollments e ON e.id = es.enrollment_id
      LEFT JOIN members m ON m.id = e.primary_member_id
      WHERE es.organization_id = p_org_id
        AND es.is_completed = false
        AND e.status NOT IN ('approved', 'rejected', 'cancelled')
      ORDER BY es.created_at ASC
      LIMIT 3
    )

    UNION ALL

    -- Priority 4: Overdue tasks
    (
      SELECT
        t.id::text AS id,
        'overdue_task' AS type,
        COALESCE(t.title, 'Untitled Task') AS title,
        'Due ' || to_char(t.due_at, 'Mon DD') AS subtitle,
        4 AS priority,
        t.due_at AS created_at
      FROM crm_tasks t
      WHERE t.assigned_to = p_user_id
        AND t.status != 'completed'
        AND t.due_at < now()
      ORDER BY t.due_at ASC
      LIMIT 3
    )
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', qi.id,
      'type', qi.type,
      'title', qi.title,
      'subtitle', qi.subtitle,
      'priority', qi.priority,
      'createdAt', qi.created_at
    )
    ORDER BY qi.priority, qi.created_at ASC
  ), '[]'::jsonb)
  INTO v_work_queue
  FROM (SELECT * FROM queue_items ORDER BY priority, created_at ASC LIMIT 8) qi;

  -- =========================================================================
  -- RETURN COMBINED RESULT
  -- =========================================================================

  RETURN jsonb_build_object(
    'enrollmentStats', jsonb_build_object(
      'startedToday', v_started_today,
      'submittedToday', v_submitted_today,
      'activatedToday', v_activated_today,
      'pendingUnderwriting', v_pending_underwriting,
      'docsRequired', v_docs_required,
      'activationDelayed', v_activation_delayed,
      'rejectedCount', v_rejected_count,
      'expiringSoon', v_expiring_soon,
      'totalDraft', v_total_draft
    ),
    'billingStats', jsonb_build_object(
      'collectedToday', v_collected_today,
      'mrr', v_mrr,
      'failedToday', v_failed_today,
      'pendingAch', v_pending_ach,
      'lastSuccessfulPaymentAt', v_last_payment_at
    ),
    'pipelineCounts', jsonb_build_object(
      'leads', v_pipeline_leads,
      'draft', v_pipeline_draft,
      'inProgress', v_pipeline_in_progress,
      'submitted', v_pipeline_submitted,
      'approved', v_pipeline_approved,
      'rejected', v_pipeline_rejected,
      'cancelled', v_pipeline_cancelled
    ),
    'operationsStats', jsonb_build_object(
      'overdueTasks', v_overdue_tasks,
      'atRiskDeals', v_at_risk_deals
    ),
    'workQueue', v_work_queue
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_command_console_stats(uuid, uuid) TO authenticated;

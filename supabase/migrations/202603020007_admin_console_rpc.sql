-- =============================================================================
-- Admin Console RPC Function
-- Single round-trip function returning all data needed by the admin enterprise
-- command console dashboard: member stats, agent stats, enrollment stats,
-- billing stats, commission stats, system stats, pipeline counts, and a
-- prioritized work queue.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_console_stats(
  p_org_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_today_start   timestamptz := date_trunc('day', now());
  v_today_end     timestamptz := v_today_start + interval '1 day';
  v_month_start   timestamptz := date_trunc('month', now());
  v_48h_ago       timestamptz := now() - interval '48 hours';
  v_24h_ago       timestamptz := now() - interval '24 hours';

  -- Member stats
  v_total_members       int := 0;
  v_active_members      int := 0;
  v_new_members_month   int := 0;
  v_inactive_month      int := 0;
  v_retention_rate      int := 0;

  -- Agent stats
  v_total_agents        int := 0;
  v_active_agents       int := 0;
  v_pending_agents      int := 0;

  -- Enrollment stats
  v_total_enrollments   int := 0;
  v_pending_review      int := 0;
  v_approved_today      int := 0;
  v_rejected_today      int := 0;
  v_started_today       int := 0;
  v_expiring_soon       int := 0;
  v_total_draft         int := 0;

  -- Billing stats
  v_collected_today     numeric(12,2) := 0;
  v_mrr                 numeric(12,2) := 0;
  v_failed_today        int := 0;
  v_pending_ach         int := 0;
  v_last_payment_at     timestamptz;

  -- Commission stats
  v_pending_commissions numeric(12,2) := 0;
  v_paid_this_month     numeric(12,2) := 0;
  v_pending_payouts     int := 0;

  -- System stats
  v_failed_jobs_24h     int := 0;
  v_running_jobs        int := 0;
  v_pending_jobs        int := 0;

  -- Pipeline counts
  v_pipeline_leads      bigint := 0;
  v_pipeline_draft      int := 0;
  v_pipeline_in_progress int := 0;
  v_pipeline_submitted  int := 0;
  v_pipeline_approved   int := 0;

  -- Work queue
  v_work_queue          jsonb := '[]'::jsonb;
BEGIN
  -- =========================================================================
  -- MEMBER STATS
  -- =========================================================================

  SELECT COUNT(*) INTO v_total_members
  FROM members WHERE organization_id = p_org_id;

  SELECT COUNT(*) INTO v_active_members
  FROM members WHERE organization_id = p_org_id AND status = 'active';

  SELECT COUNT(*) INTO v_new_members_month
  FROM members
  WHERE organization_id = p_org_id
    AND created_at >= v_month_start;

  SELECT COUNT(*) INTO v_inactive_month
  FROM members
  WHERE organization_id = p_org_id
    AND status = 'inactive'
    AND updated_at >= v_month_start;

  IF v_total_members > 0 THEN
    v_retention_rate := ROUND((v_active_members::numeric / v_total_members) * 100);
  END IF;

  -- =========================================================================
  -- AGENT STATS
  -- =========================================================================

  SELECT COUNT(*) INTO v_total_agents
  FROM advisors WHERE organization_id = p_org_id;

  SELECT COUNT(*) INTO v_active_agents
  FROM advisors WHERE organization_id = p_org_id AND status = 'active';

  SELECT COUNT(*) INTO v_pending_agents
  FROM advisors WHERE organization_id = p_org_id AND status = 'pending';

  -- =========================================================================
  -- ENROLLMENT STATS
  -- =========================================================================

  SELECT COUNT(*) INTO v_total_enrollments
  FROM enrollments WHERE organization_id = p_org_id;

  SELECT COUNT(*) INTO v_pending_review
  FROM enrollments WHERE organization_id = p_org_id AND status = 'submitted';

  SELECT COUNT(*) INTO v_approved_today
  FROM enrollments
  WHERE organization_id = p_org_id
    AND status = 'approved'
    AND updated_at >= v_today_start AND updated_at < v_today_end;

  SELECT COUNT(*) INTO v_rejected_today
  FROM enrollments
  WHERE organization_id = p_org_id
    AND status = 'rejected'
    AND updated_at >= v_today_start AND updated_at < v_today_end;

  SELECT COUNT(*) INTO v_started_today
  FROM enrollments
  WHERE organization_id = p_org_id
    AND created_at >= v_today_start AND created_at < v_today_end;

  SELECT COUNT(*) INTO v_expiring_soon
  FROM enrollments
  WHERE organization_id = p_org_id
    AND status IN ('draft', 'in_progress')
    AND created_at < v_48h_ago;

  SELECT COUNT(*) INTO v_total_draft
  FROM enrollments
  WHERE organization_id = p_org_id AND status = 'draft';

  -- =========================================================================
  -- BILLING STATS
  -- =========================================================================

  SELECT COALESCE(SUM(amount), 0) INTO v_collected_today
  FROM billing_transactions
  WHERE organization_id = p_org_id
    AND status = 'success'
    AND processed_at >= v_today_start AND processed_at < v_today_end
    AND transaction_type = 'charge';

  SELECT COALESCE(SUM(amount), 0) INTO v_mrr
  FROM billing_schedules
  WHERE organization_id = p_org_id AND status = 'active';

  SELECT COUNT(*) INTO v_failed_today
  FROM billing_failures
  WHERE organization_id = p_org_id
    AND created_at >= v_today_start AND created_at < v_today_end
    AND resolved = false;

  SELECT COUNT(*) INTO v_pending_ach
  FROM billing_transactions
  WHERE organization_id = p_org_id AND status = 'pending';

  SELECT MAX(processed_at) INTO v_last_payment_at
  FROM billing_transactions
  WHERE organization_id = p_org_id AND status = 'success';

  -- =========================================================================
  -- COMMISSION STATS
  -- =========================================================================

  SELECT COALESCE(SUM(commission_amount), 0) INTO v_pending_commissions
  FROM commission_transactions
  WHERE organization_id = p_org_id AND status = 'pending';

  SELECT COALESCE(SUM(commission_amount), 0) INTO v_paid_this_month
  FROM commission_transactions
  WHERE organization_id = p_org_id
    AND status = 'paid'
    AND paid_at >= v_month_start;

  SELECT COUNT(*) INTO v_pending_payouts
  FROM commission_payouts
  WHERE organization_id = p_org_id AND status = 'pending';

  -- =========================================================================
  -- SYSTEM STATS (job_runs)
  -- =========================================================================

  SELECT COUNT(*) INTO v_failed_jobs_24h
  FROM job_runs
  WHERE organization_id = p_org_id
    AND status = 'failed'
    AND created_at >= v_24h_ago;

  SELECT COUNT(*) INTO v_running_jobs
  FROM job_runs
  WHERE organization_id = p_org_id AND status = 'running';

  SELECT COUNT(*) INTO v_pending_jobs
  FROM job_runs
  WHERE organization_id = p_org_id AND status = 'pending';

  -- =========================================================================
  -- PIPELINE COUNTS
  -- =========================================================================

  SELECT COUNT(*) INTO v_pipeline_leads
  FROM leads WHERE organization_id = p_org_id;

  SELECT
    COUNT(*) FILTER (WHERE status = 'draft'),
    COUNT(*) FILTER (WHERE status = 'in_progress'),
    COUNT(*) FILTER (WHERE status = 'submitted'),
    COUNT(*) FILTER (WHERE status = 'approved')
  INTO
    v_pipeline_draft,
    v_pipeline_in_progress,
    v_pipeline_submitted,
    v_pipeline_approved
  FROM enrollments
  WHERE organization_id = p_org_id;

  -- =========================================================================
  -- WORK QUEUE (prioritized action items, max 10)
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

    -- Priority 1: Failed jobs in last 24h
    (
      SELECT
        jr.id::text AS id,
        'failed_job' AS type,
        'Job Failed — ' || jr.job_name AS title,
        COALESCE(jr.error_message, 'Unknown error') AS subtitle,
        1 AS priority,
        jr.created_at
      FROM job_runs jr
      WHERE jr.organization_id = p_org_id
        AND jr.status = 'failed'
        AND jr.created_at >= v_24h_ago
      ORDER BY jr.created_at DESC
      LIMIT 2
    )

    UNION ALL

    -- Priority 2: Enrollments pending admin review
    (
      SELECT
        e.id::text AS id,
        'enrollment_review' AS type,
        'Review — ' || COALESCE(m.first_name || ' ' || m.last_name, 'Unknown') AS title,
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

    -- Priority 2: Pending commission payouts
    (
      SELECT
        cp.id::text AS id,
        'commission_payout' AS type,
        'Payout — ' || COALESCE(a.first_name || ' ' || a.last_name, 'Unknown') AS title,
        '$' || cp.net_payout::text || ' pending approval' AS subtitle,
        2 AS priority,
        cp.created_at
      FROM commission_payouts cp
      LEFT JOIN advisors a ON a.id = cp.advisor_id
      WHERE cp.organization_id = p_org_id
        AND cp.status = 'pending'
      ORDER BY cp.created_at ASC
      LIMIT 2
    )

    UNION ALL

    -- Priority 3: Overdue admin tasks
    (
      SELECT
        t.id::text AS id,
        'overdue_task' AS type,
        COALESCE(t.title, 'Untitled Task') AS title,
        'Due ' || to_char(t.due_date, 'Mon DD') AS subtitle,
        3 AS priority,
        t.due_date AS created_at
      FROM tasks t
      WHERE t.organization_id = p_org_id
        AND t.status NOT IN ('completed', 'cancelled')
        AND t.due_date < now()
      ORDER BY t.due_date ASC
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
  FROM (SELECT * FROM queue_items ORDER BY priority, created_at ASC LIMIT 10) qi;

  -- =========================================================================
  -- RETURN COMBINED RESULT
  -- =========================================================================

  RETURN jsonb_build_object(
    'memberStats', jsonb_build_object(
      'total', v_total_members,
      'active', v_active_members,
      'newThisMonth', v_new_members_month,
      'inactiveThisMonth', v_inactive_month,
      'retentionRate', v_retention_rate
    ),
    'agentStats', jsonb_build_object(
      'total', v_total_agents,
      'active', v_active_agents,
      'pendingOnboarding', v_pending_agents
    ),
    'enrollmentStats', jsonb_build_object(
      'total', v_total_enrollments,
      'pendingReview', v_pending_review,
      'approvedToday', v_approved_today,
      'rejectedToday', v_rejected_today,
      'startedToday', v_started_today,
      'expiringSoon', v_expiring_soon,
      'totalDraft', v_total_draft
    ),
    'billingStats', jsonb_build_object(
      'collectedToday', v_collected_today,
      'mrr', v_mrr,
      'failedToday', v_failed_today,
      'pendingAch', v_pending_ach,
      'lastPaymentAt', v_last_payment_at
    ),
    'commissionStats', jsonb_build_object(
      'pendingAmount', v_pending_commissions,
      'paidThisMonth', v_paid_this_month,
      'pendingPayouts', v_pending_payouts
    ),
    'systemStats', jsonb_build_object(
      'failedJobs24h', v_failed_jobs_24h,
      'runningJobs', v_running_jobs,
      'pendingJobs', v_pending_jobs
    ),
    'pipelineCounts', jsonb_build_object(
      'leads', v_pipeline_leads,
      'draft', v_pipeline_draft,
      'inProgress', v_pipeline_in_progress,
      'submitted', v_pipeline_submitted,
      'approved', v_pipeline_approved
    ),
    'workQueue', v_work_queue
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_console_stats(uuid) TO authenticated;

-- =============================================================================
-- Harden RPC Authorization
-- Adds caller validation, search_path protection, and org scoping to all
-- SECURITY DEFINER functions introduced in migrations 0006, 0007, 0008.
--
-- Fixes:
--   C-1: No caller validation on SECURITY DEFINER RPCs
--   C-2: Missing SET search_path = public (search-path injection risk)
--   C-3: Cross-tenant task leak (missing org_id on task queries)
--   C-4: p_user_id not validated against auth.uid()
-- =============================================================================

-- =============================================================================
-- 1. get_command_console_stats  (migration 0006)
--    + Validate caller belongs to org
--    + Validate p_user_id matches auth.uid()
--    + Add org_id filter to task queries
--    + SET search_path = public
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_command_console_stats(
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
  -- ── Authorization: caller must belong to the target organization ──
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
      AND organization_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: caller does not belong to this organization';
  END IF;

  -- ── Authorization: p_user_id must match the authenticated user ──
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
      AND id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: p_user_id does not match authenticated user';
  END IF;

  -- =========================================================================
  -- ENROLLMENT STATS
  -- =========================================================================

  SELECT COUNT(*) INTO v_started_today
  FROM enrollments
  WHERE organization_id = p_org_id
    AND created_at >= v_today_start
    AND created_at < v_today_end;

  SELECT COUNT(*) INTO v_submitted_today
  FROM enrollments
  WHERE organization_id = p_org_id
    AND status = 'submitted'
    AND updated_at >= v_today_start
    AND updated_at < v_today_end;

  SELECT COUNT(*) INTO v_activated_today
  FROM enrollments
  WHERE organization_id = p_org_id
    AND status = 'approved'
    AND updated_at >= v_today_start
    AND updated_at < v_today_end;

  SELECT COUNT(*) INTO v_pending_underwriting
  FROM enrollments
  WHERE organization_id = p_org_id
    AND status = 'submitted';

  SELECT COUNT(DISTINCT es.enrollment_id) INTO v_docs_required
  FROM enrollment_steps es
  JOIN enrollments e ON e.id = es.enrollment_id
  WHERE es.organization_id = p_org_id
    AND es.is_completed = false
    AND e.status NOT IN ('approved', 'rejected', 'cancelled');

  SELECT COUNT(*) INTO v_activation_delayed
  FROM enrollments
  WHERE organization_id = p_org_id
    AND status = 'approved'
    AND effective_date IS NULL;

  SELECT COUNT(*) INTO v_rejected_count
  FROM enrollments
  WHERE organization_id = p_org_id
    AND status = 'rejected';

  SELECT COUNT(*) INTO v_expiring_soon
  FROM enrollments
  WHERE organization_id = p_org_id
    AND status IN ('draft', 'in_progress')
    AND created_at < v_48h_ago;

  SELECT COUNT(*) INTO v_total_draft
  FROM enrollments
  WHERE organization_id = p_org_id
    AND status = 'draft';

  -- =========================================================================
  -- BILLING STATS
  -- =========================================================================

  SELECT COALESCE(SUM(amount), 0) INTO v_collected_today
  FROM billing_transactions
  WHERE organization_id = p_org_id
    AND status = 'success'
    AND processed_at >= v_today_start
    AND processed_at < v_today_end
    AND transaction_type = 'charge';

  SELECT COALESCE(SUM(amount), 0) INTO v_mrr
  FROM billing_schedules
  WHERE organization_id = p_org_id
    AND status = 'active';

  SELECT COUNT(*) INTO v_failed_today
  FROM billing_failures
  WHERE organization_id = p_org_id
    AND created_at >= v_today_start
    AND created_at < v_today_end
    AND resolved = false;

  SELECT COUNT(*) INTO v_pending_ach
  FROM billing_transactions
  WHERE organization_id = p_org_id
    AND status = 'pending';

  SELECT MAX(processed_at) INTO v_last_payment_at
  FROM billing_transactions
  WHERE organization_id = p_org_id
    AND status = 'success';

  -- =========================================================================
  -- PIPELINE COUNTS
  -- =========================================================================

  SELECT COUNT(*) INTO v_pipeline_leads
  FROM leads
  WHERE organization_id = p_org_id;

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
  -- OPERATIONS STATS (now scoped by org_id — fixes C-3)
  -- =========================================================================

  SELECT COUNT(*) INTO v_overdue_tasks
  FROM crm_tasks
  WHERE assigned_to = p_user_id
    AND org_id = p_org_id
    AND status != 'completed'
    AND due_at < now();

  SELECT COUNT(*) INTO v_at_risk_deals
  FROM crm_records r
  JOIN crm_modules m ON m.id = r.module_id
  WHERE m.org_id = p_org_id
    AND m.key = 'deals'
    AND r.updated_at < v_seven_days
    AND r.data->>'stage' NOT IN ('Closed Won', 'Closed Lost', 'closed_won', 'closed_lost');

  -- =========================================================================
  -- WORK QUEUE (now scoped by org_id on tasks — fixes C-3)
  -- =========================================================================

  WITH queue_items AS (
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
        AND t.org_id = p_org_id
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

-- =============================================================================
-- 2. get_admin_console_stats  (migration 0007)
--    + Validate caller is admin/owner of the org
--    + SET search_path = public
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_console_stats(
  p_org_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_start   timestamptz := date_trunc('day', now());
  v_today_end     timestamptz := v_today_start + interval '1 day';
  v_month_start   timestamptz := date_trunc('month', now());
  v_48h_ago       timestamptz := now() - interval '48 hours';
  v_24h_ago       timestamptz := now() - interval '24 hours';

  v_total_members       int := 0;
  v_active_members      int := 0;
  v_new_members_month   int := 0;
  v_inactive_month      int := 0;
  v_retention_rate      int := 0;
  v_total_agents        int := 0;
  v_active_agents       int := 0;
  v_pending_agents      int := 0;
  v_total_enrollments   int := 0;
  v_pending_review      int := 0;
  v_approved_today      int := 0;
  v_rejected_today      int := 0;
  v_started_today       int := 0;
  v_expiring_soon       int := 0;
  v_total_draft         int := 0;
  v_collected_today     numeric(12,2) := 0;
  v_mrr                 numeric(12,2) := 0;
  v_failed_today        int := 0;
  v_pending_ach         int := 0;
  v_last_payment_at     timestamptz;
  v_pending_commissions numeric(12,2) := 0;
  v_paid_this_month     numeric(12,2) := 0;
  v_pending_payouts     int := 0;
  v_failed_jobs_24h     int := 0;
  v_running_jobs        int := 0;
  v_pending_jobs        int := 0;
  v_pipeline_leads      bigint := 0;
  v_pipeline_draft      int := 0;
  v_pipeline_in_progress int := 0;
  v_pipeline_submitted  int := 0;
  v_pipeline_approved   int := 0;
  v_work_queue          jsonb := '[]'::jsonb;
BEGIN
  -- ── Authorization: caller must be admin or owner of the org ──
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
      AND organization_id = p_org_id
      AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin or owner access required';
  END IF;

  -- Member stats
  SELECT COUNT(*) INTO v_total_members FROM members WHERE organization_id = p_org_id;
  SELECT COUNT(*) INTO v_active_members FROM members WHERE organization_id = p_org_id AND status = 'active';
  SELECT COUNT(*) INTO v_new_members_month FROM members WHERE organization_id = p_org_id AND created_at >= v_month_start;
  SELECT COUNT(*) INTO v_inactive_month FROM members WHERE organization_id = p_org_id AND status = 'inactive' AND updated_at >= v_month_start;
  IF v_total_members > 0 THEN
    v_retention_rate := ROUND((v_active_members::numeric / v_total_members) * 100);
  END IF;

  -- Agent stats
  SELECT COUNT(*) INTO v_total_agents FROM advisors WHERE organization_id = p_org_id;
  SELECT COUNT(*) INTO v_active_agents FROM advisors WHERE organization_id = p_org_id AND status = 'active';
  SELECT COUNT(*) INTO v_pending_agents FROM advisors WHERE organization_id = p_org_id AND status = 'pending';

  -- Enrollment stats
  SELECT COUNT(*) INTO v_total_enrollments FROM enrollments WHERE organization_id = p_org_id;
  SELECT COUNT(*) INTO v_pending_review FROM enrollments WHERE organization_id = p_org_id AND status = 'submitted';
  SELECT COUNT(*) INTO v_approved_today FROM enrollments WHERE organization_id = p_org_id AND status = 'approved' AND updated_at >= v_today_start AND updated_at < v_today_end;
  SELECT COUNT(*) INTO v_rejected_today FROM enrollments WHERE organization_id = p_org_id AND status = 'rejected' AND updated_at >= v_today_start AND updated_at < v_today_end;
  SELECT COUNT(*) INTO v_started_today FROM enrollments WHERE organization_id = p_org_id AND created_at >= v_today_start AND created_at < v_today_end;
  SELECT COUNT(*) INTO v_expiring_soon FROM enrollments WHERE organization_id = p_org_id AND status IN ('draft', 'in_progress') AND created_at < v_48h_ago;
  SELECT COUNT(*) INTO v_total_draft FROM enrollments WHERE organization_id = p_org_id AND status = 'draft';

  -- Billing stats
  SELECT COALESCE(SUM(amount), 0) INTO v_collected_today FROM billing_transactions WHERE organization_id = p_org_id AND status = 'success' AND processed_at >= v_today_start AND processed_at < v_today_end AND transaction_type = 'charge';
  SELECT COALESCE(SUM(amount), 0) INTO v_mrr FROM billing_schedules WHERE organization_id = p_org_id AND status = 'active';
  SELECT COUNT(*) INTO v_failed_today FROM billing_failures WHERE organization_id = p_org_id AND created_at >= v_today_start AND created_at < v_today_end AND resolved = false;
  SELECT COUNT(*) INTO v_pending_ach FROM billing_transactions WHERE organization_id = p_org_id AND status = 'pending';
  SELECT MAX(processed_at) INTO v_last_payment_at FROM billing_transactions WHERE organization_id = p_org_id AND status = 'success';

  -- Commission stats
  SELECT COALESCE(SUM(commission_amount), 0) INTO v_pending_commissions FROM commission_transactions WHERE organization_id = p_org_id AND status = 'pending';
  SELECT COALESCE(SUM(commission_amount), 0) INTO v_paid_this_month FROM commission_transactions WHERE organization_id = p_org_id AND status = 'paid' AND paid_at >= v_month_start;
  SELECT COUNT(*) INTO v_pending_payouts FROM commission_payouts WHERE organization_id = p_org_id AND status = 'pending';

  -- System stats
  SELECT COUNT(*) INTO v_failed_jobs_24h FROM job_runs WHERE organization_id = p_org_id AND status = 'failed' AND created_at >= v_24h_ago;
  SELECT COUNT(*) INTO v_running_jobs FROM job_runs WHERE organization_id = p_org_id AND status = 'running';
  SELECT COUNT(*) INTO v_pending_jobs FROM job_runs WHERE organization_id = p_org_id AND status = 'pending';

  -- Pipeline counts
  SELECT COUNT(*) INTO v_pipeline_leads FROM leads WHERE organization_id = p_org_id;
  SELECT
    COUNT(*) FILTER (WHERE status = 'draft'),
    COUNT(*) FILTER (WHERE status = 'in_progress'),
    COUNT(*) FILTER (WHERE status = 'submitted'),
    COUNT(*) FILTER (WHERE status = 'approved')
  INTO v_pipeline_draft, v_pipeline_in_progress, v_pipeline_submitted, v_pipeline_approved
  FROM enrollments WHERE organization_id = p_org_id;

  -- Work queue
  WITH queue_items AS (
    (SELECT bf.id::text AS id, 'billing_failure' AS type, 'Payment Failed — ' || COALESCE(m.first_name || ' ' || m.last_name, 'Unknown') AS title, 'ACH rejected · $' || bf.amount::text AS subtitle, 1 AS priority, bf.created_at FROM billing_failures bf LEFT JOIN members m ON m.id = bf.member_id WHERE bf.organization_id = p_org_id AND bf.resolved = false ORDER BY bf.created_at DESC LIMIT 3)
    UNION ALL
    (SELECT jr.id::text, 'failed_job', 'Job Failed — ' || jr.job_name, COALESCE(jr.error_message, 'Unknown error'), 1, jr.created_at FROM job_runs jr WHERE jr.organization_id = p_org_id AND jr.status = 'failed' AND jr.created_at >= v_24h_ago ORDER BY jr.created_at DESC LIMIT 2)
    UNION ALL
    (SELECT e.id::text, 'enrollment_review', 'Review — ' || COALESCE(m.first_name || ' ' || m.last_name, 'Unknown'), 'Submitted ' || to_char(e.updated_at, 'Mon DD'), 2, e.updated_at FROM enrollments e LEFT JOIN members m ON m.id = e.primary_member_id WHERE e.organization_id = p_org_id AND e.status = 'submitted' ORDER BY e.updated_at ASC LIMIT 3)
    UNION ALL
    (SELECT cp.id::text, 'commission_payout', 'Payout — ' || COALESCE(a.first_name || ' ' || a.last_name, 'Unknown'), '$' || cp.net_payout::text || ' pending approval', 2, cp.created_at FROM commission_payouts cp LEFT JOIN advisors a ON a.id = cp.advisor_id WHERE cp.organization_id = p_org_id AND cp.status = 'pending' ORDER BY cp.created_at ASC LIMIT 2)
    UNION ALL
    (SELECT t.id::text, 'overdue_task', COALESCE(t.title, 'Untitled Task'), 'Due ' || to_char(t.due_date, 'Mon DD'), 3, t.due_date FROM tasks t WHERE t.organization_id = p_org_id AND t.status NOT IN ('completed', 'cancelled') AND t.due_date < now() ORDER BY t.due_date ASC LIMIT 3)
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', qi.id, 'type', qi.type, 'title', qi.title, 'subtitle', qi.subtitle, 'priority', qi.priority, 'createdAt', qi.created_at) ORDER BY qi.priority, qi.created_at ASC), '[]'::jsonb)
  INTO v_work_queue
  FROM (SELECT * FROM queue_items ORDER BY priority, created_at ASC LIMIT 10) qi;

  RETURN jsonb_build_object(
    'memberStats', jsonb_build_object('total', v_total_members, 'active', v_active_members, 'newThisMonth', v_new_members_month, 'inactiveThisMonth', v_inactive_month, 'retentionRate', v_retention_rate),
    'agentStats', jsonb_build_object('total', v_total_agents, 'active', v_active_agents, 'pendingOnboarding', v_pending_agents),
    'enrollmentStats', jsonb_build_object('total', v_total_enrollments, 'pendingReview', v_pending_review, 'approvedToday', v_approved_today, 'rejectedToday', v_rejected_today, 'startedToday', v_started_today, 'expiringSoon', v_expiring_soon, 'totalDraft', v_total_draft),
    'billingStats', jsonb_build_object('collectedToday', v_collected_today, 'mrr', v_mrr, 'failedToday', v_failed_today, 'pendingAch', v_pending_ach, 'lastPaymentAt', v_last_payment_at),
    'commissionStats', jsonb_build_object('pendingAmount', v_pending_commissions, 'paidThisMonth', v_paid_this_month, 'pendingPayouts', v_pending_payouts),
    'systemStats', jsonb_build_object('failedJobs24h', v_failed_jobs_24h, 'runningJobs', v_running_jobs, 'pendingJobs', v_pending_jobs),
    'pipelineCounts', jsonb_build_object('leads', v_pipeline_leads, 'draft', v_pipeline_draft, 'inProgress', v_pipeline_in_progress, 'submitted', v_pipeline_submitted, 'approved', v_pipeline_approved),
    'workQueue', v_work_queue
  );
END;
$$;

-- =============================================================================
-- 3. filter_records_by_system_preset  (migration 0008)
--    + Validate caller's org owns the module
--    + SET search_path = public
-- =============================================================================

CREATE OR REPLACE FUNCTION public.filter_records_by_system_preset(
  p_module_id uuid,
  p_preset text,
  p_user_profile_id uuid DEFAULT NULL
)
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ── Authorization: caller must belong to the org that owns this module ──
  IF NOT EXISTS (
    SELECT 1 FROM crm_modules m
    JOIN profiles p ON p.organization_id = m.org_id
    WHERE m.id = p_module_id
      AND p.user_id = auth.uid()
  ) THEN
    RETURN; -- Unauthorized: return empty set
  END IF;

  CASE p_preset
    WHEN 'touched_records' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND (EXISTS (SELECT 1 FROM crm_tasks t WHERE t.record_id = r.id)
               OR EXISTS (SELECT 1 FROM crm_notes n WHERE n.record_id = r.id));

    WHEN 'untouched_records' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND NOT EXISTS (SELECT 1 FROM crm_tasks t WHERE t.record_id = r.id)
          AND NOT EXISTS (SELECT 1 FROM crm_notes n WHERE n.record_id = r.id);

    WHEN 'my_records' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id AND r.owner_id = p_user_profile_id;

    WHEN 'created_today' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.created_at >= date_trunc('day', now())
          AND r.created_at < date_trunc('day', now()) + interval '1 day';

    WHEN 'created_this_week' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.created_at >= date_trunc('week', now())
          AND r.created_at < date_trunc('week', now()) + interval '1 week';

    WHEN 'modified_today' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.updated_at >= date_trunc('day', now())
          AND r.updated_at < date_trunc('day', now()) + interval '1 day';

    WHEN 'modified_this_week' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.updated_at >= date_trunc('week', now())
          AND r.updated_at < date_trunc('week', now()) + interval '1 week';

    WHEN 'unassigned' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id AND r.owner_id IS NULL;

    WHEN 'has_activities' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (SELECT 1 FROM crm_tasks t WHERE t.record_id = r.id);

    WHEN 'no_activities' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND NOT EXISTS (SELECT 1 FROM crm_tasks t WHERE t.record_id = r.id);

    WHEN 'has_notes' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (SELECT 1 FROM crm_notes n WHERE n.record_id = r.id);

    WHEN 'has_open_tasks' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (
            SELECT 1 FROM crm_tasks t
            WHERE t.record_id = r.id AND t.status NOT IN ('completed', 'cancelled')
          );

    WHEN 'has_overdue_tasks' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (
            SELECT 1 FROM crm_tasks t
            WHERE t.record_id = r.id
              AND t.status NOT IN ('completed', 'cancelled')
              AND t.due_at IS NOT NULL AND t.due_at < now()
          );

    ELSE
      RETURN;
  END CASE;
END;
$$;

-- =============================================================================
-- 4. filter_records_by_related  (migration 0008)
--    + Validate caller's org owns the module
--    + SET search_path = public
-- =============================================================================

CREATE OR REPLACE FUNCTION public.filter_records_by_related(
  p_module_id uuid,
  p_related_type text,
  p_condition text,
  p_activity_type text DEFAULT NULL
)
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ── Authorization: caller must belong to the org that owns this module ──
  IF NOT EXISTS (
    SELECT 1 FROM crm_modules m
    JOIN profiles p ON p.organization_id = m.org_id
    WHERE m.id = p_module_id
      AND p.user_id = auth.uid()
  ) THEN
    RETURN; -- Unauthorized: return empty set
  END IF;

  CASE p_related_type
    WHEN 'activities', 'appointments', 'calls', 'emails', 'tasks' THEN
      IF p_condition = 'has_any' THEN
        RETURN QUERY
          SELECT DISTINCT r.id FROM crm_records r
          WHERE r.module_id = p_module_id
            AND EXISTS (
              SELECT 1 FROM crm_tasks t
              WHERE t.record_id = r.id
                AND (p_activity_type IS NULL OR t.activity_type = p_activity_type)
            );
      ELSIF p_condition = 'has_none' THEN
        RETURN QUERY
          SELECT r.id FROM crm_records r
          WHERE r.module_id = p_module_id
            AND NOT EXISTS (
              SELECT 1 FROM crm_tasks t
              WHERE t.record_id = r.id
                AND (p_activity_type IS NULL OR t.activity_type = p_activity_type)
            );
      END IF;

    WHEN 'notes' THEN
      IF p_condition = 'has_any' THEN
        RETURN QUERY
          SELECT DISTINCT r.id FROM crm_records r
          WHERE r.module_id = p_module_id
            AND EXISTS (SELECT 1 FROM crm_notes n WHERE n.record_id = r.id);
      ELSIF p_condition = 'has_none' THEN
        RETURN QUERY
          SELECT r.id FROM crm_records r
          WHERE r.module_id = p_module_id
            AND NOT EXISTS (SELECT 1 FROM crm_notes n WHERE n.record_id = r.id);
      END IF;

    WHEN 'linked_records' THEN
      IF p_condition = 'has_any' THEN
        RETURN QUERY
          SELECT DISTINCT r.id FROM crm_records r
          WHERE r.module_id = p_module_id
            AND EXISTS (
              SELECT 1 FROM crm_record_links rl
              JOIN crm_records tr ON tr.id = rl.target_record_id
              JOIN crm_modules tm ON tm.id = tr.module_id
              WHERE rl.source_record_id = r.id
                AND (p_activity_type IS NULL OR tm.key = p_activity_type)
            );
      ELSIF p_condition = 'has_none' THEN
        RETURN QUERY
          SELECT r.id FROM crm_records r
          WHERE r.module_id = p_module_id
            AND NOT EXISTS (
              SELECT 1 FROM crm_record_links rl
              JOIN crm_records tr ON tr.id = rl.target_record_id
              JOIN crm_modules tm ON tm.id = tr.module_id
              WHERE rl.source_record_id = r.id
                AND (p_activity_type IS NULL OR tm.key = p_activity_type)
            );
      END IF;

    ELSE
      RETURN;
  END CASE;
END;
$$;

-- Ensure grants are still applied
GRANT EXECUTE ON FUNCTION public.get_command_console_stats(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_console_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.filter_records_by_system_preset(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.filter_records_by_related(uuid, text, text, text) TO authenticated;

-- =============================================================================
-- get_admin_console_stats: deterministic work-queue ordering.
--
-- Same anti-pattern as the search RPC fix (202605020008): the work-queue
-- subqueries inside `get_admin_console_stats` use `ORDER BY <non-unique col>
-- LIMIT N` without a unique tiebreaker. When multiple rows share the
-- ordering column (e.g. several billing failures created in the same
-- second, or several "submitted" enrollments updated together by a batch
-- job), Postgres returns an arbitrary subset before LIMIT — so the admin
-- console work queue can show different items between page loads.
--
-- Industry-standard fix: always append `id` as the final ORDER BY term so
-- the cutoff is reproducible. Applies to:
--   • billing_failures   ORDER BY bf.created_at DESC LIMIT 3
--   • job_runs           ORDER BY jr.created_at DESC LIMIT 2
--   • enrollments        ORDER BY e.updated_at  ASC  LIMIT 3
--   • commission_payouts ORDER BY cp.created_at ASC  LIMIT 2
--   • tasks              ORDER BY t.due_date    ASC  LIMIT 3
--   • final UNION        ORDER BY priority, created_at ASC LIMIT 10
--
-- Function body otherwise byte-identical to the version on remote.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_console_stats(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
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
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
      AND organization_id = p_org_id
      AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin or owner access required';
  END IF;

  SELECT COUNT(*) INTO v_total_members FROM members WHERE organization_id = p_org_id;
  SELECT COUNT(*) INTO v_active_members FROM members WHERE organization_id = p_org_id AND status = 'active';
  SELECT COUNT(*) INTO v_new_members_month FROM members WHERE organization_id = p_org_id AND created_at >= v_month_start;
  SELECT COUNT(*) INTO v_inactive_month FROM members WHERE organization_id = p_org_id AND status = 'inactive' AND updated_at >= v_month_start;
  IF v_total_members > 0 THEN
    v_retention_rate := ROUND((v_active_members::numeric / v_total_members) * 100);
  END IF;

  SELECT COUNT(*) INTO v_total_agents FROM advisors WHERE organization_id = p_org_id;
  SELECT COUNT(*) INTO v_active_agents FROM advisors WHERE organization_id = p_org_id AND status = 'active';
  SELECT COUNT(*) INTO v_pending_agents FROM advisors WHERE organization_id = p_org_id AND status = 'pending';

  SELECT COUNT(*) INTO v_total_enrollments FROM enrollments WHERE organization_id = p_org_id;
  SELECT COUNT(*) INTO v_pending_review FROM enrollments WHERE organization_id = p_org_id AND status = 'submitted';
  SELECT COUNT(*) INTO v_approved_today FROM enrollments WHERE organization_id = p_org_id AND status = 'approved' AND updated_at >= v_today_start AND updated_at < v_today_end;
  SELECT COUNT(*) INTO v_rejected_today FROM enrollments WHERE organization_id = p_org_id AND status = 'rejected' AND updated_at >= v_today_start AND updated_at < v_today_end;
  SELECT COUNT(*) INTO v_started_today FROM enrollments WHERE organization_id = p_org_id AND created_at >= v_today_start AND created_at < v_today_end;
  SELECT COUNT(*) INTO v_expiring_soon FROM enrollments WHERE organization_id = p_org_id AND status IN ('draft', 'in_progress') AND created_at < v_48h_ago;
  SELECT COUNT(*) INTO v_total_draft FROM enrollments WHERE organization_id = p_org_id AND status = 'draft';

  SELECT COALESCE(SUM(amount), 0) INTO v_collected_today FROM billing_transactions WHERE organization_id = p_org_id AND status = 'success' AND processed_at >= v_today_start AND processed_at < v_today_end AND transaction_type = 'charge';
  SELECT COALESCE(SUM(amount), 0) INTO v_mrr FROM billing_schedules WHERE organization_id = p_org_id AND status = 'active';
  SELECT COUNT(*) INTO v_failed_today FROM billing_failures WHERE organization_id = p_org_id AND created_at >= v_today_start AND created_at < v_today_end AND resolved = false;
  SELECT COUNT(*) INTO v_pending_ach FROM billing_transactions WHERE organization_id = p_org_id AND status = 'pending';
  SELECT MAX(processed_at) INTO v_last_payment_at FROM billing_transactions WHERE organization_id = p_org_id AND status = 'success';

  SELECT COALESCE(SUM(commission_amount), 0) INTO v_pending_commissions FROM commission_transactions WHERE organization_id = p_org_id AND status = 'pending';
  SELECT COALESCE(SUM(commission_amount), 0) INTO v_paid_this_month FROM commission_transactions WHERE organization_id = p_org_id AND status = 'paid' AND paid_at >= v_month_start;
  SELECT COUNT(*) INTO v_pending_payouts FROM commission_payouts WHERE organization_id = p_org_id AND status = 'pending';

  SELECT COUNT(*) INTO v_failed_jobs_24h FROM job_runs WHERE organization_id = p_org_id AND status = 'failed' AND created_at >= v_24h_ago;
  SELECT COUNT(*) INTO v_running_jobs FROM job_runs WHERE organization_id = p_org_id AND status = 'running';
  SELECT COUNT(*) INTO v_pending_jobs FROM job_runs WHERE organization_id = p_org_id AND status = 'pending';

  SELECT COUNT(*) INTO v_pipeline_leads FROM leads WHERE organization_id = p_org_id;
  SELECT
    COUNT(*) FILTER (WHERE status = 'draft'),
    COUNT(*) FILTER (WHERE status = 'in_progress'),
    COUNT(*) FILTER (WHERE status = 'submitted'),
    COUNT(*) FILTER (WHERE status = 'approved')
  INTO v_pipeline_draft, v_pipeline_in_progress, v_pipeline_submitted, v_pipeline_approved
  FROM enrollments WHERE organization_id = p_org_id;

  -- Work queue — every subquery's ORDER BY now ends in `id` so the LIMIT
  -- cutoff is reproducible across calls. Without this, the admin console
  -- shows a different set of "top 3 billing failures" / "top 2 jobs" /
  -- etc. each time the page is loaded if rows happen to share timestamps.
  WITH queue_items AS (
    (
      SELECT bf.id::text AS id, 'billing_failure' AS type,
             'Payment Failed — ' || COALESCE(m.first_name || ' ' || m.last_name, 'Unknown') AS title,
             'ACH rejected · $' || bf.amount::text AS subtitle,
             1 AS priority, bf.created_at
        FROM billing_failures bf
        LEFT JOIN members m ON m.id = bf.member_id
       WHERE bf.organization_id = p_org_id AND bf.resolved = false
       ORDER BY bf.created_at DESC, bf.id DESC LIMIT 3
    )
    UNION ALL
    (
      SELECT jr.id::text, 'failed_job',
             'Job Failed — ' || jr.job_name,
             COALESCE(jr.error_message, 'Unknown error'),
             1, jr.created_at
        FROM job_runs jr
       WHERE jr.organization_id = p_org_id AND jr.status = 'failed' AND jr.created_at >= v_24h_ago
       ORDER BY jr.created_at DESC, jr.id DESC LIMIT 2
    )
    UNION ALL
    (
      SELECT e.id::text, 'enrollment_review',
             'Review — ' || COALESCE(m.first_name || ' ' || m.last_name, 'Unknown'),
             'Submitted ' || to_char(e.updated_at, 'Mon DD'),
             2, e.updated_at
        FROM enrollments e
        LEFT JOIN members m ON m.id = e.primary_member_id
       WHERE e.organization_id = p_org_id AND e.status = 'submitted'
       ORDER BY e.updated_at ASC, e.id ASC LIMIT 3
    )
    UNION ALL
    (
      SELECT cp.id::text, 'commission_payout',
             'Payout — ' || COALESCE(a.first_name || ' ' || a.last_name, 'Unknown'),
             '$' || cp.net_payout::text || ' pending approval',
             2, cp.created_at
        FROM commission_payouts cp
        LEFT JOIN advisors a ON a.id = cp.advisor_id
       WHERE cp.organization_id = p_org_id AND cp.status = 'pending'
       ORDER BY cp.created_at ASC, cp.id ASC LIMIT 2
    )
    UNION ALL
    (
      SELECT t.id::text, 'overdue_task',
             COALESCE(t.title, 'Untitled Task'),
             'Due ' || to_char(t.due_date, 'Mon DD'),
             3, t.due_date
        FROM tasks t
       WHERE t.organization_id = p_org_id
         AND t.status NOT IN ('completed', 'cancelled')
         AND t.due_date < now()
       ORDER BY t.due_date ASC, t.id ASC LIMIT 3
    )
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', qi.id,
        'type', qi.type,
        'title', qi.title,
        'subtitle', qi.subtitle,
        'priority', qi.priority,
        'createdAt', qi.created_at
      )
      ORDER BY qi.priority, qi.created_at ASC, qi.id
    ),
    '[]'::jsonb
  )
  INTO v_work_queue
  FROM (
    SELECT *
      FROM queue_items
     ORDER BY priority, created_at ASC, id
     LIMIT 10
  ) qi;

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

COMMENT ON FUNCTION public.get_admin_console_stats IS
  'Admin console stats RPC. Work-queue subqueries use ORDER BY <col>, id so '
  'the LIMIT N cutoff is deterministic across calls (industry-standard '
  'pagination practice).';

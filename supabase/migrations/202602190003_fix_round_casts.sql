-- =============================================================================
-- Fix: ROUND(double precision, integer) does not exist in PostgreSQL.
-- All two-argument ROUND() calls must receive numeric, not double precision.
-- This migration re-creates affected functions with ::numeric casts.
-- =============================================================================


-- 1. Monthly Experience Summary
CREATE OR REPLACE FUNCTION public._actuarial_monthly(p_org_id uuid, p_start timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    WITH months AS (
      SELECT gs::date AS month
      FROM generate_series(p_start, DATE_TRUNC('month', CURRENT_DATE), '1 month') gs
    ),

    monthly_members AS (
      SELECT
        m.month,
        COUNT(DISTINCT mem.id) AS eligible,
        COUNT(DISTINCT mem.id) FILTER (
          WHERE DATE_TRUNC('month', mem.created_at) = m.month
        ) AS new_members
      FROM months m
      LEFT JOIN members mem ON mem.organization_id = p_org_id
        AND mem.created_at < m.month + INTERVAL '1 month'
        AND (mem.status = 'active'
             OR mem.updated_at >= m.month)
      GROUP BY m.month
    ),

    monthly_needs AS (
      SELECT
        DATE_TRUNC('month', n.created_at)::date AS month,
        COUNT(*)                                         AS submitted_count,
        COALESCE(SUM(n.total_amount), 0)                 AS submitted_amount,
        COUNT(*) FILTER (WHERE n.status IN ('approved','paid','closed'))
                                                         AS approved_count,
        COALESCE(SUM(n.approved_amount), 0)              AS approved_amount,
        COALESCE(SUM(n.reimbursed_amount), 0)            AS paid_amount,
        ROUND(COALESCE(AVG(n.total_amount), 0)::numeric, 2)       AS avg_need,
        ROUND(COALESCE(
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY n.total_amount), 0
        )::numeric, 2)                                            AS median_need,
        COALESCE(MAX(n.total_amount), 0)                 AS max_need,
        COUNT(*) FILTER (WHERE n.total_amount > 25000)   AS over_25k,
        COUNT(*) FILTER (WHERE n.total_amount > 50000)   AS over_50k,
        COALESCE(SUM(n.iua_amount), 0)                   AS iua_total,
        COALESCE(SUM(n.member_responsibility_amount), 0) AS member_resp
      FROM needs n
      WHERE n.organization_id = p_org_id
        AND n.created_at >= p_start
      GROUP BY 1
    ),

    monthly_revenue AS (
      SELECT
        DATE_TRUNC('month', bt.processed_at)::date AS month,
        COALESCE(SUM(bt.amount) FILTER (
          WHERE bt.status = 'success' AND bt.transaction_type = 'charge'
        ), 0) AS collected,
        COALESCE(SUM(bt.processing_fee) FILTER (
          WHERE bt.status = 'success'
        ), 0) AS fees,
        COALESCE(SUM(bt.net_amount) FILTER (
          WHERE bt.status = 'success' AND bt.transaction_type = 'charge'
        ), 0) AS net_collected,
        COUNT(*) FILTER (
          WHERE bt.status = 'failed'
        ) AS failed_count,
        COALESCE(SUM(bt.amount) FILTER (
          WHERE bt.status = 'failed'
        ), 0) AS failed_amount
      FROM billing_transactions bt
      WHERE bt.organization_id = p_org_id
        AND bt.processed_at >= p_start
      GROUP BY 1
    )

    SELECT COALESCE(jsonb_agg(row_data ORDER BY m.month), '[]'::jsonb)
    FROM months m
    LEFT JOIN monthly_members mm ON mm.month = m.month
    LEFT JOIN monthly_needs mn   ON mn.month = m.month
    LEFT JOIN monthly_revenue mr ON mr.month = m.month
    CROSS JOIN LATERAL (
      SELECT jsonb_build_object(
        'period',                    TO_CHAR(m.month, 'YYYY-MM'),
        'eligibleMembers',           COALESCE(mm.eligible, 0),
        'newMembers',                COALESCE(mm.new_members, 0),
        'contributionsCollected',    COALESCE(mr.collected, 0),
        'processingFees',            COALESCE(mr.fees, 0),
        'netRevenue',                COALESCE(mr.net_collected, 0),
        'failedPayments',            COALESCE(mr.failed_count, 0),
        'failedAmount',              COALESCE(mr.failed_amount, 0),
        'needsSubmittedCount',       COALESCE(mn.submitted_count, 0),
        'needsSubmittedAmount',      COALESCE(mn.submitted_amount, 0),
        'needsApprovedCount',        COALESCE(mn.approved_count, 0),
        'needsApprovedAmount',       COALESCE(mn.approved_amount, 0),
        'needsPaidAmount',           COALESCE(mn.paid_amount, 0),
        'avgNeedSize',               COALESCE(mn.avg_need, 0),
        'medianNeedSize',            COALESCE(mn.median_need, 0),
        'maxSingleNeed',             COALESCE(mn.max_need, 0),
        'needsOver25k',              COALESCE(mn.over_25k, 0),
        'needsOver50k',              COALESCE(mn.over_50k, 0),
        'needsPer100Members',        CASE WHEN COALESCE(mm.eligible, 0) > 0
          THEN ROUND((COALESCE(mn.submitted_count, 0)::numeric / mm.eligible) * 100, 1)
          ELSE 0 END,
        'lossRatio',                 CASE WHEN COALESCE(mr.collected, 0) > 0
          THEN ROUND((COALESCE(mn.paid_amount, 0)::numeric / mr.collected) * 100, 1)
          ELSE 0 END,
        'avgMemberContribution',     CASE WHEN COALESCE(mm.eligible, 0) > 0
          THEN ROUND((COALESCE(mr.collected, 0)::numeric / mm.eligible), 2)
          ELSE 0 END,
        'iuaApplied',                COALESCE(mn.iua_total, 0),
        'memberResponsibility',      COALESCE(mn.member_resp, 0)
      ) AS row_data
    ) lat
  );
END;
$$;


-- 2. Needs Distribution by Type
CREATE OR REPLACE FUNCTION public._actuarial_needs_by_type(p_org_id uuid, p_start timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    WITH type_agg AS (
      SELECT
        COALESCE(n.need_type, 'Other') AS need_type,
        COUNT(*)                                         AS cnt,
        COALESCE(SUM(n.total_amount), 0)                 AS submitted,
        COALESCE(SUM(n.approved_amount), 0)              AS approved,
        COALESCE(SUM(n.reimbursed_amount), 0)            AS paid,
        ROUND(COALESCE(AVG(n.total_amount), 0)::numeric, 2)       AS avg_amount
      FROM needs n
      WHERE n.organization_id = p_org_id
        AND n.created_at >= p_start
      GROUP BY 1
    ),
    total AS (
      SELECT SUM(cnt) AS grand_total FROM type_agg
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'needType',         ta.need_type,
      'count',            CASE WHEN ta.cnt < 5 THEN 0 ELSE ta.cnt::int END,
      'totalSubmitted',   CASE WHEN ta.cnt < 5 THEN 0 ELSE ta.submitted END,
      'totalApproved',    CASE WHEN ta.cnt < 5 THEN 0 ELSE ta.approved END,
      'totalPaid',        CASE WHEN ta.cnt < 5 THEN 0 ELSE ta.paid END,
      'avgAmount',        CASE WHEN ta.cnt < 5 THEN 0 ELSE ta.avg_amount END,
      'pctOfTotal',       CASE WHEN t.grand_total > 0
        THEN ROUND((ta.cnt::numeric / t.grand_total) * 100, 1)
        ELSE 0 END
    ) ORDER BY ta.cnt DESC), '[]'::jsonb)
    FROM type_agg ta
    CROSS JOIN total t
  );
END;
$$;


-- 3. Contribution Adequacy
CREATE OR REPLACE FUNCTION public._actuarial_contributions(p_org_id uuid, p_start timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    WITH months AS (
      SELECT gs::date AS month
      FROM generate_series(p_start, DATE_TRUNC('month', CURRENT_DATE), '1 month') gs
    ),

    monthly_expected AS (
      SELECT
        m.month,
        COALESCE(SUM(bs.amount), 0) AS expected,
        COUNT(bs.id) AS active_schedules,
        ROUND(COALESCE(AVG(bs.amount), 0)::numeric, 2) AS avg_contribution,
        ROUND(COALESCE(
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY bs.amount), 0
        )::numeric, 2) AS median_contribution
      FROM months m
      LEFT JOIN billing_schedules bs ON bs.organization_id = p_org_id
        AND bs.status = 'active'
        AND bs.start_date <= m.month + INTERVAL '1 month'
        AND (bs.end_date IS NULL OR bs.end_date >= m.month)
      GROUP BY m.month
    ),

    monthly_actual AS (
      SELECT
        DATE_TRUNC('month', bt.processed_at)::date AS month,
        COALESCE(SUM(bt.amount) FILTER (
          WHERE bt.status = 'success' AND bt.transaction_type = 'charge'
        ), 0) AS collected,
        COALESCE(SUM(bt.processing_fee) FILTER (WHERE bt.status = 'success'), 0) AS fees,
        COUNT(*) FILTER (WHERE bt.status = 'failed') AS failed_count,
        COALESCE(SUM(bt.amount) FILTER (WHERE bt.status = 'failed'), 0) AS failed_amount
      FROM billing_transactions bt
      WHERE bt.organization_id = p_org_id
        AND bt.processed_at >= p_start
      GROUP BY 1
    )

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'period',              TO_CHAR(me.month, 'YYYY-MM'),
      'activeSchedules',     me.active_schedules,
      'avgContribution',     me.avg_contribution,
      'medianContribution',  me.median_contribution,
      'totalExpected',       me.expected,
      'totalCollected',      COALESCE(ma.collected, 0),
      'totalFailed',         COALESCE(ma.failed_amount, 0),
      'failedCount',         COALESCE(ma.failed_count, 0),
      'processingFees',      COALESCE(ma.fees, 0),
      'netRevenue',          COALESCE(ma.collected, 0) - COALESCE(ma.fees, 0),
      'collectionRate',      CASE WHEN me.expected > 0
        THEN ROUND((COALESCE(ma.collected, 0)::numeric / me.expected) * 100, 1)
        ELSE 0 END
    ) ORDER BY me.month), '[]'::jsonb)
    FROM monthly_expected me
    LEFT JOIN monthly_actual ma ON ma.month = me.month
  );
END;
$$;


-- 4. Age-Band Loss Experience
CREATE OR REPLACE FUNCTION public._actuarial_age_bands(p_org_id uuid, p_start timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    WITH band_members AS (
      SELECT
        CASE
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, mem.date_of_birth::date)) < 18 THEN '0-17'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, mem.date_of_birth::date)) < 26 THEN '18-25'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, mem.date_of_birth::date)) < 36 THEN '26-35'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, mem.date_of_birth::date)) < 46 THEN '36-45'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, mem.date_of_birth::date)) < 56 THEN '46-55'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, mem.date_of_birth::date)) < 65 THEN '56-64'
          ELSE '65+'
        END AS age_band,
        mem.id AS member_id,
        mem.has_existing_condition
      FROM members mem
      WHERE mem.organization_id = p_org_id
        AND mem.date_of_birth IS NOT NULL
    ),

    band_needs AS (
      SELECT
        bm.age_band,
        COUNT(n.id) AS needs_count,
        COALESCE(SUM(n.total_amount), 0) AS submitted,
        COALESCE(SUM(n.approved_amount), 0) AS approved,
        COALESCE(SUM(n.reimbursed_amount), 0) AS paid,
        ROUND(COALESCE(AVG(n.total_amount), 0)::numeric, 2) AS avg_need
      FROM band_members bm
      LEFT JOIN needs n ON n.member_id = bm.member_id
        AND n.organization_id = p_org_id
        AND n.created_at >= p_start
      GROUP BY bm.age_band
    ),

    band_summary AS (
      SELECT
        bm.age_band,
        COUNT(DISTINCT bm.member_id) AS member_count,
        ROUND(
          COUNT(DISTINCT bm.member_id) FILTER (WHERE bm.has_existing_condition = true)::numeric
          / NULLIF(COUNT(DISTINCT bm.member_id), 0) * 100, 1
        ) AS pct_preexisting
      FROM band_members bm
      GROUP BY bm.age_band
    )

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'ageBand',           bs.age_band,
      'eligibleMembers',   CASE WHEN bs.member_count < 5 THEN 0 ELSE bs.member_count::int END,
      'needsCount',        CASE WHEN bs.member_count < 5 THEN 0 ELSE COALESCE(bn.needs_count, 0)::int END,
      'totalSubmitted',    CASE WHEN bs.member_count < 5 THEN 0 ELSE COALESCE(bn.submitted, 0) END,
      'totalApproved',     CASE WHEN bs.member_count < 5 THEN 0 ELSE COALESCE(bn.approved, 0) END,
      'totalPaid',         CASE WHEN bs.member_count < 5 THEN 0 ELSE COALESCE(bn.paid, 0) END,
      'avgNeedSize',       CASE WHEN bs.member_count < 5 THEN 0 ELSE COALESCE(bn.avg_need, 0) END,
      'needsPer100',       CASE WHEN bs.member_count < 5 THEN 0
        WHEN bs.member_count > 0
        THEN ROUND((COALESCE(bn.needs_count, 0)::numeric / bs.member_count) * 100, 1)
        ELSE 0 END,
      'pctPreexisting',    CASE WHEN bs.member_count < 5 THEN 0 ELSE COALESCE(bs.pct_preexisting, 0) END
    ) ORDER BY
      CASE bs.age_band
        WHEN '0-17'  THEN 1
        WHEN '18-25' THEN 2
        WHEN '26-35' THEN 3
        WHEN '36-45' THEN 4
        WHEN '46-55' THEN 5
        WHEN '56-64' THEN 6
        WHEN '65+'   THEN 7
      END
    ), '[]'::jsonb)
    FROM band_summary bs
    LEFT JOIN band_needs bn ON bn.age_band = bs.age_band
  );
END;
$$;


-- 5. Portfolio Summary
CREATE OR REPLACE FUNCTION public._actuarial_summary(p_org_id uuid, p_start timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_members       bigint;
  v_active_members      bigint;
  v_total_needs         bigint;
  v_total_submitted     numeric;
  v_total_approved      numeric;
  v_total_paid          numeric;
  v_total_collected     numeric;
  v_total_expected      numeric;
  v_avg_monthly_share   numeric;
  v_loss_ratio          numeric;
  v_collection_rate     numeric;
  v_cat_count           bigint;
  v_utilization_rate    numeric;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'active')
    INTO v_total_members, v_active_members
    FROM members WHERE organization_id = p_org_id;

  SELECT
    COUNT(*),
    COALESCE(SUM(total_amount), 0),
    COALESCE(SUM(approved_amount), 0),
    COALESCE(SUM(reimbursed_amount), 0),
    COUNT(*) FILTER (WHERE total_amount > 25000)
    INTO v_total_needs, v_total_submitted, v_total_approved, v_total_paid, v_cat_count
    FROM needs
    WHERE organization_id = p_org_id AND created_at >= p_start;

  SELECT COALESCE(SUM(amount) FILTER (
    WHERE status = 'success' AND transaction_type = 'charge'
  ), 0) INTO v_total_collected
  FROM billing_transactions
  WHERE organization_id = p_org_id AND processed_at >= p_start;

  SELECT COALESCE(SUM(amount), 0)
    INTO v_total_expected
    FROM billing_schedules
    WHERE organization_id = p_org_id AND status = 'active';

  SELECT ROUND(COALESCE(AVG(amount), 0)::numeric, 2)
    INTO v_avg_monthly_share
    FROM billing_schedules
    WHERE organization_id = p_org_id AND status = 'active';

  v_loss_ratio := CASE WHEN v_total_collected > 0
    THEN ROUND((v_total_paid / v_total_collected * 100)::numeric, 1)
    ELSE 0 END;

  v_collection_rate := CASE WHEN v_total_expected > 0
    THEN ROUND((v_total_collected / v_total_expected * 100)::numeric, 1)
    ELSE 0 END;

  v_utilization_rate := CASE WHEN v_active_members > 0
    THEN ROUND((v_total_needs::numeric / v_active_members * 100)::numeric, 1)
    ELSE 0 END;

  RETURN jsonb_build_object(
    'totalMembers', v_total_members,
    'activeMembers', v_active_members,
    'totalNeedsSubmitted', v_total_needs,
    'totalAmountSubmitted', v_total_submitted,
    'totalAmountApproved', v_total_approved,
    'totalAmountPaid', v_total_paid,
    'totalContributionsCollected', v_total_collected,
    'currentMRR', v_total_expected,
    'avgMonthlyShare', v_avg_monthly_share,
    'overallLossRatio', v_loss_ratio,
    'collectionRate', v_collection_rate,
    'utilizationPer100', v_utilization_rate,
    'catastrophicNeedsCount', v_cat_count
  );
END;
$$;


-- 6. Exposure & Development
CREATE OR REPLACE FUNCTION public._actuarial_exposure_dev(p_org_id uuid, p_start timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    WITH months AS (
      SELECT gs::date AS month
      FROM generate_series(p_start, DATE_TRUNC('month', CURRENT_DATE), '1 month') gs
    ),

    daily_exposure AS (
      SELECT
        DATE_TRUNC('month', d.day)::date AS month,
        ROUND(SUM(daily_count)::numeric / MAX(days_in_month)) AS member_months,
        MAX(daily_count) FILTER (WHERE d.day = DATE_TRUNC('month', d.day)) AS beginning_members,
        MAX(daily_count) FILTER (WHERE d.day = (DATE_TRUNC('month', d.day) + INTERVAL '1 month' - INTERVAL '1 day')::date) AS ending_members
      FROM (
        SELECT
          d.day::date AS day,
          EXTRACT(DAY FROM (DATE_TRUNC('month', d.day) + INTERVAL '1 month' - INTERVAL '1 day'))::int AS days_in_month,
          COUNT(DISTINCT mem.id) AS daily_count
        FROM generate_series(p_start, DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day', '1 day') d(day)
        LEFT JOIN members mem ON mem.organization_id = p_org_id
          AND mem.created_at::date <= d.day::date
          AND (mem.status = 'active'
               OR (mem.status IN ('inactive', 'terminated') AND mem.updated_at::date > d.day::date))
        GROUP BY d.day
      ) d
      GROUP BY DATE_TRUNC('month', d.day)
    ),

    monthly_movement AS (
      SELECT
        m.month,
        COUNT(DISTINCT mem.id) FILTER (
          WHERE DATE_TRUNC('month', mem.created_at) = m.month
        ) AS new_enrollments,
        COUNT(DISTINCT mem.id) FILTER (
          WHERE mem.status IN ('inactive', 'terminated')
            AND DATE_TRUNC('month', mem.updated_at) = m.month
            AND mem.created_at < m.month
        ) AS terminations
      FROM months m
      LEFT JOIN members mem ON mem.organization_id = p_org_id
      GROUP BY m.month
    ),

    service_month_claims AS (
      SELECT
        DATE_TRUNC('month', COALESCE(n.incident_date::timestamptz, n.created_at))::date AS service_month,
        COALESCE(SUM(n.approved_amount) FILTER (
          WHERE n.status IN ('approved', 'paid', 'closed')
        ), 0) AS incurred_amount,
        COALESCE(SUM(n.reimbursed_amount) FILTER (
          WHERE n.reimbursed_amount > 0
        ), 0) AS paid_amount,
        COALESCE(SUM(
          COALESCE(n.approved_amount, 0) - COALESCE(n.reimbursed_amount, 0)
        ) FILTER (
          WHERE n.status IN ('approved')
            AND COALESCE(n.reimbursed_amount, 0) < COALESCE(n.approved_amount, 0)
        ), 0) AS pending_amount,
        ROUND(COALESCE(AVG(
          EXTRACT(DAY FROM (n.created_at - n.incident_date::timestamptz))
        ) FILTER (WHERE n.incident_date IS NOT NULL), 0)::numeric) AS avg_report_lag,
        ROUND(COALESCE(AVG(
          EXTRACT(DAY FROM (
            COALESCE(n.payment_date::timestamptz, n.last_status_change_at) - n.created_at
          ))
        ) FILTER (WHERE n.reimbursed_amount > 0), 0)::numeric) AS avg_payment_lag
      FROM needs n
      WHERE n.organization_id = p_org_id
        AND COALESCE(n.incident_date::timestamptz, n.created_at) >= p_start
      GROUP BY 1
    )

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'period',            TO_CHAR(m.month, 'YYYY-MM'),
      'serviceMonth',      TO_CHAR(m.month, 'YYYY-MM'),
      'memberMonths',      COALESCE(de.member_months, 0),
      'beginningMembers',  COALESCE(de.beginning_members, 0),
      'endingMembers',     COALESCE(de.ending_members, 0),
      'newEnrollments',    COALESCE(mv.new_enrollments, 0),
      'terminations',      COALESCE(mv.terminations, 0),
      'incurredAmount',    COALESCE(sc.incurred_amount, 0),
      'paidAmount',        COALESCE(sc.paid_amount, 0),
      'pendingAmount',     COALESCE(sc.pending_amount, 0),
      'reportLagDays',     COALESCE(sc.avg_report_lag, 0),
      'paymentLagDays',    COALESCE(sc.avg_payment_lag, 0),
      'pmpm',              CASE
        WHEN COALESCE(de.member_months, 0) > 0
        THEN ROUND((COALESCE(sc.incurred_amount, 0) / de.member_months)::numeric, 2)
        ELSE 0 END
    ) ORDER BY m.month), '[]'::jsonb)
    FROM months m
    LEFT JOIN daily_exposure de ON de.month = m.month
    LEFT JOIN monthly_movement mv ON mv.month = m.month
    LEFT JOIN service_month_claims sc ON sc.service_month = m.month
  );
END;
$$;

-- Migration: Payout Ledger + Advisor Rankings + Agency Analytics
-- ==============================================================
-- Phase A1: Payout automation foundation (ledger → batch → payment)
-- Phase B1: Advisor ranking/scoring engine
-- Phase C1: Agency analytics functions
--
-- Adapts to existing schema:
--   commission_payment_batches  (existing batch table)
--   commission_payouts          (existing per-advisor payout records)
--   commissions                 (existing commission records)
--   advisors                    (existing, uses advisor_id not user_id)
--   organizations               (existing, uses organization_id not org_id)

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE A1 — COMMISSION LEDGER + PAYOUT LINKAGE
-- ═══════════════════════════════════════════════════════════════════════════════

-- A1.1: Commission Ledger — audit intermediary between commissions and payouts.
-- Every commission record gets a ledger entry. Payouts draw from the ledger,
-- never directly from commissions.
CREATE TABLE IF NOT EXISTS commission_ledger (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  advisor_id       uuid NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
  commission_id    uuid NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
  amount           numeric(12,2) NOT NULL,
  product_type     text,
  status           text NOT NULL DEFAULT 'available'
                   CHECK (status IN ('available', 'scheduled', 'paid', 'reversed', 'held')),
  payout_batch_id  uuid REFERENCES commission_payment_batches(id) ON DELETE SET NULL,
  payout_id        uuid REFERENCES commission_payouts(id) ON DELETE SET NULL,
  reversed_at      timestamptz,
  reversed_reason  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Prevent double-ledger: one ledger entry per commission
CREATE UNIQUE INDEX IF NOT EXISTS idx_commission_ledger_commission
  ON commission_ledger (commission_id);

CREATE INDEX IF NOT EXISTS idx_commission_ledger_advisor_status
  ON commission_ledger (advisor_id, status);

CREATE INDEX IF NOT EXISTS idx_commission_ledger_org_status
  ON commission_ledger (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_commission_ledger_batch
  ON commission_ledger (payout_batch_id)
  WHERE payout_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commission_ledger_created
  ON commission_ledger (organization_id, created_at);


-- A1.2: Junction table linking payout items to ledger entries
-- (one payout item can cover many ledger entries; one ledger entry → one payout item)
CREATE TABLE IF NOT EXISTS payout_item_ledger_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id       uuid NOT NULL REFERENCES commission_payouts(id) ON DELETE CASCADE,
  ledger_entry_id uuid NOT NULL REFERENCES commission_ledger(id) ON DELETE CASCADE,
  amount          numeric(12,2) NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payout_ledger_link_unique
  ON payout_item_ledger_links (ledger_entry_id);

CREATE INDEX IF NOT EXISTS idx_payout_ledger_link_payout
  ON payout_item_ledger_links (payout_id);


-- A1.3: RLS policies
ALTER TABLE commission_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_item_ledger_links ENABLE ROW LEVEL SECURITY;

-- Admins can see all org ledger entries
CREATE POLICY "admin_ledger_select" ON commission_ledger
  FOR SELECT USING (
    organization_id = (SELECT get_user_organization_id())
    AND get_user_role() IN ('owner', 'super_admin', 'admin')
  );

-- Advisors can see their own ledger entries
CREATE POLICY "advisor_own_ledger_select" ON commission_ledger
  FOR SELECT USING (
    organization_id = (SELECT get_user_organization_id())
    AND advisor_id = (SELECT get_user_advisor_id())
  );

-- Admin can manage ledger (update status for payouts)
CREATE POLICY "admin_ledger_update" ON commission_ledger
  FOR UPDATE USING (
    organization_id = (SELECT get_user_organization_id())
    AND get_user_role() IN ('owner', 'super_admin', 'admin')
  );

-- Admin can insert ledger entries
CREATE POLICY "admin_ledger_insert" ON commission_ledger
  FOR INSERT WITH CHECK (
    organization_id = (SELECT get_user_organization_id())
    AND get_user_role() IN ('owner', 'super_admin', 'admin')
  );

-- Payout links: admin read
CREATE POLICY "admin_payout_links_select" ON payout_item_ledger_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM commission_ledger cl
      WHERE cl.id = payout_item_ledger_links.ledger_entry_id
        AND cl.organization_id = (SELECT get_user_organization_id())
    )
  );


-- A1.4: Auto-populate ledger from commissions
-- When a commission is inserted or its status changes to 'approved',
-- create a ledger entry (status = 'available').
CREATE OR REPLACE FUNCTION trg_commission_to_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only create ledger entry when commission is approved (or on insert if already approved)
  IF NEW.status = 'approved' THEN
    -- Upsert: create if not exists, update amount if exists
    INSERT INTO commission_ledger (
      organization_id, advisor_id, commission_id,
      amount, product_type, status
    ) VALUES (
      NEW.organization_id, NEW.advisor_id, NEW.id,
      NEW.commission_amount, NEW.product_type, 'available'
    )
    ON CONFLICT (commission_id)
    DO UPDATE SET
      amount = EXCLUDED.amount,
      product_type = EXCLUDED.product_type,
      status = CASE
        WHEN commission_ledger.status = 'available' THEN 'available'
        ELSE commission_ledger.status  -- Don't revert scheduled/paid
      END,
      updated_at = now();
  END IF;

  -- If commission is reversed, reverse the ledger entry
  IF NEW.status = 'reversed' THEN
    UPDATE commission_ledger
    SET status = 'reversed',
        reversed_at = now(),
        reversed_reason = 'Commission reversed',
        updated_at = now()
    WHERE commission_id = NEW.id
      AND status IN ('available', 'scheduled');
  END IF;

  -- If commission is held, hold the ledger entry
  IF NEW.status = 'held' THEN
    UPDATE commission_ledger
    SET status = 'held', updated_at = now()
    WHERE commission_id = NEW.id
      AND status = 'available';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_commission_ledger_sync ON commissions;
CREATE TRIGGER trg_commission_ledger_sync
  AFTER INSERT OR UPDATE OF status ON commissions
  FOR EACH ROW
  EXECUTE FUNCTION trg_commission_to_ledger();


-- A1.5: Payout batch creation function
-- Groups available ledger entries by advisor, creates batch + payout items + links.
-- Uses advisory lock for concurrency safety.
CREATE OR REPLACE FUNCTION create_payout_batch(
  p_org_id       uuid,
  p_period_start date,
  p_period_end   date,
  p_description  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch_id       uuid;
  v_batch_number   text;
  v_total_amount   numeric := 0;
  v_total_advisors int := 0;
  v_advisor_row    record;
  v_payout_id      uuid;
  v_link_count     int := 0;
BEGIN
  -- Advisory lock to prevent concurrent batch creation for same org
  PERFORM pg_advisory_xact_lock(hashtext(p_org_id::text || 'payout_batch'));

  -- Generate batch number
  v_batch_number := 'PAY-' || to_char(p_period_start, 'YYYYMM') || '-' ||
                    lpad((
                      SELECT count(*) + 1
                      FROM commission_payment_batches
                      WHERE organization_id = p_org_id
                        AND period_start = p_period_start
                    )::text, 3, '0');

  -- Create the batch
  INSERT INTO commission_payment_batches (
    organization_id, batch_number, description,
    period_start, period_end, payment_date,
    status
  ) VALUES (
    p_org_id, v_batch_number, COALESCE(p_description, 'Auto-generated payout batch'),
    p_period_start, p_period_end, current_date,
    'draft'
  )
  RETURNING id INTO v_batch_id;

  -- Group available ledger entries by advisor and create payout items
  FOR v_advisor_row IN
    SELECT
      cl.advisor_id,
      sum(cl.amount) FILTER (WHERE cl.amount > 0) AS total_commissions,
      sum(cl.amount) FILTER (WHERE cl.amount < 0) AS total_chargebacks,
      sum(cl.amount) AS net_amount,
      array_agg(cl.id) AS ledger_ids
    FROM commission_ledger cl
    WHERE cl.organization_id = p_org_id
      AND cl.status = 'available'
      AND cl.created_at >= p_period_start::timestamptz
      AND cl.created_at < (p_period_end + interval '1 day')::timestamptz
    GROUP BY cl.advisor_id
    HAVING sum(cl.amount) > 0  -- Only create payouts for positive net amounts
  LOOP
    -- Create payout item using existing commission_payouts table
    INSERT INTO commission_payouts (
      organization_id, advisor_id,
      period_start, period_end,
      total_commissions,
      total_chargebacks,
      net_payout,
      status
    ) VALUES (
      p_org_id, v_advisor_row.advisor_id,
      p_period_start, p_period_end,
      COALESCE(v_advisor_row.total_commissions, 0),
      COALESCE(abs(v_advisor_row.total_chargebacks), 0),
      v_advisor_row.net_amount,
      'draft'
    )
    RETURNING id INTO v_payout_id;

    -- Link ledger entries to payout item
    INSERT INTO payout_item_ledger_links (payout_id, ledger_entry_id, amount)
    SELECT v_payout_id, unnest(v_advisor_row.ledger_ids), cl.amount
    FROM commission_ledger cl
    WHERE cl.id = ANY(v_advisor_row.ledger_ids);

    -- Mark ledger entries as scheduled
    UPDATE commission_ledger
    SET status = 'scheduled',
        payout_batch_id = v_batch_id,
        payout_id = v_payout_id,
        updated_at = now()
    WHERE id = ANY(v_advisor_row.ledger_ids)
      AND status = 'available';

    GET DIAGNOSTICS v_link_count = ROW_COUNT;

    v_total_amount := v_total_amount + v_advisor_row.net_amount;
    v_total_advisors := v_total_advisors + 1;
  END LOOP;

  -- Update batch totals
  UPDATE commission_payment_batches
  SET total_amount = v_total_amount,
      total_advisors = v_total_advisors,
      total_commissions = v_link_count
  WHERE id = v_batch_id;

  RETURN jsonb_build_object(
    'batch_id', v_batch_id,
    'batch_number', v_batch_number,
    'total_amount', v_total_amount,
    'total_advisors', v_total_advisors,
    'status', 'draft'
  );
END;
$$;


-- A1.6: Mark batch as paid (atomically)
CREATE OR REPLACE FUNCTION mark_payout_paid(
  p_batch_id uuid,
  p_processed_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch record;
  v_count int;
BEGIN
  -- Lock the batch row
  SELECT * INTO v_batch
  FROM commission_payment_batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF v_batch IS NULL THEN
    RETURN jsonb_build_object('error', 'Batch not found');
  END IF;

  IF v_batch.status NOT IN ('draft', 'approved', 'processing') THEN
    RETURN jsonb_build_object('error', 'Batch is not in a payable state: ' || v_batch.status);
  END IF;

  -- Mark all linked ledger entries as paid
  UPDATE commission_ledger
  SET status = 'paid', updated_at = now()
  WHERE payout_batch_id = p_batch_id
    AND status = 'scheduled';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Mark all payout items as paid
  UPDATE commission_payouts
  SET status = 'paid',
      paid_at = now(),
      updated_at = now()
  WHERE id IN (
    SELECT DISTINCT payout_id FROM commission_ledger
    WHERE payout_batch_id = p_batch_id
  );

  -- Mark batch as paid
  UPDATE commission_payment_batches
  SET status = 'paid',
      processed_by = p_processed_by,
      processed_at = now(),
      updated_at = now()
  WHERE id = p_batch_id;

  -- Log to financial audit
  INSERT INTO financial_audit_log (
    organization_id, action, entity_type, entity_id,
    performed_by, details
  ) VALUES (
    v_batch.organization_id, 'payout_completed', 'commission_payment_batch', p_batch_id,
    p_processed_by,
    jsonb_build_object(
      'batch_number', v_batch.batch_number,
      'total_amount', v_batch.total_amount,
      'ledger_entries_paid', v_count
    )
  );

  RETURN jsonb_build_object(
    'batch_id', p_batch_id,
    'status', 'paid',
    'ledger_entries_paid', v_count,
    'paid_at', now()
  );
END;
$$;


-- A1.7: Mark batch as failed (atomically — releases ledger entries back to available)
CREATE OR REPLACE FUNCTION mark_payout_failed(
  p_batch_id uuid,
  p_reason   text DEFAULT 'Payment processing failed'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch record;
  v_count int;
  v_payout_ids uuid[];
BEGIN
  SELECT * INTO v_batch
  FROM commission_payment_batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF v_batch IS NULL THEN
    RETURN jsonb_build_object('error', 'Batch not found');
  END IF;

  -- Collect payout IDs BEFORE nullifying the batch reference
  SELECT array_agg(DISTINCT cl.payout_id) INTO v_payout_ids
  FROM commission_ledger cl
  WHERE cl.payout_batch_id = p_batch_id
    AND cl.payout_id IS NOT NULL;

  -- Release ledger entries back to available
  UPDATE commission_ledger
  SET status = 'available',
      payout_batch_id = NULL,
      payout_id = NULL,
      updated_at = now()
  WHERE payout_batch_id = p_batch_id
    AND status = 'scheduled';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Mark payout items as failed (using pre-collected IDs)
  UPDATE commission_payouts
  SET status = 'failed',
      notes = p_reason,
      updated_at = now()
  WHERE id = ANY(COALESCE(v_payout_ids, '{}'));

  -- Mark batch as failed
  UPDATE commission_payment_batches
  SET status = 'failed',
      notes = p_reason,
      updated_at = now()
  WHERE id = p_batch_id;

  -- Audit log
  INSERT INTO financial_audit_log (
    organization_id, action, entity_type, entity_id,
    details
  ) VALUES (
    v_batch.organization_id, 'payout_failed', 'commission_payment_batch', p_batch_id,
    jsonb_build_object(
      'batch_number', v_batch.batch_number,
      'reason', p_reason,
      'ledger_entries_released', v_count
    )
  );

  RETURN jsonb_build_object(
    'batch_id', p_batch_id,
    'status', 'failed',
    'reason', p_reason,
    'ledger_entries_released', v_count
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE B1 — ADVISOR RANKING & GAMIFICATION
-- ═══════════════════════════════════════════════════════════════════════════════

-- B1.1: Advisor Rankings table
CREATE TABLE IF NOT EXISTS advisor_rankings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  advisor_id        uuid NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
  period_month      date NOT NULL,
  -- Scoring components
  commission_score  numeric(12,2) DEFAULT 0,
  enrollment_score  numeric(12,2) DEFAULT 0,
  downline_score    numeric(12,2) DEFAULT 0,
  growth_score      numeric(12,2) DEFAULT 0,
  production_score  numeric(12,2) DEFAULT 0,  -- Composite
  -- Ranking
  rank_position     int,
  tier              text CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'elite')),
  -- Context
  total_commissions numeric(12,2) DEFAULT 0,
  total_enrollments int DEFAULT 0,
  policy_count      int DEFAULT 0,
  downline_production numeric(12,2) DEFAULT 0,
  growth_rate_pct   numeric(8,2) DEFAULT 0,
  -- Gamification
  streak_months     int DEFAULT 0,  -- Consecutive months in top tier
  prev_rank         int,
  rank_change       int DEFAULT 0,  -- Positive = improved
  next_tier_gap     numeric(12,2),  -- Points needed for next tier
  -- Timestamps
  calculated_at     timestamptz DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(advisor_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_advisor_rankings_org_month
  ON advisor_rankings (organization_id, period_month);

CREATE INDEX IF NOT EXISTS idx_advisor_rankings_rank
  ON advisor_rankings (organization_id, period_month, rank_position);

CREATE INDEX IF NOT EXISTS idx_advisor_rankings_tier
  ON advisor_rankings (organization_id, period_month, tier);

-- RLS
ALTER TABLE advisor_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_view_rankings" ON advisor_rankings
  FOR SELECT USING (
    organization_id = (SELECT get_user_organization_id())
  );


-- B1.2: Scoring + ranking refresh function
-- Formula:
--   production_score = (commissions * 1.0) + (enrollments * 50) +
--                      (downline_commission * 0.3) + (growth_rate * 200)
-- Tiers: bronze < 500, silver < 2000, gold < 5000, platinum < 15000, elite >= 15000
CREATE OR REPLACE FUNCTION refresh_advisor_rankings(
  p_org_id uuid DEFAULT NULL,
  p_month  date DEFAULT date_trunc('month', current_date)::date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prev_month date := (p_month - interval '1 month')::date;
  v_count      int := 0;
  v_tier_thresholds numeric[] := ARRAY[500, 2000, 5000, 15000];
  v_tier_names  text[] := ARRAY['bronze', 'silver', 'gold', 'platinum', 'elite'];
BEGIN
  -- Upsert rankings from MV data
  INSERT INTO advisor_rankings (
    organization_id, advisor_id, period_month,
    commission_score, enrollment_score, downline_score, growth_score,
    production_score, rank_position, tier,
    total_commissions, total_enrollments, downline_production, growth_rate_pct,
    streak_months, prev_rank, rank_change, next_tier_gap,
    calculated_at
  )
  SELECT
    sub.organization_id,
    sub.advisor_id,
    p_month,
    sub.commission_score,
    sub.enrollment_score,
    sub.downline_score,
    sub.growth_score,
    sub.production_score,
    row_number() OVER (
      PARTITION BY sub.organization_id
      ORDER BY sub.production_score DESC
    )::int AS rank_position,
    CASE
      WHEN sub.production_score >= v_tier_thresholds[4] THEN v_tier_names[5]
      WHEN sub.production_score >= v_tier_thresholds[3] THEN v_tier_names[4]
      WHEN sub.production_score >= v_tier_thresholds[2] THEN v_tier_names[3]
      WHEN sub.production_score >= v_tier_thresholds[1] THEN v_tier_names[2]
      ELSE v_tier_names[1]
    END AS tier,
    sub.total_commissions,
    sub.total_enrollments,
    sub.downline_production,
    sub.growth_rate_pct,
    -- Streak: check if prev month was same or higher tier
    COALESCE((
      SELECT prev.streak_months + 1
      FROM advisor_rankings prev
      WHERE prev.advisor_id = sub.advisor_id
        AND prev.period_month = v_prev_month
        AND prev.tier IN ('gold', 'platinum', 'elite')
    ), 0),
    -- Previous rank
    (SELECT prev.rank_position FROM advisor_rankings prev
     WHERE prev.advisor_id = sub.advisor_id AND prev.period_month = v_prev_month),
    -- Rank change (positive = improved)
    COALESCE((
      SELECT prev.rank_position - row_number() OVER (
        PARTITION BY sub.organization_id ORDER BY sub.production_score DESC
      )::int
      FROM advisor_rankings prev
      WHERE prev.advisor_id = sub.advisor_id AND prev.period_month = v_prev_month
    ), 0),
    -- Next tier gap
    CASE
      WHEN sub.production_score >= v_tier_thresholds[4] THEN 0
      WHEN sub.production_score >= v_tier_thresholds[3] THEN v_tier_thresholds[4] - sub.production_score
      WHEN sub.production_score >= v_tier_thresholds[2] THEN v_tier_thresholds[3] - sub.production_score
      WHEN sub.production_score >= v_tier_thresholds[1] THEN v_tier_thresholds[2] - sub.production_score
      ELSE v_tier_thresholds[1] - sub.production_score
    END,
    now()
  FROM (
    SELECT
      m.organization_id,
      m.advisor_id,
      -- Score components
      COALESCE(sum(m.total_commissions), 0) AS commission_score,
      COALESCE(sum(m.total_enrollments), 0) * 50 AS enrollment_score,
      COALESCE((
        SELECT sum(dm.total_commissions) * 0.3
        FROM mv_advisor_monthly_performance dm
        WHERE dm.advisor_id IN (SELECT id FROM get_advisor_downline_ids(m.advisor_id))
          AND dm.organization_id = m.organization_id
          AND dm.month = p_month
      ), 0) AS downline_score,
      -- Growth rate vs prev month
      CASE
        WHEN COALESCE((
          SELECT sum(pm.total_commissions)
          FROM mv_advisor_monthly_performance pm
          WHERE pm.advisor_id = m.advisor_id
            AND pm.organization_id = m.organization_id
            AND pm.month = v_prev_month
        ), 0) > 0
        THEN (
          (COALESCE(sum(m.total_commissions), 0) -
           COALESCE((
             SELECT sum(pm.total_commissions)
             FROM mv_advisor_monthly_performance pm
             WHERE pm.advisor_id = m.advisor_id
               AND pm.organization_id = m.organization_id
               AND pm.month = v_prev_month
           ), 0))
          / COALESCE((
             SELECT sum(pm.total_commissions)
             FROM mv_advisor_monthly_performance pm
             WHERE pm.advisor_id = m.advisor_id
               AND pm.organization_id = m.organization_id
               AND pm.month = v_prev_month
          ), 1) * 200
        )
        ELSE 0
      END AS growth_score,
      -- Composite
      COALESCE(sum(m.total_commissions), 0)
        + COALESCE(sum(m.total_enrollments), 0) * 50
        + COALESCE((
            SELECT sum(dm.total_commissions) * 0.3
            FROM mv_advisor_monthly_performance dm
            WHERE dm.advisor_id IN (SELECT id FROM get_advisor_downline_ids(m.advisor_id))
              AND dm.organization_id = m.organization_id
              AND dm.month = p_month
          ), 0)
        + CASE
            WHEN COALESCE((
              SELECT sum(pm.total_commissions)
              FROM mv_advisor_monthly_performance pm
              WHERE pm.advisor_id = m.advisor_id
                AND pm.organization_id = m.organization_id
                AND pm.month = v_prev_month
            ), 0) > 0
            THEN (
              (COALESCE(sum(m.total_commissions), 0) -
               COALESCE((
                 SELECT sum(pm.total_commissions)
                 FROM mv_advisor_monthly_performance pm
                 WHERE pm.advisor_id = m.advisor_id
                   AND pm.organization_id = m.organization_id
                   AND pm.month = v_prev_month
               ), 0))
              / COALESCE((
                SELECT sum(pm.total_commissions)
                FROM mv_advisor_monthly_performance pm
                WHERE pm.advisor_id = m.advisor_id
                  AND pm.organization_id = m.organization_id
                  AND pm.month = v_prev_month
              ), 1) * 200
            )
            ELSE 0
          END
      AS production_score,
      -- Raw values
      COALESCE(sum(m.total_commissions), 0) AS total_commissions,
      COALESCE(sum(m.total_enrollments), 0)::int AS total_enrollments,
      COALESCE((
        SELECT sum(dm.total_commissions)
        FROM mv_advisor_monthly_performance dm
        WHERE dm.advisor_id IN (SELECT id FROM get_advisor_downline_ids(m.advisor_id))
          AND dm.organization_id = m.organization_id
          AND dm.month = p_month
      ), 0) AS downline_production,
      -- Growth rate pct
      CASE
        WHEN COALESCE((
          SELECT sum(pm.total_commissions)
          FROM mv_advisor_monthly_performance pm
          WHERE pm.advisor_id = m.advisor_id
            AND pm.organization_id = m.organization_id
            AND pm.month = v_prev_month
        ), 0) > 0
        THEN round((
          (COALESCE(sum(m.total_commissions), 0) -
           COALESCE((
             SELECT sum(pm.total_commissions)
             FROM mv_advisor_monthly_performance pm
             WHERE pm.advisor_id = m.advisor_id
               AND pm.organization_id = m.organization_id
               AND pm.month = v_prev_month
           ), 0))
          / COALESCE((
             SELECT sum(pm.total_commissions)
             FROM mv_advisor_monthly_performance pm
             WHERE pm.advisor_id = m.advisor_id
               AND pm.organization_id = m.organization_id
               AND pm.month = v_prev_month
          ), 1) * 100
        )::numeric, 1)
        ELSE 0
      END AS growth_rate_pct
    FROM mv_advisor_monthly_performance m
    WHERE m.month = p_month
      AND (p_org_id IS NULL OR m.organization_id = p_org_id)
    GROUP BY m.organization_id, m.advisor_id
  ) sub
  ON CONFLICT (advisor_id, period_month)
  DO UPDATE SET
    commission_score  = EXCLUDED.commission_score,
    enrollment_score  = EXCLUDED.enrollment_score,
    downline_score    = EXCLUDED.downline_score,
    growth_score      = EXCLUDED.growth_score,
    production_score  = EXCLUDED.production_score,
    rank_position     = EXCLUDED.rank_position,
    tier              = EXCLUDED.tier,
    total_commissions = EXCLUDED.total_commissions,
    total_enrollments = EXCLUDED.total_enrollments,
    downline_production = EXCLUDED.downline_production,
    growth_rate_pct   = EXCLUDED.growth_rate_pct,
    streak_months     = EXCLUDED.streak_months,
    prev_rank         = EXCLUDED.prev_rank,
    rank_change       = EXCLUDED.rank_change,
    next_tier_gap     = EXCLUDED.next_tier_gap,
    calculated_at     = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- B1.3: Leaderboard query function (fast, uses rankings table)
CREATE OR REPLACE FUNCTION get_leaderboard(
  p_org_id uuid,
  p_month  date DEFAULT date_trunc('month', current_date)::date,
  p_limit  int DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_data ORDER BY rank_position), '[]'::jsonb) INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'advisor_id',       r.advisor_id,
      'first_name',       a.first_name,
      'last_name',        a.last_name,
      'email',            a.email,
      'commission_tier',  a.commission_tier,
      'rank_position',    r.rank_position,
      'tier',             r.tier,
      'production_score', r.production_score,
      'total_commissions', r.total_commissions,
      'total_enrollments', r.total_enrollments,
      'downline_production', r.downline_production,
      'growth_rate_pct',  r.growth_rate_pct,
      'rank_change',      r.rank_change,
      'streak_months',    r.streak_months,
      'next_tier_gap',    r.next_tier_gap
    ) AS row_data,
    r.rank_position
    FROM advisor_rankings r
    JOIN advisors a ON a.id = r.advisor_id
    WHERE r.organization_id = p_org_id
      AND r.period_month = p_month
    ORDER BY r.rank_position
    LIMIT p_limit
  ) sub;

  RETURN jsonb_build_object(
    'leaderboard', v_result,
    'month', p_month,
    'total_ranked', (
      SELECT count(*) FROM advisor_rankings
      WHERE organization_id = p_org_id AND period_month = p_month
    )
  );
END;
$$;


-- B1.4: Get advisor's own ranking + context
CREATE OR REPLACE FUNCTION get_my_ranking(
  p_advisor_id uuid,
  p_org_id     uuid,
  p_month      date DEFAULT date_trunc('month', current_date)::date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_ranking record;
  v_total   int;
BEGIN
  SELECT * INTO v_ranking
  FROM advisor_rankings
  WHERE advisor_id = p_advisor_id
    AND organization_id = p_org_id
    AND period_month = p_month;

  SELECT count(*) INTO v_total
  FROM advisor_rankings
  WHERE organization_id = p_org_id
    AND period_month = p_month;

  IF v_ranking IS NULL THEN
    RETURN jsonb_build_object('ranked', false, 'total_ranked', v_total);
  END IF;

  RETURN jsonb_build_object(
    'ranked',            true,
    'rank_position',     v_ranking.rank_position,
    'total_ranked',      v_total,
    'tier',              v_ranking.tier,
    'production_score',  v_ranking.production_score,
    'total_commissions', v_ranking.total_commissions,
    'total_enrollments', v_ranking.total_enrollments,
    'downline_production', v_ranking.downline_production,
    'growth_rate_pct',   v_ranking.growth_rate_pct,
    'rank_change',       v_ranking.rank_change,
    'streak_months',     v_ranking.streak_months,
    'next_tier_gap',     v_ranking.next_tier_gap,
    'commission_score',  v_ranking.commission_score,
    'enrollment_score',  v_ranking.enrollment_score,
    'downline_score',    v_ranking.downline_score,
    'growth_score',      v_ranking.growth_score
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE C1 — AGENCY ANALYTICS FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Uses existing org structure + advisor branding fields.
-- No new tables needed — agencies ARE organizations, agency owners are advisors
-- with agent_role = 'Agency'.

-- C1.1: Agency-level production rollup
CREATE OR REPLACE FUNCTION get_agency_analytics(
  p_org_id uuid,
  p_months int DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_cutoff  date := (date_trunc('month', current_date) - (p_months || ' months')::interval)::date;
  v_result  jsonb;
  v_summary jsonb;
  v_by_type jsonb;
  v_top_advisors jsonb;
  v_monthly jsonb;
BEGIN
  -- Agency summary
  SELECT jsonb_build_object(
    'total_production',   COALESCE(sum(total_commissions), 0),
    'total_enrollments',  COALESCE(sum(total_enrollments), 0),
    'active_advisors',    count(DISTINCT advisor_id),
    'paid_commissions',   COALESCE(sum(paid_commissions), 0),
    'pending_commissions', COALESCE(sum(pending_commissions), 0)
  ) INTO v_summary
  FROM mv_advisor_monthly_performance
  WHERE organization_id = p_org_id AND month >= v_cutoff;

  -- By product type
  SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) INTO v_by_type
  FROM (
    SELECT jsonb_build_object(
      'product_type', product_type,
      'total_commissions', COALESCE(sum(total_commissions), 0),
      'total_enrollments', COALESCE(sum(total_enrollments), 0)
    ) AS row_data
    FROM mv_advisor_monthly_performance
    WHERE organization_id = p_org_id AND month >= v_cutoff
    GROUP BY product_type
  ) sub;

  -- Top 5 advisors by production
  SELECT COALESCE(jsonb_agg(row_data ORDER BY total DESC), '[]'::jsonb) INTO v_top_advisors
  FROM (
    SELECT jsonb_build_object(
      'advisor_id', m.advisor_id,
      'first_name', a.first_name,
      'last_name', a.last_name,
      'commission_tier', a.commission_tier,
      'total_commissions', sum(m.total_commissions),
      'total_enrollments', sum(m.total_enrollments)
    ) AS row_data,
    sum(m.total_commissions) AS total
    FROM mv_advisor_monthly_performance m
    JOIN advisors a ON a.id = m.advisor_id
    WHERE m.organization_id = p_org_id AND m.month >= v_cutoff
    GROUP BY m.advisor_id, a.first_name, a.last_name, a.commission_tier
    ORDER BY sum(m.total_commissions) DESC
    LIMIT 5
  ) sub;

  -- Monthly trend
  SELECT COALESCE(jsonb_agg(row_data ORDER BY month), '[]'::jsonb) INTO v_monthly
  FROM (
    SELECT jsonb_build_object(
      'month', month,
      'total_commissions', COALESCE(sum(total_commissions), 0),
      'total_enrollments', COALESCE(sum(total_enrollments), 0),
      'active_advisors', count(DISTINCT advisor_id)
    ) AS row_data, month
    FROM mv_advisor_monthly_performance
    WHERE organization_id = p_org_id AND month >= v_cutoff
    GROUP BY month
  ) sub;

  v_result := jsonb_build_object(
    'summary', COALESCE(v_summary, '{}'::jsonb),
    'by_product', COALESCE(v_by_type, '[]'::jsonb),
    'top_advisors', COALESCE(v_top_advisors, '[]'::jsonb),
    'monthly', COALESCE(v_monthly, '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- SCHEDULING
-- ═══════════════════════════════════════════════════════════════════════════════

-- Schedule nightly ranking refresh at 4 AM UTC (after MVs refresh at 2-3 AM)
DO $$
BEGIN
  PERFORM cron.unschedule('nightly_refresh_rankings');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'nightly_refresh_rankings',
    '0 4 * * *',
    'SELECT refresh_advisor_rankings()'
  );
  RAISE NOTICE 'Scheduled nightly ranking refresh at 4 AM UTC';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron scheduling skipped: %', SQLERRM;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════════════════════════════════════════

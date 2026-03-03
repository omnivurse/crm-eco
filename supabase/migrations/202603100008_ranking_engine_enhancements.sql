-- Migration: Phase B1 Enhancement — Ranking Engine Foundation
-- ===========================================================
-- Extends the existing advisor_rankings (from 202603100005) with:
-- 1. advisor_score_config — org-configurable scoring weights
-- 2. advisor_achievements — badge/milestone event tracking
-- 3. capacity_scope on advisor_rankings — rank by role capacity
-- 4. Rebuilt refresh_advisor_rankings() using configurable weights + capacity
-- 5. Rebuilt get_leaderboard() / get_my_ranking() with capacity filtering
--
-- Reads ONLY from mv_advisor_monthly_performance — no raw tables.


-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. ADVISOR SCORE CONFIG — per-org configurable weights
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS advisor_score_config (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Scoring weights
  commission_weight   numeric(6,3) NOT NULL DEFAULT 1.0,
  enrollment_weight   numeric(6,3) NOT NULL DEFAULT 50.0,
  downline_weight     numeric(6,3) NOT NULL DEFAULT 0.3,
  growth_weight       numeric(6,3) NOT NULL DEFAULT 200.0,
  -- Tier thresholds (production_score cutoffs)
  tier_bronze_max     numeric(12,2) NOT NULL DEFAULT 500,
  tier_silver_max     numeric(12,2) NOT NULL DEFAULT 2000,
  tier_gold_max       numeric(12,2) NOT NULL DEFAULT 5000,
  tier_platinum_max   numeric(12,2) NOT NULL DEFAULT 15000,
  -- Capacity scope this config applies to (NULL = all capacities)
  capacity_scope      text CHECK (capacity_scope IN ('health_insurance', 'health_share') OR capacity_scope IS NULL),
  -- Metadata
  created_by       uuid REFERENCES profiles(id),
  updated_by       uuid REFERENCES profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, capacity_scope)
);

CREATE INDEX IF NOT EXISTS idx_advisor_score_config_org
  ON advisor_score_config (organization_id);

-- RLS
ALTER TABLE advisor_score_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_score_config_all" ON advisor_score_config
  FOR ALL USING (
    organization_id = (SELECT get_user_organization_id())
    AND get_user_role() IN ('owner', 'super_admin', 'admin')
  );

CREATE POLICY "anyone_score_config_select" ON advisor_score_config
  FOR SELECT USING (
    organization_id = (SELECT get_user_organization_id())
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. ADVISOR ACHIEVEMENTS — badge/milestone event log
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS advisor_achievements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  advisor_id       uuid NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
  achievement_type text NOT NULL
                   CHECK (achievement_type IN (
                     'tier_promotion',       -- Moved up a tier
                     'streak_milestone',     -- Hit streak milestone (3, 6, 12 months)
                     'top_producer',         -- Ranked #1 in a month
                     'first_sale',           -- First commission earned
                     'revenue_milestone',    -- Hit $X total commissions
                     'enrollment_milestone', -- Hit N total enrollments
                     'downline_growth',      -- Recruited N sub-advisors
                     'perfect_month',        -- All enrollments approved (no rejections)
                     'comeback',             -- Re-entered top 10 after absence
                     'custom'                -- Admin-assigned
                   )),
  title            text NOT NULL,            -- "Gold Tier Achieved!"
  description      text,                     -- "Promoted from Silver to Gold in March 2026"
  -- Context
  capacity_scope   text CHECK (capacity_scope IN ('health_insurance', 'health_share') OR capacity_scope IS NULL),
  period_month     date,
  -- Quantitative
  metric_value     numeric(12,2),            -- e.g. total commissions that triggered it
  prev_value       text,                     -- e.g. "silver"
  new_value        text,                     -- e.g. "gold"
  -- Status
  acknowledged     boolean DEFAULT false,    -- Has the advisor seen/dismissed it
  acknowledged_at  timestamptz,
  -- Timestamps
  earned_at        timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_achievements_advisor
  ON advisor_achievements (advisor_id, earned_at DESC);

CREATE INDEX IF NOT EXISTS idx_achievements_org_type
  ON advisor_achievements (organization_id, achievement_type);

CREATE INDEX IF NOT EXISTS idx_achievements_unacked
  ON advisor_achievements (advisor_id, acknowledged)
  WHERE acknowledged = false;

-- RLS
ALTER TABLE advisor_achievements ENABLE ROW LEVEL SECURITY;

-- Advisors see their own achievements
CREATE POLICY "advisor_own_achievements" ON advisor_achievements
  FOR SELECT USING (
    organization_id = (SELECT get_user_organization_id())
    AND advisor_id = (SELECT get_user_advisor_id())
  );

-- Admins see all
CREATE POLICY "admin_achievements_all" ON advisor_achievements
  FOR ALL USING (
    organization_id = (SELECT get_user_organization_id())
    AND get_user_role() IN ('owner', 'super_admin', 'admin')
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. ADD capacity_scope TO advisor_rankings
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE advisor_rankings
  ADD COLUMN IF NOT EXISTS capacity_scope text
  CHECK (capacity_scope IN ('health_insurance', 'health_share') OR capacity_scope IS NULL);

-- Drop old unique constraint and replace with one that includes capacity_scope
-- The existing UNIQUE(advisor_id, period_month) needs to support capacity scoping.
-- We cannot simply drop the constraint if data exists, so use a conditional approach.
DO $$
BEGIN
  -- Drop the old unique index if it exists
  DROP INDEX IF EXISTS advisor_rankings_advisor_id_period_month_key;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_advisor_rankings_advisor_month_cap
  ON advisor_rankings (advisor_id, period_month, COALESCE(capacity_scope, '__all__'));

-- Update the rank index to include capacity_scope
DROP INDEX IF EXISTS idx_advisor_rankings_rank;
CREATE INDEX idx_advisor_rankings_rank
  ON advisor_rankings (organization_id, period_month, capacity_scope, rank_position);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. HELPER: Get scoring config for an org + capacity
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_score_config(
  p_org_id         uuid,
  p_capacity_scope text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_config record;
BEGIN
  -- Try exact match first (capacity-specific config)
  SELECT * INTO v_config
  FROM advisor_score_config
  WHERE organization_id = p_org_id
    AND (
      (p_capacity_scope IS NULL AND capacity_scope IS NULL)
      OR capacity_scope = p_capacity_scope
    )
  LIMIT 1;

  -- Fallback to org default (capacity_scope IS NULL)
  IF v_config IS NULL AND p_capacity_scope IS NOT NULL THEN
    SELECT * INTO v_config
    FROM advisor_score_config
    WHERE organization_id = p_org_id
      AND capacity_scope IS NULL
    LIMIT 1;
  END IF;

  -- Return config or defaults
  RETURN jsonb_build_object(
    'commission_weight', COALESCE(v_config.commission_weight, 1.0),
    'enrollment_weight', COALESCE(v_config.enrollment_weight, 50.0),
    'downline_weight',   COALESCE(v_config.downline_weight, 0.3),
    'growth_weight',     COALESCE(v_config.growth_weight, 200.0),
    'tier_bronze_max',   COALESCE(v_config.tier_bronze_max, 500),
    'tier_silver_max',   COALESCE(v_config.tier_silver_max, 2000),
    'tier_gold_max',     COALESCE(v_config.tier_gold_max, 5000),
    'tier_platinum_max', COALESCE(v_config.tier_platinum_max, 15000)
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. REBUILT refresh_advisor_rankings() — configurable weights + capacity scope
-- ═══════════════════════════════════════════════════════════════════════════════
-- Reads ONLY from mv_advisor_monthly_performance. No raw tables.
-- Runs per capacity_scope: NULL (all), 'health_insurance', 'health_share'

CREATE OR REPLACE FUNCTION refresh_advisor_rankings(
  p_org_id uuid DEFAULT NULL,
  p_month  date DEFAULT date_trunc('month', current_date)::date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prev_month    date := (p_month - interval '1 month')::date;
  v_count         int := 0;
  v_cap_count     int;
  v_cap           text;
  v_caps          text[] := ARRAY[NULL, 'health_insurance', 'health_share'];
  v_config        jsonb;
  v_cw            numeric; -- commission weight
  v_ew            numeric; -- enrollment weight
  v_dw            numeric; -- downline weight
  v_gw            numeric; -- growth weight
  v_tb            numeric; -- tier bronze max
  v_ts            numeric; -- tier silver max
  v_tg            numeric; -- tier gold max
  v_tp            numeric; -- tier platinum max
BEGIN
  -- Process each capacity scope
  FOREACH v_cap IN ARRAY v_caps
  LOOP
    -- Load org config for this capacity
    v_config := get_score_config(COALESCE(p_org_id, '00000000-0000-0000-0000-000000000000'::uuid), v_cap);
    v_cw := (v_config->>'commission_weight')::numeric;
    v_ew := (v_config->>'enrollment_weight')::numeric;
    v_dw := (v_config->>'downline_weight')::numeric;
    v_gw := (v_config->>'growth_weight')::numeric;
    v_tb := (v_config->>'tier_bronze_max')::numeric;
    v_ts := (v_config->>'tier_silver_max')::numeric;
    v_tg := (v_config->>'tier_gold_max')::numeric;
    v_tp := (v_config->>'tier_platinum_max')::numeric;

    INSERT INTO advisor_rankings (
      organization_id, advisor_id, period_month, capacity_scope,
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
      v_cap,
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
        WHEN sub.production_score >= v_tp THEN 'elite'
        WHEN sub.production_score >= v_tg THEN 'platinum'
        WHEN sub.production_score >= v_ts THEN 'gold'
        WHEN sub.production_score >= v_tb THEN 'silver'
        ELSE 'bronze'
      END AS tier,
      sub.total_commissions,
      sub.total_enrollments,
      sub.downline_production,
      sub.growth_rate_pct,
      -- Streak: consecutive months in gold+ tier
      COALESCE((
        SELECT prev.streak_months + 1
        FROM advisor_rankings prev
        WHERE prev.advisor_id = sub.advisor_id
          AND prev.period_month = v_prev_month
          AND prev.capacity_scope IS NOT DISTINCT FROM v_cap
          AND prev.tier IN ('gold', 'platinum', 'elite')
      ), 0),
      -- Previous rank
      (SELECT prev.rank_position FROM advisor_rankings prev
       WHERE prev.advisor_id = sub.advisor_id
         AND prev.period_month = v_prev_month
         AND prev.capacity_scope IS NOT DISTINCT FROM v_cap),
      -- Rank change (positive = improved)
      COALESCE((
        SELECT prev.rank_position
        FROM advisor_rankings prev
        WHERE prev.advisor_id = sub.advisor_id
          AND prev.period_month = v_prev_month
          AND prev.capacity_scope IS NOT DISTINCT FROM v_cap
      ), 0) - row_number() OVER (
        PARTITION BY sub.organization_id ORDER BY sub.production_score DESC
      )::int,
      -- Next tier gap
      CASE
        WHEN sub.production_score >= v_tp THEN 0
        WHEN sub.production_score >= v_tg THEN v_tp - sub.production_score
        WHEN sub.production_score >= v_ts THEN v_tg - sub.production_score
        WHEN sub.production_score >= v_tb THEN v_ts - sub.production_score
        ELSE v_tb - sub.production_score
      END,
      now()
    FROM (
      SELECT
        m.organization_id,
        m.advisor_id,
        -- Score components using configurable weights
        COALESCE(sum(m.total_commissions), 0) * v_cw AS commission_score,
        COALESCE(sum(m.total_enrollments), 0) * v_ew AS enrollment_score,
        COALESCE((
          SELECT sum(dm.total_commissions) * v_dw
          FROM mv_advisor_monthly_performance dm
          WHERE dm.advisor_id IN (SELECT id FROM get_advisor_downline_ids(m.advisor_id))
            AND dm.organization_id = m.organization_id
            AND dm.month = p_month
            AND (v_cap IS NULL OR dm.product_type = v_cap)
        ), 0) AS downline_score,
        -- Growth rate vs prev month
        CASE
          WHEN COALESCE((
            SELECT sum(pm.total_commissions)
            FROM mv_advisor_monthly_performance pm
            WHERE pm.advisor_id = m.advisor_id
              AND pm.organization_id = m.organization_id
              AND pm.month = v_prev_month
              AND (v_cap IS NULL OR pm.product_type = v_cap)
          ), 0) > 0
          THEN (
            (COALESCE(sum(m.total_commissions), 0) -
             COALESCE((
               SELECT sum(pm.total_commissions)
               FROM mv_advisor_monthly_performance pm
               WHERE pm.advisor_id = m.advisor_id
                 AND pm.organization_id = m.organization_id
                 AND pm.month = v_prev_month
                 AND (v_cap IS NULL OR pm.product_type = v_cap)
             ), 0))
            / NULLIF(COALESCE((
               SELECT sum(pm.total_commissions)
               FROM mv_advisor_monthly_performance pm
               WHERE pm.advisor_id = m.advisor_id
                 AND pm.organization_id = m.organization_id
                 AND pm.month = v_prev_month
                 AND (v_cap IS NULL OR pm.product_type = v_cap)
            ), 0), 0) * v_gw
          )
          ELSE 0
        END AS growth_score,
        -- Composite production score
        COALESCE(sum(m.total_commissions), 0) * v_cw
          + COALESCE(sum(m.total_enrollments), 0) * v_ew
          + COALESCE((
              SELECT sum(dm.total_commissions) * v_dw
              FROM mv_advisor_monthly_performance dm
              WHERE dm.advisor_id IN (SELECT id FROM get_advisor_downline_ids(m.advisor_id))
                AND dm.organization_id = m.organization_id
                AND dm.month = p_month
                AND (v_cap IS NULL OR dm.product_type = v_cap)
            ), 0)
          + CASE
              WHEN COALESCE((
                SELECT sum(pm.total_commissions)
                FROM mv_advisor_monthly_performance pm
                WHERE pm.advisor_id = m.advisor_id
                  AND pm.organization_id = m.organization_id
                  AND pm.month = v_prev_month
                  AND (v_cap IS NULL OR pm.product_type = v_cap)
              ), 0) > 0
              THEN (
                (COALESCE(sum(m.total_commissions), 0) -
                 COALESCE((
                   SELECT sum(pm.total_commissions)
                   FROM mv_advisor_monthly_performance pm
                   WHERE pm.advisor_id = m.advisor_id
                     AND pm.organization_id = m.organization_id
                     AND pm.month = v_prev_month
                     AND (v_cap IS NULL OR pm.product_type = v_cap)
                 ), 0))
                / NULLIF(COALESCE((
                   SELECT sum(pm.total_commissions)
                   FROM mv_advisor_monthly_performance pm
                   WHERE pm.advisor_id = m.advisor_id
                     AND pm.organization_id = m.organization_id
                     AND pm.month = v_prev_month
                     AND (v_cap IS NULL OR pm.product_type = v_cap)
                ), 0), 0) * v_gw
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
            AND (v_cap IS NULL OR dm.product_type = v_cap)
        ), 0) AS downline_production,
        -- Growth rate pct
        CASE
          WHEN COALESCE((
            SELECT sum(pm.total_commissions)
            FROM mv_advisor_monthly_performance pm
            WHERE pm.advisor_id = m.advisor_id
              AND pm.organization_id = m.organization_id
              AND pm.month = v_prev_month
              AND (v_cap IS NULL OR pm.product_type = v_cap)
          ), 0) > 0
          THEN round((
            (COALESCE(sum(m.total_commissions), 0) -
             COALESCE((
               SELECT sum(pm.total_commissions)
               FROM mv_advisor_monthly_performance pm
               WHERE pm.advisor_id = m.advisor_id
                 AND pm.organization_id = m.organization_id
                 AND pm.month = v_prev_month
                 AND (v_cap IS NULL OR pm.product_type = v_cap)
             ), 0))
            / NULLIF(COALESCE((
               SELECT sum(pm.total_commissions)
               FROM mv_advisor_monthly_performance pm
               WHERE pm.advisor_id = m.advisor_id
                 AND pm.organization_id = m.organization_id
                 AND pm.month = v_prev_month
                 AND (v_cap IS NULL OR pm.product_type = v_cap)
            ), 0), 0) * 100
          )::numeric, 1)
          ELSE 0
        END AS growth_rate_pct
      FROM mv_advisor_monthly_performance m
      WHERE m.month = p_month
        AND (p_org_id IS NULL OR m.organization_id = p_org_id)
        AND (v_cap IS NULL OR m.product_type = v_cap)
      GROUP BY m.organization_id, m.advisor_id
    ) sub
    ON CONFLICT (advisor_id, period_month, COALESCE(capacity_scope, '__all__'))
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

    GET DIAGNOSTICS v_cap_count = ROW_COUNT;
    v_count := v_count + v_cap_count;

    -- Generate achievements for tier promotions in this capacity
    INSERT INTO advisor_achievements (
      organization_id, advisor_id, achievement_type,
      title, description,
      capacity_scope, period_month,
      metric_value, prev_value, new_value
    )
    SELECT
      r.organization_id,
      r.advisor_id,
      'tier_promotion',
      initcap(r.tier) || ' Tier Achieved!',
      'Promoted from ' || COALESCE(initcap(prev.tier), 'unranked') || ' to ' || initcap(r.tier)
        || CASE WHEN v_cap IS NOT NULL THEN ' (' || replace(v_cap, '_', ' ') || ')' ELSE '' END,
      v_cap,
      p_month,
      r.production_score,
      prev.tier,
      r.tier
    FROM advisor_rankings r
    LEFT JOIN advisor_rankings prev
      ON prev.advisor_id = r.advisor_id
      AND prev.period_month = v_prev_month
      AND prev.capacity_scope IS NOT DISTINCT FROM v_cap
    WHERE r.period_month = p_month
      AND r.capacity_scope IS NOT DISTINCT FROM v_cap
      AND (p_org_id IS NULL OR r.organization_id = p_org_id)
      -- Tier actually improved
      AND (
        (prev.tier IS NULL AND r.tier IS NOT NULL)
        OR (
          CASE prev.tier
            WHEN 'bronze' THEN 1 WHEN 'silver' THEN 2
            WHEN 'gold' THEN 3 WHEN 'platinum' THEN 4 WHEN 'elite' THEN 5 ELSE 0
          END
          <
          CASE r.tier
            WHEN 'bronze' THEN 1 WHEN 'silver' THEN 2
            WHEN 'gold' THEN 3 WHEN 'platinum' THEN 4 WHEN 'elite' THEN 5 ELSE 0
          END
        )
      )
      -- Don't duplicate: no achievement already logged for this advisor+month+cap
      AND NOT EXISTS (
        SELECT 1 FROM advisor_achievements aa
        WHERE aa.advisor_id = r.advisor_id
          AND aa.period_month = p_month
          AND aa.achievement_type = 'tier_promotion'
          AND aa.capacity_scope IS NOT DISTINCT FROM v_cap
      );

    -- Streak milestones (3, 6, 12 months)
    INSERT INTO advisor_achievements (
      organization_id, advisor_id, achievement_type,
      title, description,
      capacity_scope, period_month, metric_value
    )
    SELECT
      r.organization_id,
      r.advisor_id,
      'streak_milestone',
      r.streak_months || '-Month Top Performer Streak!',
      'Maintained Gold tier or above for ' || r.streak_months || ' consecutive months',
      v_cap,
      p_month,
      r.streak_months
    FROM advisor_rankings r
    WHERE r.period_month = p_month
      AND r.capacity_scope IS NOT DISTINCT FROM v_cap
      AND (p_org_id IS NULL OR r.organization_id = p_org_id)
      AND r.streak_months IN (3, 6, 12, 24)
      AND NOT EXISTS (
        SELECT 1 FROM advisor_achievements aa
        WHERE aa.advisor_id = r.advisor_id
          AND aa.period_month = p_month
          AND aa.achievement_type = 'streak_milestone'
          AND aa.capacity_scope IS NOT DISTINCT FROM v_cap
      );

    -- Top producer badge (rank #1)
    INSERT INTO advisor_achievements (
      organization_id, advisor_id, achievement_type,
      title, description,
      capacity_scope, period_month, metric_value
    )
    SELECT
      r.organization_id,
      r.advisor_id,
      'top_producer',
      '#1 Producer' || CASE WHEN v_cap IS NOT NULL THEN ' — ' || replace(v_cap, '_', ' ') ELSE '' END || '!',
      'Ranked #1 in production for ' || to_char(p_month, 'Month YYYY'),
      v_cap,
      p_month,
      r.production_score
    FROM advisor_rankings r
    WHERE r.period_month = p_month
      AND r.capacity_scope IS NOT DISTINCT FROM v_cap
      AND r.rank_position = 1
      AND (p_org_id IS NULL OR r.organization_id = p_org_id)
      AND NOT EXISTS (
        SELECT 1 FROM advisor_achievements aa
        WHERE aa.advisor_id = r.advisor_id
          AND aa.period_month = p_month
          AND aa.achievement_type = 'top_producer'
          AND aa.capacity_scope IS NOT DISTINCT FROM v_cap
      );

  END LOOP;

  RETURN v_count;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. REBUILT get_leaderboard() WITH CAPACITY FILTERING
-- ═══════════════════════════════════════════════════════════════════════════════

-- Drop old 3-param version from migration 005 to avoid overloaded ambiguity
DROP FUNCTION IF EXISTS get_leaderboard(uuid, date, int);

CREATE OR REPLACE FUNCTION get_leaderboard(
  p_org_id         uuid,
  p_month          date DEFAULT date_trunc('month', current_date)::date,
  p_limit          int DEFAULT 10,
  p_capacity_scope text DEFAULT NULL
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
      'advisor_id',         r.advisor_id,
      'first_name',         a.first_name,
      'last_name',          a.last_name,
      'email',              a.email,
      'commission_tier',    a.commission_tier,
      'capacities',         a.capacities,
      'rank_position',      r.rank_position,
      'tier',               r.tier,
      'capacity_scope',     r.capacity_scope,
      'production_score',   r.production_score,
      'total_commissions',  r.total_commissions,
      'total_enrollments',  r.total_enrollments,
      'downline_production', r.downline_production,
      'growth_rate_pct',    r.growth_rate_pct,
      'rank_change',        r.rank_change,
      'streak_months',      r.streak_months,
      'next_tier_gap',      r.next_tier_gap
    ) AS row_data,
    r.rank_position
    FROM advisor_rankings r
    JOIN advisors a ON a.id = r.advisor_id
    WHERE r.organization_id = p_org_id
      AND r.period_month = p_month
      AND r.capacity_scope IS NOT DISTINCT FROM p_capacity_scope
    ORDER BY r.rank_position
    LIMIT p_limit
  ) sub;

  RETURN jsonb_build_object(
    'leaderboard', v_result,
    'month', p_month,
    'capacity_scope', p_capacity_scope,
    'total_ranked', (
      SELECT count(*) FROM advisor_rankings
      WHERE organization_id = p_org_id
        AND period_month = p_month
        AND capacity_scope IS NOT DISTINCT FROM p_capacity_scope
    )
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. REBUILT get_my_ranking() WITH CAPACITY FILTERING
-- ═══════════════════════════════════════════════════════════════════════════════

-- Drop old 3-param version from migration 005 to avoid overloaded ambiguity
DROP FUNCTION IF EXISTS get_my_ranking(uuid, uuid, date);

CREATE OR REPLACE FUNCTION get_my_ranking(
  p_advisor_id     uuid,
  p_org_id         uuid,
  p_month          date DEFAULT date_trunc('month', current_date)::date,
  p_capacity_scope text DEFAULT NULL
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
    AND period_month = p_month
    AND capacity_scope IS NOT DISTINCT FROM p_capacity_scope;

  SELECT count(*) INTO v_total
  FROM advisor_rankings
  WHERE organization_id = p_org_id
    AND period_month = p_month
    AND capacity_scope IS NOT DISTINCT FROM p_capacity_scope;

  IF v_ranking IS NULL THEN
    RETURN jsonb_build_object('ranked', false, 'total_ranked', v_total);
  END IF;

  RETURN jsonb_build_object(
    'ranked',              true,
    'rank_position',       v_ranking.rank_position,
    'total_ranked',        v_total,
    'tier',                v_ranking.tier,
    'capacity_scope',      v_ranking.capacity_scope,
    'production_score',    v_ranking.production_score,
    'total_commissions',   v_ranking.total_commissions,
    'total_enrollments',   v_ranking.total_enrollments,
    'downline_production', v_ranking.downline_production,
    'growth_rate_pct',     v_ranking.growth_rate_pct,
    'rank_change',         v_ranking.rank_change,
    'streak_months',       v_ranking.streak_months,
    'next_tier_gap',       v_ranking.next_tier_gap,
    'commission_score',    v_ranking.commission_score,
    'enrollment_score',    v_ranking.enrollment_score,
    'downline_score',      v_ranking.downline_score,
    'growth_score',        v_ranking.growth_score
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. ACHIEVEMENTS QUERY HELPER
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_advisor_achievements(
  p_advisor_id     uuid,
  p_org_id         uuid,
  p_limit          int DEFAULT 20,
  p_unacked_only   boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_data ORDER BY earned_at DESC), '[]'::jsonb) INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id',               aa.id,
      'achievement_type', aa.achievement_type,
      'title',            aa.title,
      'description',      aa.description,
      'capacity_scope',   aa.capacity_scope,
      'period_month',     aa.period_month,
      'metric_value',     aa.metric_value,
      'prev_value',       aa.prev_value,
      'new_value',        aa.new_value,
      'acknowledged',     aa.acknowledged,
      'earned_at',        aa.earned_at
    ) AS row_data,
    aa.earned_at
    FROM advisor_achievements aa
    WHERE aa.advisor_id = p_advisor_id
      AND aa.organization_id = p_org_id
      AND (NOT p_unacked_only OR aa.acknowledged = false)
    ORDER BY aa.earned_at DESC
    LIMIT p_limit
  ) sub;

  RETURN jsonb_build_object(
    'achievements', v_result,
    'unacknowledged_count', (
      SELECT count(*) FROM advisor_achievements
      WHERE advisor_id = p_advisor_id
        AND organization_id = p_org_id
        AND acknowledged = false
    )
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE — Phase B1 Ranking Engine Enhancement
-- ═══════════════════════════════════════════════════════════════════════════════

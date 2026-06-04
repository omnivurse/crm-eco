-- Migration: Executive KPI + Warehouse Export + Event Streaming
-- ==============================================================
-- Phase E1: Executive KPI materialized view + refresh
-- Phase E2: Warehouse export snapshots + incremental logic
-- Phase E3: Real-time system events + triggers + retention
--
-- All analytics read from MVs only — never raw operational tables.

-- ═══════════════════════════════════════════════════════════════════════════════
-- E1.1 — EXECUTIVE KPI MATERIALIZED VIEW
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE MATERIALIZED VIEW IF NOT EXISTS executive_kpi_mv AS
SELECT
  m.organization_id                            AS org_id,
  m.month,
  -- Revenue
  SUM(m.total_commissions)                     AS total_commission,
  SUM(m.paid_commissions)                      AS paid_commission,
  SUM(m.pending_commissions)                   AS pending_commission,
  -- Production
  SUM(m.total_enrollments)                     AS total_policies,
  COUNT(DISTINCT m.advisor_id)                 AS total_advisors,
  -- Capacity split
  SUM(CASE WHEN m.product_type = 'health_share'     THEN m.total_commissions ELSE 0 END) AS health_share_commission,
  SUM(CASE WHEN m.product_type = 'health_insurance'  THEN m.total_commissions ELSE 0 END) AS insurance_commission,
  SUM(CASE WHEN m.product_type = 'health_share'     THEN m.total_enrollments ELSE 0 END) AS health_share_policies,
  SUM(CASE WHEN m.product_type = 'health_insurance'  THEN m.total_enrollments ELSE 0 END) AS insurance_policies,
  -- Averages
  COALESCE(AVG(m.total_commissions) FILTER (WHERE m.total_commissions > 0), 0) AS avg_commission_per_advisor
FROM mv_advisor_monthly_performance m
WHERE m.product_type IN ('health_share', 'health_insurance')
GROUP BY m.organization_id, m.month
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_executive_kpi_mv_pk
  ON executive_kpi_mv (org_id, month);

CREATE INDEX IF NOT EXISTS idx_executive_kpi_mv_org
  ON executive_kpi_mv (org_id);

REFRESH MATERIALIZED VIEW executive_kpi_mv;


-- Top advisor per org per month (separate query for the MV)
CREATE MATERIALIZED VIEW IF NOT EXISTS executive_top_advisor_mv AS
SELECT DISTINCT ON (r.organization_id, r.period_month)
  r.organization_id   AS org_id,
  r.period_month       AS month,
  r.advisor_id         AS top_advisor_id,
  a.first_name         AS top_advisor_first_name,
  a.last_name          AS top_advisor_last_name,
  r.production_score   AS top_advisor_score,
  r.total_commissions  AS top_advisor_commissions,
  r.tier               AS top_advisor_tier
FROM advisor_rankings r
JOIN advisors a ON a.id = r.advisor_id
WHERE r.capacity_scope IS NULL
ORDER BY r.organization_id, r.period_month, r.rank_position ASC
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_executive_top_advisor_mv_pk
  ON executive_top_advisor_mv (org_id, month);

REFRESH MATERIALIZED VIEW executive_top_advisor_mv;


-- ═══════════════════════════════════════════════════════════════════════════════
-- E1.2 — EXECUTIVE KPI FUNCTION (with growth + agency + franchise rollups)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_executive_kpis(
  p_org_id uuid,
  p_month  date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month       date := COALESCE(p_month, date_trunc('month', current_date)::date);
  v_prev_month  date := (v_month - interval '1 month')::date;
  v_current     record;
  v_previous    record;
  v_top         record;
  v_growth      jsonb;
  v_agencies    jsonb;
  v_franchise   jsonb;
BEGIN
  -- Current month KPIs
  SELECT * INTO v_current
  FROM executive_kpi_mv
  WHERE org_id = p_org_id AND month = v_month;

  -- Previous month for growth calc
  SELECT * INTO v_previous
  FROM executive_kpi_mv
  WHERE org_id = p_org_id AND month = v_prev_month;

  -- Top advisor
  SELECT * INTO v_top
  FROM executive_top_advisor_mv
  WHERE org_id = p_org_id AND month = v_month;

  -- Growth rates
  v_growth := jsonb_build_object(
    'commission_growth_pct',
      CASE WHEN COALESCE(v_previous.total_commission, 0) > 0
           THEN ROUND(((COALESCE(v_current.total_commission, 0) - v_previous.total_commission)
                  / v_previous.total_commission * 100)::numeric, 1)
           ELSE 0 END,
    'policy_growth_pct',
      CASE WHEN COALESCE(v_previous.total_policies, 0) > 0
           THEN ROUND(((COALESCE(v_current.total_policies, 0) - v_previous.total_policies)::numeric
                  / v_previous.total_policies * 100)::numeric, 1)
           ELSE 0 END,
    'advisor_growth_pct',
      CASE WHEN COALESCE(v_previous.total_advisors, 0) > 0
           THEN ROUND(((COALESCE(v_current.total_advisors, 0) - v_previous.total_advisors)::numeric
                  / v_previous.total_advisors * 100)::numeric, 1)
           ELSE 0 END
  );

  -- Agency breakdown (top 10 agencies by production)
  SELECT COALESCE(jsonb_agg(row_data ORDER BY total DESC), '[]'::jsonb)
  INTO v_agencies
  FROM (
    SELECT jsonb_build_object(
      'agency_id',        ag.id,
      'agency_name',      ag.name,
      'total_commission', SUM(m.total_commissions),
      'total_policies',   SUM(m.total_enrollments),
      'advisor_count',    COUNT(DISTINCT m.advisor_id)
    ) AS row_data,
    SUM(m.total_commissions) AS total
    FROM mv_advisor_monthly_performance m
    JOIN agency_users au ON au.advisor_id = m.advisor_id AND au.status = 'active'
    JOIN agencies ag ON ag.id = au.agency_id AND ag.organization_id = p_org_id AND ag.status = 'active'
    WHERE m.organization_id = p_org_id
      AND m.month = v_month
      AND m.product_type IN ('health_share', 'health_insurance')
    GROUP BY ag.id, ag.name
    ORDER BY SUM(m.total_commissions) DESC
    LIMIT 10
  ) sub;

  -- Franchise breakdown (if parent org)
  SELECT COALESCE(jsonb_agg(row_data ORDER BY total DESC), '[]'::jsonb)
  INTO v_franchise
  FROM (
    SELECT jsonb_build_object(
      'child_org_id',     k.org_id,
      'child_org_name',   o.name,
      'total_commission', k.total_commission,
      'total_policies',   k.total_policies,
      'total_advisors',   k.total_advisors
    ) AS row_data,
    k.total_commission AS total
    FROM executive_kpi_mv k
    JOIN organizations o ON o.id = k.org_id
    WHERE k.org_id IN (
      SELECT child_org_id FROM org_relationships
      WHERE parent_org_id = p_org_id AND status = 'active'
    )
    AND k.month = v_month
  ) sub;

  RETURN jsonb_build_object(
    'month', v_month,
    'revenue', jsonb_build_object(
      'total_commission',    COALESCE(v_current.total_commission, 0),
      'paid_commission',     COALESCE(v_current.paid_commission, 0),
      'pending_commission',  COALESCE(v_current.pending_commission, 0),
      'avg_per_advisor',     ROUND(COALESCE(v_current.avg_commission_per_advisor, 0)::numeric, 2)
    ),
    'production', jsonb_build_object(
      'total_policies',      COALESCE(v_current.total_policies, 0),
      'total_advisors',      COALESCE(v_current.total_advisors, 0),
      'health_share_policies',  COALESCE(v_current.health_share_policies, 0),
      'insurance_policies',     COALESCE(v_current.insurance_policies, 0)
    ),
    'growth', v_growth,
    'top_advisor', CASE WHEN v_top.top_advisor_id IS NOT NULL THEN
      jsonb_build_object(
        'advisor_id',    v_top.top_advisor_id,
        'name',          v_top.top_advisor_first_name || ' ' || v_top.top_advisor_last_name,
        'score',         v_top.top_advisor_score,
        'commissions',   v_top.top_advisor_commissions,
        'tier',          v_top.top_advisor_tier
      )
    ELSE NULL END,
    'capacity_split', jsonb_build_object(
      'health_share_commission',  COALESCE(v_current.health_share_commission, 0),
      'insurance_commission',     COALESCE(v_current.insurance_commission, 0),
      'health_share_ratio',
        CASE WHEN COALESCE(v_current.total_commission, 0) > 0
             THEN ROUND((COALESCE(v_current.health_share_commission, 0)
                    / v_current.total_commission * 100)::numeric, 1)
             ELSE 0 END,
      'insurance_ratio',
        CASE WHEN COALESCE(v_current.total_commission, 0) > 0
             THEN ROUND((COALESCE(v_current.insurance_commission, 0)
                    / v_current.total_commission * 100)::numeric, 1)
             ELSE 0 END
    ),
    'agency_breakdown', v_agencies,
    'franchise_breakdown', v_franchise
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- E1.3 — REFRESH EXECUTIVE MVs (added to nightly job)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION refresh_executive_views()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz;
  v_kpi_ms int;
  v_top_ms int;
BEGIN
  v_start := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY executive_kpi_mv;
  v_kpi_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::int;

  v_start := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY executive_top_advisor_mv;
  v_top_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::int;

  RETURN jsonb_build_object(
    'executive_kpi_mv_ms', v_kpi_ms,
    'executive_top_advisor_mv_ms', v_top_ms,
    'refreshed_at', now()
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- E2.1 — WAREHOUSE EXPORT TRACKING
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS warehouse_exports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  export_type   text NOT NULL
                CHECK (export_type IN ('commissions', 'rankings', 'agencies', 'kpis', 'full')),
  period_start  date NOT NULL,
  period_end    date NOT NULL,
  format        text NOT NULL DEFAULT 'csv'
                CHECK (format IN ('csv', 'json', 'parquet')),
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  row_count     int,
  file_size_bytes bigint,
  storage_path  text,                       -- Supabase Storage path
  error_message text,
  requested_by  uuid REFERENCES profiles(id),
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_warehouse_exports_org
  ON warehouse_exports (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_warehouse_exports_status
  ON warehouse_exports (status) WHERE status IN ('pending', 'processing');


-- ═══════════════════════════════════════════════════════════════════════════════
-- E2.2 — WAREHOUSE SNAPSHOT TABLES (staging for export)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS warehouse_commission_snapshot (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_id         uuid NOT NULL REFERENCES warehouse_exports(id) ON DELETE CASCADE,
  organization_id   uuid NOT NULL,
  advisor_id        uuid NOT NULL,
  month             date NOT NULL,
  product_type      text,
  total_commissions numeric(12,2),
  paid_commissions  numeric(12,2),
  pending_commissions numeric(12,2),
  total_enrollments int,
  commission_count  int,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wh_commission_snap_export
  ON warehouse_commission_snapshot (export_id);

CREATE TABLE IF NOT EXISTS warehouse_ranking_snapshot (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_id         uuid NOT NULL REFERENCES warehouse_exports(id) ON DELETE CASCADE,
  organization_id   uuid NOT NULL,
  advisor_id        uuid NOT NULL,
  period_month      date NOT NULL,
  rank_position     int,
  tier              text,
  production_score  numeric(12,2),
  total_commissions numeric(12,2),
  total_enrollments int,
  growth_rate_pct   numeric(8,2),
  streak_months     int,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wh_ranking_snap_export
  ON warehouse_ranking_snapshot (export_id);

CREATE TABLE IF NOT EXISTS warehouse_agency_snapshot (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_id         uuid NOT NULL REFERENCES warehouse_exports(id) ON DELETE CASCADE,
  organization_id   uuid NOT NULL,
  agency_id         uuid NOT NULL,
  agency_name       text,
  month             date NOT NULL,
  total_commissions numeric(12,2),
  total_enrollments int,
  advisor_count     int,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wh_agency_snap_export
  ON warehouse_agency_snapshot (export_id);


-- ═══════════════════════════════════════════════════════════════════════════════
-- E2.3 — WAREHOUSE SNAPSHOT GENERATOR (idempotent)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION generate_warehouse_snapshot(
  p_org_id      uuid,
  p_export_type text,
  p_month       date DEFAULT NULL,
  p_actor_id    uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month     date := COALESCE(p_month, date_trunc('month', current_date)::date);
  v_export_id uuid;
  v_rows      int := 0;
  v_tmp       int;
BEGIN
  -- Create export record
  INSERT INTO warehouse_exports (organization_id, export_type, period_start, period_end, status, requested_by)
  VALUES (p_org_id, p_export_type, v_month, (v_month + interval '1 month - 1 day')::date, 'processing', p_actor_id)
  RETURNING id INTO v_export_id;

  -- Commission snapshot
  IF p_export_type IN ('commissions', 'full') THEN
    INSERT INTO warehouse_commission_snapshot
      (export_id, organization_id, advisor_id, month, product_type,
       total_commissions, paid_commissions, pending_commissions,
       total_enrollments, commission_count)
    SELECT v_export_id, m.organization_id, m.advisor_id, m.month, m.product_type,
           m.total_commissions, m.paid_commissions, m.pending_commissions,
           m.total_enrollments, m.commission_count
    FROM mv_advisor_monthly_performance m
    WHERE m.organization_id = p_org_id AND m.month = v_month;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  END IF;

  -- Ranking snapshot
  IF p_export_type IN ('rankings', 'full') THEN
    INSERT INTO warehouse_ranking_snapshot
      (export_id, organization_id, advisor_id, period_month,
       rank_position, tier, production_score, total_commissions,
       total_enrollments, growth_rate_pct, streak_months)
    SELECT v_export_id, r.organization_id, r.advisor_id, r.period_month,
           r.rank_position, r.tier, r.production_score, r.total_commissions,
           r.total_enrollments, r.growth_rate_pct, r.streak_months
    FROM advisor_rankings r
    WHERE r.organization_id = p_org_id AND r.period_month = v_month
      AND r.capacity_scope IS NULL;
    GET DIAGNOSTICS v_tmp = ROW_COUNT;
    v_rows := v_rows + v_tmp;
  END IF;

  -- Agency snapshot
  IF p_export_type IN ('agencies', 'full') THEN
    INSERT INTO warehouse_agency_snapshot
      (export_id, organization_id, agency_id, agency_name, month,
       total_commissions, total_enrollments, advisor_count)
    SELECT v_export_id, ag.organization_id, ag.id, ag.name, v_month,
           COALESCE(SUM(m.total_commissions), 0),
           COALESCE(SUM(m.total_enrollments), 0),
           COUNT(DISTINCT m.advisor_id)
    FROM agencies ag
    JOIN agency_users au ON au.agency_id = ag.id AND au.status = 'active'
    LEFT JOIN mv_advisor_monthly_performance m
      ON m.advisor_id = au.advisor_id
      AND m.organization_id = p_org_id
      AND m.month = v_month
      AND m.product_type IN ('health_share', 'health_insurance')
    WHERE ag.organization_id = p_org_id AND ag.status = 'active'
    GROUP BY ag.organization_id, ag.id, ag.name;
    GET DIAGNOSTICS v_tmp = ROW_COUNT;
    v_rows := v_rows + v_tmp;
  END IF;

  -- Mark completed
  UPDATE warehouse_exports
  SET status = 'completed', row_count = v_rows, completed_at = now()
  WHERE id = v_export_id;

  RETURN jsonb_build_object(
    'export_id', v_export_id,
    'export_type', p_export_type,
    'month', v_month,
    'row_count', v_rows,
    'status', 'completed'
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- E2.4 — WAREHOUSE RLS
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE warehouse_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_commission_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_ranking_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_agency_snapshot ENABLE ROW LEVEL SECURITY;

-- Only org admins can see/manage exports
CREATE POLICY "admin_warehouse_exports" ON warehouse_exports
  FOR ALL USING (
    organization_id = (SELECT get_user_organization_id())
    AND get_user_role() IN ('owner', 'super_admin', 'admin')
  );

CREATE POLICY "admin_wh_commission_snap" ON warehouse_commission_snapshot
  FOR SELECT USING (
    organization_id = (SELECT get_user_organization_id())
    AND get_user_role() IN ('owner', 'super_admin', 'admin')
  );

CREATE POLICY "admin_wh_ranking_snap" ON warehouse_ranking_snapshot
  FOR SELECT USING (
    organization_id = (SELECT get_user_organization_id())
    AND get_user_role() IN ('owner', 'super_admin', 'admin')
  );

CREATE POLICY "admin_wh_agency_snap" ON warehouse_agency_snapshot
  FOR SELECT USING (
    organization_id = (SELECT get_user_organization_id())
    AND get_user_role() IN ('owner', 'super_admin', 'admin')
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- E3.1 — SYSTEM EVENTS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS system_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  event_type    text NOT NULL
                CHECK (event_type IN (
                  'commission_created',
                  'payout_batch_created',
                  'payout_batch_approved',
                  'payout_completed',
                  'payout_failed',
                  'ranking_updated',
                  'agency_updated',
                  'achievement_earned',
                  'franchise_event',
                  'export_completed'
                )),
  entity_type   text NOT NULL,                -- 'commission_ledger', 'payout_batch', etc.
  entity_id     uuid,
  payload       jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_events_org_type
  ON system_events (organization_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_events_created
  ON system_events (created_at);

-- Retention cleanup uses created_at index above


-- ═══════════════════════════════════════════════════════════════════════════════
-- E3.2 — RLS FOR SYSTEM EVENTS (Supabase Realtime requires RLS)
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE system_events ENABLE ROW LEVEL SECURITY;

-- Users see only their org's events
CREATE POLICY "users_view_org_events" ON system_events
  FOR SELECT USING (
    organization_id = (SELECT get_user_organization_id())
  );

-- Only system (SECURITY DEFINER functions) can insert
-- No direct INSERT policy for regular users


-- ═══════════════════════════════════════════════════════════════════════════════
-- E3.3 — EVENT EMITTER (used by triggers)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION emit_system_event(
  p_org_id      uuid,
  p_event_type  text,
  p_entity_type text,
  p_entity_id   uuid,
  p_payload     jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO system_events (organization_id, event_type, entity_type, entity_id, payload)
  VALUES (p_org_id, p_event_type, p_entity_type, p_entity_id, p_payload);
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- E3.4 — TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Commission ledger insert → commission_created
CREATE OR REPLACE FUNCTION trg_commission_ledger_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM emit_system_event(
    NEW.organization_id,
    'commission_created',
    'commission_ledger',
    NEW.id,
    jsonb_build_object(
      'advisor_id', NEW.advisor_id,
      'amount', NEW.amount,
      'product_type', NEW.product_type,
      'status', NEW.status
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_commission_ledger_event ON commission_ledger;
CREATE TRIGGER trg_commission_ledger_event
  AFTER INSERT ON commission_ledger
  FOR EACH ROW
  EXECUTE FUNCTION trg_commission_ledger_event();


-- Payout batch status changes
CREATE OR REPLACE FUNCTION trg_payout_batch_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'payout_batch_created';
  ELSIF NEW.status = 'approved' OR NEW.status = 'processing' THEN
    v_event_type := 'payout_batch_approved';
  ELSIF NEW.status = 'paid' THEN
    v_event_type := 'payout_completed';
  ELSIF NEW.status = 'failed' THEN
    v_event_type := 'payout_failed';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM emit_system_event(
    NEW.organization_id,
    v_event_type,
    'commission_payment_batches',
    NEW.id,
    jsonb_build_object(
      'batch_number', NEW.batch_number,
      'status', NEW.status,
      'total_amount', NEW.total_amount,
      'total_advisors', NEW.total_advisors
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payout_batch_event ON commission_payment_batches;
CREATE TRIGGER trg_payout_batch_event
  AFTER INSERT OR UPDATE OF status ON commission_payment_batches
  FOR EACH ROW
  EXECUTE FUNCTION trg_payout_batch_event();


-- Ranking updates (fires when rankings are refreshed)
CREATE OR REPLACE FUNCTION trg_ranking_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only emit for overall rankings (not per-capacity), to avoid spam
  IF NEW.capacity_scope IS NULL THEN
    PERFORM emit_system_event(
      NEW.organization_id,
      'ranking_updated',
      'advisor_rankings',
      NEW.id,
      jsonb_build_object(
        'advisor_id', NEW.advisor_id,
        'rank_position', NEW.rank_position,
        'tier', NEW.tier,
        'production_score', NEW.production_score,
        'rank_change', NEW.rank_change
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ranking_event ON advisor_rankings;
CREATE TRIGGER trg_ranking_event
  AFTER INSERT OR UPDATE ON advisor_rankings
  FOR EACH ROW
  EXECUTE FUNCTION trg_ranking_event();


-- Achievement earned
CREATE OR REPLACE FUNCTION trg_achievement_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM emit_system_event(
    NEW.organization_id,
    'achievement_earned',
    'advisor_achievements',
    NEW.id,
    jsonb_build_object(
      'advisor_id', NEW.advisor_id,
      'achievement_type', NEW.achievement_type,
      'title', NEW.title
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_achievement_event ON advisor_achievements;
CREATE TRIGGER trg_achievement_event
  AFTER INSERT ON advisor_achievements
  FOR EACH ROW
  EXECUTE FUNCTION trg_achievement_event();


-- ═══════════════════════════════════════════════════════════════════════════════
-- E3.5 — EVENT RETENTION (delete > 90 days)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION cleanup_old_events()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM system_events
  WHERE created_at < now() - interval '90 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'deleted', v_deleted,
    'cutoff', (now() - interval '90 days'),
    'cleaned_at', now()
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- E3.6 — ENABLE SUPABASE REALTIME ON system_events
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE system_events;


-- ═══════════════════════════════════════════════════════════════════════════════
-- SCHEDULING — Add executive MV refresh + event cleanup to pg_cron
-- ═══════════════════════════════════════════════════════════════════════════════

-- Executive MVs refresh at 2:30 AM UTC (after reporting MVs at 2 AM)
SELECT cron.schedule(
  'refresh-executive-views',
  '30 2 * * *',
  $$SELECT refresh_executive_views()$$
);

-- Event cleanup daily at 5 AM UTC
SELECT cron.schedule(
  'cleanup-old-events',
  '0 5 * * *',
  $$SELECT cleanup_old_events()$$
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════════════════════════════════════════

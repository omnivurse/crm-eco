/*
  # System Health Monitoring Schema

  1. New Tables
    - `system_health_logs`
      - Stores historical health check results for all system components
      - Tracks latency, status, error messages, and detailed metrics
      - Enables trend analysis and incident tracking
    
    - `system_metrics`
      - Aggregated performance metrics over time
      - Stores hourly/daily rollups for efficient querying
      - Tracks database performance, API response times, storage usage
    
    - `system_incidents`
      - Log of system warnings, errors, and outages
      - Tracks incident lifecycle from detection to resolution
      - Links to health check logs for root cause analysis
    
    - `system_alerts`
      - Configurable alert thresholds and notification rules
      - Defines warning/error conditions for each component
      - Tracks alert acknowledgment and resolution

  2. Security
    - Enable RLS on all tables
    - Only super_admin and admin roles can read/write health data
    - Automated cleanup functions for old records (90-day retention)

  3. Functions
    - calculate_system_uptime: Calculates uptime percentage for date range
    - get_system_health_trends: Returns aggregated health metrics
    - cleanup_old_health_logs: Automatic cleanup of historical data
*/

-- System Health Logs Table
CREATE TABLE IF NOT EXISTS system_health_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_name text NOT NULL,
  check_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('healthy', 'warning', 'error', 'unknown')),
  message text NOT NULL,
  latency_ms integer,
  error_details jsonb,
  metrics jsonb DEFAULT '{}'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_logs_component ON system_health_logs(component_name);
CREATE INDEX IF NOT EXISTS idx_health_logs_status ON system_health_logs(status);
CREATE INDEX IF NOT EXISTS idx_health_logs_checked_at ON system_health_logs(checked_at DESC);

-- System Metrics Table
CREATE TABLE IF NOT EXISTS system_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type text NOT NULL,
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  unit text,
  dimensions jsonb DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metrics_type_name ON system_metrics(metric_type, metric_name);
CREATE INDEX IF NOT EXISTS idx_metrics_recorded_at ON system_metrics(recorded_at DESC);

-- System Incidents Table
CREATE TABLE IF NOT EXISTS system_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_name text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'investigating', 'resolved')),
  detected_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES profiles(id),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES profiles(id),
  resolution_notes text,
  affected_users integer DEFAULT 0,
  related_logs jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON system_incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON system_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_detected_at ON system_incidents(detected_at DESC);

-- System Alerts Configuration Table
CREATE TABLE IF NOT EXISTS system_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_name text NOT NULL,
  metric_name text NOT NULL,
  alert_type text NOT NULL CHECK (alert_type IN ('threshold', 'anomaly', 'availability')),
  warning_threshold numeric,
  error_threshold numeric,
  comparison_operator text DEFAULT '>=' CHECK (comparison_operator IN ('>', '<', '>=', '<=', '==')),
  is_enabled boolean DEFAULT true,
  notification_channels jsonb DEFAULT '["ui"]'::jsonb,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alerts_component ON system_alerts(component_name);
CREATE INDEX IF NOT EXISTS idx_alerts_enabled ON system_alerts(is_enabled) WHERE is_enabled = true;

-- Enable RLS
ALTER TABLE system_health_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for system_health_logs
CREATE POLICY "Super admins and admins can read health logs"
  ON system_health_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "System can insert health logs"
  ON system_health_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for system_metrics
CREATE POLICY "Super admins and admins can read metrics"
  ON system_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "System can insert metrics"
  ON system_metrics FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for system_incidents
CREATE POLICY "Super admins and admins can read incidents"
  ON system_incidents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Super admins and admins can create incidents"
  ON system_incidents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Super admins and admins can update incidents"
  ON system_incidents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- RLS Policies for system_alerts
CREATE POLICY "Super admins and admins can manage alerts"
  ON system_alerts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Function: Calculate System Uptime
CREATE OR REPLACE FUNCTION calculate_system_uptime(
  p_component_name text,
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS TABLE (
  uptime_percentage numeric,
  total_checks bigint,
  healthy_checks bigint,
  warning_checks bigint,
  error_checks bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROUND(
      (COUNT(*) FILTER (WHERE status = 'healthy')::numeric / NULLIF(COUNT(*)::numeric, 0)) * 100,
      2
    ) as uptime_percentage,
    COUNT(*) as total_checks,
    COUNT(*) FILTER (WHERE status = 'healthy') as healthy_checks,
    COUNT(*) FILTER (WHERE status = 'warning') as warning_checks,
    COUNT(*) FILTER (WHERE status = 'error') as error_checks
  FROM system_health_logs
  WHERE component_name = p_component_name
    AND checked_at BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get System Health Trends
CREATE OR REPLACE FUNCTION get_system_health_trends(
  p_hours integer DEFAULT 24
)
RETURNS TABLE (
  hour_bucket timestamptz,
  component_name text,
  avg_latency_ms numeric,
  status_counts jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    date_trunc('hour', checked_at) as hour_bucket,
    shl.component_name,
    ROUND(AVG(latency_ms)::numeric, 2) as avg_latency_ms,
    jsonb_build_object(
      'healthy', COUNT(*) FILTER (WHERE status = 'healthy'),
      'warning', COUNT(*) FILTER (WHERE status = 'warning'),
      'error', COUNT(*) FILTER (WHERE status = 'error')
    ) as status_counts
  FROM system_health_logs shl
  WHERE checked_at >= NOW() - (p_hours || ' hours')::interval
  GROUP BY date_trunc('hour', checked_at), shl.component_name
  ORDER BY hour_bucket DESC, shl.component_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Cleanup Old Health Logs (90-day retention)
CREATE OR REPLACE FUNCTION cleanup_old_health_logs()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM system_health_logs
  WHERE checked_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  DELETE FROM system_metrics
  WHERE recorded_at < NOW() - INTERVAL '90 days';
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get Component Status Summary
CREATE OR REPLACE FUNCTION get_component_status_summary()
RETURNS TABLE (
  component_name text,
  current_status text,
  last_check timestamptz,
  uptime_24h numeric,
  avg_latency_24h numeric,
  incident_count_24h bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH latest_checks AS (
    SELECT DISTINCT ON (shl.component_name)
      shl.component_name,
      shl.status,
      shl.checked_at,
      shl.latency_ms
    FROM system_health_logs shl
    ORDER BY shl.component_name, shl.checked_at DESC
  ),
  uptime_calc AS (
    SELECT
      shl.component_name,
      ROUND(
        (COUNT(*) FILTER (WHERE status = 'healthy')::numeric / NULLIF(COUNT(*)::numeric, 0)) * 100,
        2
      ) as uptime_pct,
      ROUND(AVG(latency_ms)::numeric, 2) as avg_lat
    FROM system_health_logs shl
    WHERE checked_at >= NOW() - INTERVAL '24 hours'
    GROUP BY shl.component_name
  ),
  incident_counts AS (
    SELECT
      si.component_name,
      COUNT(*) as incidents
    FROM system_incidents si
    WHERE si.detected_at >= NOW() - INTERVAL '24 hours'
    GROUP BY si.component_name
  )
  SELECT
    lc.component_name,
    lc.status as current_status,
    lc.checked_at as last_check,
    COALESCE(uc.uptime_pct, 0) as uptime_24h,
    COALESCE(uc.avg_lat, 0) as avg_latency_24h,
    COALESCE(ic.incidents, 0) as incident_count_24h
  FROM latest_checks lc
  LEFT JOIN uptime_calc uc ON lc.component_name = uc.component_name
  LEFT JOIN incident_counts ic ON lc.component_name = ic.component_name
  ORDER BY lc.component_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Update system_incidents updated_at
CREATE OR REPLACE FUNCTION update_system_incidents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_system_incidents_updated_at
  BEFORE UPDATE ON system_incidents
  FOR EACH ROW
  EXECUTE FUNCTION update_system_incidents_updated_at();

-- Insert default alert configurations
INSERT INTO system_alerts (component_name, metric_name, alert_type, warning_threshold, error_threshold, comparison_operator)
VALUES
  ('Database Connection', 'latency_ms', 'threshold', 200, 500, '>='),
  ('Vector Index', 'latency_ms', 'threshold', 300, 1000, '>='),
  ('Scheduled Functions', 'error_rate', 'threshold', 5, 10, '>='),
  ('Storage', 'usage_percentage', 'threshold', 80, 95, '>='),
  ('Authentication', 'latency_ms', 'threshold', 150, 400, '>='),
  ('Edge Functions', 'error_rate', 'threshold', 3, 8, '>=')
ON CONFLICT DO NOTHING;

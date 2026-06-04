-- =============================================================================
-- Activity Log System
-- =============================================================================
-- High-performance, partitioned activity log for tracking all software actions.
-- Designed for:
--   - Blazing-fast append-only writes (no contention with read tables)
--   - Efficient reads via monthly range partitioning + targeted indexes
--   - Automatic partition management (create future / drop old)
--   - Fire-and-forget RPC for zero-latency logging from the app
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Partitioned table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_log (
  id            uuid         NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid       NOT NULL,

  -- Who performed the action (denormalized for permanence)
  actor_id      uuid,
  actor_email   text,
  actor_role    text,

  -- What happened
  action        text         NOT NULL,   -- e.g. 'record.created', 'email.sent'
  category      text         NOT NULL,   -- e.g. 'crm', 'billing', 'auth', 'enrollment', 'system'

  -- What was affected
  entity_type   text,                    -- e.g. 'contact', 'deal', 'member'
  entity_id     text,                    -- UUID or other identifier as text

  -- Human-readable summary
  description   text,

  -- Flexible payload (diffs, context, extra data)
  metadata      jsonb        NOT NULL DEFAULT '{}'::jsonb,

  -- Request context
  ip_address    inet,
  user_agent    text,

  -- Timestamp (also the partition key)
  created_at    timestamptz  NOT NULL DEFAULT now(),

  -- PK must include partition key for partitioned tables
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Add a comment for documentation
COMMENT ON TABLE public.activity_log IS
  'High-volume, partitioned activity log. Monthly partitions, append-only writes. Use log_activity() RPC for inserts.';

-- ---------------------------------------------------------------------------
-- 2. Create monthly partitions (6 months of coverage)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_log_y2026m01 PARTITION OF activity_log
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE IF NOT EXISTS activity_log_y2026m02 PARTITION OF activity_log
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE IF NOT EXISTS activity_log_y2026m03 PARTITION OF activity_log
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE IF NOT EXISTS activity_log_y2026m04 PARTITION OF activity_log
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS activity_log_y2026m05 PARTITION OF activity_log
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS activity_log_y2026m06 PARTITION OF activity_log
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS activity_log_y2026m07 PARTITION OF activity_log
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

-- Default partition catches anything outside the explicit ranges
CREATE TABLE IF NOT EXISTS activity_log_default PARTITION OF activity_log DEFAULT;

-- ---------------------------------------------------------------------------
-- 3. Indexes (defined on parent, auto-propagated to child partitions)
-- ---------------------------------------------------------------------------
-- Primary query: "show me all activity for this org, newest first"
CREATE INDEX IF NOT EXISTS idx_activity_log_org_created
  ON activity_log (organization_id, created_at DESC);

-- "show me what this user did"
CREATE INDEX IF NOT EXISTS idx_activity_log_actor_created
  ON activity_log (actor_id, created_at DESC)
  WHERE actor_id IS NOT NULL;

-- "show me all activity on this specific entity"
CREATE INDEX IF NOT EXISTS idx_activity_log_entity
  ON activity_log (entity_type, entity_id, created_at DESC)
  WHERE entity_type IS NOT NULL;

-- "show me all activity in this category"
CREATE INDEX IF NOT EXISTS idx_activity_log_category
  ON activity_log (organization_id, category, created_at DESC);

-- ---------------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Users can read activity logs for their own organization
CREATE POLICY activity_log_org_read ON activity_log
  FOR SELECT USING (
    organization_id IN (
      SELECT p.organization_id FROM profiles p WHERE p.user_id = auth.uid()
    )
  );

-- Inserts are done via SECURITY DEFINER function, but allow direct inserts too
CREATE POLICY activity_log_org_insert ON activity_log
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT p.organization_id FROM profiles p WHERE p.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 5. log_activity() RPC — lightweight, fast insert
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_activity(
  p_action        text,
  p_category      text,
  p_entity_type   text    DEFAULT NULL,
  p_entity_id     text    DEFAULT NULL,
  p_description   text    DEFAULT NULL,
  p_metadata      jsonb   DEFAULT '{}'::jsonb,
  p_ip_address    text    DEFAULT NULL,
  p_user_agent    text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id           uuid;
  v_org_id       uuid;
  v_actor_id     uuid;
  v_actor_email  text;
  v_actor_role   text;
  v_ip           inet;
BEGIN
  -- Resolve current user context from JWT
  SELECT p.organization_id, p.id, p.email, COALESCE(p.crm_role, p.role)
    INTO v_org_id, v_actor_id, v_actor_email, v_actor_role
    FROM profiles p
   WHERE p.user_id = auth.uid()
   LIMIT 1;

  -- System category events can work without an authenticated user
  IF v_org_id IS NULL AND p_category != 'system' THEN
    RAISE EXCEPTION 'Organization context required for non-system activity logs';
  END IF;

  -- Safely cast ip_address text to inet (NULL on bad input)
  BEGIN
    v_ip := p_ip_address::inet;
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  INSERT INTO activity_log (
    organization_id, actor_id, actor_email, actor_role,
    action, category, entity_type, entity_id,
    description, metadata, ip_address, user_agent
  ) VALUES (
    COALESCE(v_org_id, '00000000-0000-0000-0000-000000000000'::uuid),
    v_actor_id, v_actor_email, v_actor_role,
    p_action, p_category, p_entity_type, p_entity_id,
    p_description, p_metadata, v_ip, p_user_agent
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.log_activity IS
  'Lightweight RPC to insert an activity log entry. Resolves actor from auth context automatically.';

-- ---------------------------------------------------------------------------
-- 6. Auto-create future partitions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_activity_log_partitions(months_ahead int DEFAULT 3)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  partition_date  date;
  partition_name  text;
  start_date      date;
  end_date        date;
BEGIN
  FOR i IN 0..months_ahead LOOP
    partition_date := date_trunc('month', now())::date + (i || ' months')::interval;
    partition_name := 'activity_log_y' || to_char(partition_date, 'YYYY') || 'm' || to_char(partition_date, 'MM');
    start_date     := partition_date;
    end_date       := (partition_date + '1 month'::interval)::date;

    IF NOT EXISTS (
      SELECT 1 FROM pg_class WHERE relname = partition_name
    ) THEN
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF activity_log FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date
      );
      RAISE NOTICE 'Created activity_log partition: %', partition_name;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.ensure_activity_log_partitions IS
  'Creates monthly activity_log partitions for the next N months. Safe to call repeatedly — skips existing partitions.';

-- ---------------------------------------------------------------------------
-- 7. Drop old partitions (retention policy)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.drop_old_activity_log_partitions(retention_months int DEFAULT 6)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff_date     date;
  rec             record;
  dropped_count   int := 0;
  p_year          int;
  p_month         int;
  p_start         date;
BEGIN
  cutoff_date := (date_trunc('month', now()) - (retention_months || ' months')::interval)::date;

  FOR rec IN
    SELECT inhrelid::regclass::text AS partition_name
      FROM pg_inherits
     WHERE inhparent = 'activity_log'::regclass
       AND inhrelid::regclass::text != 'activity_log_default'
     ORDER BY inhrelid::regclass::text
  LOOP
    -- Parse year/month from partition name: activity_log_yYYYYmMM
    IF rec.partition_name ~ 'activity_log_y\d{4}m\d{2}' THEN
      p_year  := substring(rec.partition_name FROM 'y(\d{4})')::int;
      p_month := substring(rec.partition_name FROM 'm(\d{2})')::int;
      p_start := make_date(p_year, p_month, 1);

      IF p_start < cutoff_date THEN
        EXECUTE format('DROP TABLE IF EXISTS %I', rec.partition_name);
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped old activity_log partition: %', rec.partition_name;
      END IF;
    END IF;
  END LOOP;

  RETURN dropped_count;
END;
$$;

COMMENT ON FUNCTION public.drop_old_activity_log_partitions IS
  'Drops activity_log partitions older than N months. Returns the number of partitions dropped.';

-- ---------------------------------------------------------------------------
-- 8. Grant permissions
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.log_activity TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_activity_log_partitions TO authenticated;
-- drop_old_activity_log_partitions intentionally NOT granted to regular users
-- call it from a scheduled job or admin context only

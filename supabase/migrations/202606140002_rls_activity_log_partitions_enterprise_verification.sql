-- Linter: rls_enabled_no_policy (0008)
-- Tables: _enterprise_verification, activity_log_* partitions
-- Strategy:
--   • _enterprise_verification: internal migration diagnostics — service_role only
--   • activity_log partitions: mirror org-scoped read/insert policies on each child
-- Rollback:
--   DROP POLICY service_role_enterprise_verification ON public._enterprise_verification;
--   DROP FUNCTION public.ensure_activity_log_partition_rls(text);
--   (re-run DROP POLICY activity_log_org_* on each partition if needed)

BEGIN;

SET lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. Internal verification table — service_role only (not app-facing)
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public._enterprise_verification ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_enterprise_verification ON public._enterprise_verification;
CREATE POLICY service_role_enterprise_verification
  ON public._enterprise_verification
  FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

-- ---------------------------------------------------------------------------
-- 2. Helper — org-scoped RLS on one activity_log partition
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_activity_log_partition_rls(p_partition text)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF p_partition IS NULL OR p_partition = 'activity_log' THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = p_partition
      AND c.relkind = 'r'
  ) THEN
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_partition);

  EXECUTE format('DROP POLICY IF EXISTS activity_log_org_read ON public.%I', p_partition);
  EXECUTE format(
    $policy$
      CREATE POLICY activity_log_org_read ON public.%I
        FOR SELECT
        USING (organization_id IN (SELECT public.user_organization_ids()))
    $policy$,
    p_partition
  );

  EXECUTE format('DROP POLICY IF EXISTS activity_log_org_insert ON public.%I', p_partition);
  EXECUTE format(
    $policy$
      CREATE POLICY activity_log_org_insert ON public.%I
        FOR INSERT
        WITH CHECK (organization_id IN (SELECT public.user_organization_ids()))
    $policy$,
    p_partition
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_activity_log_partition_rls(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_activity_log_partition_rls(text) TO service_role;

-- Apply to every existing activity_log child partition (incl. default).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS partition_name
    FROM pg_class c
    JOIN pg_inherits i ON i.inhrelid = c.oid
    JOIN pg_class p ON p.oid = i.inhparent
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.relname = 'activity_log'
      AND n.nspname = 'public'
  LOOP
    PERFORM public.ensure_activity_log_partition_rls(r.partition_name);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Future partitions — enable RLS + policies when created
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_activity_log_partitions(months_ahead int DEFAULT 3)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
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

    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = partition_name) THEN
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF activity_log FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date
      );
      RAISE NOTICE 'Created activity_log partition: %', partition_name;
    END IF;

    PERFORM public.ensure_activity_log_partition_rls(partition_name);
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.ensure_activity_log_partition_rls IS
  'Ensures org-scoped SELECT/INSERT RLS policies exist on an activity_log partition.';

COMMIT;

NOTIFY pgrst, 'reload schema';

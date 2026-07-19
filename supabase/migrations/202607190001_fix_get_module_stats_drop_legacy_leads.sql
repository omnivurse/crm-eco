-- get_module_stats referenced public.leads which no longer exists
-- (crm_records is the source of truth for leads). Keep members legacy rollup.

CREATE OR REPLACE FUNCTION public.get_module_stats(p_org_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_one_week_ago timestamptz := now() - interval '7 days';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND organization_id = p_org_id
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH module_counts AS (
    SELECT
      m.key AS module_key,
      COALESCE(m.name_plural, m.name || 's') AS module_name,
      COUNT(r.id) AS total_records,
      COUNT(r.id) FILTER (WHERE r.created_at >= v_one_week_ago) AS created_this_week
    FROM crm_modules m
    LEFT JOIN crm_records r ON r.module_id = m.id
    WHERE m.organization_id = p_org_id AND m.is_enabled = true
    GROUP BY m.key, m.name, m.name_plural
  ),
  legacy_members AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE created_at >= v_one_week_ago) AS this_week
    FROM members
    WHERE organization_id = p_org_id
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'moduleKey', mc.module_key,
      'moduleName', mc.module_name,
      'totalRecords', mc.total_records +
        CASE mc.module_key
          WHEN 'contacts' THEN COALESCE((SELECT total FROM legacy_members), 0)
          ELSE 0
        END,
      'createdThisWeek', mc.created_this_week +
        CASE mc.module_key
          WHEN 'contacts' THEN COALESCE((SELECT this_week FROM legacy_members), 0)
          ELSE 0
        END
    )
  ) INTO v_result
  FROM module_counts mc;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$function$;

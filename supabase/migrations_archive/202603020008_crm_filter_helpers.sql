-- =============================================================================
-- CRM Filter Helper RPCs
-- Server-side functions for system preset filters and related module filters.
-- These return sets of crm_records IDs that match the filter conditions,
-- allowing the application to compose them with other Supabase query filters.
-- =============================================================================

-- =============================================================================
-- 1. filter_records_by_system_preset
--    Returns record IDs matching a system-level preset filter.
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
AS $$
BEGIN
  CASE p_preset
    -- Records that have any activity (task, call, meeting, email, or note)
    WHEN 'touched_records' THEN
      RETURN QUERY
        SELECT DISTINCT r.id
        FROM crm_records r
        WHERE r.module_id = p_module_id
          AND (
            EXISTS (SELECT 1 FROM crm_tasks t WHERE t.record_id = r.id)
            OR EXISTS (SELECT 1 FROM crm_notes n WHERE n.record_id = r.id)
          );

    -- Records with NO activities and NO notes
    WHEN 'untouched_records' THEN
      RETURN QUERY
        SELECT r.id
        FROM crm_records r
        WHERE r.module_id = p_module_id
          AND NOT EXISTS (SELECT 1 FROM crm_tasks t WHERE t.record_id = r.id)
          AND NOT EXISTS (SELECT 1 FROM crm_notes n WHERE n.record_id = r.id);

    -- Records owned by the current user
    WHEN 'my_records' THEN
      RETURN QUERY
        SELECT r.id
        FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.owner_id = p_user_profile_id;

    -- Records created today
    WHEN 'created_today' THEN
      RETURN QUERY
        SELECT r.id
        FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.created_at >= date_trunc('day', now())
          AND r.created_at < date_trunc('day', now()) + interval '1 day';

    -- Records created this week (Mon-Sun)
    WHEN 'created_this_week' THEN
      RETURN QUERY
        SELECT r.id
        FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.created_at >= date_trunc('week', now())
          AND r.created_at < date_trunc('week', now()) + interval '1 week';

    -- Records modified today
    WHEN 'modified_today' THEN
      RETURN QUERY
        SELECT r.id
        FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.updated_at >= date_trunc('day', now())
          AND r.updated_at < date_trunc('day', now()) + interval '1 day';

    -- Records modified this week
    WHEN 'modified_this_week' THEN
      RETURN QUERY
        SELECT r.id
        FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.updated_at >= date_trunc('week', now())
          AND r.updated_at < date_trunc('week', now()) + interval '1 week';

    -- Records with no owner assigned
    WHEN 'unassigned' THEN
      RETURN QUERY
        SELECT r.id
        FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.owner_id IS NULL;

    -- Records that have at least one activity (task/call/meeting/email)
    WHEN 'has_activities' THEN
      RETURN QUERY
        SELECT DISTINCT r.id
        FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (SELECT 1 FROM crm_tasks t WHERE t.record_id = r.id);

    -- Records with no activities
    WHEN 'no_activities' THEN
      RETURN QUERY
        SELECT r.id
        FROM crm_records r
        WHERE r.module_id = p_module_id
          AND NOT EXISTS (SELECT 1 FROM crm_tasks t WHERE t.record_id = r.id);

    -- Records that have at least one note
    WHEN 'has_notes' THEN
      RETURN QUERY
        SELECT DISTINCT r.id
        FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (SELECT 1 FROM crm_notes n WHERE n.record_id = r.id);

    -- Records with at least one open (non-completed) task
    WHEN 'has_open_tasks' THEN
      RETURN QUERY
        SELECT DISTINCT r.id
        FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (
            SELECT 1 FROM crm_tasks t
            WHERE t.record_id = r.id
              AND t.status NOT IN ('completed', 'cancelled')
          );

    -- Records with at least one overdue task
    WHEN 'has_overdue_tasks' THEN
      RETURN QUERY
        SELECT DISTINCT r.id
        FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (
            SELECT 1 FROM crm_tasks t
            WHERE t.record_id = r.id
              AND t.status NOT IN ('completed', 'cancelled')
              AND t.due_at IS NOT NULL
              AND t.due_at < now()
          );

    ELSE
      -- Unknown preset: return empty set
      RETURN;
  END CASE;
END;
$$;

-- =============================================================================
-- 2. filter_records_by_related
--    Returns record IDs based on related module conditions.
--    Supports filtering by crm_tasks (with activity_type), crm_notes,
--    and crm_record_links (for cross-module relations).
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
AS $$
BEGIN
  CASE p_related_type
    -- -----------------------------------------------------------------------
    -- Activities (crm_tasks, optionally filtered by activity_type)
    -- -----------------------------------------------------------------------
    WHEN 'activities', 'appointments', 'calls', 'emails', 'tasks' THEN
      IF p_condition = 'has_any' THEN
        RETURN QUERY
          SELECT DISTINCT r.id
          FROM crm_records r
          WHERE r.module_id = p_module_id
            AND EXISTS (
              SELECT 1 FROM crm_tasks t
              WHERE t.record_id = r.id
                AND (p_activity_type IS NULL OR t.activity_type = p_activity_type)
            );
      ELSIF p_condition = 'has_none' THEN
        RETURN QUERY
          SELECT r.id
          FROM crm_records r
          WHERE r.module_id = p_module_id
            AND NOT EXISTS (
              SELECT 1 FROM crm_tasks t
              WHERE t.record_id = r.id
                AND (p_activity_type IS NULL OR t.activity_type = p_activity_type)
            );
      END IF;

    -- -----------------------------------------------------------------------
    -- Notes (crm_notes)
    -- -----------------------------------------------------------------------
    WHEN 'notes' THEN
      IF p_condition = 'has_any' THEN
        RETURN QUERY
          SELECT DISTINCT r.id
          FROM crm_records r
          WHERE r.module_id = p_module_id
            AND EXISTS (SELECT 1 FROM crm_notes n WHERE n.record_id = r.id);
      ELSIF p_condition = 'has_none' THEN
        RETURN QUERY
          SELECT r.id
          FROM crm_records r
          WHERE r.module_id = p_module_id
            AND NOT EXISTS (SELECT 1 FROM crm_notes n WHERE n.record_id = r.id);
      END IF;

    -- -----------------------------------------------------------------------
    -- Linked records via crm_record_links (leads, products, etc.)
    -- p_activity_type is reused here as the target module key
    -- -----------------------------------------------------------------------
    WHEN 'linked_records' THEN
      IF p_condition = 'has_any' THEN
        RETURN QUERY
          SELECT DISTINCT r.id
          FROM crm_records r
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
          SELECT r.id
          FROM crm_records r
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.filter_records_by_system_preset(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.filter_records_by_related(uuid, text, text, text) TO authenticated;

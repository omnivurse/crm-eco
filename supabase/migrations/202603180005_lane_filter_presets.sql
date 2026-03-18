-- ============================================================================
-- PHASE 3 — LANE-AWARE FILTER PRESETS
-- Extends filter_records_by_system_preset with market type and
-- normalization status filter presets.
-- ============================================================================

-- Add new p_value parameter for value-based presets (backward compatible)
CREATE OR REPLACE FUNCTION public.filter_records_by_system_preset(
  p_module_id uuid,
  p_preset text,
  p_user_profile_id uuid DEFAULT NULL,
  p_value text DEFAULT NULL
)
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  CASE p_preset
    -- ── Business Lane Filters (Phase 3) ──

    WHEN 'healthshare_records' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id AND r.market_type = 'healthshare';

    WHEN 'insurance_records' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id AND r.market_type = 'traditional_insurance';

    WHEN 'unclassified_records' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id AND (r.market_type IS NULL OR r.market_type = 'unknown');

    WHEN 'needs_review_records' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.normalization_status IN ('needs_review', 'unresolved');

    -- ── Existing Presets (preserved) ──

    WHEN 'touched_records' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND (
            EXISTS (SELECT 1 FROM crm_tasks t WHERE t.record_id = r.id)
            OR EXISTS (SELECT 1 FROM crm_notes n WHERE n.record_id = r.id)
          );

    WHEN 'untouched_records' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND NOT EXISTS (SELECT 1 FROM crm_tasks t WHERE t.record_id = r.id)
          AND NOT EXISTS (SELECT 1 FROM crm_notes n WHERE n.record_id = r.id);

    WHEN 'my_records' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id AND r.owner_id = p_user_profile_id;

    WHEN 'created_today' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.created_at >= date_trunc('day', now())
          AND r.created_at < date_trunc('day', now()) + interval '1 day';

    WHEN 'created_this_week' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.created_at >= date_trunc('week', now())
          AND r.created_at < date_trunc('week', now()) + interval '1 week';

    WHEN 'modified_today' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.updated_at >= date_trunc('day', now())
          AND r.updated_at < date_trunc('day', now()) + interval '1 day';

    WHEN 'modified_this_week' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND r.updated_at >= date_trunc('week', now())
          AND r.updated_at < date_trunc('week', now()) + interval '1 week';

    WHEN 'unassigned' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id AND r.owner_id IS NULL;

    WHEN 'has_activities' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (SELECT 1 FROM crm_tasks t WHERE t.record_id = r.id);

    WHEN 'no_activities' THEN
      RETURN QUERY
        SELECT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND NOT EXISTS (SELECT 1 FROM crm_tasks t WHERE t.record_id = r.id);

    WHEN 'has_notes' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (SELECT 1 FROM crm_notes n WHERE n.record_id = r.id);

    WHEN 'has_open_tasks' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (
            SELECT 1 FROM crm_tasks t
            WHERE t.record_id = r.id AND t.status NOT IN ('completed', 'cancelled')
          );

    WHEN 'has_overdue_tasks' THEN
      RETURN QUERY
        SELECT DISTINCT r.id FROM crm_records r
        WHERE r.module_id = p_module_id
          AND EXISTS (
            SELECT 1 FROM crm_tasks t
            WHERE t.record_id = r.id
              AND t.status NOT IN ('completed', 'cancelled')
              AND t.due_at IS NOT NULL AND t.due_at < now()
          );

    ELSE
      RETURN;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION filter_records_by_system_preset(uuid, text, uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

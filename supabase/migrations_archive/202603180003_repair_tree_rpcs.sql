-- ============================================================================
-- PHASE 2, MIGRATION 3 — REPAIR TREE RPCs
-- Fixes "By Advisor" and "By Agent" tree views to use canonical fields
-- instead of the broken owner_id → profiles → advisor_id join chain.
-- ============================================================================


-- ============================================================================
-- SECTION 1: Fix get_record_counts_by_advisor
--
-- OLD BEHAVIOR (broken):
--   Joined crm_records.owner_id → profiles.id → profiles.advisor_id
--   This returned 0 for all imported records because owner_id was NULL.
--
-- NEW BEHAVIOR:
--   Uses canonical_advisor_id directly (backfilled in migration 2).
--   Records matched to an advisor during backfill have the FK set.
--   Unmatched records correctly do not appear in the tree.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_record_counts_by_advisor(
  p_module_id uuid,
  p_advisor_ids uuid[]
)
RETURNS TABLE(advisor_id uuid, record_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    r.canonical_advisor_id AS advisor_id,
    COUNT(r.id)            AS record_count
  FROM crm_records r
  WHERE r.module_id = p_module_id
    AND r.canonical_advisor_id = ANY(p_advisor_ids)
  GROUP BY r.canonical_advisor_id;
$$;

GRANT EXECUTE ON FUNCTION get_record_counts_by_advisor(uuid, uuid[]) TO authenticated;


-- ============================================================================
-- SECTION 2: Fix get_agent_tree_data
--
-- OLD BEHAVIOR (broken for non-admins):
--   Scoped non-admin users by owner_id (NULL on imports → nothing returned).
--   Grouped by COALESCE(data->>'agent', data->>'producer_name', 'Unassigned').
--
-- NEW BEHAVIOR:
--   Adds p_canonical_advisor_ids parameter for non-admin scoping.
--   Non-admins see records where canonical_advisor_id matches their downline.
--   Groups by normalized_agent_name with fallback to raw fields.
--   Admin mode (both NULL) still returns all records.
--
-- BACKWARD COMPATIBLE: p_owner_ids still works for owner_id-based records.
-- ============================================================================

-- Drop old 2-arg version before creating 3-arg version
DROP FUNCTION IF EXISTS get_agent_tree_data(uuid, uuid[]);

CREATE OR REPLACE FUNCTION get_agent_tree_data(
  p_module_id uuid,
  p_owner_ids uuid[] DEFAULT NULL,
  p_canonical_advisor_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(agent_name text, record_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COALESCE(
      NULLIF(TRIM(r.normalized_agent_name), ''),
      NULLIF(TRIM(r.data->>'agent'), ''),
      NULLIF(TRIM(r.data->>'producer_name'), ''),
      'Unassigned'
    ) AS agent_name,
    COUNT(r.id) AS record_count
  FROM crm_records r
  WHERE r.module_id = p_module_id
    AND (
      -- Admin mode: both parameters NULL → show all records
      (p_owner_ids IS NULL AND p_canonical_advisor_ids IS NULL)
      -- Legacy path: filter by owner_id (for records that have it set)
      OR r.owner_id = ANY(p_owner_ids)
      -- Canonical path: filter by advisor hierarchy (for imported records)
      OR r.canonical_advisor_id = ANY(p_canonical_advisor_ids)
    )
  GROUP BY agent_name
  ORDER BY agent_name;
$$;

GRANT EXECUTE ON FUNCTION get_agent_tree_data(uuid, uuid[], uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Agent tree: aggregate record counts grouped by agent/producer_name text field.
-- Called from getAgentTreeData() in queries.ts.
-- p_owner_ids = NULL  → admin mode (all records in the module)
-- p_owner_ids = [...]  → scoped to specific record owners

CREATE OR REPLACE FUNCTION get_agent_tree_data(
  p_module_id uuid,
  p_owner_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(agent_name text, record_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COALESCE(
      NULLIF(TRIM(r.data->>'agent'), ''),
      NULLIF(TRIM(r.data->>'producer_name'), ''),
      'Unassigned'
    ) AS agent_name,
    COUNT(r.id) AS record_count
  FROM crm_records r
  WHERE r.module_id = p_module_id
    AND (p_owner_ids IS NULL OR r.owner_id = ANY(p_owner_ids))
  GROUP BY agent_name
  ORDER BY agent_name;
$$;

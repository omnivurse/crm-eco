-- RPC to count CRM records per advisor for the tree view.
-- Joins crm_records.owner_id -> profiles.id -> profiles.advisor_id
-- to count how many records each advisor owns (via their profile).

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
    p.advisor_id,
    COUNT(r.id) AS record_count
  FROM crm_records r
  JOIN profiles p ON r.owner_id = p.id
  WHERE r.module_id = p_module_id
    AND p.advisor_id = ANY(p_advisor_ids)
  GROUP BY p.advisor_id;
$$;

GRANT EXECUTE ON FUNCTION get_record_counts_by_advisor(uuid, uuid[]) TO authenticated;

-- ============================================================================
-- MEMBER SEARCH RPC — searches primary member AND dependents (spouse/child)
-- Returns member IDs that match the search term in their own name or any
-- dependent's name. Used by Admin portal for family-aware search.
-- ============================================================================

CREATE OR REPLACE FUNCTION search_members_with_dependents(
  p_org_id uuid,
  p_search text
)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  -- Members whose own name matches
  SELECT id FROM members
  WHERE organization_id = p_org_id
    AND (
      first_name ILIKE '%' || p_search || '%'
      OR last_name ILIKE '%' || p_search || '%'
      OR email ILIKE '%' || p_search || '%'
      OR (first_name || ' ' || last_name) ILIKE '%' || p_search || '%'
    )
  UNION
  -- Members who have a dependent whose name matches
  SELECT d.member_id FROM dependents d
  WHERE d.organization_id = p_org_id
    AND (
      d.first_name ILIKE '%' || p_search || '%'
      OR d.last_name ILIKE '%' || p_search || '%'
      OR (d.first_name || ' ' || d.last_name) ILIKE '%' || p_search || '%'
    )
$$;

GRANT EXECUTE ON FUNCTION search_members_with_dependents(uuid, text) TO authenticated;

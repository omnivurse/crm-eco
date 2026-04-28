-- =============================================================================
-- crm_phone_lookup: deterministic ORDER BY (match crm_smart_search / 008).
--
-- Bulk `updated_at` alignment can collapse the secondary sort; without `r.id`
-- phone-only lookups can still return unstable subsets within LIMIT — same
-- failure mode as pre-008 smart search (planner/order of ties undefined).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.crm_phone_lookup(
  p_org_id uuid,
  p_query text,
  p_module_key text DEFAULT NULL,
  p_limit integer DEFAULT 25
)
RETURNS TABLE (
  id uuid,
  title text,
  email text,
  phone text,
  status text,
  module_id uuid,
  data jsonb,
  module_key text,
  module_name text,
  module_name_plural text,
  match_type text,
  rank real
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_digits text := regexp_replace(coalesce(p_query, ''), '\D', '', 'g');
  v_tail   text := right(v_digits, 10);
BEGIN
  IF length(v_digits) < 4 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.title,
    r.email,
    r.phone,
    r.status,
    r.module_id,
    r.data,
    m.key          AS module_key,
    m.name         AS module_name,
    m.name_plural  AS module_name_plural,
    'exact'::text  AS match_type,
    CASE
      WHEN regexp_replace(coalesce(r.phone, ''), '\D', '', 'g') = v_digits THEN 2.50::real
      WHEN length(v_tail) = 10
        AND right(regexp_replace(coalesce(r.phone, ''), '\D', '', 'g'), 10) = v_tail THEN 2.30::real
      WHEN regexp_replace(coalesce(r.phone, ''), '\D', '', 'g') LIKE '%' || v_digits || '%' THEN 1.95::real
      ELSE 1.50::real
    END AS rank
  FROM public.crm_records r
  JOIN public.crm_modules m ON m.id = r.module_id
  WHERE r.org_id = p_org_id
    AND (p_module_key IS NULL OR m.key = p_module_key)
    AND (
      regexp_replace(coalesce(r.phone, ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
      OR (
        length(v_tail) = 10
        AND right(regexp_replace(coalesce(r.phone, ''), '\D', '', 'g'), 10) = v_tail
      )
    )
  ORDER BY rank DESC, r.updated_at DESC NULLS LAST, r.id
  LIMIT GREATEST(p_limit, 1);
END;
$$;

COMMENT ON FUNCTION public.crm_phone_lookup IS
  'Digit-normalized phone search: indexed scan on r.phone. ORDER BY includes '
  'r.id so LIMIT is stable when rank and updated_at tie (see 202605020010).';

GRANT EXECUTE ON FUNCTION public.crm_phone_lookup(uuid, text, text, integer)
  TO authenticated;

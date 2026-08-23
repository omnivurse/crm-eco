-- ============================================================================
-- crm_field_distinct_values(p_module_id uuid, p_key text, p_limit int)
-- ----------------------------------------------------------------------------
-- Road to Ten DE-2 (server half): org-scoped "distinct values + counts" for ONE
-- JSONB key (crm_records.data->>p_key) of ONE module, feeding free-text
-- suggestions such as Health Insurance Plan on the Quick Create drawer.
--
-- Why SECURITY INVOKER: the GROUP BY runs under the CALLER's crm_records RLS
-- (CRM members → their org; advisors → downline-only; super admins → all), so
-- nothing is ever counted that the caller could not list. No org argument is
-- needed — the module id belongs to exactly one org and RLS does the rest
-- (an other-org module id simply yields zero rows).
--
-- Guards:
--   * p_key must match ^[a-z0-9_]{1,64}$ (the crm_fields.key shape); anything
--     else raises invalid_parameter_value — the key is never interpolated.
--   * p_limit is clamped to 1..200 (default 25).
--   * soft-deleted rows (deleted_at IS NOT NULL) and blank/NULL values are
--     skipped; stored spellings come back exactly as stored (nothing rewritten).
--   * EXECUTE is revoked from PUBLIC and anon; granted to authenticated and
--     service_role only.
--
-- Additive, idempotent (CREATE OR REPLACE). No data is touched.
--
-- ROLLBACK (rehearsed locally in a rolled-back transaction):
--   DROP FUNCTION IF EXISTS public.crm_field_distinct_values(uuid, text, integer);
-- ============================================================================

SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.crm_field_distinct_values(
  p_module_id uuid,
  p_key text,
  p_limit integer DEFAULT 25
)
RETURNS TABLE(value text, count bigint)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 200));
BEGIN
  IF p_module_id IS NULL THEN
    RAISE EXCEPTION 'p_module_id is required' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_key IS NULL OR p_key !~ '^[a-z0-9_]{1,64}$' THEN
    RAISE EXCEPTION 'p_key must match ^[a-z0-9_]{1,64}$' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN QUERY
    SELECT r.data ->> p_key AS v,
           count(*)::bigint  AS n
    FROM public.crm_records AS r
    WHERE r.module_id = p_module_id
      AND r.deleted_at IS NULL
      AND nullif(btrim(r.data ->> p_key), '') IS NOT NULL
    GROUP BY 1
    ORDER BY 2 DESC, 1 ASC
    LIMIT v_limit;
END;
$$;

COMMENT ON FUNCTION public.crm_field_distinct_values(uuid, text, integer) IS
  'Distinct crm_records.data->>p_key values with counts for one module, under the caller''s RLS (SECURITY INVOKER). Feeds free-text field suggestions (DE-2).';

REVOKE EXECUTE ON FUNCTION public.crm_field_distinct_values(uuid, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.crm_field_distinct_values(uuid, text, integer) FROM anon;
GRANT  EXECUTE ON FUNCTION public.crm_field_distinct_values(uuid, text, integer) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.crm_field_distinct_values(uuid, text, integer) TO service_role;

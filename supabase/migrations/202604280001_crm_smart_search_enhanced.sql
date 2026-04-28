-- =============================================================================
-- crm_smart_search v2: stronger matching for email, phone, JSON fields, ilike
--
-- Adds:
--   • Phone: digit-normalized LIKE + trigram on `phone` column
--   • Email / arbitrary JSON: substring ILIKE on `data::text` + `email` (escaped)
--   • Extra fuzzy targets: preferred_name, contact_name, account_name, company,
--     data->phone (digits)
--   • Substring hits merged with FTS + fuzzy (deduped by id, best rank wins)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_crm_records_phone_trgm
  ON public.crm_records USING gin (phone gin_trgm_ops);

DROP FUNCTION IF EXISTS public.crm_smart_search(uuid, text, text, integer, real);

CREATE OR REPLACE FUNCTION public.crm_smart_search(
  p_org_id uuid,
  p_query text,
  p_module_key text DEFAULT NULL,
  p_limit integer DEFAULT 25,
  p_similarity_threshold real DEFAULT 0.25
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
DECLARE
  v_query     text := btrim(coalesce(p_query, ''));
  v_clean     text;
  v_words     text[];
  v_tsquery   text;
  v_digits    text;
  v_esc       text;
  v_ilike_pat text;
BEGIN
  IF length(v_query) = 0 THEN
    RETURN;
  END IF;

  v_clean := lower(regexp_replace(v_query, '[^a-z0-9 ]', ' ', 'gi'));
  v_words := regexp_split_to_array(btrim(v_clean), '\s+');

  SELECT string_agg(w || ':*', ' & ')
    INTO v_tsquery
    FROM unnest(v_words) AS w
   WHERE length(w) >= 2;

  v_digits := regexp_replace(v_query, '\D', '', 'g');
  -- Escape ILIKE metacharacters in user input
  v_esc := replace(replace(replace(v_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');
  v_ilike_pat := '%' || v_esc || '%';

  RETURN QUERY
  WITH fts_hits AS (
    SELECT
      r.id,
      ts_rank(r.search, to_tsquery('english', v_tsquery)) + 1.0::real AS rank,
      'exact'::text AS match_type
    FROM public.crm_records r
    WHERE r.org_id = p_org_id
      AND v_tsquery IS NOT NULL
      AND r.search @@ to_tsquery('english', v_tsquery)
  ),
  fuzzy_hits AS (
    SELECT
      r.id,
      GREATEST(
        similarity(coalesce(r.title, ''), v_query),
        similarity(coalesce(r.email, ''), v_query),
        similarity(coalesce(r.phone, ''), v_query),
        CASE
          WHEN length(v_digits) >= 4 THEN
            similarity(
              regexp_replace(coalesce(r.phone, ''), '\D', '', 'g'),
              v_digits
            )
          ELSE 0::real
        END,
        CASE
          WHEN length(v_digits) >= 4 THEN
            similarity(
              regexp_replace(coalesce(r.data->>'phone', ''), '\D', '', 'g'),
              v_digits
            )
          ELSE 0::real
        END,
        similarity(
          coalesce(r.data->>'first_name', '') || ' ' ||
          coalesce(r.data->>'last_name', ''),
          v_query
        ),
        similarity(coalesce(r.data->>'last_name', ''), v_query),
        similarity(coalesce(r.data->>'first_name', ''), v_query),
        similarity(coalesce(r.data->>'preferred_name', ''), v_query),
        similarity(coalesce(r.data->>'contact_name', ''), v_query),
        similarity(coalesce(r.data->>'account_name', ''), v_query),
        similarity(coalesce(r.data->>'company', ''), v_query)
      )::real AS rank,
      'fuzzy'::text AS match_type
    FROM public.crm_records r
    WHERE r.org_id = p_org_id
      AND (
        r.title % v_query
        OR r.email % v_query
        OR r.phone % v_query
        OR (
          coalesce(r.data->>'first_name', '') || ' ' ||
          coalesce(r.data->>'last_name', '')
        ) % v_query
        OR coalesce(r.data->>'preferred_name', '') % v_query
        OR coalesce(r.data->>'contact_name', '') % v_query
        OR coalesce(r.data->>'account_name', '') % v_query
        OR coalesce(r.data->>'company', '') % v_query
        OR (
          length(v_digits) >= 4
          AND regexp_replace(coalesce(r.phone, ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
        )
        OR (
          length(v_digits) >= 4
          AND regexp_replace(coalesce(r.data->>'phone', ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
        )
      )
  ),
  -- Substring / partial email & broad JSON value match (slower; gated by min length)
  substr_hits AS (
    SELECT
      r.id,
      0.62::real AS rank,
      'exact'::text AS match_type
    FROM public.crm_records r
    WHERE r.org_id = p_org_id
      AND length(v_query) >= 2
      AND (
        coalesce(r.email, '') ILIKE v_ilike_pat
        OR coalesce(r.phone, '') ILIKE v_ilike_pat
        OR (
          length(v_query) >= 3
          AND r.data::text ILIKE v_ilike_pat
        )
      )
  ),
  combined AS (
    SELECT
      h.id,
      MAX(h.rank) AS rank,
      CASE
        WHEN bool_or(h.match_type = 'exact') THEN 'exact'
        ELSE 'fuzzy'
      END AS match_type
    FROM (
      SELECT * FROM fts_hits
      UNION ALL
      SELECT * FROM fuzzy_hits WHERE rank >= p_similarity_threshold
      UNION ALL
      SELECT * FROM substr_hits
    ) h
    GROUP BY h.id
  )
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
    c.match_type,
    c.rank
  FROM combined c
  JOIN public.crm_records r ON r.id = c.id
  JOIN public.crm_modules m ON m.id = r.module_id
  WHERE (p_module_key IS NULL OR m.key = p_module_key)
  ORDER BY c.rank DESC, r.updated_at DESC NULLS LAST
  LIMIT GREATEST(p_limit, 1);
END;
$$;

COMMENT ON FUNCTION public.crm_smart_search IS
  'Hybrid CRM record search: FTS on `search`, pg_trgm fuzzy on names/email/phone, '
  'digit phone match on column + data->phone, substring ILIKE on email/phone/data JSON.';

GRANT EXECUTE ON FUNCTION public.crm_smart_search(uuid, text, text, integer, real)
  TO authenticated;

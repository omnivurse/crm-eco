-- =============================================================================
-- crm_smart_search v3 — "super smart" recall + ranking
--
-- Adds on top of v2:
--   • OR-token FTS when multiple words (any token can match) — fixes "Acme John"
--     style queries that AND would miss.
--   • pg_trgm word_similarity on a compact "blob" (title, email, phone, key data)
--     — better than plain similarity for finding a short query inside a long field.
--   • Exact / strong email & title boosts (rank ≫ fuzzy) so the right row surfaces first.
--   • Default similarity threshold 0.18 (API can still override).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

DROP FUNCTION IF EXISTS public.crm_smart_search(uuid, text, text, integer, real);

CREATE OR REPLACE FUNCTION public.crm_smart_search(
  p_org_id uuid,
  p_query text,
  p_module_key text DEFAULT NULL,
  p_limit integer DEFAULT 25,
  p_similarity_threshold real DEFAULT 0.18
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
  v_query        text := btrim(coalesce(p_query, ''));
  v_query_lower  text;
  v_clean        text;
  v_words        text[];
  v_tsquery_and  text;
  v_tsquery_or   text;
  v_digits       text;
  v_esc          text;
  v_ilike_pat    text;
  v_word_len     int;
  v_thr          real := LEAST(GREATEST(p_similarity_threshold, 0.05::real), 0.9::real);
BEGIN
  IF length(v_query) = 0 THEN
    RETURN;
  END IF;

  v_query_lower := lower(v_query);
  v_clean := lower(regexp_replace(v_query, '[^a-z0-9 ]', ' ', 'gi'));
  v_words := regexp_split_to_array(btrim(v_clean), '\s+');
  v_word_len := cardinality(v_words);

  SELECT string_agg(w || ':*', ' & ')
    INTO v_tsquery_and
    FROM unnest(v_words) AS w
   WHERE length(w) >= 2;

  -- Multi-token OR: any substantial word can match (higher recall).
  SELECT string_agg(w || ':*', ' | ')
    INTO v_tsquery_or
    FROM unnest(v_words) AS w
   WHERE length(w) >= 2;

  v_digits := regexp_replace(v_query, '\D', '', 'g');
  v_esc := replace(replace(replace(v_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');
  v_ilike_pat := '%' || v_esc || '%';

  RETURN QUERY
  WITH
  -- Strongest: whole-field equality / containment for email & title
  exact_hits AS (
    SELECT
      r.id,
      CASE
        WHEN lower(trim(coalesce(r.email, ''))) = v_query_lower THEN 2.85::real
        WHEN lower(trim(coalesce(r.title, ''))) = v_query_lower THEN 2.55::real
        WHEN strpos(v_query_lower, '@') > 0
          AND lower(coalesce(r.email, '')) LIKE '%' || v_query_lower || '%' THEN 2.35::real
      END AS rank,
      'exact'::text AS match_type
    FROM public.crm_records r
    WHERE r.org_id = p_org_id
      AND (
        lower(trim(coalesce(r.email, ''))) = v_query_lower
        OR lower(trim(coalesce(r.title, ''))) = v_query_lower
        OR (
          strpos(v_query_lower, '@') > 0
          AND lower(coalesce(r.email, '')) LIKE '%' || v_query_lower || '%'
        )
      )
  ),
  fts_and_hits AS (
    SELECT
      r.id,
      ts_rank_cd(r.search, to_tsquery('english', v_tsquery_and)) + 1.05::real AS rank,
      'exact'::text AS match_type
    FROM public.crm_records r
    WHERE r.org_id = p_org_id
      AND v_tsquery_and IS NOT NULL
      AND r.search @@ to_tsquery('english', v_tsquery_and)
  ),
  -- Softer recall when user typed several tokens; any can match.
  fts_or_hits AS (
    SELECT
      r.id,
      ts_rank_cd(r.search, to_tsquery('english', v_tsquery_or)) * 0.55::real + 0.72::real AS rank,
      'fuzzy'::text AS match_type
    FROM public.crm_records r
    WHERE r.org_id = p_org_id
      AND v_tsquery_or IS NOT NULL
      AND v_word_len > 1
      AND r.search @@ to_tsquery('english', v_tsquery_or)
      AND NOT (v_tsquery_and IS NOT NULL AND r.search @@ to_tsquery('english', v_tsquery_and))
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
  -- Short query inside long haystack (e.g. unique last name, company fragment).
  word_hits AS (
    SELECT
      r.id,
      GREATEST(
        word_similarity(
          v_query,
          trim(
            coalesce(r.title, '') || ' ' ||
            coalesce(r.email, '') || ' ' ||
            coalesce(r.phone, '') || ' ' ||
            coalesce(r.data->>'first_name', '') || ' ' ||
            coalesce(r.data->>'last_name', '') || ' ' ||
            coalesce(r.data->>'preferred_name', '') || ' ' ||
            coalesce(r.data->>'contact_name', '') || ' ' ||
            coalesce(r.data->>'account_name', '') || ' ' ||
            coalesce(r.data->>'company', '')
          )
        ),
        word_similarity(
          trim(
            coalesce(r.title, '') || ' ' ||
            coalesce(r.email, '') || ' ' ||
            coalesce(r.phone, '') || ' ' ||
            coalesce(r.data->>'first_name', '') || ' ' ||
            coalesce(r.data->>'last_name', '') || ' ' ||
            coalesce(r.data->>'preferred_name', '') || ' ' ||
            coalesce(r.data->>'contact_name', '') || ' ' ||
            coalesce(r.data->>'account_name', '') || ' ' ||
            coalesce(r.data->>'company', '')
          ),
          v_query
        )
      )::real AS rank,
      'fuzzy'::text AS match_type
    FROM public.crm_records r
    WHERE r.org_id = p_org_id
      AND length(v_query) >= 2
      AND (
        word_similarity(
          v_query,
          trim(
            coalesce(r.title, '') || ' ' ||
            coalesce(r.email, '') || ' ' ||
            coalesce(r.phone, '') || ' ' ||
            coalesce(r.data->>'first_name', '') || ' ' ||
            coalesce(r.data->>'last_name', '') || ' ' ||
            coalesce(r.data->>'preferred_name', '') || ' ' ||
            coalesce(r.data->>'contact_name', '') || ' ' ||
            coalesce(r.data->>'account_name', '') || ' ' ||
            coalesce(r.data->>'company', '')
          )
        ) >= v_thr
        OR word_similarity(
          trim(
            coalesce(r.title, '') || ' ' ||
            coalesce(r.email, '') || ' ' ||
            coalesce(r.phone, '') || ' ' ||
            coalesce(r.data->>'first_name', '') || ' ' ||
            coalesce(r.data->>'last_name', '') || ' ' ||
            coalesce(r.data->>'preferred_name', '') || ' ' ||
            coalesce(r.data->>'contact_name', '') || ' ' ||
            coalesce(r.data->>'account_name', '') || ' ' ||
            coalesce(r.data->>'company', '')
          ),
          v_query
        ) >= v_thr
      )
  ),
  substr_hits AS (
    SELECT
      r.id,
      0.62::real AS rank,
      'exact'::text AS match_type
    FROM public.crm_records r
    WHERE r.org_id = p_org_id
      AND length(v_query) >= 2
      AND (
        coalesce(r.title, '') ILIKE v_ilike_pat
        OR coalesce(r.email, '') ILIKE v_ilike_pat
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
      SELECT * FROM exact_hits
      UNION ALL
      SELECT * FROM fts_and_hits
      UNION ALL
      SELECT * FROM fts_or_hits
      UNION ALL
      SELECT * FROM fuzzy_hits WHERE rank >= v_thr
      UNION ALL
      SELECT * FROM word_hits WHERE rank >= v_thr
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
  'CRM smart search v3: exact email/title boosts, AND/OR FTS, trigram fuzzy, '
  'word_similarity on haystack, phone digits, JSON ilike. Default threshold 0.18.';

GRANT EXECUTE ON FUNCTION public.crm_smart_search(uuid, text, text, integer, real)
  TO authenticated;

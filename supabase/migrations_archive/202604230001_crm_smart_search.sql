-- =============================================================================
-- crm_smart_search: Zoho-style typo-tolerant search across crm_records
--
-- Combines Postgres full-text search (prefix tsquery) with pg_trgm similarity
-- so that minor misspellings ("Bollman" -> "Bollmann"), missing characters,
-- and transpositions still surface the correct record.
--
-- Strategy
-- --------
-- 1. FTS prefix match on the existing `search` tsvector column. Cheap and
--    exact; ranks via ts_rank.
-- 2. Trigram similarity on title / email / first+last name. Catches typos
--    that FTS misses. Uses the % operator (driven by pg_trgm.similarity_threshold)
--    and the GIN trigram indexes created below for performance.
-- 3. Union the two candidate sets, keep the best score per record, and order
--    exact matches above fuzzy matches by giving FTS hits a +1.0 boost.
--
-- Security
-- --------
-- SECURITY INVOKER + an explicit p_org_id filter. The caller must already
-- be authenticated; RLS on crm_records / crm_modules is still enforced.
-- =============================================================================

-- pg_trgm is already enabled (see 202601310003_enterprise_grade_hardening.sql)
-- but make this migration idempotent if run on a fresh database.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- -----------------------------------------------------------------------------
-- Trigram indexes for fast similarity scans.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_crm_records_title_trgm
  ON public.crm_records USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_crm_records_email_trgm
  ON public.crm_records USING gin (email gin_trgm_ops);

-- Composite first_name + last_name trigram index via expression.
CREATE INDEX IF NOT EXISTS idx_crm_records_fullname_trgm
  ON public.crm_records USING gin (
    (
      coalesce(data->>'first_name', '') || ' ' ||
      coalesce(data->>'last_name', '')
    ) gin_trgm_ops
  );

-- -----------------------------------------------------------------------------
-- crm_smart_search RPC
-- -----------------------------------------------------------------------------
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
BEGIN
  IF length(v_query) = 0 THEN
    RETURN;
  END IF;

  -- Build a prefix tsquery from the cleaned, alpha-numeric tokens.
  -- e.g. "Sara Bollman" -> "sara:* & bollman:*"
  -- This catches the common case where the user typed less than the full name.
  v_clean := lower(regexp_replace(v_query, '[^a-z0-9 ]', ' ', 'gi'));
  v_words := regexp_split_to_array(btrim(v_clean), '\s+');

  SELECT string_agg(w || ':*', ' & ')
    INTO v_tsquery
    FROM unnest(v_words) AS w
   WHERE length(w) >= 2;

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
        similarity(
          coalesce(r.data->>'first_name', '') || ' ' ||
          coalesce(r.data->>'last_name', ''),
          v_query
        ),
        similarity(coalesce(r.data->>'last_name', ''),  v_query),
        similarity(coalesce(r.data->>'first_name', ''), v_query)
      )::real AS rank,
      'fuzzy'::text AS match_type
    FROM public.crm_records r
    WHERE r.org_id = p_org_id
      AND (
        r.title % v_query
        OR r.email % v_query
        OR (
          coalesce(r.data->>'first_name', '') || ' ' ||
          coalesce(r.data->>'last_name', '')
        ) % v_query
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
  'Hybrid search across crm_records: FTS prefix + pg_trgm fuzzy similarity. '
  'Returns ranked records (exact matches boosted above fuzzy). '
  'p_similarity_threshold defaults to 0.25 (lower = more permissive).';

GRANT EXECUTE ON FUNCTION public.crm_smart_search(uuid, text, text, integer, real)
  TO authenticated;

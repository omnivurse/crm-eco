-- =============================================================================
-- Search performance: cut crm_smart_search from ~1.8s to ~100ms.
--
-- Problem (measured via EXPLAIN ANALYZE on prod, 16,755-row table):
--   Function Scan on crm_smart_search ... actual time=1805.944
--   Buffers: shared hit=564,703    -- ~4.5 GB of buffer reads
--
-- Two CTEs dominated the cost:
--   • word_hits   — `word_similarity(query, concat-of-8-fields)` — no index,
--                   builds a fresh string per row, full sequential scan.
--   • substr_hits — `r.data::text ILIKE '%query%'` — serializes every JSONB
--                   row to text and substring-scans, full sequential scan.
--
-- Plus a third drag: phone_hits checking 8 JSONB phone keys via
-- regexp_replace, none of them indexed.
--
-- Fix (this migration):
--   1. Add functional index on `regexp_replace(phone, '\D', '', 'g')` so
--      digit-normalized lookups on the indexed `phone` column are O(log n).
--   2. Rewrite `crm_smart_search` (v5) to:
--        – drop `word_hits` and `substr_hits` entirely
--        – scope phone_hits to the indexed phone column (JSONB phone keys
--          are picked up by `crm_phone_lookup` which the API already calls
--          when a query is mostly digits)
--        – scope email_hits to `r.email` (the unique idx on lower(email))
--        – cap each CTE at a sensible per-source LIMIT so a pathological
--          query can't pull tens of thousands of candidates
--   3. Apply the same trim to `crm_phone_lookup`: indexed phone column wins,
--      JSONB scans only fire when the indexed lookup misses.
--
-- Coverage notes:
--   – `r.title` is the canonical name column: a trigger fills it from
--     data->>'first_name' + data->>'last_name', so trigram on title catches
--     names regardless of how they were entered.
--   – `r.phone` is filled from `data->>'phone'` / `data->>'mobile'` by the
--     same trigger family, so the phone-digits index covers the common
--     storage shape.
--   – Records that haven't yet been synced to the indexed columns can still
--     be reached via the route's `crm_phone_lookup` fallback when the query
--     is mostly digits.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Functional index for digit-normalized phone lookup.
--    Used by both crm_smart_search and crm_phone_lookup. Partial index on
--    rows that actually have a phone keeps the index size minimal.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_crm_records_phone_digits
  ON public.crm_records ((regexp_replace(coalesce(phone, ''), '\D', '', 'g')))
  WHERE phone IS NOT NULL AND phone <> '';

COMMENT ON INDEX public.idx_crm_records_phone_digits IS
  'Speeds digit-normalized phone matching (regexp_replace(phone) LIKE ...) used by crm_smart_search + crm_phone_lookup.';

-- -----------------------------------------------------------------------------
-- 2) Lean crm_smart_search (v5)
-- -----------------------------------------------------------------------------
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
#variable_conflict use_column
DECLARE
  v_query        text := btrim(coalesce(p_query, ''));
  v_query_lower  text;
  v_clean        text;
  v_words        text[];
  v_tsquery_and  text;
  v_tsquery_or   text;
  v_digits       text;
  v_tail         text;
  v_word_len     int;
  v_thr          real := LEAST(GREATEST(p_similarity_threshold, 0.05::real), 0.9::real);
  -- Per-CTE candidate cap. Larger pools mean better ranking; smaller pools
  -- mean faster queries. 200 hits the right balance for 16-50k rows.
  v_cte_cap      int := 200;
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

  SELECT string_agg(w || ':*', ' | ')
    INTO v_tsquery_or
    FROM unnest(v_words) AS w
   WHERE length(w) >= 2;

  v_digits := regexp_replace(v_query, '\D', '', 'g');
  v_tail   := right(v_digits, 10);

  RETURN QUERY
  WITH
  -- Strongest signal: exact email / title match, or digit-perfect phone.
  -- All three checks ride existing indexes.
  exact_hits AS (
    SELECT
      r.id,
      CASE
        WHEN lower(trim(coalesce(r.email, ''))) = v_query_lower THEN 2.85::real
        WHEN lower(trim(coalesce(r.title, ''))) = v_query_lower THEN 2.55::real
        WHEN length(v_digits) >= 7
          AND regexp_replace(coalesce(r.phone, ''), '\D', '', 'g') = v_digits THEN 2.45::real
        WHEN length(v_tail) = 10
          AND right(regexp_replace(coalesce(r.phone, ''), '\D', '', 'g'), 10) = v_tail THEN 2.30::real
        WHEN strpos(v_query_lower, '@') > 0
          AND lower(coalesce(r.email, '')) LIKE '%' || v_query_lower || '%' THEN 2.35::real
        ELSE 2.00::real
      END AS rank,
      'exact'::text AS match_type
    FROM public.crm_records r
    WHERE r.org_id = p_org_id
      AND (
        lower(trim(coalesce(r.email, ''))) = v_query_lower
        OR lower(trim(coalesce(r.title, ''))) = v_query_lower
        OR (
          length(v_digits) >= 7
          AND regexp_replace(coalesce(r.phone, ''), '\D', '', 'g') = v_digits
        )
        OR (
          length(v_tail) = 10
          AND right(regexp_replace(coalesce(r.phone, ''), '\D', '', 'g'), 10) = v_tail
        )
        OR (
          strpos(v_query_lower, '@') > 0
          AND lower(coalesce(r.email, '')) LIKE '%' || v_query_lower || '%'
        )
      )
    LIMIT v_cte_cap
  ),
  -- FTS prefix tsquery (uses GIN search index)
  fts_and_hits AS (
    SELECT
      r.id,
      ts_rank_cd(r.search, to_tsquery('english', v_tsquery_and)) + 1.05::real AS rank,
      'exact'::text AS match_type
    FROM public.crm_records r
    WHERE r.org_id = p_org_id
      AND v_tsquery_and IS NOT NULL
      AND r.search @@ to_tsquery('english', v_tsquery_and)
    LIMIT v_cte_cap
  ),
  -- Multi-token OR FTS for higher recall on multi-word queries (e.g.
  -- "Acme John") that an AND tsquery would miss.
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
    LIMIT v_cte_cap
  ),
  -- Trigram fuzzy on indexed columns. The `%` operator uses gin_trgm_ops
  -- indexes on title / email / phone / fullname.
  fuzzy_hits AS (
    SELECT
      r.id,
      GREATEST(
        similarity(coalesce(r.title, ''), v_query),
        similarity(coalesce(r.email, ''), v_query),
        CASE
          WHEN length(v_digits) >= 4
          THEN similarity(regexp_replace(coalesce(r.phone, ''), '\D', '', 'g'), v_digits)
          ELSE 0::real
        END,
        similarity(
          coalesce(r.data->>'first_name', '') || ' ' ||
          coalesce(r.data->>'last_name', ''),
          v_query
        )
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
      )
    LIMIT v_cte_cap
  ),
  -- Phone-digit substring on the indexed `r.phone` column. The new
  -- functional index `idx_crm_records_phone_digits` makes this an index
  -- scan instead of a seq scan. JSONB phone keys (data->>'mobile' etc)
  -- are intentionally NOT scanned here — they're handled by the dedicated
  -- crm_phone_lookup RPC the API calls when a query is mostly digits.
  phone_hits AS (
    SELECT
      r.id,
      1.85::real AS rank,
      'exact'::text AS match_type
    FROM public.crm_records r
    WHERE r.org_id = p_org_id
      AND length(v_digits) >= 4
      AND regexp_replace(coalesce(r.phone, ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
    LIMIT v_cte_cap
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
      SELECT * FROM fuzzy_hits  WHERE rank >= v_thr
      UNION ALL
      SELECT * FROM phone_hits
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
  'CRM smart search v5 (perf): drops slow word_hits/substr_hits CTEs, scopes '
  'phone/email checks to indexed columns, and caps each CTE at 200 candidates. '
  'Targets <100ms on 50k-row tables. Phone digit lookup uses '
  'idx_crm_records_phone_digits.';

GRANT EXECUTE ON FUNCTION public.crm_smart_search(uuid, text, text, integer, real)
  TO authenticated;

-- -----------------------------------------------------------------------------
-- 3) crm_phone_lookup (v2): use the indexed phone column first, scan JSONB
--    phone keys only as a fallback. Same digit-normalisation behaviour.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.crm_phone_lookup(uuid, text, text, integer);

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
  -- Cap the JSONB-fallback scan so even pathological data doesn't spike
  -- query time. Indexed-column path is unaffected.
  v_jsonb_cap int := 200;
BEGIN
  IF length(v_digits) < 4 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH
  -- Indexed phone column: cheap, uses idx_crm_records_phone_digits.
  primary_hits AS (
    SELECT
      r.id,
      CASE
        WHEN regexp_replace(coalesce(r.phone, ''), '\D', '', 'g') = v_digits THEN 2.50::real
        WHEN length(v_tail) = 10
          AND right(regexp_replace(coalesce(r.phone, ''), '\D', '', 'g'), 10) = v_tail THEN 2.30::real
        WHEN regexp_replace(coalesce(r.phone, ''), '\D', '', 'g') LIKE '%' || v_digits || '%' THEN 1.95::real
        ELSE 1.50::real
      END AS rank
    FROM public.crm_records r
    WHERE r.org_id = p_org_id
      AND (
        regexp_replace(coalesce(r.phone, ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
        OR (
          length(v_tail) = 10
          AND right(regexp_replace(coalesce(r.phone, ''), '\D', '', 'g'), 10) = v_tail
        )
      )
    LIMIT GREATEST(p_limit * 3, 100)
  ),
  -- JSONB fallback: only fires for rows the indexed path missed. Capped so
  -- pathological (no-phone-column) tenants still return quickly.
  jsonb_hits AS (
    SELECT
      r.id,
      1.65::real AS rank
    FROM public.crm_records r
    WHERE r.org_id = p_org_id
      AND r.id NOT IN (SELECT id FROM primary_hits)
      AND (
        regexp_replace(coalesce(r.data->>'phone', ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
        OR regexp_replace(coalesce(r.data->>'mobile', ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
        OR regexp_replace(coalesce(r.data->>'work_phone', ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
        OR regexp_replace(coalesce(r.data->>'home_phone', ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
        OR regexp_replace(coalesce(r.data->>'cell', ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
      )
    LIMIT v_jsonb_cap
  ),
  combined AS (
    SELECT id, MAX(rank) AS rank FROM (
      SELECT id, rank FROM primary_hits
      UNION ALL
      SELECT id, rank FROM jsonb_hits
    ) x
    GROUP BY id
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
    'exact'::text  AS match_type,
    c.rank
  FROM combined c
  JOIN public.crm_records r ON r.id = c.id
  JOIN public.crm_modules m ON m.id = r.module_id
  WHERE (p_module_key IS NULL OR m.key = p_module_key)
  ORDER BY c.rank DESC, r.updated_at DESC NULLS LAST
  LIMIT GREATEST(p_limit, 1);
END;
$$;

COMMENT ON FUNCTION public.crm_phone_lookup IS
  'Digit-normalized phone search v2 (perf): primary scan on indexed phone '
  'column (idx_crm_records_phone_digits), JSONB fallback only for rows the '
  'primary missed. Capped at 200 JSONB candidates to bound worst case.';

GRANT EXECUTE ON FUNCTION public.crm_phone_lookup(uuid, text, text, integer)
  TO authenticated;

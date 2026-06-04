-- =============================================================================
-- Make crm_smart_search ordering deterministic.
--
-- Bug: searching for "Johnson" returned different sets of 25 records
-- between calls — "Jake Johnson" was sometimes in the results, sometimes
-- not. Root cause:
--
--   • The PIFH realignment migration (202605020001) bulk-updated 16,755
--     rows at the same instant. Every record's `updated_at` is now
--     identical down to the microsecond.
--   • Searching a common token like "johnson" matches 104 records via FTS,
--     all tied on ts_rank. The function ordered by
--     `c.rank DESC, r.updated_at DESC NULLS LAST` — but with all 104
--     `updated_at` values equal, the secondary tiebreak collapses to
--     "whatever the planner returns first."
--   • The hash-based GROUP BY in the `combined` CTE has no inherent
--     order; planner choice (parallel scan, hash spill, etc.) varies the
--     emit order between calls.
--
-- Result: which 25 of the 104 Johnsons made it past LIMIT 25 was
-- effectively random. Jake Johnson was found one second, missing the
-- next.
--
-- Fix: append `r.id` as a final deterministic tiebreaker. Same query →
-- same 25 records every time. Function logic otherwise unchanged.
-- =============================================================================

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
  -- Deterministic ordering: rank desc, then updated_at desc, then id as a
  -- final tiebreaker so the same query always returns the same N records.
  -- Without the `r.id` term the same query was returning different 25-row
  -- subsets of common-name buckets (e.g. all 104 PIFH "Johnson" records
  -- share an `updated_at` from the org realignment migration), which made
  -- "Jake Johnson" appear and disappear between keystrokes.
  ORDER BY c.rank DESC, r.updated_at DESC NULLS LAST, r.id
  LIMIT GREATEST(p_limit, 1);
END;
$$;

COMMENT ON FUNCTION public.crm_smart_search IS
  'CRM smart search v6 (deterministic): same indexes/CTEs as v5 plus a '
  'final ORDER BY tiebreaker on r.id so common-name searches return the '
  'same set of N records every time.';

GRANT EXECUTE ON FUNCTION public.crm_smart_search(uuid, text, text, integer, real)
  TO authenticated;

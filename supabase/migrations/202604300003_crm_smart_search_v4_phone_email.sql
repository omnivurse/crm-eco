-- =============================================================================
-- crm_smart_search v4 — robust phone & email matching
--
-- Builds on v3 (`202604290001_crm_smart_search_v3_super.sql`) by:
--   • Normalizing every common JSONB phone-like key (`mobile`, `work_phone`,
--     `home_phone`, `cell`, `mobile_phone`, `phone_number`, `cell_phone`)
--     before comparison. Real-world data has stored phones with parens,
--     dashes, dots, country prefixes, leading 1s — `regexp_replace(\D)` makes
--     all of those equivalent at search time.
--   • Adding a digit-suffix match (last 10 digits) so `8005558888` finds
--     `+1 (800) 555-8888` even though the leading `1` differs.
--   • Adding a dedicated `crm_phone_lookup` RPC that the API can call
--     directly when it has detected a phone-style query. Cheaper than the
--     full smart_search and easier to fall back to when the FTS column is
--     missing on a fresh DB.
--
-- All RPCs are SECURITY INVOKER; RLS still enforces org access.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- -----------------------------------------------------------------------------
-- crm_smart_search v4
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
DECLARE
  v_query        text := btrim(coalesce(p_query, ''));
  v_query_lower  text;
  v_clean        text;
  v_words        text[];
  v_tsquery_and  text;
  v_tsquery_or   text;
  v_digits       text;
  v_tail         text;
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

  SELECT string_agg(w || ':*', ' | ')
    INTO v_tsquery_or
    FROM unnest(v_words) AS w
   WHERE length(w) >= 2;

  v_digits := regexp_replace(v_query, '\D', '', 'g');
  v_tail   := right(v_digits, 10);
  v_esc := replace(replace(replace(v_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');
  v_ilike_pat := '%' || v_esc || '%';

  RETURN QUERY
  WITH
  exact_hits AS (
    SELECT
      r.id,
      CASE
        WHEN lower(trim(coalesce(r.email, ''))) = v_query_lower THEN 2.85::real
        WHEN lower(trim(coalesce(r.title, ''))) = v_query_lower THEN 2.55::real
        WHEN strpos(v_query_lower, '@') > 0
          AND lower(coalesce(r.email, '')) LIKE '%' || v_query_lower || '%' THEN 2.35::real
        WHEN length(v_digits) >= 7
          AND regexp_replace(coalesce(r.phone, ''), '\D', '', 'g') = v_digits THEN 2.45::real
        WHEN length(v_tail) = 10
          AND right(regexp_replace(coalesce(r.phone, ''), '\D', '', 'g'), 10) = v_tail THEN 2.30::real
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
        OR (
          length(v_digits) >= 7
          AND regexp_replace(coalesce(r.phone, ''), '\D', '', 'g') = v_digits
        )
        OR (
          length(v_tail) = 10
          AND right(regexp_replace(coalesce(r.phone, ''), '\D', '', 'g'), 10) = v_tail
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
  -- Phone-digit hits across every common JSONB phone key. Indexed `r.phone`
  -- column is already covered by the regexp_replace LIKE above (and the
  -- exact-tail boost in exact_hits); this widens to alt fields people store
  -- the number under.
  phone_hits AS (
    SELECT
      r.id,
      CASE
        WHEN regexp_replace(coalesce(r.data->>'phone', ''), '\D', '', 'g') LIKE '%' || v_digits || '%' THEN 1.95::real
        WHEN regexp_replace(coalesce(r.data->>'mobile', ''), '\D', '', 'g') LIKE '%' || v_digits || '%' THEN 1.90::real
        WHEN regexp_replace(coalesce(r.data->>'work_phone', ''), '\D', '', 'g') LIKE '%' || v_digits || '%' THEN 1.80::real
        WHEN regexp_replace(coalesce(r.data->>'home_phone', ''), '\D', '', 'g') LIKE '%' || v_digits || '%' THEN 1.78::real
        WHEN regexp_replace(coalesce(r.data->>'cell', ''), '\D', '', 'g') LIKE '%' || v_digits || '%' THEN 1.78::real
        WHEN regexp_replace(coalesce(r.data->>'mobile_phone', ''), '\D', '', 'g') LIKE '%' || v_digits || '%' THEN 1.78::real
        WHEN regexp_replace(coalesce(r.data->>'cell_phone', ''), '\D', '', 'g') LIKE '%' || v_digits || '%' THEN 1.78::real
        WHEN regexp_replace(coalesce(r.data->>'phone_number', ''), '\D', '', 'g') LIKE '%' || v_digits || '%' THEN 1.78::real
        WHEN regexp_replace(coalesce(r.phone, ''), '\D', '', 'g') LIKE '%' || v_digits || '%' THEN 1.85::real
        ELSE 1.50::real
      END AS rank,
      'exact'::text AS match_type
    FROM public.crm_records r
    WHERE r.org_id = p_org_id
      AND length(v_digits) >= 4
      AND (
        regexp_replace(coalesce(r.phone, ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
        OR regexp_replace(coalesce(r.data->>'phone', ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
        OR regexp_replace(coalesce(r.data->>'mobile', ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
        OR regexp_replace(coalesce(r.data->>'work_phone', ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
        OR regexp_replace(coalesce(r.data->>'home_phone', ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
        OR regexp_replace(coalesce(r.data->>'cell', ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
        OR regexp_replace(coalesce(r.data->>'mobile_phone', ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
        OR regexp_replace(coalesce(r.data->>'cell_phone', ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
        OR regexp_replace(coalesce(r.data->>'phone_number', ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
      )
  ),
  -- Email hits — exact, partial, plus any `*_email` JSONB fallback.
  email_hits AS (
    SELECT
      r.id,
      CASE
        WHEN lower(coalesce(r.data->>'work_email', '')) = v_query_lower THEN 2.40::real
        WHEN lower(coalesce(r.data->>'personal_email', '')) = v_query_lower THEN 2.40::real
        WHEN lower(coalesce(r.data->>'secondary_email', '')) = v_query_lower THEN 2.35::real
        WHEN strpos(v_query_lower, '@') > 0
          AND (
            lower(coalesce(r.data->>'work_email', '')) LIKE '%' || v_query_lower || '%'
            OR lower(coalesce(r.data->>'personal_email', '')) LIKE '%' || v_query_lower || '%'
            OR lower(coalesce(r.data->>'secondary_email', '')) LIKE '%' || v_query_lower || '%'
          ) THEN 2.10::real
        ELSE 1.40::real
      END AS rank,
      'exact'::text AS match_type
    FROM public.crm_records r
    WHERE r.org_id = p_org_id
      AND length(v_query_lower) >= 3
      AND (
        lower(coalesce(r.data->>'work_email', '')) = v_query_lower
        OR lower(coalesce(r.data->>'personal_email', '')) = v_query_lower
        OR lower(coalesce(r.data->>'secondary_email', '')) = v_query_lower
        OR (
          strpos(v_query_lower, '@') > 0
          AND (
            lower(coalesce(r.data->>'work_email', '')) LIKE '%' || v_query_lower || '%'
            OR lower(coalesce(r.data->>'personal_email', '')) LIKE '%' || v_query_lower || '%'
            OR lower(coalesce(r.data->>'secondary_email', '')) LIKE '%' || v_query_lower || '%'
          )
        )
      )
  ),
  fuzzy_hits AS (
    SELECT
      r.id,
      GREATEST(
        similarity(coalesce(r.title, ''), v_query),
        similarity(coalesce(r.email, ''), v_query),
        CASE
          WHEN length(v_digits) >= 4 THEN
            similarity(
              regexp_replace(coalesce(r.phone, ''), '\D', '', 'g'),
              v_digits
            )
          ELSE 0::real
        END,
        similarity(
          coalesce(r.data->>'first_name', '') || ' ' ||
          coalesce(r.data->>'last_name', ''),
          v_query
        ),
        similarity(coalesce(r.data->>'last_name', ''),  v_query),
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
      )
  ),
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
      SELECT * FROM phone_hits
      UNION ALL
      SELECT * FROM email_hits
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
  'CRM smart search v4: digit-normalized phone + email matching across all '
  'common JSONB phone/email keys, plus FTS, trigram, word_similarity. '
  'Format-agnostic: 8005558888 finds (800) 555-8888, 1-800-555-8888, etc.';

GRANT EXECUTE ON FUNCTION public.crm_smart_search(uuid, text, text, integer, real)
  TO authenticated;

-- -----------------------------------------------------------------------------
-- crm_phone_lookup — dedicated digit-only RPC.
--
-- Used by `/api/crm/search` when the query is mostly digits, and as a fallback
-- when the full-fat smart_search is unavailable. Strips non-digits from both
-- sides and matches across every common JSONB phone key.
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
      -- exact full-number match (digits-only) on indexed column
      WHEN regexp_replace(coalesce(r.phone, ''), '\D', '', 'g') = v_digits THEN 2.50::real
      -- last-10-digit match (handles +1 prefix differences)
      WHEN length(v_tail) = 10
        AND right(regexp_replace(coalesce(r.phone, ''), '\D', '', 'g'), 10) = v_tail THEN 2.30::real
      -- substring (e.g. user typed area code + first 4)
      WHEN regexp_replace(coalesce(r.phone, ''), '\D', '', 'g') LIKE '%' || v_digits || '%' THEN 1.95::real
      -- JSONB fallbacks
      WHEN regexp_replace(coalesce(r.data->>'phone', ''), '\D', '', 'g') LIKE '%' || v_digits || '%' THEN 1.85::real
      WHEN regexp_replace(coalesce(r.data->>'mobile', ''), '\D', '', 'g') LIKE '%' || v_digits || '%' THEN 1.80::real
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
      OR regexp_replace(coalesce(r.data->>'phone', ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
      OR regexp_replace(coalesce(r.data->>'mobile', ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
      OR regexp_replace(coalesce(r.data->>'work_phone', ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
      OR regexp_replace(coalesce(r.data->>'home_phone', ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
      OR regexp_replace(coalesce(r.data->>'cell', ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
      OR regexp_replace(coalesce(r.data->>'mobile_phone', ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
      OR regexp_replace(coalesce(r.data->>'cell_phone', ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
      OR regexp_replace(coalesce(r.data->>'phone_number', ''), '\D', '', 'g') LIKE '%' || v_digits || '%'
    )
  ORDER BY rank DESC, r.updated_at DESC NULLS LAST
  LIMIT GREATEST(p_limit, 1);
END;
$$;

COMMENT ON FUNCTION public.crm_phone_lookup IS
  'Digit-normalized phone search across crm_records.phone and common JSONB '
  'phone keys. Format-agnostic: matches "(800) 555-8888", "1-800-555-8888", '
  '"+1 800 555 8888" given any digit subset including last-10-digits.';

GRANT EXECUTE ON FUNCTION public.crm_phone_lookup(uuid, text, text, integer)
  TO authenticated;

-- CRM search: widen the slim result payload so the API can attribute *which*
-- field matched (for colour-coded "matched field" chips in the ⌘K palette and
-- module spotlight).
--
-- Signature-preserving CREATE OR REPLACE of crm_smart_search / crm_phone_lookup:
-- the ONLY change is the `data` projection in the final SELECT. Every existing
-- key (first_name, last_name, is_converted, converted_contact_id, lead_status)
-- is preserved verbatim as `r.data->>'...'` text so `isConvertedLeadRow` and the
-- name fallback keep behaving exactly as before. We add a handful of commonly
-- searched keys (company/account, member id, status, phones, address, name
-- variants) so the API can tell the client the matched field precisely.
--
-- No RETURNS TABLE / argument change ⇒ CREATE OR REPLACE is valid and grants
-- are retained; the GRANTs below are re-affirmed defensively.

SET lock_timeout = '4s';

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
SET search_path = public, extensions
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
      0.72::real AS rank,
      'fuzzy'::text AS match_type
    FROM public.crm_records r
    WHERE r.org_id = p_org_id
      AND v_word_len > 1
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
    -- Slim, attribution-friendly payload. Existing keys unchanged; extra keys
    -- let the API name the matched field for colour-coded chips.
    jsonb_build_object(
      'first_name', r.data->>'first_name',
      'last_name', r.data->>'last_name',
      'middle_name', r.data->>'middle_name',
      'preferred_name', r.data->>'preferred_name',
      'company_name', r.data->>'company_name',
      'account_name', r.data->>'account_name',
      'member_number', r.data->>'member_number',
      'lead_status', r.data->>'lead_status',
      'contact_status', r.data->>'contact_status',
      'mobile', r.data->>'mobile',
      'work_phone', r.data->>'work_phone',
      'home_phone', r.data->>'home_phone',
      'city', r.data->>'city',
      'state', r.data->>'state',
      'is_converted', r.data->>'is_converted',
      'converted_contact_id', r.data->>'converted_contact_id'
    ) AS data,
    m.key          AS module_key,
    m.name         AS module_name,
    m.name_plural  AS module_name_plural,
    c.match_type,
    c.rank
  FROM combined c
  JOIN public.crm_records r ON r.id = c.id
  JOIN public.crm_modules m ON m.id = r.module_id
  WHERE (p_module_key IS NULL OR m.key = p_module_key)
  ORDER BY c.rank DESC, r.updated_at DESC NULLS LAST, r.id
  LIMIT GREATEST(p_limit, 1);
END;
$$;

COMMENT ON FUNCTION public.crm_smart_search IS
  'CRM smart search v6 (perf) + matched-field payload: same hybrid FTS/trigram/'
  'phone strategy and <100ms target as v6; widens the returned data payload with '
  'company/member/status/phone/address/name keys so the API can attribute which '
  'field matched. is_converted/converted_contact_id preserved as text.';

GRANT EXECUTE ON FUNCTION public.crm_smart_search(uuid, text, text, integer, real)
  TO authenticated;

-- -----------------------------------------------------------------------------
-- crm_phone_lookup: same widened payload.
-- -----------------------------------------------------------------------------
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
SET search_path = public, extensions
AS $$
#variable_conflict use_column
DECLARE
  v_digits text := regexp_replace(coalesce(p_query, ''), '\D', '', 'g');
  v_tail   text := right(v_digits, 10);
  v_jsonb_cap int := 200;
BEGIN
  IF length(v_digits) < 4 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH
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
    jsonb_build_object(
      'first_name', r.data->>'first_name',
      'last_name', r.data->>'last_name',
      'middle_name', r.data->>'middle_name',
      'preferred_name', r.data->>'preferred_name',
      'company_name', r.data->>'company_name',
      'account_name', r.data->>'account_name',
      'member_number', r.data->>'member_number',
      'lead_status', r.data->>'lead_status',
      'contact_status', r.data->>'contact_status',
      'mobile', r.data->>'mobile',
      'work_phone', r.data->>'work_phone',
      'home_phone', r.data->>'home_phone',
      'city', r.data->>'city',
      'state', r.data->>'state',
      'is_converted', r.data->>'is_converted',
      'converted_contact_id', r.data->>'converted_contact_id'
    ) AS data,
    m.key          AS module_key,
    m.name         AS module_name,
    m.name_plural  AS module_name_plural,
    'exact'::text  AS match_type,
    c.rank
  FROM combined c
  JOIN public.crm_records r ON r.id = c.id
  JOIN public.crm_modules m ON m.id = r.module_id
  WHERE (p_module_key IS NULL OR m.key = p_module_key)
  ORDER BY c.rank DESC, r.updated_at DESC NULLS LAST, r.id
  LIMIT GREATEST(p_limit, 1);
END;
$$;

COMMENT ON FUNCTION public.crm_phone_lookup IS
  'Digit-normalized phone search v2 (perf) + matched-field payload: indexed '
  'phone-column primary scan with JSONB fallback, now returning company/member/'
  'status/phone/address/name keys for matched-field attribution.';

GRANT EXECUTE ON FUNCTION public.crm_phone_lookup(uuid, text, text, integer)
  TO authenticated;

-- Push name+DOB import matching into SQL.
-- NOT applied by the authoring agent — rehearsed locally, then `supabase db push`.
--
-- Why: findByNameDobs paged EVERY record in the module that has a
-- date_of_birth and rebuilt the match key in JavaScript. On a large module
-- (members ~30k, contacts ~14k) that is tens of thousands of full JSONB blobs
-- pulled over the wire, inside a 60s function budget that also has to write.
-- It is the slowest tier and the most likely to time out, and a timeout there
-- fails the whole run.
--
-- The key is `lower(first)|lower(last)|YYYY-MM-DD`, built to match
-- nameDobKey()/normalizeDobForMatch() in apps/crm/src/lib/imports/csv-update.ts.
-- Matching stays FAIL-CLOSED: this returns EVERY candidate per key so the
-- orchestrator can still detect ambiguity and skip.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.crm_name_dob_lookup(uuid, uuid, text[]);
--   DROP INDEX IF EXISTS public.idx_crm_records_name_dob_key;
--   DROP FUNCTION IF EXISTS public.crm_name_dob_key(jsonb);

SET lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- Key builder — IMMUTABLE so it can back an expression index.
-- ---------------------------------------------------------------------------
-- MUST NEVER RAISE. This backs an expression index on crm_records, so an
-- exception here does not merely fail a lookup — it aborts the index build,
-- and once the index exists it rejects every INSERT/UPDATE touching an
-- offending row, on the busiest table in the product.
--
-- `to_date` is therefore NOT used: it raises on legacy values this dataset
-- demonstrably contains (a Zoho migration wave — `2/30/1985`, day/month
-- transpositions), and with an FM prefix it silently rolls sentinels like
-- `01/00/2000` to a real date, collapsing every sentinel record onto one
-- shared match key. Parts are validated arithmetically instead, mirroring
-- normalizeDateColumnValue()'s calendar checks in
-- apps/crm/src/lib/crm/merge-crm-data-json-to-row.ts.
CREATE OR REPLACE FUNCTION public.crm_name_dob_key(p_data jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  WITH raw AS (
    SELECT btrim(lower(coalesce(p_data ->> 'first_name', ''))) AS f,
           btrim(lower(coalesce(p_data ->> 'last_name', '')))  AS l,
           btrim(coalesce(p_data ->> 'date_of_birth', ''))     AS d
  ),
  parts AS (
    SELECT f, l, d,
      CASE
        WHEN d ~ '^\d{4}-\d{2}-\d{2}'      THEN substring(d from 1 for 4)::int
        WHEN d ~ '^\d{1,2}/\d{1,2}/\d{4}$' THEN split_part(d, '/', 3)::int
        -- 2-digit year: same Y2K pivot as normalizeDateColumnValue
        -- (0..29 -> 2000s, 30..99 -> 1900s). Without this, legacy rows
        -- stored as "6/1/26" would stop matching when the lookup moved
        -- from JavaScript into SQL.
        WHEN d ~ '^\d{1,2}/\d{1,2}/\d{2}$' THEN
          CASE WHEN split_part(d, '/', 3)::int <= 29
               THEN 2000 + split_part(d, '/', 3)::int
               ELSE 1900 + split_part(d, '/', 3)::int END
      END AS yy,
      CASE
        WHEN d ~ '^\d{4}-\d{2}-\d{2}'        THEN substring(d from 6 for 2)::int
        WHEN d ~ '^\d{1,2}/\d{1,2}/\d{2,4}$' THEN split_part(d, '/', 1)::int
      END AS mm,
      CASE
        WHEN d ~ '^\d{4}-\d{2}-\d{2}'        THEN substring(d from 9 for 2)::int
        WHEN d ~ '^\d{1,2}/\d{1,2}/\d{2,4}$' THEN split_part(d, '/', 2)::int
      END AS dd
    FROM raw
  )
  SELECT CASE
    WHEN f = '' OR l = '' OR yy IS NULL OR mm IS NULL OR dd IS NULL THEN NULL
    WHEN yy < 1900 OR yy > 2100 THEN NULL
    WHEN mm < 1 OR mm > 12 THEN NULL
    WHEN dd < 1 THEN NULL
    WHEN dd > CASE
                WHEN mm IN (1,3,5,7,8,10,12) THEN 31
                WHEN mm IN (4,6,9,11)        THEN 30
                WHEN (yy % 4 = 0 AND yy % 100 <> 0) OR yy % 400 = 0 THEN 29
                ELSE 28
              END THEN NULL
    ELSE f || '|' || l || '|' ||
         lpad(yy::text, 4, '0') || '-' || lpad(mm::text, 2, '0') || '-' || lpad(dd::text, 2, '0')
  END
  FROM parts;
$$;

COMMENT ON FUNCTION public.crm_name_dob_key(jsonb) IS
  'Canonical first|last|YYYY-MM-DD identity key. Must stay in lockstep with nameDobKey() in apps/crm/src/lib/imports/csv-update.ts.';

-- Expression index so a key lookup is a probe, not a full-module scan.
CREATE INDEX IF NOT EXISTS idx_crm_records_name_dob_key
  ON public.crm_records (org_id, module_id, public.crm_name_dob_key(data))
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Lookup — returns EVERY candidate per key (ambiguity is decided upstream).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_name_dob_lookup(
  p_org_id    uuid,
  p_module_id uuid,
  p_keys      text[]
)
RETURNS TABLE(
  id           uuid,
  title        text,
  email        text,
  phone        text,
  status       text,
  stage        text,
  data         jsonb,
  updated_at   timestamptz,
  name_dob_key text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT r.id, r.title, r.email, r.phone, r.status, r.stage, r.data,
         r.updated_at, public.crm_name_dob_key(r.data)
    FROM public.crm_records r
   WHERE r.org_id = p_org_id
     AND r.module_id = p_module_id
     AND r.deleted_at IS NULL
     AND public.crm_name_dob_key(r.data) = ANY(p_keys)
   ORDER BY r.id;
$$;

COMMENT ON FUNCTION public.crm_name_dob_lookup(uuid, uuid, text[]) IS
  'Name+DOB import matching. SECURITY INVOKER so crm_records RLS still applies — this is a performance change, never a privilege one. Returns all candidates per key so the caller can fail closed on ambiguity.';

REVOKE ALL ON FUNCTION public.crm_name_dob_lookup(uuid, uuid, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_name_dob_lookup(uuid, uuid, text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.crm_name_dob_lookup(uuid, uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_name_dob_lookup(uuid, uuid, text[]) TO service_role;

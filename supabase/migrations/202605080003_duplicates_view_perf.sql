-- Speed up `crm_probable_duplicates` on tenants with thousands of records.
--
-- The view does a self-join on candidates where the predicate is
--   a.first_name_lc = b.first_name_lc AND a.last_name_lc = b.last_name_lc
--   AND (email match OR phone match OR dob match)
-- The expressions are computed from JSONB on every row, so without an
-- expression index Postgres has to scan the whole table on each side and
-- recompute LOWER(...) per comparison. On 15k+ records this can blow past
-- statement_timeout — the API surfaces it as "Failed to load duplicate pairs".
--
-- These indexes match the exact expressions in the view so the planner can
-- use them for both the candidates CTE filter and the self-join.

-- 1. (first_name, last_name) lowercased — the join's primary equality.
CREATE INDEX IF NOT EXISTS idx_crm_records_dup_name_lc
  ON public.crm_records
     ((LOWER(COALESCE(data->>'first_name', ''))),
      (LOWER(COALESCE(data->>'last_name',  ''))))
  WHERE COALESCE(data->>'first_name', '') <> ''
    AND COALESCE(data->>'last_name',  '') <> '';

-- 2. Lowercased email — for the email-match branch of the OR predicate.
CREATE INDEX IF NOT EXISTS idx_crm_records_dup_email_lc
  ON public.crm_records ((LOWER(email)))
  WHERE email IS NOT NULL AND email <> '';

-- 3. Phone — exact match in the OR predicate.
-- (`phone` is already indexed by some installs; CREATE INDEX IF NOT EXISTS
--  is a no-op if a different name already exists.)
CREATE INDEX IF NOT EXISTS idx_crm_records_dup_phone
  ON public.crm_records (phone)
  WHERE phone IS NOT NULL AND phone <> '';

-- 4. date_of_birth pulled from JSONB — used by the dob-match branch.
CREATE INDEX IF NOT EXISTS idx_crm_records_dup_dob
  ON public.crm_records ((NULLIF(data->>'date_of_birth', '')))
  WHERE NULLIF(data->>'date_of_birth', '') IS NOT NULL;

-- ANALYZE so the planner picks up the new stats immediately.
ANALYZE public.crm_records;

NOTIFY pgrst, 'reload schema';

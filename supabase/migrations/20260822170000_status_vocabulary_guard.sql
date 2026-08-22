-- ============================================================================
-- Status vocabulary, step 3 of 3: the database keeps it that way (PIFH)
-- ----------------------------------------------------------------------------
-- Why a DB guard and not an app check: the write-path inventory (22 Aug) found
-- 13 paths that put free text into crm_records.status — the bulk API, the
-- record PATCH, record create, CSV import, CSV update, automation actions,
-- inbound webhooks, public webforms, merge, the historical Zoho upserts, the
-- rollback ledger — and the one server-side allowlist accepted 85 values.
-- Only the table itself can hold the line.
--
-- Three behaviours, all module-aware (the vocabulary lives in a small table
-- keyed by org + module, so leads' status is the PIPELINE stage and
-- contacts'/members' is the LIFECYCLE; an org/module with no row is untouched):
--   1. canonical spelling — "active" / " Active " become "Active";
--   2. a CHANGE to a word outside the vocabulary is refused (SQLSTATE 23514,
--      a clear message listing the allowed words). A legacy value already on a
--      record is tolerated until it is migrated — unrelated edits still save;
--   3. the column is the single truth: the JSONB mirror (contact_status, or
--      lead_status on leads, plus data.status when present) always follows the
--      column, and a writer that changes only the mirror gets it promoted to
--      the column — so the header, the form, lists and exports can never
--      disagree again. The 259 records whose mirror had drifted (auto-cancel
--      cron, lead conversion) are repaired here once.
--
-- Escape hatch for migrations / the CSV rollback: SET LOCAL crm.status_guard =
-- 'off' disables rule 2 only (spelling + mirror still apply).
-- map_member_status_to_crm: 'paused' (unused today: 0 members) and any
-- unexpected value now map to Inactive instead of leaking "Paused" / a
-- Title-Cased free string into the CRM.
--
-- Rollback: DROP TRIGGER crm_0_status_guard_trg ON crm_records; DROP FUNCTION
-- crm_status_guard(); DROP TABLE crm_status_vocabulary. (The mirror repair is
-- a convergence onto the column and needs no undo.)
-- ============================================================================

SET lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. The vocabulary, per org + module. Read only by the guard (SECURITY
--    DEFINER), so no client role needs access to it.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_status_vocabulary (
  org_id     uuid NOT NULL,
  module_key text NOT NULL,
  statuses   text[] NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, module_key),
  CONSTRAINT crm_status_vocabulary_nonempty CHECK (cardinality(statuses) > 0)
);
ALTER TABLE public.crm_status_vocabulary ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_status_vocabulary FROM anon, authenticated;
COMMENT ON TABLE public.crm_status_vocabulary IS
  'Allowed crm_records.status values per org + module; enforced by crm_status_guard(). No row = module not guarded.';

INSERT INTO public.crm_status_vocabulary (org_id, module_key, statuses) VALUES
  ('00000000-0000-0000-0000-000000000001', 'contacts',
     ARRAY['Active','Inactive','Pending','In Process','Cancelled','Terminated','Deceased','Prospect','Lost','Declined','Abandoned']),
  ('00000000-0000-0000-0000-000000000001', 'members',
     ARRAY['Active','Inactive','Pending','In Process','Cancelled','Terminated','Deceased','Prospect','Lost','Declined','Abandoned']),
  ('00000000-0000-0000-0000-000000000001', 'leads',
     ARRAY['New','Attempted','Contacted','Qualified','Future Prospect','In Process','Pending','Converted','Unqualified','Lost'])
ON CONFLICT (org_id, module_key) DO UPDATE SET statuses = EXCLUDED.statuses, updated_at = now();

-- ---------------------------------------------------------------------------
-- 2. The guard. Named to fire FIRST among the BEFORE triggers (Postgres fires
--    them in name order), so the search vector and the title see the
--    canonical status.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_status_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_module     text;
  v_vocab      text[];
  v_mirror_key text;
  v_status     text;
  v_canon      text;
  v_new_mirror text;
  v_old_mirror text;
  v_new_js     text;
  v_old_js     text;
BEGIN
  SELECT key INTO v_module FROM public.crm_modules WHERE id = NEW.module_id;
  SELECT statuses INTO v_vocab
    FROM public.crm_status_vocabulary
   WHERE org_id = NEW.org_id AND module_key = v_module;
  IF v_vocab IS NULL THEN
    RETURN NEW;                                   -- not a guarded org/module
  END IF;

  v_mirror_key := CASE WHEN v_module = 'leads' THEN 'lead_status' ELSE 'contact_status' END;
  NEW.data := COALESCE(NEW.data, '{}'::jsonb);

  -- A writer that changed only the JSONB mirror (or data.status) and not the
  -- column: promote it, the column is the truth. data.status wins last, as in
  -- the application's own mirror.
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    v_new_mirror := NULLIF(btrim(NEW.data->>v_mirror_key), '');
    v_old_mirror := NULLIF(btrim(COALESCE(OLD.data, '{}'::jsonb)->>v_mirror_key), '');
    IF v_new_mirror IS NOT NULL AND v_new_mirror IS DISTINCT FROM v_old_mirror THEN
      NEW.status := v_new_mirror;
    END IF;
    v_new_js := NULLIF(btrim(NEW.data->>'status'), '');
    v_old_js := NULLIF(btrim(COALESCE(OLD.data, '{}'::jsonb)->>'status'), '');
    IF v_new_js IS NOT NULL AND v_new_js IS DISTINCT FROM v_old_js THEN
      NEW.status := v_new_js;
    END IF;
  END IF;

  -- Canonical spelling: trim, then a case-insensitive match onto the vocabulary.
  v_status := NULLIF(btrim(NEW.status), '');
  IF v_status IS NOT NULL AND NOT (v_status = ANY (v_vocab)) THEN
    SELECT v INTO v_canon FROM unnest(v_vocab) AS v WHERE lower(v) = lower(v_status) LIMIT 1;
    IF v_canon IS NOT NULL THEN
      v_status := v_canon;
    END IF;
  END IF;
  NEW.status := v_status;

  -- The guard proper: refuse a CHANGE to a word outside the vocabulary.
  IF v_status IS NOT NULL
     AND NOT (v_status = ANY (v_vocab))
     AND (TG_OP = 'INSERT' OR v_status IS DISTINCT FROM OLD.status)
     AND COALESCE(current_setting('crm.status_guard', true), 'on') <> 'off' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = format('Status "%s" is not in the %s vocabulary. Allowed: %s', v_status, v_module, array_to_string(v_vocab, ', ')),
      HINT    = 'Choose one of the allowed statuses. A legacy value already on a record is kept until it is migrated.';
  END IF;

  -- The mirror follows the column, always.
  IF v_status IS NULL THEN
    NEW.data := NEW.data - v_mirror_key;
    IF NEW.data ? 'status' THEN NEW.data := NEW.data - 'status'; END IF;
  ELSE
    IF NEW.data->>v_mirror_key IS DISTINCT FROM v_status THEN
      NEW.data := NEW.data || jsonb_build_object(v_mirror_key, v_status);
    END IF;
    IF (NEW.data ? 'status') AND NEW.data->>'status' IS DISTINCT FROM v_status THEN
      NEW.data := NEW.data || jsonb_build_object('status', v_status);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_status_guard() FROM PUBLIC;

DROP TRIGGER IF EXISTS crm_0_status_guard_trg ON public.crm_records;
CREATE TRIGGER crm_0_status_guard_trg
  BEFORE INSERT OR UPDATE OF status, data ON public.crm_records
  FOR EACH ROW EXECUTE FUNCTION public.crm_status_guard();

COMMENT ON FUNCTION public.crm_status_guard() IS
  'Per org+module status vocabulary: canonical spelling, refuse changes to unknown values (SET LOCAL crm.status_guard = off to bypass), keep JSONB mirrors equal to the column.';

-- ---------------------------------------------------------------------------
-- 3. The member → CRM status mapper can no longer leak a non-vocabulary word.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.map_member_status_to_crm(p_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(btrim(coalesce(p_status, '')))
    WHEN 'active'     THEN 'Active'
    WHEN 'pending'    THEN 'Pending'
    WHEN 'terminated' THEN 'Terminated'
    WHEN 'inactive'   THEN 'Inactive'
    WHEN 'paused'     THEN 'Inactive'      -- a paused membership is not active coverage
    WHEN 'prospect'   THEN 'Prospect'
    WHEN ''           THEN 'Active'
    ELSE 'Inactive'                        -- never a free-text passthrough
  END;
$$;

-- ---------------------------------------------------------------------------
-- 4. One-time repair of mirrors that had drifted from the column (measured
--    22 Aug: 235 contacts + 24 leads). Guard is set to 'off' here because some
--    of those columns still hold legacy values awaiting batch 2 — this only
--    makes the mirror agree, it changes no status.
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_n int;
BEGIN
  PERFORM set_config('crm.status_guard', 'off', true);
  WITH fixed AS (
    UPDATE public.crm_records c
       SET data = c.data || jsonb_build_object(
                    CASE WHEN m.key = 'leads' THEN 'lead_status' ELSE 'contact_status' END, c.status)
      FROM public.crm_modules m
     WHERE m.id = c.module_id
       AND c.org_id = '00000000-0000-0000-0000-000000000001'
       AND c.deleted_at IS NULL
       AND c.status IS NOT NULL
       AND m.key IN ('contacts','members','leads')
       AND c.data ? (CASE WHEN m.key = 'leads' THEN 'lead_status' ELSE 'contact_status' END)
       AND c.data->>(CASE WHEN m.key = 'leads' THEN 'lead_status' ELSE 'contact_status' END) IS DISTINCT FROM c.status
    RETURNING 1
  )
  SELECT count(*) INTO v_n FROM fixed;
  RAISE NOTICE 'status vocabulary guard: % drifted mirrors repaired', v_n;
  PERFORM set_config('crm.status_guard', 'on', true);
END $$;

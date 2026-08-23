-- ============================================================================
-- Status vocabulary, batch 2: the remaining legacy labels (PIFH)
-- ----------------------------------------------------------------------------
-- Batch 1 (20260822160000) applied the 46 rows the client had answered. This
-- applies the rows she had not seen (section B from "Decision Making Stage"
-- down, section E's last rows), the two she left blank, and the three values
-- the audit surfaced afterwards — using the proposals as they stand on the
-- decision sheet (owner: "apply"), every one reversible: the original label
-- is kept in data.legacy_status and the full before-image in crm_audit_log.
--
-- Same module-aware rules as batch 1:
--   contacts / members — status = LIFECYCLE; pipeline stage (if any) in
--                        data.lead_status.
--   leads               — status = the STAGE; a legacy value that is already a
--                        valid stage is left alone.
-- Judgement calls, named so they can be reversed by hand if the client says so:
--   • "Cancellation Pending" (2 contacts, no cancellation date on file, covers
--     since 2017/2021) → Cancelled — a requested cancellation with no date is
--     not active coverage.
--   • the two "Florida Group Business" LEADS → Qualified + record_type group
--     (a group-business opportunity still in the pipeline; if they in fact
--     enrolled, Converted is a one-line change).
--   • the one LEAD on "Cancelled" → Lost (the pipeline's own word).
--   • "E-Mail opt out" → Prospect; if the module defines an email_opt_out
--     boolean it is set, so the fact is not lost.
-- Not touched: the 5 records with NULL status (no basis to guess) and lead
-- Celina Allen (Converted; no contact found under her email).
--
-- Rows are locked as they are read (FOR UPDATE), so a concurrent edit cannot
-- be overwritten by the re-read. Re-run safe: a record whose status is no
-- longer a legacy value is skipped.
-- ============================================================================

SET lock_timeout = '5s';
SET statement_timeout = '600s';

DO $$
DECLARE
  v_org      constant uuid := '00000000-0000-0000-0000-000000000001';
  v_contacts uuid; v_leads uuid;
  r record;
  v_new_status text; v_data jsonb; v_mirror jsonb;
  v_has_optout boolean;
  v_rows int := 0; v_by_value jsonb := '{}'::jsonb;
BEGIN
  SELECT id INTO v_contacts FROM public.crm_modules WHERE org_id = v_org AND key = 'contacts';
  SELECT id INTO v_leads    FROM public.crm_modules WHERE org_id = v_org AND key = 'leads';
  IF v_contacts IS NULL OR v_leads IS NULL THEN
    -- 2026-08-23: fresh-database guard (pattern of commit 7c60dec8). This is a
    -- PIFH prod-data backfill: on production it has already run (its version is
    -- recorded, it never re-runs there), but on a FRESH database (supabase start,
    -- the CI walk runner) the org row does not exist yet and the chain died here.
    -- Nothing to backfill on a fresh DB: skip loudly. Editing an applied migration
    -- is safe precisely because prod never replays it.
    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org) THEN
      RAISE NOTICE '20260822200000_status_vocabulary_apply_batch2: org % not present (fresh database) — skipped', v_org;
      RETURN;
    END IF;
    -- The org EXISTS but the expected row does not: that is real drift on a
    -- populated database and still deserves the hard stop (cf 7c60dec8).
    RAISE EXCEPTION 'PIFH contacts/leads module not found — refusing to run against a bare database';
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.crm_fields WHERE module_id = v_contacts AND key = 'email_opt_out') INTO v_has_optout;

  DROP TABLE IF EXISTS vocab_map2;
  CREATE TEMP TABLE vocab_map2 (
    legacy     text PRIMARY KEY,
    lifecycle  text NOT NULL,
    stage      text,
    extra      jsonb NOT NULL DEFAULT '{}'::jsonb
  ) ON COMMIT DROP;

  INSERT INTO vocab_map2 (legacy, lifecycle, stage, extra) VALUES
    -- B · pipeline stage (proposals as on the sheet)
    ('Decision Making Stage',       'Prospect', 'Qualified',   '{}'),
    ('Cold Prospect - Released',    'Lost',     'Lost',        '{}'),
    ('Attempted Contact One',       'Prospect', 'Attempted',   '{}'),
    ('Attempted Contact Two',       'Prospect', 'Attempted',   '{}'),
    ('Attempted Contact Four',      'Prospect', 'Attempted',   '{}'),
    ('Attempted to Contact',        'Prospect', 'Attempted',   '{}'),
    ('Dropout',                     'Lost',     'Lost',        '{}'),
    ('Sent to Webinar',             'Prospect', 'Contacted',   '{}'),
    ('Warm - Future Prospect',      'Prospect', 'Contacted',   '{}'),
    ('Full Presentation Completed', 'Prospect', 'Qualified',   '{}'),
    ('Product Selection',           'Prospect', 'Qualified',   '{}'),
    ('Junk Lead',                   'Lost',     'Unqualified', '{}'),
    ('Not Qualified',               'Lost',     'Unqualified', '{}'),
    ('Visited Click Funnel',        'Prospect', 'New',         '{}'),
    ('Ready to Convert',            'Prospect', 'Qualified',   '{}'),
    ('Qualification',               'Prospect', 'Qualified',   '{}'),
    -- E · the rest
    ('E-Mail opt out',              'Prospect',  NULL, '{"__email_opt_out": true}'),
    ('Cancellation Pending',        'Cancelled', NULL, '{}'),
    ('Cancelled - In New CRM',      'Cancelled', NULL, '{}'),
    ('Suspended',                   'Inactive',  NULL, '{}'),
    -- the two left blank
    ('Non Client',                  'Lost',      'Unqualified', '{}'),
    ('Agency- SUPPORT',             'Active',    NULL,          '{}'),
    -- surfaced by the audit
    ('Florida Group Business',      'Active',    'Qualified',   '{"record_type": "group"}'),
    ('Cancelled',                   'Cancelled', 'Lost',        '{}');   -- only reaches leads (see below)

  FOR r IN
    SELECT c.id, c.module_id, c.status, c.data, m.lifecycle, m.stage, m.extra
      FROM public.crm_records c
      JOIN vocab_map2 m ON m.legacy = c.status
     WHERE c.org_id = v_org AND c.deleted_at IS NULL
     FOR UPDATE OF c
  LOOP
    -- 'Cancelled' is a vocabulary word on contacts/members: only a LEAD on it
    -- is a legacy value (→ Lost).
    IF r.status = 'Cancelled' AND r.module_id <> v_leads THEN CONTINUE; END IF;

    IF r.module_id = v_leads THEN
      IF r.status = ANY (ARRAY['New','Attempted','Contacted','Qualified','Future Prospect','In Process','Pending','Converted','Unqualified','Lost']) THEN
        CONTINUE;   -- already a valid stage
      END IF;
      IF r.stage IS NULL THEN CONTINUE; END IF;   -- no honest pipeline word: leave for a human
      v_new_status := r.stage;
    ELSE
      v_new_status := r.lifecycle;
    END IF;

    v_data := COALESCE(r.data, '{}'::jsonb);
    IF NULLIF(btrim(v_data->>'legacy_status'), '') IS NULL THEN
      v_data := v_data || jsonb_build_object('legacy_status', r.status);
    END IF;
    FOR v_mirror IN SELECT jsonb_build_object(k, v) FROM jsonb_each(r.extra) e(k, v) LOOP
      IF v_mirror ? '__email_opt_out' THEN
        IF v_has_optout THEN v_data := v_data || '{"email_opt_out": true}'::jsonb; END IF;
      ELSIF NULLIF(btrim(v_data->>(SELECT key FROM jsonb_object_keys(v_mirror) key LIMIT 1)), '') IS NULL
         OR ((v_mirror ? 'record_type') AND v_data->>'record_type' IN ('individual','unknown')) THEN
        v_data := v_data || v_mirror;
      END IF;
    END LOOP;
    IF r.module_id = v_leads THEN
      v_data := v_data || jsonb_build_object('lead_status', v_new_status);
      IF v_data ? 'contact_status' THEN v_data := v_data || jsonb_build_object('contact_status', v_new_status); END IF;
    ELSE
      v_data := v_data || jsonb_build_object('contact_status', v_new_status);
      IF r.stage IS NOT NULL THEN v_data := v_data || jsonb_build_object('lead_status', r.stage); END IF;
    END IF;
    IF v_data ? 'status' THEN v_data := v_data || jsonb_build_object('status', v_new_status); END IF;

    UPDATE public.crm_records
       SET status = v_new_status,
           record_type = CASE WHEN (r.extra ? 'record_type') AND COALESCE(record_type,'unknown') IN ('individual','unknown')
                              THEN r.extra->>'record_type' ELSE record_type END,
           data = v_data
     WHERE id = r.id;
    v_rows := v_rows + 1;
    v_by_value := v_by_value || jsonb_build_object(r.status, COALESCE((v_by_value->>r.status)::int, 0) + 1);
  END LOOP;

  RAISE NOTICE 'status vocabulary batch 2: % records re-labelled. Per value: %', v_rows, v_by_value::text;
END $$;

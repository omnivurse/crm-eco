-- PIFH configuration-only (crm_fields rows; NO record data touched).
--
-- Adds a ROLE field so a record's relationship and its lifecycle state stop
-- fighting for the same column.
--
-- Today the status column encodes both at once: "Active ADVISOR", "Active DPC",
-- "Agent - Prospect", "DPC Prospect", "Agency- SUPPORT". An active advisor and
-- an active member are the same STATE but different KINDS of record, so those
-- values can never be merged into "Active" without destroying the distinction —
-- which is exactly why they survived every previous cleanup.
--
-- After this: status = "Active", contact_role = "Advisor", and
-- "active advisors" becomes a real filter instead of a string match.
--
-- A blank contact_role means Member — the overwhelming default. Only the ~575
-- non-member records are tagged, so this stays a small, reversible change
-- rather than a rewrite of 14,000 rows.
--
-- legacy_status preserves the ORIGINAL status string verbatim before any
-- normalisation touches it. Nothing is lost even if a mapping later proves
-- wrong, and it is the exact source for a rollback.
--
-- Rollback:
--   DELETE FROM public.crm_fields
--    WHERE key IN ('contact_role','legacy_status')
--      AND module_id IN (SELECT id FROM public.crm_modules
--                         WHERE org_id = '00000000-0000-0000-0000-000000000001'
--                           AND key IN ('contacts','leads','members'));

SET lock_timeout = '5s';

DO $$
DECLARE
  v_org uuid := '00000000-0000-0000-0000-000000000001';
  v_mod record;
  v_n   int := 0;
BEGIN
  FOR v_mod IN
    SELECT id, key FROM public.crm_modules
     WHERE org_id = v_org AND key IN ('contacts', 'leads', 'members')
  LOOP
    INSERT INTO public.crm_fields (org_id, module_id, key, label, type, section, options)
    VALUES (
      v_org, v_mod.id, 'contact_role', 'Relationship', 'select', 'main',
      '["Member","Advisor","Agency","DPC Provider","Provider","Employee"]'::jsonb
    )
    ON CONFLICT DO NOTHING;

    INSERT INTO public.crm_fields (org_id, module_id, key, label, type, section)
    VALUES (v_org, v_mod.id, 'legacy_status', 'Legacy status (imported)', 'text', 'system')
    ON CONFLICT DO NOTHING;

    v_n := v_n + 1;
  END LOOP;

  IF v_n = 0 THEN
    RAISE EXCEPTION 'No contacts/leads/members module found for org % — refusing to no-op silently', v_org;
  END IF;
  RAISE NOTICE 'contact_role + legacy_status defined on % module(s)', v_n;
END $$;

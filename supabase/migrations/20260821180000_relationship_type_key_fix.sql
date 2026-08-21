-- Correct a key collision I introduced in 20260821140000.
--
-- `contact_role` was ALREADY defined on contacts and members as "Contact Role"
-- — someone's job at a company: Owner, Decision Maker, Office Manager, HR
-- Manager, Benefits Coordinator. My migration tried to redefine it as
-- "Relationship" (Member/Advisor/Agency/DPC Provider) with ON CONFLICT DO
-- NOTHING, so on those two modules the insert was silently skipped and the old
-- definition stood — while on leads, which had no such field, my definition WAS
-- created. One key, two different meanings, and 575 records carrying values
-- that are not in their own field's option list.
--
-- Same class of mistake as labelling a product category "Health Sharing
-- Membership": the value and its field disagreed.
--
-- No data was destroyed — the backfill only wrote where the key was absent, so
-- all 575 values are mine and no real Contact Role was overwritten. This moves
-- them to their own key and leaves contact_role as the field it always was.
--
-- Rollback:
--   UPDATE public.crm_records
--      SET data = (data - 'relationship_type')
--               || jsonb_build_object('contact_role', data->>'relationship_type')
--    WHERE org_id = '00000000-0000-0000-0000-000000000001'
--      AND data ? 'relationship_type';
--   DELETE FROM public.crm_fields WHERE key = 'relationship_type';

SET lock_timeout = '5s';
SET statement_timeout = '120s';

DO $$
DECLARE
  v_org uuid := '00000000-0000-0000-0000-000000000001';
  v_mod record;
  v_n   int;
BEGIN
  -- 1. define relationship_type properly on all three modules
  FOR v_mod IN
    SELECT id, key FROM public.crm_modules
     WHERE org_id = v_org AND key IN ('contacts', 'leads', 'members')
  LOOP
    INSERT INTO public.crm_fields (org_id, module_id, key, label, type, section, options)
    VALUES (
      v_org, v_mod.id, 'relationship_type', 'Relationship', 'select', 'main',
      '["Member","Advisor","Agency","DPC Provider","Provider","Employee"]'::jsonb
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- 2. remove the mistaken "Relationship" definition from leads' contact_role,
  --    so the key means the same thing everywhere again
  DELETE FROM public.crm_fields f
   USING public.crm_modules m
   WHERE f.module_id = m.id
     AND m.org_id = v_org AND m.key = 'leads'
     AND f.key = 'contact_role'
     AND f.label = 'Relationship';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'leads contact_role mis-definition removed: %', v_n;

  -- 3. move the 575 values onto the correct key
  UPDATE public.crm_records
     SET data = (data - 'contact_role')
              || jsonb_build_object('relationship_type', data->>'contact_role')
   WHERE org_id = v_org
     AND deleted_at IS NULL
     AND data ? 'contact_role'
     AND data->>'contact_role' IN ('Member','Advisor','Agency','DPC Provider','Provider','Employee');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'relationship values moved off contact_role: %', v_n;
END $$;

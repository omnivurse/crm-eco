-- PIFH data-only: two more default list columns per person module so the
-- list shows "as much data at a glance as possible" (right third of the
-- table was empty at 6 columns). Chosen from what is actually populated:
--   leads    + city (740/1,120)     + producer      (850  — who enrolled)
--   contacts + product (12,773/14k) + producer_name (13,130 — who enrolled)
-- Idempotent: appends only keys not already present. Members' default view
-- (seeded 20260817030000) already carries member_number/advisor_name.
--
-- Rollback:
--   UPDATE public.crm_views SET columns = columns - 'city' - 'producer'
--    WHERE org_id='00000000-0000-0000-0000-000000000001' AND is_default AND module_id=(select id from crm_modules where org_id='00000000-0000-0000-0000-000000000001' and key='leads');
--   UPDATE public.crm_views SET columns = columns - 'product' - 'producer_name'
--    WHERE org_id='00000000-0000-0000-0000-000000000001' AND is_default AND module_id=(select id from crm_modules where org_id='00000000-0000-0000-0000-000000000001' and key='contacts');

SET lock_timeout = '5s';

DO $$
DECLARE
  v_org uuid := '00000000-0000-0000-0000-000000000001';
  v_mod uuid;
  v_key text;
  v_add text[];
  v_n int;
BEGIN
  FOR v_key, v_add IN
    SELECT * FROM (VALUES
      ('leads',    ARRAY['city', 'producer']),
      ('contacts', ARRAY['product', 'producer_name'])
    ) AS t(k, a)
  LOOP
    SELECT id INTO v_mod FROM public.crm_modules WHERE org_id = v_org AND key = v_key LIMIT 1;
    IF v_mod IS NULL THEN CONTINUE; END IF;

    UPDATE public.crm_views v
       SET columns = (
             SELECT jsonb_agg(c)
               FROM (
                 SELECT c FROM jsonb_array_elements_text(v.columns) WITH ORDINALITY AS e(c, o) ORDER BY o
               ) existing
           ) || (
             SELECT COALESCE(jsonb_agg(to_jsonb(k)), '[]'::jsonb)
               FROM unnest(v_add) AS k
              WHERE NOT (v.columns ? k)
           ),
           updated_at = now()
     WHERE v.module_id = v_mod AND v.is_default = true
       AND EXISTS (SELECT 1 FROM unnest(v_add) k WHERE NOT (v.columns ? k));
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE '% default view: % row(s) updated', v_key, v_n;
  END LOOP;
END $$;

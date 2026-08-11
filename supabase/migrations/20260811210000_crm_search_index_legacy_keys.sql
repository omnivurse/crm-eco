-- ============================================================================
-- Make members findable by the things reps actually type into search.
-- ----------------------------------------------------------------------------
-- Live PIFH (PG 17): `crm_records.search` is a STORED GENERATED column.
-- Baseline also ships a BEFORE trigger (`crm_records_search_trigger`) that
-- assigns NEW.search — incompatible with GENERATED (SQLSTATE 428C9).
--
-- This migration:
--   1. Expands the generation expression (member ids, city/state spellings,
--      phones, company, plan/advisor identifiers).
--   2. Removes the incompatible trigger so INSERT/UPDATE cannot 428C9.
--   3. Keeps `crm_records_search_update()` as a no-op for any leftover callers.
--
-- Branch for non-generated environments (legacy trigger-maintained `search`):
-- replace the trigger function and force a recomputation via UPDATE.
-- ============================================================================

SET lock_timeout = '5s';

DO $migrate$
DECLARE
  v_generated char;
  v_noisy text[] := ARRAY[
    'audit_crm_records',
    'set_updated_at_crm_records',
    'update_crm_records_updated_at',
    'set_crm_record_title',
    'log_deal_stage_change_trigger'
  ];
  v_present text[] := '{}';
  v_name text;
  v_rows bigint;
  v_doc text := $expr$
    coalesce(title, '') || ' ' ||
    coalesce(email, '') || ' ' ||
    coalesce(phone, '') || ' ' ||
    coalesce(status, '') || ' ' ||
    coalesce(data->>'first_name', '') || ' ' ||
    coalesce(data->>'last_name', '') || ' ' ||
    coalesce(data->>'middle_name', '') || ' ' ||
    coalesce(data->>'preferred_name', '') || ' ' ||
    coalesce(data->>'contact_name', '') || ' ' ||
    coalesce(data->>'spouse', '') || ' ' ||
    coalesce(data->>'spouse_name', '') || ' ' ||
    coalesce(data->>'child_1_name', '') || ' ' ||
    coalesce(data->>'child_2_name', '') || ' ' ||
    coalesce(data->>'child_3_name', '') || ' ' ||
    coalesce(data->>'child_4_name', '') || ' ' ||
    coalesce(data->>'child_5_name', '') || ' ' ||
    coalesce(data->>'member_number', '') || ' ' ||
    coalesce(data->>'sharing_member_id', '') || ' ' ||
    coalesce(data->>'e123_member_id', '') || ' ' ||
    coalesce(data->>'internal_id', '') || ' ' ||
    coalesce(data->>'city', '') || ' ' ||
    coalesce(data->>'state', '') || ' ' ||
    coalesce(data->>'mailing_city', '') || ' ' ||
    coalesce(data->>'mailing_state', '') || ' ' ||
    coalesce(data->>'zip_code', '') || ' ' ||
    coalesce(data->>'mailing_zip', '') || ' ' ||
    coalesce(data->>'address_line1', '') || ' ' ||
    coalesce(data->>'mailing_street', '') || ' ' ||
    coalesce(data->>'company', '') || ' ' ||
    coalesce(data->>'company_name', '') || ' ' ||
    coalesce(data->>'carrier', '') || ' ' ||
    coalesce(data->>'sharing_entity', '') || ' ' ||
    coalesce(data->>'product', '') || ' ' ||
    coalesce(data->>'mobile', '') || ' ' ||
    coalesce(data->>'phone2', '') || ' ' ||
    coalesce(data->>'work_phone', '') || ' ' ||
    coalesce(data->>'home_phone', '') || ' ' ||
    coalesce(data->>'email2', '') || ' ' ||
    coalesce(data->>'secondary_email', '') || ' ' ||
    coalesce(data->>'producer_name', '') || ' ' ||
    coalesce(data->>'advisor_name', '') || ' ' ||
    coalesce(data->>'advisor_code', '') || ' ' ||
    coalesce(group_name, '') || ' ' ||
    coalesce(CASE WHEN tobacco_user = true THEN 'tobacco smoker' ELSE '' END, '')
  $expr$;
BEGIN
  SELECT a.attgenerated
    INTO v_generated
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'crm_records'
    AND a.attname = 'search'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF v_generated IS NULL THEN
    RAISE EXCEPTION 'public.crm_records.search column not found';
  END IF;

  DROP TRIGGER IF EXISTS crm_records_search_trigger ON public.crm_records;

  FOREACH v_name IN ARRAY v_noisy LOOP
    IF EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relname = 'crm_records' AND t.tgname = v_name AND NOT t.tgisinternal
    ) THEN
      v_present := array_append(v_present, v_name);
      EXECUTE format('ALTER TABLE public.crm_records DISABLE TRIGGER %I', v_name);
    ELSE
      RAISE NOTICE 'trigger % not found on crm_records — skipping', v_name;
    END IF;
  END LOOP;

  BEGIN
    IF v_generated = 's' THEN
      EXECUTE format(
        'ALTER TABLE public.crm_records ALTER COLUMN search SET EXPRESSION AS (to_tsvector(%L::regconfig, %s))',
        'english',
        v_doc
      );

      EXECUTE $fn$
        CREATE OR REPLACE FUNCTION public.crm_records_search_update() RETURNS trigger
            LANGUAGE plpgsql
            SET search_path TO 'public', 'pg_catalog'
            AS $body$
        BEGIN
          RETURN NEW;
        END;
        $body$;
      $fn$;

      RAISE NOTICE 'crm_records.search GENERATED expression updated (trigger removed)';
    ELSE
      EXECUTE $fn$
        CREATE OR REPLACE FUNCTION public.crm_records_search_update() RETURNS trigger
            LANGUAGE plpgsql
            SET search_path TO 'public', 'pg_catalog'
            AS $body$
        BEGIN
          NEW.search := to_tsvector('english',
            coalesce(NEW.title, '') || ' ' ||
            coalesce(NEW.email, '') || ' ' ||
            coalesce(NEW.phone, '') || ' ' ||
            coalesce(NEW.status, '') || ' ' ||
            coalesce(NEW.data->>'first_name', '') || ' ' ||
            coalesce(NEW.data->>'last_name', '') || ' ' ||
            coalesce(NEW.data->>'middle_name', '') || ' ' ||
            coalesce(NEW.data->>'preferred_name', '') || ' ' ||
            coalesce(NEW.data->>'contact_name', '') || ' ' ||
            coalesce(NEW.data->>'spouse', '') || ' ' ||
            coalesce(NEW.data->>'spouse_name', '') || ' ' ||
            coalesce(NEW.data->>'child_1_name', '') || ' ' ||
            coalesce(NEW.data->>'child_2_name', '') || ' ' ||
            coalesce(NEW.data->>'child_3_name', '') || ' ' ||
            coalesce(NEW.data->>'child_4_name', '') || ' ' ||
            coalesce(NEW.data->>'child_5_name', '') || ' ' ||
            coalesce(NEW.data->>'member_number', '') || ' ' ||
            coalesce(NEW.data->>'sharing_member_id', '') || ' ' ||
            coalesce(NEW.data->>'e123_member_id', '') || ' ' ||
            coalesce(NEW.data->>'internal_id', '') || ' ' ||
            coalesce(NEW.data->>'city', '') || ' ' ||
            coalesce(NEW.data->>'state', '') || ' ' ||
            coalesce(NEW.data->>'mailing_city', '') || ' ' ||
            coalesce(NEW.data->>'mailing_state', '') || ' ' ||
            coalesce(NEW.data->>'zip_code', '') || ' ' ||
            coalesce(NEW.data->>'mailing_zip', '') || ' ' ||
            coalesce(NEW.data->>'address_line1', '') || ' ' ||
            coalesce(NEW.data->>'mailing_street', '') || ' ' ||
            coalesce(NEW.data->>'company', '') || ' ' ||
            coalesce(NEW.data->>'company_name', '') || ' ' ||
            coalesce(NEW.data->>'carrier', '') || ' ' ||
            coalesce(NEW.data->>'sharing_entity', '') || ' ' ||
            coalesce(NEW.data->>'product', '') || ' ' ||
            coalesce(NEW.data->>'mobile', '') || ' ' ||
            coalesce(NEW.data->>'phone2', '') || ' ' ||
            coalesce(NEW.data->>'work_phone', '') || ' ' ||
            coalesce(NEW.data->>'home_phone', '') || ' ' ||
            coalesce(NEW.data->>'email2', '') || ' ' ||
            coalesce(NEW.data->>'secondary_email', '') || ' ' ||
            coalesce(NEW.data->>'producer_name', '') || ' ' ||
            coalesce(NEW.data->>'advisor_name', '') || ' ' ||
            coalesce(NEW.data->>'advisor_code', '') || ' ' ||
            coalesce(NEW.group_name, '') || ' ' ||
            coalesce(CASE WHEN NEW.tobacco_user = true THEN 'tobacco smoker' ELSE '' END, '')
          );
          RETURN NEW;
        END;
        $body$;
      $fn$;

      CREATE TRIGGER crm_records_search_trigger
        BEFORE INSERT OR UPDATE ON public.crm_records
        FOR EACH ROW EXECUTE FUNCTION public.crm_records_search_update();

      UPDATE public.crm_records SET search = search;
      GET DIAGNOSTICS v_rows = ROW_COUNT;

      RAISE NOTICE 'search index rebuilt for % rows (trigger path)', v_rows;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    FOREACH v_name IN ARRAY v_present LOOP
      EXECUTE format('ALTER TABLE public.crm_records ENABLE TRIGGER %I', v_name);
    END LOOP;
    RAISE;
  END;

  FOREACH v_name IN ARRAY v_present LOOP
    EXECUTE format('ALTER TABLE public.crm_records ENABLE TRIGGER %I', v_name);
  END LOOP;
END;
$migrate$;

ANALYZE public.crm_records (search);

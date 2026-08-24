-- Reactivate + period ledger: dated cancelled events, Members-module writes
-- (no hop), Contacts historical→open writes returned. Additive REPLACE of
-- existing History helpers. No row move.
--
-- Rollback:
--   Re-apply the function bodies from 20260823210132_crm_history_module_lookup_and_roster.sql
--   (event_date = now(), contacts+history only). Ledger rows already inserted
--   stay; delete where source IN ('history_backfill','history_roster') if needed.

SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.crm_person_lifecycle_event_date(
  p_cancellation_date date,
  p_data jsonb,
  p_updated_at timestamptz
) RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_from_json date;
BEGIN
  IF p_cancellation_date IS NOT NULL THEN
    RETURN p_cancellation_date;
  END IF;
  IF p_data ? 'cancellation_date' AND nullif(p_data->>'cancellation_date', '') IS NOT NULL THEN
    BEGIN
      v_from_json := (p_data->>'cancellation_date')::date;
      IF v_from_json IS NOT NULL THEN
        RETURN v_from_json;
      END IF;
    EXCEPTION WHEN others THEN
      v_from_json := NULL;
    END;
  END IF;
  RETURN coalesce(p_updated_at::date, (timezone('utc', now()))::date);
END;
$$;

REVOKE ALL ON FUNCTION public.crm_person_lifecycle_event_date(date, jsonb, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_person_lifecycle_event_date(date, jsonb, timestamptz)
  TO service_role;

DROP FUNCTION IF EXISTS public.crm_append_person_lifecycle_event(uuid, uuid, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.crm_append_person_lifecycle_event(
  p_org_id uuid,
  p_contact_id uuid,
  p_event_type text,
  p_source text,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_event_date date DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_open boolean;
BEGIN
  IF p_event_type NOT IN ('cancelled', 'returned') THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM member_lifecycle_events e
    WHERE e.contact_id = p_contact_id
      AND e.organization_id = p_org_id
      AND e.event_type = 'cancelled'
      AND NOT EXISTS (
        SELECT 1
        FROM member_lifecycle_events r
        WHERE r.contact_id = e.contact_id
          AND r.organization_id = e.organization_id
          AND r.event_type = 'returned'
          AND (r.event_date, r.created_at) > (e.event_date, e.created_at)
      )
  ) INTO v_open;

  IF p_event_type = 'cancelled' AND v_open THEN
    RETURN false;
  END IF;
  IF p_event_type = 'returned' AND NOT v_open THEN
    RETURN false;
  END IF;

  INSERT INTO member_lifecycle_events (
    organization_id, contact_id, event_type, event_date, source, metadata
  ) VALUES (
    p_org_id,
    p_contact_id,
    p_event_type,
    coalesce(p_event_date, (timezone('utc', now()))::date),
    p_source,
    coalesce(p_metadata, '{}'::jsonb)
  );
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.crm_append_person_lifecycle_event(uuid, uuid, text, text, jsonb, date) IS
  'Idempotent cancelled/returned write. Optional event_date (cancellation_date / updated_at).';

REVOKE ALL ON FUNCTION public.crm_append_person_lifecycle_event(uuid, uuid, text, text, jsonb, date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_append_person_lifecycle_event(uuid, uuid, text, text, jsonb, date)
  TO service_role;

CREATE OR REPLACE FUNCTION public.crm_backfill_cancelled_lifecycle_events(p_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_count integer := 0;
  r record;
BEGIN
  FOR r IN
    SELECT
      rec.id,
      coalesce(rec.organization_id, rec.org_id) AS org_id,
      public.crm_person_lifecycle_event_date(
        rec.cancellation_date, rec.data, rec.updated_at
      ) AS event_date
    FROM crm_records rec
    JOIN crm_modules m ON m.id = rec.module_id
    WHERE rec.org_id = p_org_id
      AND rec.deleted_at IS NULL
      AND rec.status IN ('Cancelled', 'Terminated', 'Deceased')
      AND m.key IN ('contacts', 'history', 'members')
  LOOP
    IF public.crm_append_person_lifecycle_event(
      r.org_id, r.id, 'cancelled', 'history_backfill',
      jsonb_build_object('source', 'crm_backfill_cancelled_lifecycle_events'),
      r.event_date
    ) THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_backfill_cancelled_lifecycle_events(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.crm_history_roster_bind()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_key text;
  v_old_key text;
  v_history uuid;
  v_contacts uuid;
  v_members_source boolean;
  v_target uuid;
  v_event text;
  v_event_date date;
  v_historical boolean;
  v_working boolean;
BEGIN
  IF current_setting('crm.skip_history_roster', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  SELECT key INTO v_key FROM crm_modules WHERE id = NEW.module_id;
  IF v_key IS NULL OR v_key NOT IN ('contacts', 'history', 'members') THEN
    RETURN NEW;
  END IF;

  v_members_source := coalesce(NEW.system->>'source_table', '') = 'members';
  v_historical := NEW.status IN ('Cancelled', 'Terminated', 'Deceased');
  v_working := NEW.status IN (
    'Active','Inactive','Pending','In Process','Prospect',
    'Lost','Declined','Abandoned'
  );

  SELECT id INTO v_history
  FROM crm_modules
  WHERE org_id = NEW.org_id AND key = 'history' AND coalesce(is_enabled, true)
  LIMIT 1;
  SELECT id INTO v_contacts
  FROM crm_modules
  WHERE org_id = NEW.org_id AND key = 'contacts' AND coalesce(is_enabled, true)
  LIMIT 1;

  v_target := NULL;
  -- Never hop Members-module rows or members-source twins.
  IF NOT v_members_source AND v_key IN ('contacts', 'history') THEN
    IF v_key = 'contacts'
       AND v_historical
       AND v_history IS NOT NULL
       AND NEW.module_id IS DISTINCT FROM v_history THEN
      v_target := v_history;
      v_event := 'cancelled';
    ELSIF v_key = 'history'
       AND v_working
       AND v_contacts IS NOT NULL
       AND NEW.module_id IS DISTINCT FROM v_contacts THEN
      v_target := v_contacts;
      v_event := 'returned';
    END IF;
  END IF;

  IF v_target IS NOT NULL THEN
    UPDATE crm_records
    SET module_id = v_target
    WHERE id = NEW.id
      AND module_id IS DISTINCT FROM v_target;
  END IF;

  IF v_event IS NULL THEN
    IF v_historical
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
      v_event := 'cancelled';
    ELSIF v_working
       AND TG_OP = 'UPDATE'
       AND OLD.status IN ('Cancelled', 'Terminated', 'Deceased') THEN
      v_event := 'returned';
    END IF;
  END IF;

  IF v_event IS NULL AND TG_OP = 'UPDATE' AND OLD.module_id IS DISTINCT FROM NEW.module_id THEN
    SELECT key INTO v_old_key FROM crm_modules WHERE id = OLD.module_id;
    IF v_old_key = 'contacts' AND v_key = 'history' AND v_historical THEN
      v_event := 'cancelled';
    ELSIF v_old_key = 'history' AND v_key = 'contacts' THEN
      v_event := 'returned';
    END IF;
  END IF;

  IF v_event IS NOT NULL THEN
    IF v_event = 'cancelled' THEN
      v_event_date := public.crm_person_lifecycle_event_date(
        NEW.cancellation_date, NEW.data, NEW.updated_at
      );
    ELSE
      v_event_date := (timezone('utc', now()))::date;
    END IF;
    PERFORM public.crm_append_person_lifecycle_event(
      coalesce(NEW.organization_id, NEW.org_id),
      NEW.id,
      v_event,
      'history_roster',
      jsonb_build_object(
        'from_module', v_key,
        'status', NEW.status,
        'members_source', v_members_source
      ),
      v_event_date
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.crm_history_roster_bind() IS
  'Contacts + historical status → History; History + working → Contacts. Members and members-source never hop. Writes dated cancelled/returned.';

REVOKE ALL ON FUNCTION public.crm_history_roster_bind() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_history_roster_bind() TO service_role;

-- ============================================================================
-- History door + PersonIdentityLookup (sync_member) + LifecycleModuleBinding
-- ----------------------------------------------------------------------------
-- Additive. No row moves. Phase 3 backfill of ~6,422 Cancelled Contacts is
-- NOT in this file — rehearse + explicit approval required.
--
-- 1. Empty `history` module per org that already has Contacts (clone fields /
--    default layout / default view).
-- 2. crm_status_vocabulary for history (no row = module not guarded).
-- 3. sync_member_to_crm searches History after a Contacts miss.
-- 4. AFTER trigger crm_1_history_roster_trg (name-ordered after
--    crm_0_status_guard_trg) hops contacts ↔ history on status, skips
--    members-source, writes cancelled / returned ledger events.
--
-- Escape hatch: SET LOCAL crm.skip_history_roster = 'on';
-- Rollback: disable trigger; leave empty module; do not delete rows.
-- ============================================================================

SET lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. History module (empty door)
-- ---------------------------------------------------------------------------
INSERT INTO public.crm_modules (
  org_id, organization_id, key, name, name_plural, icon, description,
  is_system, is_enabled, display_order
)
SELECT
  c.org_id,
  c.organization_id,
  'history',
  'History',
  'History',
  'archive',
  'Former members whose membership is closed',
  true,
  true,
  3
FROM public.crm_modules c
WHERE c.key = 'contacts'
ON CONFLICT (org_id, key) DO UPDATE SET
  name = EXCLUDED.name,
  name_plural = EXCLUDED.name_plural,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  is_enabled = true,
  display_order = EXCLUDED.display_order,
  updated_at = now();

INSERT INTO public.crm_fields (
  org_id, organization_id, module_id, key, label, type, required, is_system,
  is_indexed, is_title_field, options, validation, default_value, tooltip,
  display_order, section, width, is_pinned, metadata
)
SELECT
  f.org_id, f.organization_id, h.id, f.key, f.label, f.type, f.required, f.is_system,
  f.is_indexed, f.is_title_field, f.options, f.validation, f.default_value, f.tooltip,
  f.display_order, f.section, f.width, f.is_pinned, f.metadata
FROM public.crm_modules h
JOIN public.crm_modules c
  ON c.org_id = h.org_id AND c.key = 'contacts'
JOIN public.crm_fields f
  ON f.module_id = c.id
WHERE h.key = 'history'
ON CONFLICT (module_id, key) DO NOTHING;

INSERT INTO public.crm_layouts (
  org_id, organization_id, module_id, name, is_default, config
)
SELECT
  h.org_id, h.organization_id, h.id, l.name, true, l.config
FROM public.crm_modules h
JOIN LATERAL (
  SELECT cl.name, cl.config
  FROM public.crm_modules c
  JOIN public.crm_layouts cl ON cl.module_id = c.id AND coalesce(cl.is_default, false)
  WHERE c.org_id = h.org_id AND c.key = 'contacts'
  ORDER BY cl.updated_at DESC NULLS LAST
  LIMIT 1
) l ON true
WHERE h.key = 'history'
  AND NOT EXISTS (
    SELECT 1 FROM public.crm_layouts x
    WHERE x.module_id = h.id AND coalesce(x.is_default, false)
  );

INSERT INTO public.crm_views (
  org_id, organization_id, module_id, name, columns, filters, sort,
  is_default, is_shared, created_by
)
SELECT
  h.org_id, h.organization_id, h.id, 'All History', v.columns, '[]'::jsonb, v.sort,
  true, true, v.created_by
FROM public.crm_modules h
JOIN LATERAL (
  SELECT cv.columns, cv.sort, cv.created_by
  FROM public.crm_modules c
  JOIN public.crm_views cv ON cv.module_id = c.id AND coalesce(cv.is_default, false)
  WHERE c.org_id = h.org_id AND c.key = 'contacts'
  ORDER BY cv.updated_at DESC NULLS LAST
  LIMIT 1
) v ON true
WHERE h.key = 'history'
  AND NOT EXISTS (
    SELECT 1 FROM public.crm_views x
    WHERE x.module_id = h.id AND coalesce(x.is_default, false)
  );

-- ---------------------------------------------------------------------------
-- 2. Status vocabulary (guard: no row = module not guarded)
-- ---------------------------------------------------------------------------
INSERT INTO public.crm_status_vocabulary (org_id, module_key, statuses)
SELECT
  c.org_id,
  'history',
  coalesce(
    v.statuses,
    ARRAY[
      'Active','Inactive','Pending','In Process','Cancelled','Terminated',
      'Deceased','Prospect','Lost','Declined','Abandoned'
    ]
  )
FROM public.crm_modules c
LEFT JOIN public.crm_status_vocabulary v
  ON v.org_id = c.org_id AND v.module_key = 'contacts'
WHERE c.key = 'contacts'
ON CONFLICT (org_id, module_key) DO UPDATE SET
  statuses = EXCLUDED.statuses,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 3. PersonIdentityLookup helper used by sync_member_to_crm
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_find_person_record_in_module(
  p_module_id uuid,
  p_organization_id uuid,
  p_linked_member_id uuid,
  p_member_number text,
  p_email text,
  p_phone text,
  p_first_name text,
  p_last_name text
) RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_module_id IS NULL OR p_organization_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_id
  FROM crm_records
  WHERE module_id = p_module_id
    AND organization_id = p_organization_id
    AND deleted_at IS NULL
    AND p_linked_member_id IS NOT NULL
    AND (data->>'linked_member_id') = p_linked_member_id::text
  LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  IF p_member_number IS NOT NULL AND btrim(p_member_number) <> '' THEN
    SELECT id INTO v_id
    FROM crm_records
    WHERE module_id = p_module_id
      AND organization_id = p_organization_id
      AND deleted_at IS NULL
      AND btrim(coalesce(data->>'member_number', '')) = btrim(p_member_number)
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 1;
    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;
  END IF;

  IF p_email IS NOT NULL AND p_email <> ''
     AND p_first_name IS NOT NULL AND p_last_name IS NOT NULL THEN
    SELECT id INTO v_id
    FROM crm_records
    WHERE module_id = p_module_id
      AND organization_id = p_organization_id
      AND deleted_at IS NULL
      AND email IS NOT NULL
      AND lower(email) = lower(p_email)
      AND lower(coalesce(data->>'first_name', '')) = lower(p_first_name)
      AND lower(coalesce(data->>'last_name', '')) = lower(p_last_name)
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 1;
    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;
  END IF;

  IF p_phone IS NOT NULL AND p_phone <> ''
     AND p_first_name IS NOT NULL AND p_last_name IS NOT NULL THEN
    SELECT id INTO v_id
    FROM crm_records
    WHERE module_id = p_module_id
      AND organization_id = p_organization_id
      AND deleted_at IS NULL
      AND phone = p_phone
      AND lower(coalesce(data->>'first_name', '')) = lower(p_first_name)
      AND lower(coalesce(data->>'last_name', '')) = lower(p_last_name)
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.crm_find_person_record_in_module(uuid, uuid, uuid, text, text, text, text, text) IS
  'PersonIdentityLookup: linked_member_id → member # → email+name → phone+name inside one module.';

REVOKE ALL ON FUNCTION public.crm_find_person_record_in_module(uuid, uuid, uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_find_person_record_in_module(uuid, uuid, uuid, text, text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_member_to_crm()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_contacts_module_id uuid;
  v_history_module_id  uuid;
  v_existing_record_id uuid;
  v_record_title       text;
  v_data               jsonb;
  v_member_number      text;
  v_crm_status         text;
  v_effective          date;
BEGIN
  SELECT id INTO v_contacts_module_id
  FROM crm_modules
  WHERE organization_id = NEW.organization_id
    AND key = 'contacts'
    AND is_enabled = true
  LIMIT 1;

  IF v_contacts_module_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_history_module_id
  FROM crm_modules
  WHERE organization_id = NEW.organization_id
    AND key = 'history'
    AND is_enabled = true
  LIMIT 1;

  v_record_title := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
  IF v_record_title = '' THEN
    v_record_title := COALESCE(NEW.email, 'Member ' || NEW.id::text);
  END IF;

  v_crm_status := public.map_member_status_to_crm(NEW.status);
  v_effective := NEW.effective_date;

  v_existing_record_id := public.crm_find_person_record_in_module(
    v_contacts_module_id,
    NEW.organization_id,
    NEW.id,
    NEW.member_number,
    NEW.email,
    NEW.phone,
    NEW.first_name,
    NEW.last_name
  );

  IF v_existing_record_id IS NULL AND v_history_module_id IS NOT NULL THEN
    v_existing_record_id := public.crm_find_person_record_in_module(
      v_history_module_id,
      NEW.organization_id,
      NEW.id,
      NEW.member_number,
      NEW.email,
      NEW.phone,
      NEW.first_name,
      NEW.last_name
    );
  END IF;

  IF v_existing_record_id IS NOT NULL THEN
    SELECT data INTO v_data
    FROM crm_records
    WHERE id = v_existing_record_id;

    v_data := jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            COALESCE(v_data, '{}'::jsonb),
            '{first_name}', to_jsonb(COALESCE(NEW.first_name, v_data->>'first_name'))
          ),
          '{last_name}',  to_jsonb(COALESCE(NEW.last_name,  v_data->>'last_name'))
        ),
        '{email}',        to_jsonb(COALESCE(NEW.email,      v_data->>'email'))
      ),
      '{linked_member_id}', to_jsonb(NEW.id::text)
    );

    v_member_number := NULLIF(BTRIM(COALESCE(NEW.member_number, '')), '');
    IF v_member_number IS NOT NULL THEN
      v_data := jsonb_set(v_data, '{member_number}', to_jsonb(v_member_number), true);
    END IF;

    v_data := jsonb_set(v_data, '{contact_status}', to_jsonb(v_crm_status), true);
    IF v_effective IS NOT NULL THEN
      v_data := jsonb_set(v_data, '{effective_date}', to_jsonb(v_effective::text), true);
      v_data := jsonb_set(v_data, '{start_date}', to_jsonb(v_effective::text), true);
    END IF;

    UPDATE crm_records
    SET
      title = COALESCE(NULLIF(title, ''), v_record_title),
      email = COALESCE(NULLIF(email, ''), NEW.email),
      phone = COALESCE(NULLIF(phone, ''), NEW.phone),
      status = CASE
        WHEN lower(COALESCE(NEW.status, '')) = 'active' THEN 'Active'
        WHEN status IN ('Active', 'Active HS Member', 'Active Insurance Client', 'Active Member')
             AND lower(COALESCE(NEW.status, '')) <> 'active'
             AND lower(COALESCE(NEW.status, '')) NOT IN ('pending', 'terminated', 'inactive', 'paused')
          THEN status
        ELSE v_crm_status
      END,
      original_start_date = COALESCE(v_effective, original_start_date),
      current_year_start_date = COALESCE(v_effective, current_year_start_date),
      data = v_data,
      updated_at = now()
    WHERE id = v_existing_record_id;

    RETURN NEW;
  END IF;

  INSERT INTO crm_records (
    organization_id, module_id, title, email, phone, status,
    original_start_date, current_year_start_date, data,
    created_at, updated_at
  ) VALUES (
    NEW.organization_id,
    v_contacts_module_id,
    v_record_title,
    NEW.email,
    NEW.phone,
    v_crm_status,
    v_effective,
    v_effective,
    jsonb_strip_nulls(jsonb_build_object(
      'first_name',       NEW.first_name,
      'last_name',        NEW.last_name,
      'email',            NEW.email,
      'phone',            NEW.phone,
      'contact_status',   v_crm_status,
      'linked_member_id', NEW.id::text,
      'member_number',    NULLIF(BTRIM(COALESCE(NEW.member_number, '')), ''),
      'effective_date',   CASE WHEN v_effective IS NULL THEN NULL ELSE v_effective::text END,
      'start_date',       CASE WHEN v_effective IS NULL THEN NULL ELSE v_effective::text END,
      'source',           'enrollment_sync'
    )),
    now(), now()
  )
  ON CONFLICT (org_id, module_id, lower(email),
               lower(btrim(coalesce(data->>'first_name', ''))),
               lower(btrim(coalesce(data->>'last_name', ''))))
    WHERE (email IS NOT NULL AND email <> ''
           AND (system->>'source_table') IS DISTINCT FROM 'members'
           AND deleted_at IS NULL)
    DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sync_member_to_crm failed for member %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Ledger helper (idempotent cancelled / returned)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_append_person_lifecycle_event(
  p_org_id uuid,
  p_contact_id uuid,
  p_event_type text,
  p_source text,
  p_metadata jsonb DEFAULT '{}'::jsonb
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
    p_org_id, p_contact_id, p_event_type, (timezone('utc', now()))::date, p_source,
    coalesce(p_metadata, '{}'::jsonb)
  );
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.crm_append_person_lifecycle_event(uuid, uuid, text, text, jsonb) IS
  'Idempotent cancelled/returned write. No second open cancelled; no returned without one.';

REVOKE ALL ON FUNCTION public.crm_append_person_lifecycle_event(uuid, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_append_person_lifecycle_event(uuid, uuid, text, text, jsonb) TO service_role;

-- Optional: backfill missing cancelled events. NOT invoked here (prod write).
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
    SELECT rec.id, coalesce(rec.organization_id, rec.org_id) AS org_id
    FROM crm_records rec
    JOIN crm_modules m ON m.id = rec.module_id
    WHERE rec.org_id = p_org_id
      AND rec.deleted_at IS NULL
      AND rec.status IN ('Cancelled', 'Terminated', 'Deceased')
      AND m.key IN ('contacts', 'history')
      AND coalesce(rec.system->>'source_table', '') IS DISTINCT FROM 'members'
  LOOP
    IF public.crm_append_person_lifecycle_event(
      r.org_id, r.id, 'cancelled', 'history_backfill',
      jsonb_build_object('source', 'crm_backfill_cancelled_lifecycle_events')
    ) THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_backfill_cancelled_lifecycle_events(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. LifecycleModuleBinding trigger (AFTER status guard)
-- ---------------------------------------------------------------------------
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
BEGIN
  IF current_setting('crm.skip_history_roster', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  SELECT key INTO v_key FROM crm_modules WHERE id = NEW.module_id;
  IF v_key IS NULL OR v_key NOT IN ('contacts', 'history') THEN
    RETURN NEW;
  END IF;

  v_members_source := coalesce(NEW.system->>'source_table', '') = 'members';

  SELECT id INTO v_history
  FROM crm_modules
  WHERE org_id = NEW.org_id AND key = 'history' AND coalesce(is_enabled, true)
  LIMIT 1;
  SELECT id INTO v_contacts
  FROM crm_modules
  WHERE org_id = NEW.org_id AND key = 'contacts' AND coalesce(is_enabled, true)
  LIMIT 1;

  v_target := NULL;
  IF NOT v_members_source THEN
    IF v_key = 'contacts'
       AND NEW.status IN ('Cancelled', 'Terminated', 'Deceased')
       AND v_history IS NOT NULL
       AND NEW.module_id IS DISTINCT FROM v_history THEN
      v_target := v_history;
      v_event := 'cancelled';
    ELSIF v_key = 'history'
       AND NEW.status IN (
         'Active','Inactive','Pending','In Process','Prospect',
         'Lost','Declined','Abandoned'
       )
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
  ELSIF v_members_source THEN
    IF NEW.status IN ('Cancelled', 'Terminated', 'Deceased')
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
      v_event := 'cancelled';
    ELSIF NEW.status IN (
         'Active','Inactive','Pending','In Process','Prospect',
         'Lost','Declined','Abandoned'
       )
       AND TG_OP = 'UPDATE'
       AND OLD.status IN ('Cancelled', 'Terminated', 'Deceased') THEN
      v_event := 'returned';
    END IF;
  END IF;

  IF v_event IS NULL THEN
    IF v_key = 'contacts'
       AND NEW.status IN ('Cancelled', 'Terminated', 'Deceased')
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
      v_event := 'cancelled';
    ELSIF v_key = 'history'
       AND NEW.status IN (
         'Active','Inactive','Pending','In Process','Prospect',
         'Lost','Declined','Abandoned'
       )
       AND TG_OP = 'UPDATE'
       AND OLD.status IN ('Cancelled', 'Terminated', 'Deceased') THEN
      v_event := 'returned';
    END IF;
  END IF;

  -- Module-only hop (Phase 3 backfill): status already historical.
  IF v_event IS NULL AND TG_OP = 'UPDATE' AND OLD.module_id IS DISTINCT FROM NEW.module_id THEN
    SELECT key INTO v_old_key FROM crm_modules WHERE id = OLD.module_id;
    IF v_old_key = 'contacts' AND v_key = 'history'
       AND NEW.status IN ('Cancelled', 'Terminated', 'Deceased') THEN
      v_event := 'cancelled';
    ELSIF v_old_key = 'history' AND v_key = 'contacts' THEN
      v_event := 'returned';
    END IF;
  END IF;

  IF v_event IS NOT NULL THEN
    PERFORM public.crm_append_person_lifecycle_event(
      coalesce(NEW.organization_id, NEW.org_id),
      NEW.id,
      v_event,
      'history_roster',
      jsonb_build_object(
        'from_module', v_key,
        'status', NEW.status,
        'members_source', v_members_source
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_1_history_roster_trg ON public.crm_records;
CREATE TRIGGER crm_1_history_roster_trg
  AFTER INSERT OR UPDATE OF status, module_id
  ON public.crm_records
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_history_roster_bind();

COMMENT ON TRIGGER crm_1_history_roster_trg ON public.crm_records IS
  'Contacts + historical status → History; History + working status → Contacts. Skips members-source. Writes cancelled/returned.';

-- Phase 3 backfill (DO NOT RUN HERE). Expected PIFH count at plan time: 6422.
-- Abort if live count diverges or any candidate has system.source_table = members.
--
-- BEGIN;
-- SET lock_timeout = '5s';
-- -- SELECT count(*) FROM crm_records r
-- -- JOIN crm_modules m ON m.id = r.module_id
-- -- WHERE m.key = 'contacts' AND r.org_id = '00000000-0000-0000-0000-000000000001'
-- --   AND r.deleted_at IS NULL
-- --   AND r.status IN ('Cancelled','Terminated','Deceased')
-- --   AND coalesce(r.system->>'source_table','') IS DISTINCT FROM 'members';
-- -- UPDATE ... SET module_id = :history_module_id ...
-- ROLLBACK;

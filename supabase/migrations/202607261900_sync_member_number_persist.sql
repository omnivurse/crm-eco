-- Persist member_number on sync_member_to_crm match/update and on enrollment_sync
-- stub insert so Amber-class email mismatches stay matchable after first sync.
-- Also adds an expression index for the member_number lookup path.

CREATE OR REPLACE FUNCTION public.sync_member_to_crm()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_contacts_module_id uuid;
  v_existing_record_id uuid;
  v_record_title       text;
  v_data               jsonb;
  v_member_number      text;
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

  v_record_title := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
  IF v_record_title = '' THEN
    v_record_title := COALESCE(NEW.email, 'Member ' || NEW.id::text);
  END IF;

  -- 1. Exact linked_member_id match (cheapest and most specific).
  SELECT id INTO v_existing_record_id
  FROM crm_records
  WHERE module_id = v_contacts_module_id
    AND organization_id    = NEW.organization_id
    AND deleted_at IS NULL
    AND (data->>'linked_member_id') = NEW.id::text
  LIMIT 1;

  -- 2. Member number match — Zoho imports store member_number in JSONB while
  --    indexed email may differ from the MMS member row (e.g. proton vs gmail).
  IF v_existing_record_id IS NULL
     AND NEW.member_number IS NOT NULL
     AND BTRIM(NEW.member_number) <> '' THEN
    SELECT id INTO v_existing_record_id
    FROM crm_records
    WHERE module_id = v_contacts_module_id
      AND organization_id = NEW.organization_id
      AND deleted_at IS NULL
      AND BTRIM(COALESCE(data->>'member_number', '')) = BTRIM(NEW.member_number)
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  -- 3. Email + NAME match (case-insensitive) when no link yet. Email alone
  --    is not sufficient — family members legitimately share one email.
  IF v_existing_record_id IS NULL
     AND NEW.email IS NOT NULL
     AND NEW.email <> ''
     AND NEW.first_name IS NOT NULL
     AND NEW.last_name  IS NOT NULL THEN
    SELECT id INTO v_existing_record_id
    FROM crm_records
    WHERE module_id = v_contacts_module_id
      AND organization_id    = NEW.organization_id
      AND deleted_at IS NULL
      AND email IS NOT NULL
      AND LOWER(email) = LOWER(NEW.email)
      AND LOWER(COALESCE(data->>'first_name','')) = LOWER(NEW.first_name)
      AND LOWER(COALESCE(data->>'last_name', '')) = LOWER(NEW.last_name)
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  -- 4. Phone + name match. Phone alone is too loose (household lines,
  --    office numbers), so we require the name to line up too.
  IF v_existing_record_id IS NULL
     AND NEW.phone IS NOT NULL
     AND NEW.phone <> ''
     AND NEW.first_name IS NOT NULL
     AND NEW.last_name  IS NOT NULL THEN
    SELECT id INTO v_existing_record_id
    FROM crm_records
    WHERE module_id = v_contacts_module_id
      AND organization_id    = NEW.organization_id
      AND deleted_at IS NULL
      AND phone     = NEW.phone
      AND LOWER(COALESCE(data->>'first_name','')) = LOWER(NEW.first_name)
      AND LOWER(COALESCE(data->>'last_name', '')) = LOWER(NEW.last_name)
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 1;
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

    -- Persist member_number when present; never blank an existing value.
    v_member_number := NULLIF(BTRIM(COALESCE(NEW.member_number, '')), '');
    IF v_member_number IS NOT NULL THEN
      v_data := jsonb_set(v_data, '{member_number}', to_jsonb(v_member_number), true);
    END IF;

    UPDATE crm_records
    SET
      title = COALESCE(NULLIF(title, ''), v_record_title),
      email = COALESCE(NULLIF(email, ''), NEW.email),
      phone = COALESCE(NULLIF(phone, ''), NEW.phone),
      status = CASE
        WHEN NEW.status = 'Active' THEN 'Active'
        WHEN status = 'Active'     THEN status
        ELSE COALESCE(NEW.status, status)
      END,
      data = v_data,
      updated_at = now()
    WHERE id = v_existing_record_id;

    RETURN NEW;
  END IF;

  -- Nothing matched — insert a fresh Contact (include member_number for later match).
  INSERT INTO crm_records (
    organization_id, module_id, title, email, phone, status, data,
    created_at, updated_at
  ) VALUES (
    NEW.organization_id,
    v_contacts_module_id,
    v_record_title,
    NEW.email,
    NEW.phone,
    COALESCE(NEW.status, 'Active'),
    jsonb_strip_nulls(jsonb_build_object(
      'first_name',       NEW.first_name,
      'last_name',        NEW.last_name,
      'email',            NEW.email,
      'phone',            NEW.phone,
      'contact_status',   COALESCE(NEW.status, 'Active'),
      'linked_member_id', NEW.id::text,
      'member_number',    NULLIF(BTRIM(COALESCE(NEW.member_number, '')), ''),
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

-- Non-CONCURRENTLY so this migration can run inside a transaction.
-- Prod may also create the same index via CREATE INDEX CONCURRENTLY IF NOT EXISTS.
CREATE INDEX IF NOT EXISTS idx_crm_records_org_member_number
  ON crm_records (organization_id, (BTRIM(data->>'member_number')))
  WHERE deleted_at IS NULL
    AND BTRIM(COALESCE(data->>'member_number', '')) <> '';

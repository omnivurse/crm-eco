-- ============================================================================
-- Migration: Stop the enrollment sync from creating duplicate Contacts.
--
-- Background: `sync_member_to_crm` fires from the enrollment side on INSERT
-- or UPDATE of members. Its only "does a Contact already exist?" check was
-- data->>'linked_member_id' = NEW.id. Any Contact created before the member
-- (manual entry, import, lead conversion) is invisible to the trigger and a
-- second Contact gets inserted — that's the "Active" twin that PIFH is
-- seeing on every record.
--
-- Fix: walk a match ladder instead of a single lookup, and backfill
-- linked_member_id so the trigger self-heals on the next run.
--
--   1. data->>'linked_member_id' matches NEW.id          (previous behavior)
--   2. LOWER(email) matches NEW.email                    (new)
--   3. phone matches NEW.phone and first+last matches    (new, phone-only
--      would false-positive on shared household lines)
--
-- If any match is found we UPDATE that Contact and stamp it with
-- linked_member_id. Only when nothing matches do we INSERT.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_member_to_crm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  v_contacts_module_id uuid;
  v_existing_record_id uuid;
  v_record_title       text;
BEGIN
  SELECT id INTO v_contacts_module_id
  FROM crm_modules
  WHERE org_id = NEW.organization_id
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
    AND org_id    = NEW.organization_id
    AND (data->>'linked_member_id') = NEW.id::text
  LIMIT 1;

  -- 2. Email match (case-insensitive) when no link yet.
  IF v_existing_record_id IS NULL
     AND NEW.email IS NOT NULL
     AND NEW.email <> '' THEN
    SELECT id INTO v_existing_record_id
    FROM crm_records
    WHERE module_id = v_contacts_module_id
      AND org_id    = NEW.organization_id
      AND email IS NOT NULL
      AND LOWER(email) = LOWER(NEW.email)
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  -- 3. Phone + name match. Phone alone is too loose (household lines,
  --    office numbers), so we require the name to line up too.
  IF v_existing_record_id IS NULL
     AND NEW.phone IS NOT NULL
     AND NEW.phone <> ''
     AND NEW.first_name IS NOT NULL
     AND NEW.last_name  IS NOT NULL THEN
    SELECT id INTO v_existing_record_id
    FROM crm_records
    WHERE module_id = v_contacts_module_id
      AND org_id    = NEW.organization_id
      AND phone     = NEW.phone
      AND LOWER(COALESCE(data->>'first_name','')) = LOWER(NEW.first_name)
      AND LOWER(COALESCE(data->>'last_name', '')) = LOWER(NEW.last_name)
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_existing_record_id IS NOT NULL THEN
    -- Update + stamp linked_member_id so subsequent syncs short-circuit on
    -- the fast path.
    UPDATE crm_records
    SET
      title = COALESCE(NULLIF(title, ''), v_record_title),
      email = COALESCE(NULLIF(email, ''), NEW.email),
      phone = COALESCE(NULLIF(phone, ''), NEW.phone),
      -- Don't stomp an Active status with a Pending one — but do promote
      -- the other way around.
      status = CASE
        WHEN NEW.status = 'Active' THEN 'Active'
        WHEN status = 'Active'     THEN status
        ELSE COALESCE(NEW.status, status)
      END,
      data = jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              COALESCE(data, '{}'::jsonb),
              '{first_name}', to_jsonb(COALESCE(NEW.first_name, data->>'first_name'))
            ),
            '{last_name}',  to_jsonb(COALESCE(NEW.last_name,  data->>'last_name'))
          ),
          '{email}',        to_jsonb(COALESCE(NEW.email,      data->>'email'))
        ),
        '{linked_member_id}', to_jsonb(NEW.id::text)
      ),
      updated_at = now()
    WHERE id = v_existing_record_id;

    RETURN NEW;
  END IF;

  -- Nothing matched — insert a fresh Contact.
  INSERT INTO crm_records (
    org_id, module_id, title, email, phone, status, data, search,
    created_at, updated_at
  ) VALUES (
    NEW.organization_id,
    v_contacts_module_id,
    v_record_title,
    NEW.email,
    NEW.phone,
    COALESCE(NEW.status, 'Active'),
    jsonb_build_object(
      'first_name',       NEW.first_name,
      'last_name',        NEW.last_name,
      'email',            NEW.email,
      'phone',            NEW.phone,
      'contact_status',   COALESCE(NEW.status, 'Active'),
      'linked_member_id', NEW.id::text,
      'source',           'enrollment_sync'
    ),
    to_tsvector('english', COALESCE(v_record_title, '') || ' ' || COALESCE(NEW.email, '')),
    now(), now()
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sync_member_to_crm failed for member %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$fn$;

COMMIT;

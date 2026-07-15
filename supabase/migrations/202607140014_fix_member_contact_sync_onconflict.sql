-- ============================================================================
-- Fix: member -> Contact auto-sync silently created no Contact for new members.
--
-- sync_member_to_crm() (the contacts-module sync, fired by trigger
-- trigger_sync_member_to_crm on members INSERT/UPDATE) ends with a fresh-Contact
-- INSERT guarded by:
--     ON CONFLICT (org_id, module_id, lower(email)) WHERE (...) DO NOTHING
-- That 3-column arbiter needs a UNIQUE index on exactly (org_id, module_id,
-- lower(email)). Migration 202607090004 redefined idx_crm_records_unique_email
-- to FIVE columns (… + first_name + last_name), so since 2026-07-09 NO index
-- matches that arbiter. ON CONFLICT inference is resolved at plan time, so the
-- INSERT raises 42P10 ("no unique or exclusion constraint matching the ON
-- CONFLICT specification") EVERY time it runs — then the function's
-- `EXCEPTION WHEN OTHERS THEN RAISE WARNING … RETURN NEW` swallows it. Net
-- effect: a brand-new member whose Contact isn't already matched by
-- linked_member_id / email+name / phone+name gets NO Contact, only a warning.
--
-- Fix: repoint the arbiter to the CURRENT index — the 5-column expression set
-- plus the same partial predicate, including the `deleted_at IS NULL` clause
-- added in 6a-2 (202607140013). This restores the intended "skip an exact
-- same-email+same-name duplicate, but let a different-named family member get
-- their own Contact" semantics (the whole point of 202607090004), and makes the
-- fresh-insert path succeed for genuinely new members.
--
-- Everything else in the function is reproduced byte-for-byte from its current
-- definition (202606170001); ONLY the ON CONFLICT clause changes.
--
-- IMPORTANT maintenance note: this ON CONFLICT arbiter MUST stay in lockstep with
-- idx_crm_records_unique_email's column list + predicate. That coupling is
-- exactly what silently broke here — if you ever change that index again, update
-- this arbiter (and the sync_member_to_crm_records source-id path) in the same
-- migration, or drop ON CONFLICT and rely on the EXCEPTION handler.
-- ============================================================================

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
    AND (data->>'linked_member_id') = NEW.id::text
  LIMIT 1;

  -- 2. Email + NAME match (case-insensitive) when no link yet. CHANGED (B2): email alone
  --    is no longer sufficient — family members legitimately share one email, and matching
  --    on email-only let member B overwrite member A's Contact. Require the name to line up.
  IF v_existing_record_id IS NULL
     AND NEW.email IS NOT NULL
     AND NEW.email <> ''
     AND NEW.first_name IS NOT NULL
     AND NEW.last_name  IS NOT NULL THEN
    SELECT id INTO v_existing_record_id
    FROM crm_records
    WHERE module_id = v_contacts_module_id
      AND organization_id    = NEW.organization_id
      AND email IS NOT NULL
      AND LOWER(email) = LOWER(NEW.email)
      AND LOWER(COALESCE(data->>'first_name','')) = LOWER(NEW.first_name)
      AND LOWER(COALESCE(data->>'last_name', '')) = LOWER(NEW.last_name)
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
      AND organization_id    = NEW.organization_id
      AND phone     = NEW.phone
      AND LOWER(COALESCE(data->>'first_name','')) = LOWER(NEW.first_name)
      AND LOWER(COALESCE(data->>'last_name', '')) = LOWER(NEW.last_name)
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_existing_record_id IS NOT NULL THEN
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

  -- Nothing matched — insert a fresh Contact. CHANGED (B2): ON CONFLICT DO NOTHING so a
  -- same-email contact (family member, contacts module still email-deduped) degrades
  -- cleanly instead of raising and being swallowed by the EXCEPTION handler.
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
    jsonb_build_object(
      'first_name',       NEW.first_name,
      'last_name',        NEW.last_name,
      'email',            NEW.email,
      'phone',            NEW.phone,
      'contact_status',   COALESCE(NEW.status, 'Active'),
      'linked_member_id', NEW.id::text,
      'source',           'enrollment_sync'
    ),
    now(), now()
  )
  -- FIXED: match the CURRENT idx_crm_records_unique_email (5-column, +deleted_at)
  -- instead of the obsolete 3-column spec that matched no index (42P10). org_id
  -- is populated by the BEFORE-INSERT sync_org_tenant_key() trigger, so the
  -- arbiter sees it before the conflict check.
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

-- Wave 2 / DHH-AUDIT-006 — B1/B2 family-shared-email member CRM sync fix
-- Rehearsed on prod 2026-06-15: index + functions OK; backfill uses contacts-trigger disable
-- to avoid statement_timeout on sync_member_to_crm() linked_member_id scan.

SET lock_timeout = '4s';
SET statement_timeout = '0';

-- Speed up sync_member_to_crm() step-1 linked_member_id lookup (B2)
CREATE INDEX IF NOT EXISTS idx_crm_records_contacts_linked_member
  ON crm_records (module_id, organization_id, ((data->>'linked_member_id')))
  WHERE data ? 'linked_member_id'
    AND (data->>'linked_member_id') <> '';

-- B1.1 — Re-scope email-unique index to exclude members module
DROP INDEX IF EXISTS idx_crm_records_unique_email;
CREATE UNIQUE INDEX idx_crm_records_unique_email
  ON crm_records (org_id, module_id, lower(email))
  WHERE email IS NOT NULL
    AND email <> ''
    AND (system->>'source_table') IS DISTINCT FROM 'members';

-- B1.2 — One members-module crm_record per member source_id
CREATE UNIQUE INDEX IF NOT EXISTS crm_records_members_source_uniq
  ON crm_records (org_id, module_id, (system->>'source_id'))
  WHERE (system->>'source_table') = 'members'
    AND (system->>'source_id') IS NOT NULL;
CREATE OR REPLACE FUNCTION public.sync_member_to_crm_records()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_module_id uuid;
  v_owner_id uuid;
  v_advisor_code text;
  v_advisor_name text;
  v_org_id uuid;
  v_data jsonb;
  v_market_type text;
  v_canonical_advisor_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_org_id := OLD.organization_id;
  ELSE
    v_org_id := NEW.organization_id;
  END IF;

  SELECT id INTO v_module_id
    FROM crm_modules WHERE organization_id = v_org_id AND key = 'members';

  IF v_module_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM crm_records
      WHERE module_id = v_module_id
        AND system->>'source_table' = 'members'
        AND system->>'source_id' = OLD.id::text;
    RETURN OLD;
  END IF;

  v_canonical_advisor_id := NEW.advisor_id;
  IF NEW.advisor_id IS NOT NULL THEN
    SELECT a.advisor_code, a.first_name || ' ' || a.last_name, p.id
    INTO v_advisor_code, v_advisor_name, v_owner_id
    FROM advisors a LEFT JOIN profiles p ON p.id = a.profile_id
    WHERE a.id = NEW.advisor_id;
  END IF;

  v_market_type := CASE
    WHEN NEW.plan_type ILIKE '%health%share%' OR NEW.plan_type ILIKE '%sharing%' THEN 'healthshare'
    WHEN NEW.plan_type ILIKE '%insurance%' OR NEW.plan_type ILIKE '%traditional%' THEN 'traditional_insurance'
    WHEN NEW.plan_name ILIKE '%MPB%' OR NEW.plan_name ILIKE '%MPowering%'
      OR NEW.plan_name ILIKE '%Sedera%' OR NEW.plan_name ILIKE '%Zion%'
      OR NEW.plan_name ILIKE '%sharing%' THEN 'healthshare'
    ELSE 'unknown'
  END;

  v_data := jsonb_build_object(
    'member_number', NEW.member_number,
    'first_name', NEW.first_name,
    'last_name', NEW.last_name,
    'date_of_birth', NEW.date_of_birth,
    'gender', NEW.gender,
    'marital_status', NEW.marital_status,
    'address_line1', NEW.address_line1,
    'address_line2', NEW.address_line2,
    'city', NEW.city,
    'state', NEW.state,
    'zip_code', NEW.postal_code,
    'advisor_id', NEW.advisor_id,
    'advisor_code', v_advisor_code,
    'advisor_name', v_advisor_name,
    'plan_name', NEW.plan_name,
    'plan_type', NEW.plan_type,
    'effective_date', NEW.effective_date,
    'monthly_share', NEW.monthly_share,
    'coverage_type', NEW.coverage_type,
    'program_type', NEW.program_type
  );

  v_data := v_data || jsonb_build_object(
    'enrollment_source', COALESCE(NEW.custom_fields->>'enrollment_source', ''),
    'county', NEW.county,
    'phone2', NEW.phone2,
    'phone3', NEW.phone3,
    'fax', NEW.fax,
    'email2', NEW.email2,
    'email3', NEW.email3,
    'do_not_call', NEW.do_not_call,
    'company_name', NEW.company_name,
    'position', NEW.position,
    'department', NEW.department,
    'division', NEW.division,
    'ethnicity', NEW.ethnicity,
    'height', NEW.height,
    'weight', NEW.weight,
    'disability', NEW.disability,
    'source', NEW.source,
    'referral', NEW.referral,
    'member_type', NEW.member_type,
    'stage', NEW.stage,
    'internal_id', NEW.internal_id,
    'external_username', NEW.external_username
  );

  IF TG_OP = 'INSERT' THEN
    INSERT INTO crm_records (
      organization_id, module_id, owner_id,
      title, status, email, phone,
      data, system,
      market_type, canonical_advisor_id, normalized_advisor_name,
      tobacco_user, record_type, import_source, normalization_status,
      created_at, updated_at
    ) VALUES (
      NEW.organization_id, v_module_id, v_owner_id,
      NEW.first_name || ' ' || NEW.last_name,
      NEW.status, NEW.email, NEW.phone,
      v_data,
      jsonb_build_object(
        'source_table', 'members',
        'source_id', NEW.id::text,
        'member_number', NEW.member_number,
        'synced', true
      ),
      v_market_type, v_canonical_advisor_id, v_advisor_name,
      COALESCE(NEW.is_smoker, false),
      'individual', 'enrollment',
      CASE WHEN v_market_type != 'unknown' THEN 'normalized' ELSE 'needs_review' END,
      NEW.created_at, now()
    )
    -- CHANGED (B1): de-conflict on the per-member source_id index, NOT email — so a 2nd
    -- family member sharing an email gets their own record instead of vanishing.
    ON CONFLICT (org_id, module_id, (system->>'source_id'))
      WHERE (system->>'source_table') = 'members' AND (system->>'source_id') IS NOT NULL
      DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE crm_records SET
      title = NEW.first_name || ' ' || NEW.last_name,
      status = NEW.status, email = NEW.email, phone = NEW.phone,
      owner_id = COALESCE(v_owner_id, owner_id),
      data = v_data,
      system = jsonb_build_object(
        'source_table', 'members', 'source_id', NEW.id::text,
        'member_number', NEW.member_number, 'synced', true
      ),
      market_type = COALESCE(v_market_type, market_type),
      canonical_advisor_id = COALESCE(v_canonical_advisor_id, canonical_advisor_id),
      normalized_advisor_name = COALESCE(v_advisor_name, normalized_advisor_name),
      tobacco_user = COALESCE(NEW.is_smoker, tobacco_user),
      record_type = COALESCE(record_type, 'individual'),
      import_source = COALESCE(import_source, 'enrollment'),
      updated_at = now()
    WHERE module_id = v_module_id
      AND system->>'source_table' = 'members'
      AND system->>'source_id' = OLD.id::text;

    IF NOT FOUND THEN
      INSERT INTO crm_records (
        organization_id, module_id, owner_id,
        title, status, email, phone,
        data, system,
        market_type, canonical_advisor_id, normalized_advisor_name,
        tobacco_user, record_type, import_source, normalization_status,
        created_at, updated_at
      ) VALUES (
        NEW.organization_id, v_module_id, v_owner_id,
        NEW.first_name || ' ' || NEW.last_name,
        NEW.status, NEW.email, NEW.phone,
        v_data,
        jsonb_build_object(
          'source_table', 'members', 'source_id', NEW.id::text,
          'member_number', NEW.member_number, 'synced', true
        ),
        v_market_type, v_canonical_advisor_id, v_advisor_name,
        COALESCE(NEW.is_smoker, false),
        'individual', 'enrollment',
        CASE WHEN v_market_type != 'unknown' THEN 'normalized' ELSE 'needs_review' END,
        COALESCE(NEW.created_at, now()), now()
      )
      ON CONFLICT (org_id, module_id, (system->>'source_id'))
        WHERE (system->>'source_table') = 'members' AND (system->>'source_id') IS NOT NULL
        DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'sync_member_to_crm_records failed for member %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$function$;

-- ------------------------------------------------------------------------------
-- B2 — sync_member_to_crm() (contacts): add a NAME filter to the step-2 email match so a
--      different-named family member can no longer hijack a sibling's Contact (stops the
--      ping-pong). The bare INSERT also gets ON CONFLICT DO NOTHING so it degrades
--      cleanly instead of relying on the catch-all EXCEPTION handler.
--
--      OPEN DECISION (NOT done here): the contacts module is still email-deduped by
--      idx_crm_records_unique_email (intentionally — see 202603040001 "prevent_duplicate_
--      contacts"). So the 2nd family member still won't get their OWN Contact; they just
--      no longer corrupt the first one. Letting two same-email family Contacts coexist
--      requires relaxing the contacts email-dedup, which trades off against lead/contact
--      dedup — decide explicitly before changing.
-- ------------------------------------------------------------------------------
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
  ON CONFLICT (org_id, module_id, lower(email))
    WHERE (email IS NOT NULL AND email <> ''
           AND (system->>'source_table') IS DISTINCT FROM 'members')
    DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sync_member_to_crm failed for member %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

-- B1.4 — BACKFILL: fire members-module sync only (skip contacts sync during bulk touch)
ALTER TABLE public.members DISABLE TRIGGER trigger_sync_member_to_crm;

UPDATE public.members m
   SET updated_at = now()
 WHERE m.merged_into_id IS NULL
   AND EXISTS (
     SELECT 1 FROM crm_modules cm
      WHERE cm.organization_id = m.organization_id AND cm.key = 'members'
   )
   AND NOT EXISTS (
     SELECT 1 FROM crm_records r
       JOIN crm_modules cm ON cm.id = r.module_id
      WHERE cm.key = 'members'
        AND cm.organization_id = m.organization_id
        AND r.system->>'source_table' = 'members'
        AND r.system->>'source_id'    = m.id::text
   );

ALTER TABLE public.members ENABLE TRIGGER trigger_sync_member_to_crm;

-- Member activation harden:
-- 1) Map MMS lowercase members.status → CRM Title Case taxonomy in both sync triggers
-- 2) Persist coverage start dates onto CRM contacts/members records for activate-pending
-- 3) finalize_member_enrollment_tx also sets members.status/effective_date
--
-- Idempotent: CREATE OR REPLACE only. Rollback = re-apply prior function bodies from
-- 202607261900_sync_member_number_persist.sql + 202606280002_finalize_member_enrollment_tx.sql
-- (and live sync_member_to_crm_records body prior to this change).
--
-- PROD WRITE RISK: YES — apply only after explicit approval.

SET lock_timeout = '5s';

-- Shared status mapper: MMS lowercase → CRM Title Case (contacts + members modules).
CREATE OR REPLACE FUNCTION public.map_member_status_to_crm(p_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(btrim(coalesce(p_status, '')))
    WHEN 'active' THEN 'Active'
    WHEN 'pending' THEN 'Pending'
    WHEN 'terminated' THEN 'Terminated'
    WHEN 'inactive' THEN 'Inactive'
    WHEN 'paused' THEN 'Paused'
    WHEN 'prospect' THEN 'Prospect'
    WHEN '' THEN 'Active'
    ELSE initcap(btrim(p_status))
  END;
$$;

COMMENT ON FUNCTION public.map_member_status_to_crm(text) IS
  'Maps members.status (lowercase) to CRM crm_records Title Case taxonomy.';

-- ─────────────────────────────────────────────────────────────────────────────
-- sync_member_to_crm (contacts module)
-- ─────────────────────────────────────────────────────────────────────────────
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

  v_record_title := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
  IF v_record_title = '' THEN
    v_record_title := COALESCE(NEW.email, 'Member ' || NEW.id::text);
  END IF;

  v_crm_status := public.map_member_status_to_crm(NEW.status);
  v_effective := NEW.effective_date;

  -- 1. Exact linked_member_id match
  SELECT id INTO v_existing_record_id
  FROM crm_records
  WHERE module_id = v_contacts_module_id
    AND organization_id    = NEW.organization_id
    AND deleted_at IS NULL
    AND (data->>'linked_member_id') = NEW.id::text
  LIMIT 1;

  -- 2. Member number match
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

  -- 3. Email + NAME match
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

  -- 4. Phone + name match
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

    v_member_number := NULLIF(BTRIM(COALESCE(NEW.member_number, '')), '');
    IF v_member_number IS NOT NULL THEN
      v_data := jsonb_set(v_data, '{member_number}', to_jsonb(v_member_number), true);
    END IF;

    -- Keep contact_status + start/effective dates in sync for activate-pending.
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
        -- Promote to Active when MMS is active
        WHEN lower(COALESCE(NEW.status, '')) = 'active' THEN 'Active'
        -- Preserve richer Active-* CRM statuses when MMS is not actively changing
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

  -- Nothing matched — insert a fresh Contact
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

-- ─────────────────────────────────────────────────────────────────────────────
-- sync_member_to_crm_records (members module) — Title Case status + start cols
-- ─────────────────────────────────────────────────────────────────────────────
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
  v_crm_status text;
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

  v_crm_status := public.map_member_status_to_crm(NEW.status);
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
    'start_date', NEW.effective_date,
    'monthly_share', NEW.monthly_share,
    'coverage_type', NEW.coverage_type,
    'program_type', NEW.program_type,
    'contact_status', v_crm_status
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
      original_start_date, current_year_start_date,
      data, system,
      market_type, canonical_advisor_id, normalized_advisor_name,
      tobacco_user, record_type, import_source, normalization_status,
      created_at, updated_at
    ) VALUES (
      NEW.organization_id, v_module_id, v_owner_id,
      NEW.first_name || ' ' || NEW.last_name,
      v_crm_status, NEW.email, NEW.phone,
      NEW.effective_date, NEW.effective_date,
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
    ON CONFLICT (org_id, module_id, (system->>'source_id'))
      WHERE (system->>'source_table') = 'members' AND (system->>'source_id') IS NOT NULL
      DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE crm_records SET
      title = NEW.first_name || ' ' || NEW.last_name,
      status = v_crm_status, email = NEW.email, phone = NEW.phone,
      original_start_date = COALESCE(NEW.effective_date, original_start_date),
      current_year_start_date = COALESCE(NEW.effective_date, current_year_start_date),
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
        original_start_date, current_year_start_date,
        data, system,
        market_type, canonical_advisor_id, normalized_advisor_name,
        tobacco_user, record_type, import_source, normalization_status,
        created_at, updated_at
      ) VALUES (
        NEW.organization_id, v_module_id, v_owner_id,
        NEW.first_name || ' ' || NEW.last_name,
        v_crm_status, NEW.email, NEW.phone,
        NEW.effective_date, NEW.effective_date,
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

-- ─────────────────────────────────────────────────────────────────────────────
-- finalize_member_enrollment_tx — also set members.effective_date + pending
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.finalize_member_enrollment_tx(
  p_org_id uuid,
  p_enrollment_id uuid,
  p_payment_profile_id uuid DEFAULT NULL,
  p_effective_date date DEFAULT NULL,
  p_charged_first_month boolean DEFAULT true
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_enr            public.enrollments%ROWTYPE;
  v_effective      date;
  v_next_billing   date;
  v_membership_id  uuid;
  v_schedule_id    uuid;
  v_amount         numeric;
BEGIN
  SELECT * INTO v_enr
    FROM public.enrollments
   WHERE id = p_enrollment_id AND organization_id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment % not found in organization %', p_enrollment_id, p_org_id;
  END IF;

  IF v_enr.primary_member_id IS NULL THEN
    RAISE EXCEPTION 'Enrollment % has no primary member', p_enrollment_id;
  END IF;
  IF v_enr.selected_plan_id IS NULL THEN
    RAISE EXCEPTION 'Enrollment % has no selected plan; cannot create a membership', p_enrollment_id;
  END IF;

  v_effective := COALESCE(
    date_trunc('month', p_effective_date)::date,
    (date_trunc('month', CURRENT_DATE) + interval '1 month')::date
  );
  v_next_billing := CASE
    WHEN p_charged_first_month THEN (v_effective + interval '1 month')::date
    ELSE v_effective
  END;
  v_amount := COALESCE(v_enr.base_monthly_cost, 0);

  SELECT id INTO v_membership_id
    FROM public.memberships
   WHERE enrollment_id = p_enrollment_id AND organization_id = p_org_id
   LIMIT 1;

  IF v_membership_id IS NULL THEN
    INSERT INTO public.memberships (
      organization_id, member_id, plan_id, advisor_id, enrollment_id,
      status, effective_date, billing_amount, billing_frequency
    ) VALUES (
      p_org_id, v_enr.primary_member_id, v_enr.selected_plan_id, v_enr.advisor_id, p_enrollment_id,
      'pending', v_effective, v_amount, 'monthly'
    )
    RETURNING id INTO v_membership_id;
  ELSE
    UPDATE public.memberships
       SET plan_id        = v_enr.selected_plan_id,
           advisor_id     = COALESCE(advisor_id, v_enr.advisor_id),
           effective_date = v_effective,
           billing_amount = v_amount,
           updated_at     = now()
     WHERE id = v_membership_id;
  END IF;

  -- Align coverage start on the member row. Never demote active/paused/terminal
  -- on idempotent re-runs; only coerce prospect/null/other into pending.
  UPDATE public.members
     SET status = CASE
           WHEN status IN ('active', 'paused', 'terminated', 'inactive') THEN status
           ELSE 'pending'
         END,
         effective_date = v_effective,
         updated_at = now()
   WHERE id = v_enr.primary_member_id
     AND organization_id = p_org_id;

  IF v_enr.status IN ('draft', 'in_progress', 'submitted', 'on_hold') THEN
    UPDATE public.enrollments
       SET status            = 'approved',
           effective_date    = v_effective,
           permanent_bill_day = 1,
           updated_at        = now()
     WHERE id = p_enrollment_id;
  END IF;

  UPDATE public.billing_schedules
     SET billing_day        = 1,
         day_of_month       = 1,
         frequency          = 'monthly',
         start_date         = v_effective,
         next_billing_date  = v_next_billing,
         last_billed_date   = CASE WHEN p_charged_first_month THEN CURRENT_DATE ELSE last_billed_date END,
         amount             = v_amount,
         payment_profile_id = COALESCE(p_payment_profile_id, payment_profile_id),
         status             = 'active',
         updated_at         = now()
   WHERE enrollment_id = p_enrollment_id
     AND organization_id = p_org_id
   RETURNING id INTO v_schedule_id;

  IF v_schedule_id IS NULL THEN
    INSERT INTO public.billing_schedules (
      organization_id, enrollment_id, member_id, payment_profile_id,
      amount, frequency, billing_day, day_of_month, start_date, next_billing_date,
      last_billed_date, status, idempotency_key
    ) VALUES (
      p_org_id, p_enrollment_id, v_enr.primary_member_id, p_payment_profile_id,
      v_amount, 'monthly', 1, 1, v_effective, v_next_billing,
      CASE WHEN p_charged_first_month THEN CURRENT_DATE ELSE NULL END,
      'active', 'finalize_' || p_enrollment_id::text
    )
    ON CONFLICT (idempotency_key) DO UPDATE
      SET payment_profile_id = EXCLUDED.payment_profile_id,
          next_billing_date  = EXCLUDED.next_billing_date,
          amount             = EXCLUDED.amount,
          updated_at         = now()
    RETURNING id INTO v_schedule_id;
  END IF;

  RETURN jsonb_build_object(
    'enrollment_id', p_enrollment_id,
    'member_id', v_enr.primary_member_id,
    'membership_id', v_membership_id,
    'plan_id', v_enr.selected_plan_id,
    'effective_date', v_effective,
    'billing_schedule_id', v_schedule_id,
    'next_billing_date', v_next_billing,
    'amount', v_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_member_enrollment_tx(uuid, uuid, uuid, date, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_member_enrollment_tx(uuid, uuid, uuid, date, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.finalize_member_enrollment_tx(uuid, uuid, uuid, date, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_member_enrollment_tx(uuid, uuid, uuid, date, boolean) TO service_role;

REVOKE ALL ON FUNCTION public.map_member_status_to_crm(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.map_member_status_to_crm(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.map_member_status_to_crm(text) TO authenticated;

-- ============================================================================
-- sync_member_to_crm(): classify the contacts twin's market_type
-- ----------------------------------------------------------------------------
-- WHY
-- `sync_member_to_crm()` creates/updates the CONTACTS twin of a member but never
-- sets `market_type`, so a new health-share enrollment lands an unclassified
-- contact (market_type NULL). Its sibling `sync_member_to_crm_records()` does
-- classify the MEMBERS-module row, so the same person ends up classified on one
-- surface and blank on the other. Consequences:
--   * health-share list filters / reports miss the contact
--   * the Health Sharing section has no reason to render
--   * crm_2_healthshare_canonical_trg (20260903190000) gates on market_type, so
--     canonical Health Share keys are not projected until something else
--     classifies the row
--
-- WHAT
-- Reuse the EXISTING classifier `public.classify_market_type(product, carrier,
-- coverage, iua)` — already the canonical implementation, used by
-- `upsert_contacts_batch`. No new classification logic is introduced.
--
-- Signals, richest first: the contact row's own product / carrier /
-- coverage_option / iua_amount (Zoho-era columns the classifier was written
-- for), falling back to the member's plan_name / plan_type / coverage_type.
--
-- SAFETY
--   * Fill-only: an existing real classification ('healthshare' /
--     'traditional_insurance') is NEVER overwritten. Only NULL / '' / 'unknown'
--     is upgraded, and only to a definite value — we never write 'unknown' over
--     an existing value.
--   * No backfill. Existing rows are reclassified lazily, only when their member
--     row is next written, so this cannot mass-reclassify reporting overnight.
--   * The rest of the function body is byte-identical to the deployed version
--     (captured via pg_get_functiondef); only the market_type lines are added.
--
-- ROLLBACK: re-apply the previous definition, i.e. this same body with the
-- `v_market_type` assignment removed, `market_type` dropped from the INSERT
-- column/value lists, and the `market_type = CASE ...` line dropped from the
-- UPDATE. See the tail of this file for the exact revert statement.
-- ============================================================================

SET lock_timeout = '5s';

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
  v_market_type        text;
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

    -- Classify from the contact's own coverage signals first, then the member's.
    v_market_type := public.classify_market_type(
      COALESCE(NULLIF(BTRIM(COALESCE(v_data->>'product', '')), ''), NEW.plan_name, NEW.plan_type),
      NULLIF(BTRIM(COALESCE(v_data->>'carrier', '')), ''),
      COALESCE(NULLIF(BTRIM(COALESCE(v_data->>'coverage_option', '')), ''), NEW.coverage_type, NEW.plan_type),
      NULLIF(BTRIM(COALESCE(v_data->>'iua_amount', '')), '')
    );

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
      -- Fill only: never overwrite a real classification, never write 'unknown'.
      market_type = CASE
        WHEN COALESCE(market_type, '') IN ('', 'unknown')
             AND v_market_type IS NOT NULL
             AND v_market_type <> 'unknown'
          THEN v_market_type
        ELSE market_type
      END,
      data = v_data,
      updated_at = now()
    WHERE id = v_existing_record_id;

    RETURN NEW;
  END IF;

  v_market_type := public.classify_market_type(
    COALESCE(NEW.plan_name, NEW.plan_type),
    NULL,
    COALESCE(NEW.coverage_type, NEW.plan_type),
    NULL
  );

  INSERT INTO crm_records (
    organization_id, module_id, title, email, phone, status,
    original_start_date, current_year_start_date, market_type, data,
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
    v_market_type,
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

COMMENT ON FUNCTION public.sync_member_to_crm() IS
  'Syncs a members row onto its CONTACTS twin. Classifies market_type via public.classify_market_type (fill-only, never overwrites a real classification) so the contacts twin matches the members-module row and the Health Share canonical projection can fire.';

-- ============================================================================
-- ROLLBACK: restore the previous definition by re-applying this function with
--   * the `v_market_type text;` declaration removed
--   * both `v_market_type := public.classify_market_type(...)` blocks removed
--   * `market_type` removed from the INSERT column list and its value list
--   * the `market_type = CASE ... END,` clause removed from the UPDATE
-- Nothing else in the body differs from the pre-change version, so no data
-- rollback is required — this migration writes no rows of its own.
-- ============================================================================

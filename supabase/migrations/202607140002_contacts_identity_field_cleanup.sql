-- =============================================================================
-- Migration: Contacts / Leads identity-section cleanup  (Phase 1 + 2a)
-- =============================================================================
--
-- Client feedback: the contact/member record form's identity section is
-- cluttered with redundant fields and confusingly named ones. This migration
-- ships the full SAFE, reversible cleanup (audited 2026-07-14). Every change is
-- either a label/order update or a field-definition removal whose stored JSONB
-- values are retained — nothing is destructively deleted from record data.
--
-- What this does, on the `contacts` and `leads` modules:
--
--   1. RENAME confusing labels (label-only, no data touched):
--        title              "Title"                -> "Job Title"
--        primary_ss_number  "Primary S.S. Number"  -> "SSN"
--
--   2. CONSOLIDATE gender onto one key. The importer wrote
--      `primary_member_gender` while live member-sync logic reads `gender`, so
--      imported records silently never populated the field the app uses. We:
--        - backfill data.gender from data.primary_member_gender (non-destructive;
--          only where gender is empty),
--        - ensure a single canonical `gender` select field (label "Gender",
--          superset options), placed where the identity cluster lives,
--        - remove the duplicate `primary_member_gender` field row.
--      NOTE: the Zoho import mapping is repointed to `gender` in the same PR
--      (apps/crm/src/lib/imports/contacts-mapping.ts) so imports keep populating
--      the surviving field.
--
--   3. HIDE derivable / redundant fields by removing their definition rows
--      (their stored values remain in `crm_records.data` for traceability):
--        - birth_month   — a free-text helper fully derivable from date_of_birth,
--                          read by nothing.
--        - contact_name  — a legacy Zoho "First Last" concatenation that renders
--                          as a redundant fourth name field. Safe to remove the
--                          DEFINITION because every live consumer reads the JSONB
--                          VALUE `data->>'contact_name'`, not this row:
--                            * ongoing title: generate_record_title() derives from
--                              preferred_name/first_name + last_name, never
--                              contact_name (202606060001);
--                            * import title: reads the staging column v_row.contact_name;
--                            * full-text search: the generated `search` tsvector +
--                              trigger read data->>'contact_name';
--                            * list column: RecordTable reads data.contact_name.
--                          The value stays, so title/search/import are unchanged;
--                          only the form stops showing the field. (Fully purging
--                          the stored duplicate is a separate, riskier Phase 2b.)
--
--   4. REORDER the identity cluster so the name parts are contiguous
--      (Salutation, First, Middle, Last, Preferred) and the demographics group
--      at the end (Date of Birth, Gender, Marital Status).
--
--   5. CONFIRM two already-retired leftovers are gone: `middle_initial`
--      (merged into `middle_name` by 202604160002) and `record_id` (phantom
--      Zoho id, superseded by `zoho_record_id`). Defensive DELETE IF EXISTS.
--
-- DO NOT confuse `contact_name` here with the unrelated `contact_name` COLUMNS
-- on `vendors`, `carrier_contacts`, and `inbox_conversations` — different
-- entities on different tables, untouched by this module-scoped migration.
--
-- Idempotent and reversible: renames/reorders are UPDATEs; deleted field rows
-- can be re-inserted and their JSONB data is untouched. Safe to re-run.
-- =============================================================================

DO $$
DECLARE
  v_mod      record;
  v_section  text;
  v_updated  bigint;
BEGIN
  -- ------------------------------------------------------------------ backfill
  -- Copy primary_member_gender -> gender in the JSONB blob, only where the
  -- canonical gender key is empty (never overwrite an existing value). Global
  -- and guarded by key presence, so it only touches records that actually
  -- carry a primary_member_gender value.
  UPDATE crm_records
  SET data = jsonb_set(
        COALESCE(data, '{}'::jsonb),
        '{gender}',
        data->'primary_member_gender',
        true
      )
  WHERE COALESCE(NULLIF(data->>'primary_member_gender', ''), NULL) IS NOT NULL
    AND COALESCE(NULLIF(data->>'gender', ''), NULL) IS NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Backfilled gender from primary_member_gender on % records', v_updated;

  -- --------------------------------------------------------------- per module
  FOR v_mod IN
    SELECT id, org_id FROM crm_modules WHERE key IN ('contacts', 'leads')
  LOOP
    -- Anchor the canonical `gender` field to the same section the identity
    -- cluster already uses in THIS org (legacy 'core' vs seed 'main'), so it
    -- lands with the other name/demographic fields rather than a stray section.
    SELECT section INTO v_section
    FROM crm_fields
    WHERE module_id = v_mod.id AND key = 'first_name'
    LIMIT 1;
    v_section := COALESCE(v_section, 'core');

    -- (2) Ensure ONE canonical gender field. Upsert so an org that already has
    -- a lean `gender` (options Male/Female) gets the superset + correct label
    -- and placement, and an org that only had `primary_member_gender` gets a
    -- fresh `gender` before that row is dropped below.
    INSERT INTO crm_fields (
      org_id, module_id, key, label, type, required, is_system, is_pinned,
      is_indexed, options, display_order, section, tooltip
    ) VALUES (
      v_mod.org_id, v_mod.id, 'gender', 'Gender', 'select', false, false, false,
      false, '["Male","Female","Other","Prefer not to say"]'::jsonb, 15, v_section,
      'Member gender.'
    )
    ON CONFLICT (module_id, key) DO UPDATE
      SET label         = EXCLUDED.label,
          options       = EXCLUDED.options,
          section       = EXCLUDED.section,
          display_order = EXCLUDED.display_order,
          tooltip       = EXCLUDED.tooltip;

    -- (1) Rename confusing labels (label-only).
    UPDATE crm_fields SET label = 'Job Title'
      WHERE module_id = v_mod.id AND key = 'title';
    UPDATE crm_fields SET label = 'SSN'
      WHERE module_id = v_mod.id AND key = 'primary_ss_number';

    -- (4) Reorder the identity cluster: name parts contiguous, demographics
    -- grouped at the end. Only the listed keys are touched; anything else keeps
    -- its order.
    UPDATE crm_fields SET display_order = CASE key
        WHEN 'salutation'       THEN 1
        WHEN 'first_name'       THEN 2
        WHEN 'middle_name'      THEN 3
        WHEN 'last_name'        THEN 4
        WHEN 'preferred_name'   THEN 5
        WHEN 'contact_category' THEN 6   -- "Contact Type"
        WHEN 'title'            THEN 7   -- now "Job Title"
        WHEN 'email'            THEN 8
        WHEN 'secondary_email'  THEN 9
        WHEN 'phone'            THEN 10
        WHEN 'mobile'           THEN 11
        WHEN 'work_phone'       THEN 12
        WHEN 'fax'              THEN 13
        WHEN 'date_of_birth'    THEN 14
        WHEN 'gender'           THEN 15
        WHEN 'marital_status'   THEN 16
        ELSE display_order
      END
      WHERE module_id = v_mod.id
        AND key IN (
          'salutation','first_name','middle_name','last_name','preferred_name',
          'contact_category','title','email','secondary_email','phone','mobile',
          'work_phone','fax','date_of_birth','gender','marital_status'
        );

    -- (3) Remove redundant field definitions (JSONB values retained).
    --   birth_month:  derivable from date_of_birth, read by nothing.
    --   contact_name: derived First+Last dup; data + search + title wiring all
    --                 read the retained JSONB value, so only the form field goes.
    DELETE FROM crm_fields
      WHERE module_id = v_mod.id AND key IN ('birth_month', 'contact_name');

    -- (2 cont.) Remove the duplicate gender key now that gender is ensured +
    -- backfilled.
    DELETE FROM crm_fields
      WHERE module_id = v_mod.id AND key = 'primary_member_gender';

    -- (5) Confirm already-retired leftovers are gone (no-op if absent).
    DELETE FROM crm_fields
      WHERE module_id = v_mod.id AND key IN ('middle_initial', 'record_id');
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

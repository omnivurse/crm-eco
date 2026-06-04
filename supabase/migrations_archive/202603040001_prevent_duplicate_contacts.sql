-- ============================================================================
-- Migration: Prevent Duplicate Contacts and Leads
--
-- 1. Clean existing duplicates in crm_records (by email per org+module)
-- 2. Clean existing duplicates in leads (by email per org)
-- 3. Add unique partial indexes on email
-- 4. Add check_crm_duplicate() RPC function
-- ============================================================================

BEGIN;

-- ============================================================================
-- PHASE 1: Clean existing duplicates in crm_records
-- For each (org_id, module_id, LOWER(email)) group, keep the most recent record.
-- Merge data JSONB from duplicates into the keeper (keeper values win).
-- Child tables (crm_notes, crm_tasks, crm_attachments, crm_record_links) use
-- ON DELETE CASCADE, so we must re-associate them before deleting duplicates.
-- ============================================================================

DO $$
DECLARE
  dup_group RECORD;
  keeper_id uuid;
  dup_ids uuid[];
  dup_record RECORD;
  merged_data jsonb;
BEGIN
  -- Find all duplicate email groups in crm_records
  FOR dup_group IN
    SELECT org_id, module_id, LOWER(email) AS email_lower
    FROM crm_records
    WHERE email IS NOT NULL AND email != ''
    GROUP BY org_id, module_id, LOWER(email)
    HAVING COUNT(*) > 1
  LOOP
    -- Keeper = most recently updated record
    SELECT id INTO keeper_id
    FROM crm_records
    WHERE org_id = dup_group.org_id
      AND module_id = dup_group.module_id
      AND LOWER(email) = dup_group.email_lower
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    LIMIT 1;

    -- Get IDs of duplicates (all except keeper)
    SELECT array_agg(id) INTO dup_ids
    FROM crm_records
    WHERE org_id = dup_group.org_id
      AND module_id = dup_group.module_id
      AND LOWER(email) = dup_group.email_lower
      AND id != keeper_id;

    -- Merge data: start with oldest duplicate data as base, overlay newer, keeper wins
    SELECT data INTO merged_data FROM crm_records WHERE id = keeper_id;
    FOR dup_record IN
      SELECT id, data FROM crm_records
      WHERE id = ANY(dup_ids)
      ORDER BY updated_at ASC NULLS FIRST, created_at ASC NULLS FIRST
    LOOP
      -- Duplicate data is the base, keeper data overlays
      merged_data := COALESCE(dup_record.data, '{}'::jsonb) || COALESCE(merged_data, '{}'::jsonb);
    END LOOP;

    -- Update keeper with merged data
    UPDATE crm_records SET data = merged_data WHERE id = keeper_id;

    -- Re-associate child records before cascade delete
    UPDATE crm_notes SET record_id = keeper_id WHERE record_id = ANY(dup_ids);
    UPDATE crm_tasks SET record_id = keeper_id WHERE record_id = ANY(dup_ids);
    UPDATE crm_attachments SET record_id = keeper_id WHERE record_id = ANY(dup_ids);

    -- Re-associate record links (handle unique constraint conflicts)
    UPDATE crm_record_links SET source_record_id = keeper_id
    WHERE source_record_id = ANY(dup_ids)
      AND NOT EXISTS (
        SELECT 1 FROM crm_record_links existing
        WHERE existing.source_record_id = keeper_id
          AND existing.target_record_id = crm_record_links.target_record_id
          AND existing.link_type = crm_record_links.link_type
      );
    UPDATE crm_record_links SET target_record_id = keeper_id
    WHERE target_record_id = ANY(dup_ids)
      AND NOT EXISTS (
        SELECT 1 FROM crm_record_links existing
        WHERE existing.source_record_id = crm_record_links.source_record_id
          AND existing.target_record_id = keeper_id
          AND existing.link_type = crm_record_links.link_type
      );

    -- Delete remaining orphaned links (duplicates that couldn't be re-associated)
    DELETE FROM crm_record_links
    WHERE source_record_id = ANY(dup_ids) OR target_record_id = ANY(dup_ids);

    -- Re-associate activities if the table exists
    BEGIN
      EXECUTE 'UPDATE crm_activities SET record_id = $1 WHERE record_id = ANY($2)'
        USING keeper_id, dup_ids;
    EXCEPTION WHEN undefined_table THEN
      NULL; -- table doesn't exist, skip
    END;

    -- Delete duplicates (remaining cascade handles anything we missed)
    DELETE FROM crm_records WHERE id = ANY(dup_ids);

    RAISE NOTICE 'Deduped crm_records: kept %, deleted % duplicates for email %',
      keeper_id, array_length(dup_ids, 1), dup_group.email_lower;
  END LOOP;
END;
$$;

-- ============================================================================
-- PHASE 2: Clean existing duplicates in leads table
-- ============================================================================

DO $$
DECLARE
  dup_group RECORD;
  keeper_id uuid;
  dup_ids uuid[];
BEGIN
  FOR dup_group IN
    SELECT organization_id, LOWER(email) AS email_lower
    FROM leads
    WHERE email IS NOT NULL AND email != ''
    GROUP BY organization_id, LOWER(email)
    HAVING COUNT(*) > 1
  LOOP
    -- Keeper = most recently updated
    SELECT id INTO keeper_id
    FROM leads
    WHERE organization_id = dup_group.organization_id
      AND LOWER(email) = dup_group.email_lower
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    LIMIT 1;

    SELECT array_agg(id) INTO dup_ids
    FROM leads
    WHERE organization_id = dup_group.organization_id
      AND LOWER(email) = dup_group.email_lower
      AND id != keeper_id;

    -- Merge notes from duplicates into keeper
    UPDATE leads
    SET notes = COALESCE(notes, '') || E'\n---\n' || (
      SELECT string_agg(COALESCE(notes, ''), E'\n---\n')
      FROM leads WHERE id = ANY(dup_ids) AND notes IS NOT NULL AND notes != ''
    )
    WHERE id = keeper_id
      AND EXISTS (
        SELECT 1 FROM leads WHERE id = ANY(dup_ids) AND notes IS NOT NULL AND notes != ''
      );

    DELETE FROM leads WHERE id = ANY(dup_ids);

    RAISE NOTICE 'Deduped leads: kept %, deleted % duplicates for email %',
      keeper_id, array_length(dup_ids, 1), dup_group.email_lower;
  END LOOP;
END;
$$;

-- ============================================================================
-- PHASE 3: Add unique partial indexes
-- Scoped by (org_id, module_id) for crm_records so same email can exist in
-- different modules (contact + lead). Null/empty emails are not constrained.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_records_unique_email
  ON crm_records (org_id, module_id, LOWER(email))
  WHERE email IS NOT NULL AND email != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_unique_email
  ON leads (organization_id, LOWER(email))
  WHERE email IS NOT NULL AND email != '';

-- ============================================================================
-- PHASE 4: Duplicate check RPC function
-- Used by the API and UI for pre-insert duplicate detection.
-- ============================================================================

CREATE OR REPLACE FUNCTION check_crm_duplicate(
  p_org_id uuid,
  p_module_id uuid,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_exclude_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  title text,
  email text,
  phone text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $fn$
BEGIN
  RETURN QUERY
  SELECT r.id, r.title, r.email, r.phone, r.status, r.created_at
  FROM crm_records r
  WHERE r.org_id = p_org_id
    AND r.module_id = p_module_id
    AND (p_exclude_id IS NULL OR r.id != p_exclude_id)
    AND (
      -- Primary: match by email (case-insensitive)
      (p_email IS NOT NULL AND p_email != '' AND LOWER(r.email) = LOWER(p_email))
      OR
      -- Fallback: match by phone only when no email provided
      (
        (p_email IS NULL OR p_email = '')
        AND p_phone IS NOT NULL AND p_phone != ''
        AND r.phone = p_phone
      )
    )
  LIMIT 5;
END;
$fn$;

COMMENT ON FUNCTION check_crm_duplicate IS 'Check for duplicate CRM records by email (primary) or phone (fallback). Used for pre-insert validation.';

COMMIT;

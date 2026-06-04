-- =============================================================================
-- Migration: Backfill NULL titles on crm_records from JSONB data fields
-- =============================================================================
--
-- Root cause: records created before the `mergeCrmDataJsonIntoRowColumns`
-- pipeline was wired (or via imports that didn't populate the `title` column)
-- have `title IS NULL`.  The UI falls back to "Untitled", making it impossible
-- to identify people like Allison McFee even though her `first_name` and
-- `last_name` are present in the JSONB `data` column.
--
-- This migration derives the title from the same priority chain used by the
-- application layer:
--   1. preferred_name + last_name
--   2. first_name + last_name
--   3. account_name
--   4. name
--   5. deal_name
--
-- Only rows with `title IS NULL` (or empty string) are touched; existing
-- populated titles are never overwritten.  The UPDATE is idempotent.
-- =============================================================================

UPDATE public.crm_records
SET    title = derived.new_title
FROM (
  SELECT
    id,
    COALESCE(
      -- Person-style: preferred_name > first_name, joined with last_name
      NULLIF(
        TRIM(
          CONCAT_WS(' ',
            NULLIF(TRIM(COALESCE(data->>'preferred_name', data->>'first_name', '')), ''),
            NULLIF(TRIM(COALESCE(data->>'last_name', '')), '')
          )
        ),
        ''
      ),
      -- Entity-style fallbacks
      NULLIF(TRIM(data->>'account_name'), ''),
      NULLIF(TRIM(data->>'name'), ''),
      NULLIF(TRIM(data->>'deal_name'), '')
    ) AS new_title
  FROM public.crm_records
  WHERE (title IS NULL OR TRIM(title) = '')
) AS derived
WHERE crm_records.id = derived.id
  AND derived.new_title IS NOT NULL;

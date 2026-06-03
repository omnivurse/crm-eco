-- =============================================================================
-- Migration: Repair contact display titles clobbered by the job-title field
-- =============================================================================
--
-- Root cause (fixed in app code in `mergeCrmDataJsonIntoRowColumns`): for PERSON
-- modules (contacts/leads/members/prospects) the JSONB `title` field is a *job
-- title* (e.g. "Minister", "Outside Sales", "HR Director"). A deals/accounts
-- code path was mirroring `data.title` onto the `crm_records.title` display-name
-- column, so the job title showed up in the record heading instead of the
-- person's name (reported on contact "Thomas Boyd", id 71aaf7ba-…).
--
-- This migration re-derives the display title from the person's name fields,
-- using the EXACT precedence the application layer uses
-- (`getRecordDisplayName` / the merge pipeline):
--     displayFirst = preferred_name (if non-blank) else first_name
--     title        = trim(displayFirst + ' ' + last_name)
--
-- IMPORTANT: SQL `COALESCE('', x)` keeps the empty string (unlike JS `'' || x`),
-- so blanks are converted to NULL with `NULLIF(TRIM(...),'')` BEFORE coalescing —
-- otherwise a record with preferred_name = '' (e.g. Thomas Boyd) would resolve to
-- just "Boyd" instead of "Thomas Boyd".
--
-- Scope / safety:
--   * Only PERSON modules (contacts, leads, members, prospects).
--   * Only rows whose title was clobbered — i.e. title = data->>'title' and the
--     job-title value is non-blank — AND a real name exists to restore.
--   * The job title is preserved untouched in JSONB `data.title`.
--   * Never sets a NULL/blank title; never overwrites a title that already
--     differs from the job-title value.
--   * Idempotent: after running, title <> data->>'title', so a re-run is a no-op.
--
-- Rollback: this only rewrites the `title` column from data already present in
-- `data` (first/last/preferred). The prior (incorrect) value equals the still-
-- present `data->>'title'`, so it can be restored per-row if ever needed.
-- =============================================================================

UPDATE public.crm_records AS r
SET    title = derived.new_title
FROM (
  SELECT
    cr.id,
    NULLIF(
      TRIM(
        CONCAT_WS(
          ' ',
          COALESCE(
            NULLIF(TRIM(COALESCE(cr.data->>'preferred_name', '')), ''),
            NULLIF(TRIM(COALESCE(cr.data->>'first_name', '')), '')
          ),
          NULLIF(TRIM(COALESCE(cr.data->>'last_name', '')), '')
        )
      ),
      ''
    ) AS new_title
  FROM public.crm_records cr
  JOIN public.crm_modules m ON m.id = cr.module_id
  WHERE LOWER(m.key) IN ('contacts', 'leads', 'members', 'prospects')
    AND cr.data->>'title' IS NOT NULL
    AND BTRIM(cr.data->>'title') <> ''
    AND cr.title = cr.data->>'title'                       -- title was clobbered
    AND (
      COALESCE(BTRIM(cr.data->>'first_name'), '') <> ''
      OR COALESCE(BTRIM(cr.data->>'last_name'), '') <> ''
    )
) AS derived
WHERE r.id = derived.id
  AND derived.new_title IS NOT NULL
  AND r.title IS DISTINCT FROM derived.new_title;

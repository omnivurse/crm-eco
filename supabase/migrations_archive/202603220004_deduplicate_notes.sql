-- Deduplicate existing crm_notes rows.
-- For each group of notes with identical (record_id, body, created_by),
-- keep only the earliest entry (smallest created_at) and delete the rest.
-- This is a one-time cleanup; the application layer now prevents future duplicates.

DELETE FROM crm_notes
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY record_id, body, created_by
        ORDER BY created_at ASC
      ) AS rn
    FROM crm_notes
  ) dupes
  WHERE rn > 1
);

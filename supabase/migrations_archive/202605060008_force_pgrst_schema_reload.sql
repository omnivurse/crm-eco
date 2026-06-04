-- "Could not find the 'advisor_id' column of 'crm_records' in the schema cache"
--
-- The column exists (added in 202603110015) and the schema is correct, but
-- PostgREST's in-memory cache can drift after long-running connections or
-- failed reloads. The error above is PostgREST telling us its cache disagrees
-- with the live catalog.
--
-- This migration is intentionally a no-op for the database itself — it just:
--   1. Re-asserts the column with `ADD COLUMN IF NOT EXISTS`, which is a no-op
--      when the column is present but causes Postgres to emit a DDL event.
--   2. Re-applies the column comment.
--   3. Notifies pgrst to reload its schema, with both the standard channel
--      name and the legacy `pgrst, reload schema` form.
--
-- After applying this, the patch / save flow on records that send `advisor_id`
-- (every owner change on a healthshare contact) starts working again.

ALTER TABLE crm_records
  ADD COLUMN IF NOT EXISTS advisor_id uuid REFERENCES crm_advisors(id) ON DELETE SET NULL;

COMMENT ON COLUMN crm_records.advisor_id IS
  'Assigned CRM advisor for this contact record';

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

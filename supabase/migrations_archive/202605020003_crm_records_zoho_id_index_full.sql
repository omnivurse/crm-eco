-- =============================================================================
-- Make the `crm_records.data->>'zoho_id'` index non-partial.
--
-- 202605020002 created `idx_crm_records_zoho_id … WHERE data ? 'zoho_id'`,
-- but Postgres can only use a partial index when the query *syntactically*
-- includes the same predicate. The CSV-update route filters with
-- `(data->>'zoho_id') IN (…)`, which logically implies `data ? 'zoho_id'`
-- but the planner doesn't recognize the implication and falls back to a
-- seq scan.
--
-- The simplest fix: drop the WHERE clause. A full btree on the expression
-- is only ~16k entries today and grows linearly with `crm_records` — well
-- under any size budget. Index null entries still indexed, but Postgres
-- handles null btree leaves efficiently.
-- =============================================================================

DROP INDEX IF EXISTS public.idx_crm_records_zoho_id;

CREATE INDEX IF NOT EXISTS idx_crm_records_zoho_id
  ON public.crm_records ((data->>'zoho_id'));

COMMENT ON INDEX public.idx_crm_records_zoho_id IS
  'Full btree on data->>zoho_id so the CSV-update IN(...) lookup uses the index without needing a `data ? key` predicate in the query.';

-- Ops entry point: re-run the canonical Health Share projection over
-- contacts/members and print what changed.
--
-- Safe to run any time: blank-only fills, never overwrites, converges to zero
-- rows changed. Pre-change values are recorded in
-- public.crm_records_hs_canonical_backfill_log (see the ROLLBACK notes in
-- supabase/migrations/20260903190000_healthshare_canonical_projection_guard.sql).
--
-- Normally you should NOT need this: crm_2_healthshare_canonical_trg projects on
-- the write path, so drift cannot accumulate. Reach for this after a bulk import
-- that ran with triggers disabled, or when the strict audit reports drift.
--
--   psql "$PIFH_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f scripts/sql/backfill-healthshare-canonical-keys.sql
--
-- Dry run first — this writes nothing and shows exactly what is outstanding:
--   psql "$PIFH_SUPABASE_DB_URL" -c 'SELECT * FROM public.crm_healthshare_canonical_drift();'

\echo '== Outstanding drift BEFORE (dry run — no writes) =='
SELECT * FROM public.crm_healthshare_canonical_drift();

\echo '== Applying backfill =='
SELECT * FROM public.backfill_healthshare_canonical_keys();

\echo '== Outstanding drift AFTER (must be all zero) =='
SELECT * FROM public.crm_healthshare_canonical_drift();

\echo '== Verifying the write-path guard is enabled (tgenabled must be O) =='
SELECT t.tgname, t.tgenabled
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname = 'crm_records'
  AND t.tgname = 'crm_2_healthshare_canonical_trg';

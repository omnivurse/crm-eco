-- Phase 8b: Supabase linter — no_primary_key (public import staging tables)
-- Project: sffisarikcreyyjzdjvb (PIF-ECO-V2 production)
-- Linter: no_primary_key
-- Scope: public.*_staging tables only (row_num is NOT NULL, unique per import batch)
-- Skipped: dupe_pilot.* — one-off merge artifacts; drop schema when merge work is complete
-- Risk: LOW — metadata only if row_num is unique; guarded with duplicate check
-- Rollback: ALTER TABLE ... DROP CONSTRAINT IF EXISTS <table>_pkey;

BEGIN;

SET lock_timeout = '5s';

DO $$
DECLARE
  v_table text;
  v_dupes bigint;
  v_tables text[] := ARRAY[
    '_import_contacts_staging',
    '_import_leads_staging',
    '_import_notes_staging',
    'import_contacts_staging',
    'import_leads_staging',
    'import_notes_staging'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    BEGIN
      IF to_regclass(format('public.%I', v_table)) IS NULL THEN
        RAISE NOTICE 'Phase 8b: skip missing table public.%', v_table;
        CONTINUE;
      END IF;

      EXECUTE format(
        'SELECT count(*) - count(DISTINCT row_num) FROM public.%I',
        v_table
      ) INTO v_dupes;

      IF v_dupes > 0 THEN
        RAISE EXCEPTION 'Phase 8b: public.% has % duplicate row_num values — aborting PK add',
          v_table, v_dupes;
      END IF;

      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I PRIMARY KEY (row_num)',
        v_table,
        v_table || '_pkey'
      );
      RAISE NOTICE 'Phase 8b: added PRIMARY KEY on public.%.row_num', v_table;
    EXCEPTION
      WHEN duplicate_object THEN
        RAISE NOTICE 'Phase 8b: public.% already has primary key — skipping', v_table;
    END;
  END LOOP;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';

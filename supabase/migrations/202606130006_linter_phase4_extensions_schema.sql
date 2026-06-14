-- Phase 4: Supabase linter — move extensions out of public schema
-- Linter: extension_in_public (pg_trgm, btree_gin)
-- Risk: MEDIUM — verify GIN/GiST indexes still resolve after move
-- Rollback: ALTER EXTENSION <name> SET SCHEMA public;
-- Pilot: run on staging first; confirm pg_trgm operators still work on indexed columns

BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gin') THEN
    ALTER EXTENSION btree_gin SET SCHEMA extensions;
  END IF;
END $$;

COMMIT;

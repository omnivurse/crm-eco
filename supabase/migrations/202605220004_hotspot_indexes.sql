-- ============================================================================
-- Migration: 202605220004_hotspot_indexes
-- Purpose:   Add covering indexes for the 7 hot filter columns the Hawkeye
--            audit flagged. Each column is filtered 5+ times across the
--            frontend codebase against tables with 1k+ rows, and PIFH had no
--            covering index — every call triggered a sequential scan.
--
-- Targets (from .audit/findings.json → "Missing indexes"):
--   crm_records.module_id   (36 call sites, ~15k rows) — biggest ROI
--   crm_records.updated_at  ( 6 call sites, ~15k rows)
--   crm_records.market_type ( 6 call sites, ~15k rows)
--   crm_records.owner_id    ( 5 call sites, ~15k rows)
--   crm_audit_log.entity    ( 6 call sites, ~488k rows)  ← longest lock (~10s)
--   crm_notes.created_at    ( 8 call sites, ~194k rows)  ← second longest (~5s)
--   members.last_name       ( 5 call sites, ~1k  rows)
--
-- Why no CONCURRENTLY:
--   Supabase CLI wraps each migration in a transaction, and
--   `CREATE INDEX CONCURRENTLY` cannot run inside a transaction
--   (ERROR 25001). This matches the repo's existing convention — see
--   supabase/migrations/202605020002_crm_records_zoho_id_index.sql for the
--   same rationale.
--
-- Lock impact (ACCESS EXCLUSIVE on the indexed table during build):
--   crm_records  (15k rows)  : sub-second
--   crm_audit_log (488k rows): ~5–15 seconds — push outside peak hours if
--                              possible. Otherwise the velocity vs. blocked
--                              reads tradeoff still favors building it.
--   crm_notes    (194k rows) : ~3–8 seconds
--   members      (1k rows)   : sub-second
--
-- Safety:
--   - IF NOT EXISTS on every index → re-runnable; no-op on second apply.
--   - Wrapped in BEGIN/COMMIT so a failure mid-batch leaves the DB clean.
--   - All indexes scoped by org/tenant where applicable to keep them tight.
--
-- Rollback (rarely needed):
--   BEGIN;
--     DROP INDEX CONCURRENTLY IF EXISTS crm_records_module_idx;
--     -- … (each idx below)
--   COMMIT;
-- ============================================================================

BEGIN;

-- ── crm_records (the central table — 36 call-site monster) ──────────────────

CREATE INDEX IF NOT EXISTS crm_records_module_idx
  ON public.crm_records (org_id, module_id);

CREATE INDEX IF NOT EXISTS crm_records_owner_idx
  ON public.crm_records (org_id, owner_id)
  WHERE owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS crm_records_market_type_idx
  ON public.crm_records (org_id, market_type)
  WHERE market_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS crm_records_updated_at_idx
  ON public.crm_records (org_id, updated_at DESC);

-- ── crm_audit_log (488k rows — longest lock window in this migration) ──────

CREATE INDEX IF NOT EXISTS crm_audit_log_entity_idx
  ON public.crm_audit_log (entity);

-- ── crm_notes (194k rows — recent-first lookups dominate) ───────────────────

CREATE INDEX IF NOT EXISTS crm_notes_created_at_idx
  ON public.crm_notes (created_at DESC);

-- ── members (last_name lookups for the directory search) ────────────────────

CREATE INDEX IF NOT EXISTS members_last_name_idx
  ON public.members (organization_id, lower(last_name))
  WHERE last_name IS NOT NULL;

-- ── Tell PostgREST to recompute query plans against the new indexes ─────────

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Phase 0 / Tenancy: org isolation for public.files (ADDITIVE, idempotent). [A1 of 3]
-- Project: sffisarikcreyyjzdjvb (PIF-ECO-V2 production)
-- Status: PROMOTED to supabase/migrations/ — applied in version order by `supabase db push` (additive + idempotent).
-- Risk: MEDIUM — adds nullable columns + indexes + sync trigger; backfill (A2) is guarded/resumable.
--        The ONLY non-additive step (replacing the leaky "Users can read org files"
--        SELECT policy) lives in A2 5.2 and is policy-only + reversible — held behind
--        the approval gate (see README rehearsal/gate section).
-- Rollback: see -- Rollback: block at end of file.
-- Refs: baseline files L31632; leak policy L74852; documents pattern L78744-78772;
--       get_user_organization_id L13349; sync_org_tenant_key body L20809 (references new.org_id
--       AND new.organization_id, so BOTH columns must exist before the trigger is attached);
--       FK covering-index idiom 202606150001; documents non-FK org_id indexes L49744-49765.
-- NOTE: no explicit BEGIN/COMMIT — the Supabase migration runner wraps each file in one
--       transaction (matches template 202606190001 which uses only SET lock_timeout).

SET lock_timeout = '5s';

-- (1) ADD COLUMNS (nullable, no constraint yet). Dual-column shape mirrors documents so the
--     EXISTING sync_org_tenant_key() trigger (which reads BOTH new.org_id and
--     new.organization_id) can keep them aligned. BOTH columns are required for the trigger
--     not to raise "record new has no field org_id".
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS org_id uuid;

-- (1a) Attach the EXISTING sync trigger (reuse, do not reinvent). Drop-then-create = idempotent.
DROP TRIGGER IF EXISTS trg_sync_org_tenant_key ON public.files;
CREATE TRIGGER trg_sync_org_tenant_key
  BEFORE INSERT OR UPDATE ON public.files
  FOR EACH ROW EXECUTE FUNCTION public.sync_org_tenant_key();

-- (3) COVERING / LOOKUP INDEXES (house idiom). organization_id index carries the *_fkey suffix
--     because it will cover the validated FK files_organization_id_fkey added in A3 (matches
--     idx_documents_organization_id). org_id is a denormalized sync column with NO FK ever,
--     so it gets a plain name (matches idx_documents_org_folder / idx_documents_trash, L49744-65).
CREATE INDEX IF NOT EXISTS idx_files_organization_id_fkey ON public.files (organization_id); -- covers files_organization_id_fkey (added in A3)
CREATE INDEX IF NOT EXISTS idx_files_org_id              ON public.files (org_id);          -- denormalized sync col, no FK

NOTIFY pgrst, 'reload schema';

-- Rollback (A1):
--   DROP TRIGGER IF EXISTS trg_sync_org_tenant_key ON public.files;
--   DROP INDEX IF EXISTS public.idx_files_organization_id_fkey;
--   DROP INDEX IF EXISTS public.idx_files_org_id;
--   -- columns intentionally NOT dropped on rollback (non-destructive: a nullable unused
--   -- column is safe; dropping could lose a partial backfill). Drop only on explicit approval.

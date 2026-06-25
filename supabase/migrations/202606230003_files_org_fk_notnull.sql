-- Phase 0 / Tenancy: promote files.organization_id to FK + NOT NULL (deferred). [A3 of 3]
-- Project: sffisarikcreyyjzdjvb
-- Status: DRAFT — not applied.
-- PRE-REQ: V1 (audit Q4) returns 0 NULL/orphan rows across the verification window. Behind gate.
-- DEVIATION FLAGGED FOR OWNER: every other org FK in the schema is ON DELETE CASCADE
--   (e.g. L62945, L64585, L65697). This uses ON DELETE RESTRICT because files are
--   compliance/DMS artifacts that should NOT silently vanish on org teardown. If org-deletion
--   tooling REQUIRES cascade, switch to ON DELETE CASCADE here. Owner chooses at the gate.
SET lock_timeout = '5s';

-- FK NOT VALID first (cheap, no full scan / no rewrite), then VALIDATE separately
-- (scans without ACCESS EXCLUSIVE). The covering index idx_files_organization_id_fkey
-- created in A1 now backs this FK (justifies the *_fkey index name).
ALTER TABLE public.files
  ADD CONSTRAINT files_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE public.files VALIDATE CONSTRAINT files_organization_id_fkey;

ALTER TABLE public.files ALTER COLUMN organization_id SET NOT NULL;

NOTIFY pgrst, 'reload schema';

-- Rollback (A3):
--   ALTER TABLE public.files ALTER COLUMN organization_id DROP NOT NULL;
--   ALTER TABLE public.files DROP CONSTRAINT IF EXISTS files_organization_id_fkey;

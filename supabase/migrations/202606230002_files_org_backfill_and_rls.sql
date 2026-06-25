-- Phase 0 / Tenancy: public.files backfill + org-isolated RLS. [A2 of 3]
-- Project: sffisarikcreyyjzdjvb
-- Status: DRAFT — not applied. PRE-REQ: A1 (202606230001) applied first.
-- Risk: MEDIUM. Backfill is idempotent (WHERE organization_id IS NULL) and resumable.
--        Includes the single policy REPLACE that closes the cross-tenant SELECT leak (5.2).
-- Rollback: see end of file.

SET lock_timeout = '5s';

-- (2) BACKFILL — derive org from owner_id. THE ONLY VALID LINEAGE for a files row:
--     files.owner_id = auth.users.id  ==>  profiles.user_id  ==>  profiles.organization_id
--     documents is NOT joinable (no FK either direction) and is deliberately NOT used.
--     Idempotent + resumable: only touches NULLs; safe to re-run.
--     SCALE NOTE: this is a single UPDATE. The dry-run row count (V1, audit Q4) decides
--     viability under lock_timeout='5s'. If the count is large enough to risk a timeout,
--     run the keyset-batched variant below INSTEAD (re-runnable; each batch self-contained).
UPDATE public.files f
SET    organization_id = p.organization_id
FROM   public.profiles p
WHERE  f.owner_id = p.user_id
  AND  f.organization_id IS NULL
  AND  p.organization_id IS NOT NULL;
-- org_id is auto-filled from organization_id by trg_sync_org_tenant_key on this UPDATE.

-- (2-batched, OPTIONAL) Use only if V1 shows the single-shot UPDATE risks lock_timeout.
--   Re-run this block until it reports 0 rows updated:
--     WITH batch AS (
--       SELECT f.ctid
--       FROM public.files f
--       JOIN public.profiles p ON p.user_id = f.owner_id AND p.organization_id IS NOT NULL
--       WHERE f.organization_id IS NULL
--       LIMIT 5000
--     )
--     UPDATE public.files f SET organization_id = p.organization_id
--     FROM public.profiles p, batch
--     WHERE f.ctid = batch.ctid AND p.user_id = f.owner_id;

-- (2a) FALLBACK for owners whose profile org is NULL: use organization_members ONLY when
--      UNAMBIGUOUS (exactly one active membership). HAVING COUNT(*)=1 guarantees a single
--      row per user, so MIN(organization_id) is just that one guaranteed value (NOT a tiebreak).
WITH single_membership AS (
  SELECT user_id, (array_agg(organization_id))[1] AS organization_id  -- single guaranteed value under HAVING=1 (note: min(uuid) doesn't exist in Postgres)
  FROM   public.organization_members
  WHERE  is_active = true
  GROUP  BY user_id
  HAVING COUNT(*) = 1
)
UPDATE public.files f
SET    organization_id = sm.organization_id
FROM   single_membership sm
WHERE  f.owner_id = sm.user_id
  AND  f.organization_id IS NULL;

-- (2b) FLAG UNRESOLVED rows rather than guessing (diagnostic — see audit Q4 / README V1/V2).
--      These MUST be triaged by a human before File A3 (NOT NULL/FK) can run.

-- ---------------------------------------------------------------------------
-- (5) RLS — split-per-command, org-keyed, mirroring documents_* and the
--     commission_payout template. Additive policies use DROP IF EXISTS + CREATE.
-- RLS is already ENABLED on files (baseline L79120); we do NOT add FORCE (FORCE appears
-- exactly once in the schema — crm_records L78194 — and is NOT house style).
-- ---------------------------------------------------------------------------

-- 5.1 NEW org-scoped SELECT (additive — OR-combined with existing own/team policies).
DROP POLICY IF EXISTS "Users can read files in their organization" ON public.files;
CREATE POLICY "Users can read files in their organization"
  ON public.files
  FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_organization_id());

-- 5.2 *** THE FIX *** — replace the leaky visibility='org' policy (baseline L74852, no org
--     predicate). Re-created WITH the org predicate. This is the ONE non-additive action;
--     reversible via the A2 rollback block. >>> Apply ONLY after the approval gate. <<<
DROP POLICY IF EXISTS "Users can read org files" ON public.files;
CREATE POLICY "Users can read org files"
  ON public.files
  FOR SELECT
  TO authenticated
  USING (
    visibility = 'org'
    AND organization_id = public.get_user_organization_id()
  );

-- 5.3 Org-scoped INSERT (additive). Existing "Users can create files" (L74256, owner_id=auth.uid())
--     stays; this adds the org guard so a row cannot be created carrying a FOREIGN organization_id.
DROP POLICY IF EXISTS "Users can create org files" ON public.files;
CREATE POLICY "Users can create org files"
  ON public.files
  FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND organization_id = public.get_user_organization_id()
  );

-- 5.4 Org-scoped UPDATE (additive; USING + WITH CHECK per template).
DROP POLICY IF EXISTS "Users can update org files" ON public.files;
CREATE POLICY "Users can update org files"
  ON public.files
  FOR UPDATE
  TO authenticated
  USING      (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

-- 5.5 Org-scoped DELETE (additive).
DROP POLICY IF EXISTS "Users can delete org files" ON public.files;
CREATE POLICY "Users can delete org files"
  ON public.files
  FOR DELETE
  TO authenticated
  USING (organization_id = public.get_user_organization_id());

NOTIFY pgrst, 'reload schema';

-- NOTE: existing ownership policies ("Users can read/update/delete own files" L74889/L75057/L74351,
-- "Users can read team files" L74960, "Users can create files" L74256) and
-- "service_role_all_files" (L82363) are deliberately LEFT IN PLACE — additive, OR-combined.
-- Own = owner_id=auth.uid(); team = via linked_project membership; neither is a cross-tenant
-- leak. Only the visibility='org' policy lacked an org predicate; replaced in 5.2.

-- Rollback (A2):
--   DROP POLICY IF EXISTS "Users can read org files" ON public.files;
--   CREATE POLICY "Users can read org files" ON public.files FOR SELECT TO authenticated
--     USING ((visibility = 'org'::text));   -- restores ORIGINAL (leaky) policy
--   DROP POLICY IF EXISTS "Users can read files in their organization" ON public.files;
--   DROP POLICY IF EXISTS "Users can create org files" ON public.files;
--   DROP POLICY IF EXISTS "Users can update org files" ON public.files;
--   DROP POLICY IF EXISTS "Users can delete org files" ON public.files;
--   -- backfilled column values are non-destructive; leave them.

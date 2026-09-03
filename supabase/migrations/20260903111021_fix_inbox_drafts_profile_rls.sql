-- inbox_drafts.author_id references profiles.id, not auth.users.id. The
-- baseline policies compare it directly with auth.uid(), denying every row.
--
-- This additive permissive policy leaves the existing policies untouched and
-- authorizes only drafts owned by the caller's profile inside an organization
-- where that caller has an active membership.
--
-- Rollback:
--   DROP POLICY IF EXISTS inbox_drafts_profile_owner_access ON public.inbox_drafts;

BEGIN;

SET LOCAL lock_timeout = '5s';

DROP POLICY IF EXISTS inbox_drafts_profile_owner_access ON public.inbox_drafts;
CREATE POLICY inbox_drafts_profile_owner_access
ON public.inbox_drafts
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = inbox_drafts.author_id
      AND profile.user_id = (SELECT auth.uid())
  )
  AND EXISTS (
    SELECT 1
    FROM public.organization_members AS membership
    WHERE membership.organization_id = inbox_drafts.organization_id
      AND membership.user_id = (SELECT auth.uid())
      AND membership.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = inbox_drafts.author_id
      AND profile.user_id = (SELECT auth.uid())
  )
  AND EXISTS (
    SELECT 1
    FROM public.organization_members AS membership
    WHERE membership.organization_id = inbox_drafts.organization_id
      AND membership.user_id = (SELECT auth.uid())
      AND membership.is_active = true
  )
);

COMMIT;

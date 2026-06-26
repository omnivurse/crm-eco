-- Recognize org OWNERS as admins. private.is_admin() checked role IN ('admin',
-- 'super_admin'), excluding 'owner' (the highest tenant role) — so owners were
-- blocked from every is_admin()-gated admin write (members, advisors, enrollments,
-- enrollment_approvals, enrollment_reviews, crm_reports). Owner >= admin, so this
-- is purely additive (verified: 0 restrictive/negative is_admin usages). Signature
-- mirrors the original exactly; only the role list changes.
CREATE OR REPLACE FUNCTION private.is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'private', 'public', 'pg_catalog'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin', 'super_admin')
  );
END;
$function$;

-- members has admin INSERT + DELETE policies but NO admin UPDATE (only advisors),
-- so admins/owners couldn't edit members. Add it, mirroring the __insert check.
CREATE POLICY "Admins can manage members__update" ON public.members
  FOR UPDATE TO authenticated
  USING (private.is_admin() AND (private.is_super_admin() OR organization_id = private.get_user_organization_id()))
  WITH CHECK (private.is_admin() AND (private.is_super_admin() OR organization_id = private.get_user_organization_id()));

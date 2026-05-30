-- SECURITY (multi-tenant isolation): org-scope the 20 org-UNSCOPED tenant-data RLS
-- policies that grant access purely on is_staff_or_admin()/is_admin() with no
-- organization_id filter, across 11 tables (advisors, agent_levels, commissions,
-- crm_reports, crm_scheduled_reports, enrollments, members, products, report_alerts,
-- report_segments, advisor_milestone_progress). Because permissive policies are OR'd,
-- they let any tenant staff/admin read (and via the ALL/UPDATE/DELETE policies, write/
-- delete) EVERY org's rows. CONFIRMED by an authenticated cross-tenant test (org-A
-- admin read org-B enrollments). Latent at one org; a live cross-tenant breach at
-- tenant #2 (white-label blocker). PII/PHI affected: members, enrollments, commissions.
--
-- Fix: gate each on `is_super_admin() OR organization_id = get_user_organization_id()`
-- — tenant staff/admins are scoped to their own org; platform super_admins (the 51
-- is_super_admin() policies) KEEP cross-org access. Owner clauses (created_by = uid)
-- on crm_reports are preserved. WITH CHECK added on ALL/UPDATE policies to close the
-- write path (they previously fell back to the unscoped USING).
-- ALTER POLICY = in-place, reversible. Verified end-to-end: re-running the
-- cross-tenant Layer-3 spec against staging after this migration shows isolation holds.

ALTER POLICY "Staff can manage milestone progress" ON public.advisor_milestone_progress
  USING (is_staff_or_admin() AND (is_super_admin() OR organization_id = get_user_organization_id()))
  WITH CHECK (is_staff_or_admin() AND (is_super_admin() OR organization_id = get_user_organization_id()));
ALTER POLICY "Staff can read milestone progress" ON public.advisor_milestone_progress
  USING (is_staff_or_admin() AND (is_super_admin() OR organization_id = get_user_organization_id()));
ALTER POLICY "Admins can manage advisors" ON public.advisors
  USING (is_admin() AND (is_super_admin() OR organization_id = get_user_organization_id()))
  WITH CHECK (is_admin() AND (is_super_admin() OR organization_id = get_user_organization_id()));
ALTER POLICY "Staff can read advisors" ON public.advisors
  USING (is_staff_or_admin() AND (is_super_admin() OR organization_id = get_user_organization_id()));
ALTER POLICY "Staff can read agent levels" ON public.agent_levels
  USING (is_staff_or_admin() AND (is_super_admin() OR organization_id = get_user_organization_id()));
ALTER POLICY "Staff can read commissions" ON public.commissions
  USING (is_staff_or_admin() AND (is_super_admin() OR organization_id = get_user_organization_id()));
ALTER POLICY "Users can delete own reports" ON public.crm_reports
  USING (((created_by = ( SELECT auth.uid() AS uid)) OR (is_admin() AND (is_super_admin() OR organization_id = get_user_organization_id()))));
ALTER POLICY "Staff can read reports" ON public.crm_reports
  USING (is_staff_or_admin() AND (is_super_admin() OR organization_id = get_user_organization_id()));
ALTER POLICY "Users can update own reports" ON public.crm_reports
  USING (((created_by = ( SELECT auth.uid() AS uid)) OR (is_admin() AND (is_super_admin() OR organization_id = get_user_organization_id()))))
  WITH CHECK (((created_by = ( SELECT auth.uid() AS uid)) OR (is_admin() AND (is_super_admin() OR organization_id = get_user_organization_id()))));
ALTER POLICY "Staff can manage scheduled reports" ON public.crm_scheduled_reports
  USING (is_staff_or_admin() AND (is_super_admin() OR organization_id = get_user_organization_id()))
  WITH CHECK (is_staff_or_admin() AND (is_super_admin() OR organization_id = get_user_organization_id()));
ALTER POLICY "Staff can read scheduled reports" ON public.crm_scheduled_reports
  USING (is_staff_or_admin() AND (is_super_admin() OR organization_id = get_user_organization_id()));
ALTER POLICY "Admins can manage enrollments" ON public.enrollments
  USING (is_admin() AND (is_super_admin() OR organization_id = get_user_organization_id()))
  WITH CHECK (is_admin() AND (is_super_admin() OR organization_id = get_user_organization_id()));
ALTER POLICY "Staff can read enrollments" ON public.enrollments
  USING (is_staff_or_admin() AND (is_super_admin() OR organization_id = get_user_organization_id()));
ALTER POLICY "Admins can manage members" ON public.members
  USING (is_admin() AND (is_super_admin() OR organization_id = get_user_organization_id()))
  WITH CHECK (is_admin() AND (is_super_admin() OR organization_id = get_user_organization_id()));
ALTER POLICY "Staff can read members" ON public.members
  USING (is_staff_or_admin() AND (is_super_admin() OR organization_id = get_user_organization_id()));
ALTER POLICY "Staff can read products" ON public.products
  USING (is_staff_or_admin() AND (is_super_admin() OR organization_id = get_user_organization_id()));
ALTER POLICY "Staff can manage alerts" ON public.report_alerts
  USING (is_staff_or_admin() AND (is_super_admin() OR organization_id = get_user_organization_id()))
  WITH CHECK (is_staff_or_admin() AND (is_super_admin() OR organization_id = get_user_organization_id()));
ALTER POLICY "Staff can read alerts" ON public.report_alerts
  USING (is_staff_or_admin() AND (is_super_admin() OR organization_id = get_user_organization_id()));
ALTER POLICY "Staff can manage segments" ON public.report_segments
  USING (is_staff_or_admin() AND (is_super_admin() OR organization_id = get_user_organization_id()))
  WITH CHECK (is_staff_or_admin() AND (is_super_admin() OR organization_id = get_user_organization_id()));
ALTER POLICY "Staff can read segments" ON public.report_segments
  USING (is_staff_or_admin() AND (is_super_admin() OR organization_id = get_user_organization_id()));

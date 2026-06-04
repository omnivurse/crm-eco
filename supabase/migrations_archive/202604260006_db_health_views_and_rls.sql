-- ============================================================================
-- DB Health Sweep — Part 2: SECURITY DEFINER views + RLS auth_rls_initplan
--
-- Targets two more advisor categories:
--
--   • security_definer_view (7 ERROR-level): all 7 are pure aggregation /
--     identity-bridge views over base tables that already have RLS. They
--     don't need to bypass RLS — recreating them with security_invoker = on
--     means callers' RLS applies (defence in depth), and the view authors
--     no longer matter for permission resolution.
--
--   • auth_rls_initplan (48): policies that call auth.uid() / auth.jwt() /
--     auth.role() directly inside USING / WITH CHECK clauses. Postgres
--     re-evaluates these per row. Wrapping each call in (SELECT auth.fn())
--     forces the planner to evaluate it once per query (initplan), giving
--     a 10–100× speedup on tables with many rows.
--     See https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Recreate 7 SECURITY DEFINER views with security_invoker = on
--    (Definitions copied verbatim from pg_get_viewdef; no semantic change.)
-- ----------------------------------------------------------------------------

DROP VIEW IF EXISTS public.advisor_identity_bridge;
CREATE VIEW public.advisor_identity_bridge WITH (security_invoker = on) AS
 SELECT a.id AS advisor_id,
    a.organization_id,
    TRIM(BOTH FROM (a.first_name || ' '::text) || a.last_name) AS advisor_full_name,
    a.first_name,
    a.last_name,
    a.email AS advisor_email,
    a.phone AS advisor_phone,
    a.producer_code,
    a.parent_advisor_id,
    a.commission_tier,
    a.status AS advisor_status,
    a.profile_id AS advisor_profile_id,
    ca.id AS crm_advisor_id,
    ca.advisor_name AS crm_advisor_name,
    ca.agency_name AS crm_agency_name,
    ca.user_id AS crm_user_id,
    ca.is_active AS crm_advisor_active,
    p.id AS profile_id,
    p.user_id AS auth_user_id,
        CASE
            WHEN ca.id IS NOT NULL THEN 'bridged'::text
            ELSE 'advisors_only'::text
        END AS bridge_status
   FROM advisors a
     LEFT JOIN profiles p ON p.advisor_id = a.id
     LEFT JOIN crm_advisors ca ON ca.organization_id = a.organization_id AND (p.user_id IS NOT NULL AND ca.user_id = p.user_id OR lower(TRIM(BOTH FROM ca.advisor_name)) = lower(TRIM(BOTH FROM (a.first_name || ' '::text) || a.last_name)))
UNION ALL
 SELECT NULL::uuid AS advisor_id,
    ca.organization_id,
    ca.advisor_name AS advisor_full_name,
    NULL::text AS first_name,
    NULL::text AS last_name,
    NULL::text AS advisor_email,
    NULL::text AS advisor_phone,
    NULL::text AS producer_code,
    NULL::uuid AS parent_advisor_id,
    NULL::text AS commission_tier,
    NULL::text AS advisor_status,
    NULL::uuid AS advisor_profile_id,
    ca.id AS crm_advisor_id,
    ca.advisor_name AS crm_advisor_name,
    ca.agency_name AS crm_agency_name,
    ca.user_id AS crm_user_id,
    ca.is_active AS crm_advisor_active,
    NULL::uuid AS profile_id,
    ca.user_id AS auth_user_id,
    'crm_advisors_only'::text AS bridge_status
   FROM crm_advisors ca
  WHERE NOT (EXISTS ( SELECT 1
           FROM advisors a
          WHERE a.organization_id = ca.organization_id AND ((EXISTS ( SELECT 1
                   FROM profiles p
                  WHERE p.advisor_id = a.id AND p.user_id = ca.user_id)) OR lower(TRIM(BOTH FROM ca.advisor_name)) = lower(TRIM(BOTH FROM (a.first_name || ' '::text) || a.last_name)))));

DROP VIEW IF EXISTS public.comparison_summary;
CREATE VIEW public.comparison_summary WITH (security_invoker = on) AS
 SELECT c.id AS comparison_id,
    c.organization_id,
    c.record_id,
    c.comparison_name,
    c.created_by,
    c.created_at,
    count(ci.id) AS plan_count,
    min(ci.net_premium) AS best_net_premium,
    max(ci.net_premium) AS worst_net_premium,
    avg(ci.net_premium) AS avg_net_premium
   FROM premium_comparisons c
     LEFT JOIN premium_comparison_items ci ON ci.comparison_id = c.id
  GROUP BY c.id, c.organization_id, c.record_id, c.comparison_name, c.created_by, c.created_at;

DROP VIEW IF EXISTS public.group_contact_counts;
CREATE VIEW public.group_contact_counts WITH (security_invoker = on) AS
 SELECT g.id AS group_id,
    g.organization_id,
    g.group_name,
    g.group_type,
    g.color,
    g.icon,
    g.is_system,
    g.is_active,
    g.display_order,
    count(gm.id) AS member_count
   FROM crm_contact_groups g
     LEFT JOIN crm_contact_group_members gm ON gm.group_id = g.id
  GROUP BY g.id, g.organization_id, g.group_name, g.group_type, g.color, g.icon, g.is_system, g.is_active, g.display_order;

DROP VIEW IF EXISTS public.lifecycle_org_stats;
CREATE VIEW public.lifecycle_org_stats WITH (security_invoker = on) AS
 SELECT organization_id,
    count(DISTINCT contact_id) AS total_tracked_members,
    count(DISTINCT contact_id) FILTER (WHERE event_type = 'enrolled'::text AND event_date >= date_trunc('month'::text, now())) AS enrolled_this_month,
    count(DISTINCT contact_id) FILTER (WHERE event_type = 'cancelled'::text AND event_date >= date_trunc('month'::text, now())) AS cancelled_this_month,
    count(DISTINCT contact_id) FILTER (WHERE event_type = 'returned'::text) AS total_returned,
        CASE
            WHEN count(id) FILTER (WHERE event_type = 'enrolled'::text AND event_date >= (now() - '1 year'::interval)) > 0 THEN round(count(id) FILTER (WHERE event_type = 'cancelled'::text AND event_date >= (now() - '1 year'::interval))::numeric / count(id) FILTER (WHERE event_type = 'enrolled'::text AND event_date >= (now() - '1 year'::interval))::numeric * 100::numeric, 1)
            ELSE 0::numeric
        END AS churn_rate_12m,
    ( SELECT le.reason
           FROM member_lifecycle_events le
          WHERE le.organization_id = e.organization_id AND le.event_type = 'cancelled'::text
          GROUP BY le.reason
          ORDER BY (count(*)) DESC
         LIMIT 1) AS top_cancel_reason
   FROM member_lifecycle_events e
  GROUP BY organization_id;

DROP VIEW IF EXISTS public.medicaid_dashboard_stats;
CREATE VIEW public.medicaid_dashboard_stats WITH (security_invoker = on) AS
 SELECT org_id AS organization_id,
    count(id) FILTER (WHERE is_medicaid = true) AS total_medicaid_members,
    count(id) FILTER (WHERE is_medicaid = true AND medicaid_end_date IS NULL) AS active_medicaid,
    count(id) FILTER (WHERE is_medicaid = true AND medicaid_end_date IS NOT NULL) AS former_medicaid,
    count(id) FILTER (WHERE is_medicaid = true AND medicaid_end_date IS NOT NULL AND medicaid_end_date >= (now() - '90 days'::interval)) AS transitioning_from_medicaid,
    count(id) FILTER (WHERE is_medicaid = true AND medicaid_start_date >= date_trunc('month'::text, now())) AS new_medicaid_this_month
   FROM crm_records r
  GROUP BY org_id;

DROP VIEW IF EXISTS public.medicaid_state_breakdown;
CREATE VIEW public.medicaid_state_breakdown WITH (security_invoker = on) AS
 SELECT org_id AS organization_id,
    medicaid_state AS state,
    count(id) AS total,
    count(id) FILTER (WHERE medicaid_end_date IS NULL) AS active,
    count(id) FILTER (WHERE medicaid_end_date IS NOT NULL AND medicaid_end_date >= (now() - '90 days'::interval)) AS transitioning
   FROM crm_records r
  WHERE is_medicaid = true AND medicaid_state IS NOT NULL
  GROUP BY org_id, medicaid_state;

DROP VIEW IF EXISTS public.member_history_summary;
CREATE VIEW public.member_history_summary WITH (security_invoker = on) AS
 SELECT e.contact_id,
    e.organization_id,
    r.title AS contact_name,
    r.email AS contact_email,
    count(e.id) AS total_events,
    count(e.id) FILTER (WHERE e.event_type = 'enrolled'::text) AS enroll_count,
    count(e.id) FILTER (WHERE e.event_type = 'cancelled'::text) AS cancel_count,
    count(e.id) FILTER (WHERE e.event_type = 'returned'::text) AS return_count,
    count(e.id) FILTER (WHERE e.event_type = 'paused'::text) AS pause_count,
    min(e.event_date) FILTER (WHERE e.event_type = 'enrolled'::text) AS first_enrolled,
    max(e.event_date) AS last_event_date,
    ( SELECT le.event_type
           FROM member_lifecycle_events le
          WHERE le.contact_id = e.contact_id
          ORDER BY le.event_date DESC, le.created_at DESC
         LIMIT 1) AS current_status,
    ( SELECT le.reason
           FROM member_lifecycle_events le
          WHERE le.contact_id = e.contact_id AND le.event_type = 'cancelled'::text
          GROUP BY le.reason
          ORDER BY (count(*)) DESC
         LIMIT 1) AS top_cancel_reason
   FROM member_lifecycle_events e
     JOIN crm_records r ON r.id = e.contact_id
  GROUP BY e.contact_id, e.organization_id, r.title, r.email;


-- ----------------------------------------------------------------------------
-- 2. Rewrite RLS policies to use (SELECT auth.fn()) for plan caching
-- ----------------------------------------------------------------------------
ALTER POLICY "messages_insert" ON public.channel_messages
    WITH CHECK ((sender_id = (SELECT auth.uid())));
ALTER POLICY "advisor_carriers_delete_own" ON public.crm_advisor_carriers
    USING ((user_id = (SELECT auth.uid())));
ALTER POLICY "advisor_carriers_insert_own" ON public.crm_advisor_carriers
    WITH CHECK (((user_id = (SELECT auth.uid())) AND is_crm_member(organization_id)));
ALTER POLICY "advisor_carriers_select_own" ON public.crm_advisor_carriers
    USING ((user_id = (SELECT auth.uid())));
ALTER POLICY "advisor_carriers_update_own" ON public.crm_advisor_carriers
    USING ((user_id = (SELECT auth.uid())))
  WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY "crm_advisors_select_member" ON public.crm_advisors
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (SELECT auth.uid())) AND (profiles.organization_id = crm_advisors.organization_id)))));
ALTER POLICY "crm_dup_dismissals_delete" ON public.crm_duplicate_dismissals
    USING ((org_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.user_id = (SELECT auth.uid())) AND (profiles.crm_role = ANY (ARRAY['crm_admin'::text, 'crm_manager'::text]))))));
ALTER POLICY "crm_dup_dismissals_insert" ON public.crm_duplicate_dismissals
    WITH CHECK ((org_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.user_id = (SELECT auth.uid())) AND (profiles.crm_role = ANY (ARRAY['crm_admin'::text, 'crm_manager'::text]))))));
ALTER POLICY "crm_dup_dismissals_select" ON public.crm_duplicate_dismissals
    USING ((org_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.user_id = (SELECT auth.uid())) AND (profiles.crm_role IS NOT NULL)))));
ALTER POLICY "crm_feature_flags_admin_write" ON public.crm_feature_flags
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (SELECT auth.uid())) AND (profiles.crm_role = 'crm_admin'::text) AND ((crm_feature_flags.organization_id IS NULL) OR (crm_feature_flags.organization_id = profiles.organization_id))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (SELECT auth.uid())) AND (profiles.crm_role = 'crm_admin'::text) AND ((crm_feature_flags.organization_id IS NULL) OR (crm_feature_flags.organization_id = profiles.organization_id))))));
ALTER POLICY "crm_feature_flags_select" ON public.crm_feature_flags
    USING (((organization_id IS NULL) OR (organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.user_id = (SELECT auth.uid()))))));
ALTER POLICY "crm_idempotency_keys_org_read" ON public.crm_idempotency_keys
    USING ((organization_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.user_id = (SELECT auth.uid())))));
ALTER POLICY "crm_recently_viewed_delete_own" ON public.crm_recently_viewed
    USING ((user_id = (SELECT auth.uid())));
ALTER POLICY "crm_recently_viewed_insert_own" ON public.crm_recently_viewed
    WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY "crm_recently_viewed_select_own" ON public.crm_recently_viewed
    USING ((user_id = (SELECT auth.uid())));
ALTER POLICY "crm_recently_viewed_update_own" ON public.crm_recently_viewed
    USING ((user_id = (SELECT auth.uid())))
  WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY "crm_record_links_org_access" ON public.crm_record_links
    USING ((org_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.user_id = (SELECT auth.uid())))));
ALTER POLICY "crm_report_filters_delete" ON public.crm_report_filters
    USING (((created_by = (SELECT auth.uid())) OR (org_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = (SELECT auth.uid())) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));
ALTER POLICY "crm_report_filters_insert" ON public.crm_report_filters
    WITH CHECK ((org_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "crm_report_filters_select" ON public.crm_report_filters
    USING ((org_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "crm_report_filters_update" ON public.crm_report_filters
    USING (((created_by = (SELECT auth.uid())) OR (org_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE ((profiles.id = (SELECT auth.uid())) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));
ALTER POLICY "report_cache_delete" ON public.crm_report_results_cache
    USING ((org_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "report_cache_insert" ON public.crm_report_results_cache
    WITH CHECK ((org_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "report_cache_select" ON public.crm_report_results_cache
    USING ((org_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Users can delete own preferences" ON public.crm_user_preferences
    USING (((org_id = ( SELECT get_user_organization_id() AS get_user_organization_id)) AND (user_id = ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (SELECT auth.uid()))
 LIMIT 1))));
ALTER POLICY "Users can insert own preferences" ON public.crm_user_preferences
    WITH CHECK (((org_id = ( SELECT get_user_organization_id() AS get_user_organization_id)) AND (user_id = ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (SELECT auth.uid()))
 LIMIT 1))));
ALTER POLICY "Users can update own preferences" ON public.crm_user_preferences
    USING (((org_id = ( SELECT get_user_organization_id() AS get_user_organization_id)) AND (user_id = ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (SELECT auth.uid()))
 LIMIT 1))));
ALTER POLICY "visitor_sessions_org_access" ON public.crm_visitor_sessions
    USING ((org_id IN ( SELECT profiles.organization_id
   FROM profiles
  WHERE (profiles.user_id = (SELECT auth.uid())))));
ALTER POLICY "daily_log_reports_insert" ON public.daily_log_reports
    WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY "knowledge_versions_insert" ON public.knowledge_versions
    WITH CHECK ((created_by = (SELECT auth.uid())));
ALTER POLICY "org_members_select_self_or_admin" ON public.organization_members
    USING (((user_id = (SELECT auth.uid())) OR (user_role_in(organization_id) = ANY (ARRAY['owner'::text, 'super_admin'::text, 'admin'::text]))));
ALTER POLICY "org_members_update_self" ON public.organization_members
    USING ((user_id = (SELECT auth.uid())))
  WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY "organizations_insert_authenticated" ON public.organizations
    WITH CHECK ((((SELECT auth.uid()) IS NOT NULL) AND ((owner_user_id IS NULL) OR (owner_user_id = (SELECT auth.uid())))));
ALTER POLICY "plan_benefit_matrix_admin_write" ON public.plan_benefit_matrix
    USING ((EXISTS ( SELECT 1
   FROM (plans p
     JOIN profiles pr ON ((pr.organization_id = p.organization_id)))
  WHERE ((p.id = plan_benefit_matrix.plan_id) AND (pr.user_id = (SELECT auth.uid())) AND (get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text]))))));
ALTER POLICY "plan_benefit_matrix_auth_read" ON public.plan_benefit_matrix
    USING ((EXISTS ( SELECT 1
   FROM (plans p
     JOIN profiles pr ON ((pr.organization_id = p.organization_id)))
  WHERE ((p.id = plan_benefit_matrix.plan_id) AND (pr.user_id = (SELECT auth.uid()))))));
ALTER POLICY "plan_hs_config_admin_write" ON public.plan_healthshare_config
    USING ((EXISTS ( SELECT 1
   FROM (plans p
     JOIN profiles pr ON ((pr.organization_id = p.organization_id)))
  WHERE ((p.id = plan_healthshare_config.plan_id) AND (pr.user_id = (SELECT auth.uid())) AND (get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text]))))));
ALTER POLICY "plan_hs_config_auth_read" ON public.plan_healthshare_config
    USING ((EXISTS ( SELECT 1
   FROM (plans p
     JOIN profiles pr ON ((pr.organization_id = p.organization_id)))
  WHERE ((p.id = plan_healthshare_config.plan_id) AND (pr.user_id = (SELECT auth.uid()))))));
ALTER POLICY "plan_rates_admin_write" ON public.plan_rates
    USING ((EXISTS ( SELECT 1
   FROM (plans p
     JOIN profiles pr ON ((pr.organization_id = p.organization_id)))
  WHERE ((p.id = plan_rates.plan_id) AND (pr.user_id = (SELECT auth.uid())) AND (get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text]))))));
ALTER POLICY "plan_rates_auth_read" ON public.plan_rates
    USING ((EXISTS ( SELECT 1
   FROM (plans p
     JOIN profiles pr ON ((pr.organization_id = p.organization_id)))
  WHERE ((p.id = plan_rates.plan_id) AND (pr.user_id = (SELECT auth.uid()))))));
ALTER POLICY "plan_trad_config_admin_write" ON public.plan_traditional_config
    USING ((EXISTS ( SELECT 1
   FROM (plans p
     JOIN profiles pr ON ((pr.organization_id = p.organization_id)))
  WHERE ((p.id = plan_traditional_config.plan_id) AND (pr.user_id = (SELECT auth.uid())) AND (get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text]))))));
ALTER POLICY "plan_trad_config_auth_read" ON public.plan_traditional_config
    USING ((EXISTS ( SELECT 1
   FROM (plans p
     JOIN profiles pr ON ((pr.organization_id = p.organization_id)))
  WHERE ((p.id = plan_traditional_config.plan_id) AND (pr.user_id = (SELECT auth.uid()))))));
ALTER POLICY "plan_versions_admin_write" ON public.plan_versions
    USING ((EXISTS ( SELECT 1
   FROM (plans p
     JOIN profiles pr ON ((pr.organization_id = p.organization_id)))
  WHERE ((p.id = plan_versions.plan_id) AND (pr.user_id = (SELECT auth.uid())) AND (get_user_role() = ANY (ARRAY['owner'::text, 'admin'::text]))))));
ALTER POLICY "plan_versions_auth_read" ON public.plan_versions
    USING ((EXISTS ( SELECT 1
   FROM (plans p
     JOIN profiles pr ON ((pr.organization_id = p.organization_id)))
  WHERE ((p.id = plan_versions.plan_id) AND (pr.user_id = (SELECT auth.uid()))))));
ALTER POLICY "advisors_see_capacity_products" ON public.products
    USING (((product_type IS NULL) OR (EXISTS ( SELECT 1
   FROM (advisors a
     JOIN profiles p ON ((p.id = a.profile_id)))
  WHERE ((p.user_id = (SELECT auth.uid())) AND (a.organization_id = products.organization_id) AND ((a.capacities = '{}'::text[]) OR (a.capacities IS NULL) OR (products.product_type = ANY (a.capacities)))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = (SELECT auth.uid())) AND (p.organization_id = products.organization_id) AND (p.role = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])))))));
ALTER POLICY "Users can manage own views" ON public.saved_views
    USING ((user_id = (SELECT auth.uid())))
  WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY "team_activities_insert" ON public.team_activities
    WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY "ticket_field_history_insert" ON public.ticket_field_history
    WITH CHECK ((changed_by = (SELECT auth.uid())));
ALTER POLICY "ticket_files_insert" ON public.ticket_files
    WITH CHECK ((uploaded_by = (SELECT auth.uid())));

-- 48 policies rewritten

NOTIFY pgrst, 'reload schema';

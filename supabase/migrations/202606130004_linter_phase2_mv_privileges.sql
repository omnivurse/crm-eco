-- Phase 2: Supabase linter — revoke direct API access to materialized views
-- Linter: materialized_view_in_api (4 views)
-- Apps access these via SECURITY DEFINER RPCs (get_executive_kpis, etc.), not direct .from()
-- Risk: LOW if no client code selects MVs directly (verified in repo)
-- Rollback: GRANT SELECT ON <mv> TO authenticated;

BEGIN;

REVOKE ALL ON TABLE public.mv_org_monthly_dashboard FROM anon, authenticated;
REVOKE ALL ON TABLE public.mv_advisor_monthly_performance FROM anon, authenticated;
REVOKE ALL ON TABLE public.executive_top_advisor_mv FROM anon, authenticated;
REVOKE ALL ON TABLE public.executive_kpi_mv FROM anon, authenticated;

-- Preserve service_role / postgres access for refresh jobs and RPCs
GRANT SELECT ON TABLE public.mv_org_monthly_dashboard TO service_role;
GRANT SELECT ON TABLE public.mv_advisor_monthly_performance TO service_role;
GRANT SELECT ON TABLE public.executive_top_advisor_mv TO service_role;
GRANT SELECT ON TABLE public.executive_kpi_mv TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
